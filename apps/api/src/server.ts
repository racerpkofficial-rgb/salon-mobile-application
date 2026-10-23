import mongoose from 'mongoose';
import { app } from './application.js';
import { env } from './config/env.js';
import { seedSuperAdmin } from './services/admin-seed.service.js';
import { emailService } from './services/email.service.js';
import { syncAllSalonRatings } from './services/review.service.js';

async function start() {
  await mongoose.connect(env.MONGODB_URI);
  await seedSuperAdmin();
  await syncAllSalonRatings().catch((err) => console.warn('[ReviewService] Rating sync error:', err));

  // Validate and log safe email service configuration on startup
  const emailValidation = emailService.validateConfig();
  if (emailValidation.isConfigured) {
    console.log(
      `[EmailService] SMTP configured (${emailValidation.safeSummary.host}:${emailValidation.safeSummary.port}, sender: ${emailValidation.safeSummary.from}). Verifying connection...`
    );
    emailService
      .verifyConnection()
      .then((res) => {
        if (res.ok) {
          console.log(`[EmailService] ✓ ${res.message}`);
        } else {
          console.warn(`[EmailService] ⚠ SMTP connection warning: ${res.message}`);
        }
      })
      .catch((err) => {
        console.warn(`[EmailService] ⚠ SMTP connection error: ${(err as Error).message}`);
      });
  } else {
    console.log(
      `[EmailService] ℹ SMTP is unconfigured (missing: ${emailValidation.missingFields.join(', ')}). Password recovery self-service will return 503 until SMTP variables are configured in apps/api/.env.`
    );
  }

  app.listen(env.PORT, () => console.log(`Book My Salon API listening on ${env.PORT}`));
}

start().catch((error) => {
  console.error('Unable to start API', error);
  process.exit(1);
});