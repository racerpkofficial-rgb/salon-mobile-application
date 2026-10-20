import express from 'express';
import mongoose from 'mongoose';
import { app } from './src/application.js';
import { env } from './src/config/env.js';
import { seedSuperAdmin } from './src/services/admin-seed.service.js';

const vercelApp = express();
let databaseInitialization: Promise<void> | undefined;

mongoose.connection.on('disconnected', () => {
  databaseInitialization = undefined;
});

function initializeDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    return Promise.resolve();
  }

  if (!databaseInitialization) {
    databaseInitialization = mongoose
      .connect(env.MONGODB_URI)
      .then(async () => {
        await seedSuperAdmin();
      })
      .catch((error: unknown) => {
        databaseInitialization = undefined;
        throw error;
      });
  }

  return databaseInitialization;
}

vercelApp.use(async (_req, res, next) => {
  try {
    await initializeDatabase();
    next();
  } catch (error) {
    console.error('Unable to initialize API request', error);
    res.status(503).json({ message: 'API temporarily unavailable' });
  }
});

vercelApp.use(app);

export default vercelApp;
