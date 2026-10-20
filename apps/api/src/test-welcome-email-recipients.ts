import mongoose, { Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { app } from './application.js';
import { env } from './config/env.js';
import { User } from './models/User.js';
import { Salon } from './models/Salon.js';
import { EmailLog } from './models/EmailLog.js';
import { emailService } from './services/email.service.js';

interface TestResult {
  testNumber: number;
  description: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function record(testNumber: number, description: string, passed: boolean, details: string) {
  results.push({ testNumber, description, passed, details });
  const icon = passed ? '✓ PASS' : '✗ FAIL';
  console.log(`[${icon}] Case ${testNumber}: ${description}`);
  console.log(`       Details: ${details}\n`);
}

async function runWelcomeEmailRecipientTestSuite() {
  console.log('========================================================================');
  console.log('   BOOKMY SALON WELCOME EMAIL RECIPIENT & ADMIN SEPARATION TEST SUITE  ');
  console.log('========================================================================\n');

  await mongoose.connect(env.MONGODB_URI);

  const server = app.listen(0);
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

  const ts = Date.now();
  const createdUserIds: Types.ObjectId[] = [];
  const createdSalonIds: Types.ObjectId[] = [];

  const ADMIN_EMAIL = 'bookmysalonadmin@gmail.com';

  let capturedEmails: Array<{ to: string; subject: string; text: string; html?: string }> = [];
  emailService.setMockSender(async (opts) => {
    capturedEmails.push(opts);
  });

  try {
    // -------------------------------------------------------------------------
    // TEST CASE 1: New customer registration -> Welcome email goes to customer
    // -------------------------------------------------------------------------
    capturedEmails = [];
    const customerEmail = `customer_case1_${ts}@example.com`;
    const customerName = 'Deepika Padukone';

    const regCustRes = await fetch(`${baseUrl}/auth/register/customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: customerName,
        email: customerEmail,
        password: 'SecurePassword123!',
        phone: '9876500001'
      })
    });

    const regCustData = await regCustRes.json();
    if (regCustData.user?.id) createdUserIds.push(new Types.ObjectId(regCustData.user.id));

    const custWelcomeEmail = capturedEmails.find(
      (m) => m.to.toLowerCase() === customerEmail.toLowerCase() && m.subject.includes('Welcome')
    );
    const custAdminEmailLeak = capturedEmails.some(
      (m) => m.to.toLowerCase() === ADMIN_EMAIL.toLowerCase()
    );

    const case1Passed =
      regCustRes.status === 201 &&
      Boolean(custWelcomeEmail) &&
      custWelcomeEmail?.subject === 'Welcome to BookMy Salon!' &&
      custWelcomeEmail.to.toLowerCase() === customerEmail.toLowerCase() &&
      !custAdminEmailLeak;

    record(
      1,
      'New customer registers → Welcome email goes to that customer’s email',
      case1Passed,
      `Status: ${regCustRes.status}, Recipient: "${custWelcomeEmail?.to}", Subject: "${custWelcomeEmail?.subject}", Admin Leak: ${custAdminEmailLeak}`
    );

    // -------------------------------------------------------------------------
    // TEST CASE 2: New salon owner registration -> Welcome email goes to owner
    // -------------------------------------------------------------------------
    capturedEmails = [];
    const ownerEmail = `owner_case2_${ts}@example.com`;
    const ownerName = 'Vikramaditya Salon Partner';

    const regOwnerRes = await fetch(`${baseUrl}/auth/register/salon-owner`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: ownerName,
        email: ownerEmail,
        password: 'OwnerPassword123!',
        phone: '9876500002',
        salonName: 'Luxe Hair & Spa Residency',
        address: '42 Royal Crescent',
        city: 'Chennai',
        state: 'Tamil Nadu',
        identityProof: {
          url: 'https://res.cloudinary.com/demo/image/upload/id_proof.pdf',
          filename: 'gov_id.pdf',
          fileType: 'application/pdf',
          fileSize: 1024 * 200
        }
      })
    });

    const regOwnerData = await regOwnerRes.json();
    if (regOwnerData.user?.id) createdUserIds.push(new Types.ObjectId(regOwnerData.user.id));
    if (regOwnerData.salon?.id) createdSalonIds.push(new Types.ObjectId(regOwnerData.salon.id));

    const ownerWelcomeEmail = capturedEmails.find(
      (m) => m.to.toLowerCase() === ownerEmail.toLowerCase() && m.subject === 'Welcome to BookMy Salon!'
    );
    const ownerAdminEmailLeak = capturedEmails.some(
      (m) => m.to.toLowerCase() === ADMIN_EMAIL.toLowerCase()
    );

    const case2Passed =
      regOwnerRes.status === 201 &&
      Boolean(ownerWelcomeEmail) &&
      ownerWelcomeEmail?.subject === 'Welcome to BookMy Salon!' &&
      ownerWelcomeEmail.to.toLowerCase() === ownerEmail.toLowerCase() &&
      !ownerAdminEmailLeak;

    record(
      2,
      'New salon owner registers → Welcome email goes to that owner’s email',
      case2Passed,
      `Status: ${regOwnerRes.status}, Recipient: "${ownerWelcomeEmail?.to}", Subject: "${ownerWelcomeEmail?.subject}", Admin Leak: ${ownerAdminEmailLeak}`
    );

    // -------------------------------------------------------------------------
    // TEST CASE 3: Existing customer logs in -> Welcome Back email to customer
    // -------------------------------------------------------------------------
    capturedEmails = [];
    const custLoginRes = await fetch(`${baseUrl}/auth/customer/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: customerEmail,
        password: 'SecurePassword123!'
      })
    });

    const custLoginData = await custLoginRes.json();
    const custWelcomeBack = capturedEmails.find(
      (m) => m.to.toLowerCase() === customerEmail.toLowerCase() && m.subject === 'Welcome Back to BookMy Salon!'
    );
    const custLoginAdminLeak = capturedEmails.some(
      (m) => m.to.toLowerCase() === ADMIN_EMAIL.toLowerCase()
    );

    const case3Passed =
      custLoginRes.status === 200 &&
      Boolean(custLoginData.token) &&
      Boolean(custWelcomeBack) &&
      custWelcomeBack?.subject === 'Welcome Back to BookMy Salon!' &&
      custWelcomeBack.to.toLowerCase() === customerEmail.toLowerCase() &&
      !custLoginAdminLeak;

    record(
      3,
      'Existing customer logs in → Welcome Back email goes to customer’s registered email',
      case3Passed,
      `Status: ${custLoginRes.status}, Recipient: "${custWelcomeBack?.to}", Subject: "${custWelcomeBack?.subject}", Admin Leak: ${custLoginAdminLeak}`
    );

    // -------------------------------------------------------------------------
    // TEST CASE 4: Existing salon owner logs in -> Welcome Back email to owner
    // -------------------------------------------------------------------------
    capturedEmails = [];
    const ownerLoginRes = await fetch(`${baseUrl}/auth/salon-owner/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: ownerEmail,
        password: 'OwnerPassword123!'
      })
    });

    const ownerLoginData = await ownerLoginRes.json();
    const ownerWelcomeBack = capturedEmails.find(
      (m) => m.to.toLowerCase() === ownerEmail.toLowerCase() && m.subject === 'Welcome Back to BookMy Salon!'
    );
    const ownerLoginAdminLeak = capturedEmails.some(
      (m) => m.to.toLowerCase() === ADMIN_EMAIL.toLowerCase()
    );

    const case4Passed =
      ownerLoginRes.status === 200 &&
      Boolean(ownerLoginData.token) &&
      Boolean(ownerWelcomeBack) &&
      ownerWelcomeBack?.subject === 'Welcome Back to BookMy Salon!' &&
      ownerWelcomeBack.to.toLowerCase() === ownerEmail.toLowerCase() &&
      !ownerLoginAdminLeak;

    record(
      4,
      'Existing salon owner logs in → Welcome Back email goes to owner’s registered email',
      case4Passed,
      `Status: ${ownerLoginRes.status}, Recipient: "${ownerWelcomeBack?.to}", Subject: "${ownerWelcomeBack?.subject}", Admin Leak: ${ownerLoginAdminLeak}`
    );

    // -------------------------------------------------------------------------
    // TEST CASE 5: Admin logs in -> No customer Welcome Back email sent to admin
    // -------------------------------------------------------------------------
    capturedEmails = [];
    const adminPasswordHash = await bcrypt.hash('SuperAdminPassword123!', 10);
    const adminUserEmail = `super_admin_test_${ts}@example.com`;
    const adminUser = await User.create({
      name: 'Super System Administrator',
      email: adminUserEmail,
      passwordHash: adminPasswordHash,
      role: 'SUPER_ADMIN',
      isActive: true
    });
    createdUserIds.push(adminUser._id);

    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: adminUserEmail,
        password: 'SuperAdminPassword123!'
      })
    });

    const adminLoginData = await adminLoginRes.json();
    const welcomeEmailsSentDuringAdminLogin = capturedEmails.filter((m) =>
      m.subject.includes('Welcome')
    );

    const case5Passed =
      adminLoginRes.status === 200 &&
      Boolean(adminLoginData.token) &&
      welcomeEmailsSentDuringAdminLogin.length === 0;

    record(
      5,
      'Admin logs in → No customer Welcome Back email is sent to admin address',
      case5Passed,
      `Status: ${adminLoginRes.status}, Welcome Emails Sent: ${welcomeEmailsSentDuringAdminLogin.length} (Expected 0)`
    );

    // -------------------------------------------------------------------------
    // TEST CASE 6: SMTP fails -> Auth & registration remain correct, error logged
    // -------------------------------------------------------------------------
    // Simulate SMTP network / server failure
    emailService.setMockSender(async () => {
      throw new Error('SMTP connection failure: ETIMEDOUT 142.250.190.108:587');
    });

    const smtpFailCustEmail = `smtp_fail_cust_${ts}@example.com`;

    // 6A. Registration with SMTP failure
    const failRegRes = await fetch(`${baseUrl}/auth/register/customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Resilient Customer',
        email: smtpFailCustEmail,
        password: 'SecurePassword123!',
        phone: '9876500003'
      })
    });

    const failRegData = await failRegRes.json();
    if (failRegData.user?.id) createdUserIds.push(new Types.ObjectId(failRegData.user.id));

    // Verify user was successfully created despite email failure
    const dbUserExists = await User.exists({ email: smtpFailCustEmail });

    // 6B. Login with SMTP failure
    const failLoginRes = await fetch(`${baseUrl}/auth/customer/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: smtpFailCustEmail,
        password: 'SecurePassword123!'
      })
    });

    const failLoginData = await failLoginRes.json();

    // Check that email log recorded FAILED status
    const failEmailLog = await EmailLog.findOne({
      recipientEmail: smtpFailCustEmail,
      eventType: 'CUSTOMER_WELCOME'
    });

    const case6Passed =
      failRegRes.status === 201 &&
      Boolean(failRegData.token) &&
      Boolean(dbUserExists) &&
      failLoginRes.status === 200 &&
      Boolean(failLoginData.token) &&
      failEmailLog?.status === 'FAILED';

    record(
      6,
      'SMTP fails → Authentication and registration remain correct, email failure logged safely',
      case6Passed,
      `Reg Status: ${failRegRes.status}, Login Status: ${failLoginRes.status}, DB Created: ${Boolean(dbUserExists)}, EmailLog Status: "${failEmailLog?.status}"`
    );

  } finally {
    // Restore mock state
    emailService.clearTestState();

    // Clean up test records
    console.log('Cleaning up test documents from database...');
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
      await EmailLog.deleteMany({ referenceId: { $in: createdUserIds } });
    }
    if (createdSalonIds.length > 0) {
      await Salon.deleteMany({ _id: { $in: createdSalonIds } });
    }

    server.close();
    await mongoose.disconnect();
  }

  // Summary
  const allPassed = results.every((r) => r.passed);
  console.log('========================================================================');
  console.log(
    `RESULTS: ${results.filter((r) => r.passed).length}/${results.length} PASSED ${
      allPassed ? '🎉 ALL TESTS PASSED' : '❌ SOME TESTS FAILED'
    }`
  );
  console.log('========================================================================\n');

  if (!allPassed) {
    process.exit(1);
  }
}

runWelcomeEmailRecipientTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
