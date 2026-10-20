
import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({
  path: path.resolve(process.cwd(), 'apps/api/.env'),
});
import mongoose from 'mongoose';
import { EJSON } from 'bson';
import fs from 'node:fs/promises';
import path from 'node:path';

const DRY_RUN = process.env.CLEANUP_DRY_RUN !== 'false';
const CONFIRM = process.env.CLEANUP_CONFIRM;
const ADMIN_ROLE = 'SUPER_ADMIN';

// Keep core subscription-plan/configuration collections.
// All other non-user collections are included in the cleanup.
const PRESERVE_COLLECTIONS = new Set([
  'users',
  'plans',
  'subscriptionplans',
]);

async function main() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI is missing. Check apps/api/.env');
  }

  if (!DRY_RUN && CONFIRM !== 'DELETE_TEST_DATA') {
    throw new Error(
      'Deletion blocked. Set CLEANUP_CONFIRM=DELETE_TEST_DATA to proceed.'
    );
  }

  await mongoose.connect(uri);

  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB database connection unavailable.');

  const databaseName = db.databaseName;

  console.log('\nDatabase:', databaseName);
  console.log('Mode:', DRY_RUN ? 'DRY RUN — NO DELETION' : 'DELETE MODE');

  if (!DRY_RUN) {
    console.log('\nDeletion explicitly requested.');
  }

  const collections = await db.listCollections().toArray();

  // Require the expected user collection before proceeding.
  const userCollection = collections.find(
    (c) => c.name.toLowerCase() === 'users'
  );

  if (!userCollection) {
    throw new Error(
      'Could not find the users collection. Nothing was deleted.'
    );
  }

  const backupDir = path.resolve(
    process.cwd(),
    'backups',
    `aurelia-cleanup-${new Date().toISOString().replace(/[:.]/g, '-')}`
  );

  // Snapshot every collection before any destructive operation.
  await fs.mkdir(backupDir, { recursive: true });

  const snapshots: Array<{
    name: string;
    count: number;
    docs: any[];
  }> = [];

  for (const info of collections) {
    const collection = db.collection(info.name);
    const docs = await collection.find({}).toArray();

    snapshots.push({
      name: info.name,
      count: docs.length,
      docs,
    });

    const backupFile = path.join(backupDir, `${info.name}.ejson`);
    await fs.writeFile(
      backupFile,
      EJSON.stringify(docs, null, 2),
      'utf8'
    );

    console.log(`Backup: ${info.name} — ${docs.length} records`);
  }

  // Verify that every collection backup was written and is readable.
  for (const snapshot of snapshots) {
    const backupFile = path.join(backupDir, `${snapshot.name}.ejson`);
    const saved = await fs.readFile(backupFile, 'utf8');
    const parsed = EJSON.parse(saved);

    if (!Array.isArray(parsed) || parsed.length !== snapshot.count) {
      throw new Error(
        `Backup verification failed for ${snapshot.name}. Deletion stopped.`
      );
    }
  }

  console.log('\nBackup verified:', backupDir);

  const userSnapshot = snapshots.find((s) => s.name === userCollection.name)!;
  const adminUsers = userSnapshot.docs.filter(
    (user) => String(user.role ?? '').toUpperCase() === ADMIN_ROLE
  );

  console.log('SUPER_ADMIN accounts to preserve:', adminUsers.length);

  if (adminUsers.length === 0) {
    throw new Error(
      'No SUPER_ADMIN found. Cleanup stopped to protect admin access.'
    );
  }

  const operations: Array<{ name: string; count: number }> = [];

  for (const snapshot of snapshots) {
    if (PRESERVE_COLLECTIONS.has(snapshot.name.toLowerCase())) {
      if (snapshot.name.toLowerCase() === 'users') {
        const nonAdminCount = snapshot.docs.filter(
          (user) => String(user.role ?? '').toUpperCase() !== ADMIN_ROLE
        ).length;

        operations.push({
          name: snapshot.name,
          count: nonAdminCount,
        });
      }
      continue;
    }

    operations.push({
      name: snapshot.name,
      count: snapshot.count,
    });
  }

  console.log('\n--- CLEANUP SUMMARY ---');
  for (const op of operations) {
    console.log(`${op.name}: ${op.count} record(s)`);
  }

  if (DRY_RUN) {
    console.log('\nDRY RUN complete. No records were deleted.');
    console.log('Review the collections and backup before proceeding.');
    return;
  }

  // Delete related records first, then remove non-admin users.
  for (const op of operations) {
    if (op.name.toLowerCase() === 'users') continue;

    const result = await db.collection(op.name).deleteMany({});
    console.log(`Cleared ${op.name}: ${result.deletedCount ?? 0}`);
  }

  const userResult = await db.collection(userCollection.name).deleteMany({
    $expr: {
      $ne: [{ $toUpper: { $ifNull: ['$role', ''] } }, ADMIN_ROLE],
    },
  });

  console.log(`Deleted non-admin users: ${userResult.deletedCount ?? 0}`);

  const remainingAdmins = await db.collection(userCollection.name).countDocuments({
    $expr: {
      $eq: [{ $toUpper: { $ifNull: ['$role', ''] } }, ADMIN_ROLE],
    },
  });

  if (remainingAdmins === 0) {
    throw new Error(
      'CRITICAL: No SUPER_ADMIN remains. Restore from the verified backup.'
    );
  }

  console.log('\nCleanup completed.');
  console.log('Remaining SUPER_ADMIN accounts:', remainingAdmins);
  console.log('Backup location:', backupDir);
}

main()
  .catch((error) => {
    console.error('\nCleanup failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });