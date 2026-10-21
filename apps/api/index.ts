import express from 'express';
import mongoose from 'mongoose';
import { app } from './src/application.js';
import { env } from './src/config/env.js';
import { seedSuperAdmin } from './src/services/admin-seed.service.js';

const vercelApp = express();
let databaseInitialization: Promise<void> | undefined;
let adminSeedInitialization: Promise<void> | undefined;

console.info('[API] Vercel handler module loaded');

function getSafeErrorSummary(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'UnknownError';
  }
  return error.name;
}

mongoose.connection.on('disconnected', () => {
  console.warn('[API] MongoDB disconnected');
  databaseInitialization = undefined;
  adminSeedInitialization = undefined;
});

mongoose.connection.on('connected', () => {
  console.info('[API] MongoDB connected');
});

mongoose.connection.on('error', (error: unknown) => {
  console.error(`[API] MongoDB connection error (${getSafeErrorSummary(error)})`);
});

function connectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    return Promise.resolve();
  }

  if (!databaseInitialization) {
    console.info('[API] MongoDB connection attempt started');
    databaseInitialization = mongoose
      .connect(env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5_000,
        connectTimeoutMS: 5_000
      })
      .then(() => undefined)
      .catch((error: unknown) => {
        databaseInitialization = undefined;
        console.error(
          `[API] MongoDB connection attempt failed (${getSafeErrorSummary(error)}; readyState=${mongoose.connection.readyState})`
        );
        throw error;
      });
  }

  return databaseInitialization;
}

function initializeDatabase(): Promise<void> {
  if (!adminSeedInitialization) {
    adminSeedInitialization = connectDatabase()
      .then(() => seedSuperAdmin())
      .catch((error: unknown) => {
        adminSeedInitialization = undefined;
        throw error;
      });
  }

  return adminSeedInitialization;
}

vercelApp.get('/health', async (_req, res) => {
  try {
    await connectDatabase();
    res.status(200).json({
      status: 'ok',
      database: 'connected'
    });
  } catch (error) {
    console.error(
      `[API] Health check database connection failed (${getSafeErrorSummary(error)})`
    );
    res.status(503).json({
      status: 'unavailable',
      database: 'disconnected'
    });
  }
});

vercelApp.use(async (_req, res, next) => {
  try {
    await initializeDatabase();
    next();
  } catch (error) {
    console.error(`Unable to initialize API request: ${getSafeErrorSummary(error)}`);
    res.status(503).json({ message: 'API temporarily unavailable' });
  }
});

vercelApp.use(app);

export default vercelApp;
