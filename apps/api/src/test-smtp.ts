import { emailService } from './services/email.service.js';

async function main() {
  console.log('=== BOOK MY SALON SMTP CONFIGURATION & DELIVERY VERIFIER ===\n');

  const validation = emailService.validateConfig();

  if (!validation.isConfigured) {
    console.error('❌ SMTP configuration is incomplete or missing.\n');
    console.log('Missing required fields:');
    for (const field of validation.missingFields) {
      console.log(`  - ${field}`);
    }
    if (validation.isAuthIncomplete) {
      console.log('  - Both SMTP_USER and SMTP_PASS must be provided together for authenticated SMTP.');
    }

    console.log('\n--- HOW TO CONFIGURE SMTP IN apps/api/.env ---');
    console.log('Add the following block to your apps/api/.env file:');
    console.log(`
# Gmail Configuration (Recommended for testing & production)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-char-app-password
SMTP_FROM="Book My Salon Security" <your-email@gmail.com>
SMTP_SECURE=false
SMTP_TLS_REJECT_UNAUTHORIZED=false

# Steps to generate a Google App Password:
# 1. Open your Google Account (https://myaccount.google.com).
# 2. Go to Security > 2-Step Verification.
# 3. Scroll to "App passwords" (or search for App Passwords).
# 4. Create an App name: "Book My Salon API".
# 5. Copy the 16-character password and paste it as SMTP_PASS.
`);
    process.exit(1);
  }

  console.log('✓ Configuration detected:');
  console.log(`  Host:   ${validation.safeSummary.host}`);
  console.log(`  Port:   ${validation.safeSummary.port}`);
  console.log(`  Secure: ${validation.safeSummary.secure}`);
  console.log(`  User:   ${validation.safeSummary.user || '(none)'}`);
  console.log(`  From:   ${validation.safeSummary.from}`);

  console.log('\nConnecting to SMTP server and verifying credentials...');
  const verifyRes = await emailService.verifyConnection();

  if (!verifyRes.ok) {
    console.error(`\n❌ Verification failed: ${verifyRes.message}`);
    process.exit(1);
  }

  console.log(`\n✓ ${verifyRes.message}`);

  // If a recipient is passed via CLI argument, send a test email
  const targetEmail = process.argv[2] || (validation.safeSummary.from?.match(/<(.+)>/)?.[1] || validation.safeSummary.from);

  if (targetEmail && targetEmail.includes('@')) {
    console.log(`\nSending real test verification email to: ${targetEmail}...`);
    try {
      await emailService.sendPasswordResetOtp(targetEmail, '582914', 'Test Customer', false);
      console.log(`✓ Real test email sent successfully to ${targetEmail}! Check your inbox.`);
    } catch (err: any) {
      console.error(`❌ Failed to send test email: ${err.message}`);
      process.exit(1);
    }
  }

  console.log('\n🎉 SMTP EMAIL SERVICE IS 100% OPERATIONAL!\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error verifying SMTP:', err);
  process.exit(1);
});
