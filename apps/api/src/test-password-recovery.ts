import mongoose from 'mongoose';
import { app } from './app.js';
import { env } from './config/env.js';
import { User } from './models/User.js';
import { PasswordReset } from './models/PasswordReset.js';
import { emailService } from './services/email.service.js';
import bcrypt from 'bcryptjs';

const results: { name: string; passed: boolean; details?: string }[] = [];

function record(name: string, passed: boolean, details?: string) {
  results.push({ name, passed, details });
  const symbol = passed ? '✓ PASS' : '✗ FAIL';
  console.log(`${symbol} ${name}`);
  if (details) console.log(`    Detail: ${details}`);
}

async function runPasswordRecoveryTests() {
  console.log('=== STARTING BOOK MY SALON PASSWORD RECOVERY & CHANGE SUITE ===\n');

  await mongoose.connect(env.MONGODB_URI);

  // Start in-process test server on an ephemeral port
  const server = app.listen(0);
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

  const timestamp = Date.now();
  const testEmail = `recovery_test_${timestamp}@example.com`;
  const initialPassword = 'Password123!';
  const updatedPassword = 'NewSecretPassword99#';
  const finalPassword = 'FinalChangedPassword88$';

  let capturedOtp: string | null = null;

  try {
    // 0. Create test user
    const passwordHash = await bcrypt.hash(initialPassword, 12);
    const user = await User.create({
      name: 'Recovery Test User',
      email: testEmail,
      passwordHash,
      role: 'CUSTOMER',
      isActive: true,
      authProvider: 'LOCAL',
      hasCustomPassword: true
    });

    // 1. Test unconfigured email service (503)
    emailService.clearTestState();
    // Temporarily ensure SMTP_HOST & SMTP_FROM are falsy if any
    const originalHost = env.SMTP_HOST;
    const originalFrom = env.SMTP_FROM;
    (env as any).SMTP_HOST = undefined;
    (env as any).SMTP_FROM = undefined;

    const unconfRes = await fetch(`${baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, role: 'CUSTOMER' })
    });
    const unconfJson = await unconfRes.json();
    record(
      'Forgot Password returns 503 when email delivery is unconfigured',
      unconfRes.status === 503 && unconfJson.code === 'EMAIL_SERVICE_NOT_CONFIGURED',
      JSON.stringify(unconfJson)
    );

    // Restore env & set mock sender for testing OTP flows
    (env as any).SMTP_HOST = originalHost;
    (env as any).SMTP_FROM = originalFrom;
    emailService.setMockSender(async (options) => {
      const match = options.subject.match(/(\d{6})/);
      if (match) capturedOtp = match[1];
    });

    // 2. Role restriction: SUPER_ADMIN self-service recovery rejected (403)
    const adminRes = await fetch(`${baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', role: 'SUPER_ADMIN' })
    });
    const adminJson = await adminRes.json();
    record(
      'SUPER_ADMIN password recovery rejected via self-service (403 Forbidden)',
      adminRes.status === 403 && adminJson.code === 'ADMIN_RECOVERY_RESTRICTED',
      JSON.stringify(adminJson)
    );

    // 3. Account enumeration prevention: non-existent email returns generic 200
    const nonExistentRes = await fetch(`${baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `nonexistent_${timestamp}@example.com`, role: 'CUSTOMER' })
    });
    const nonExistentJson = await nonExistentRes.json();
    record(
      'Non-existent account returns generic 200 to prevent account enumeration',
      nonExistentRes.status === 200 && nonExistentJson.message.includes('verification code has been sent'),
      JSON.stringify(nonExistentJson)
    );

    // 4. Successful OTP generation & delivery
    capturedOtp = null;
    const forgotRes = await fetch(`${baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, role: 'CUSTOMER' })
    });
    const forgotJson = await forgotRes.json();
    record(
      'Forgot Password initiates 6-digit OTP delivery for registered user (200 OK)',
      forgotRes.status === 200 && Boolean(capturedOtp && (capturedOtp as string).length === 6),
      `OTP Captured by Mock Sender: ${capturedOtp ? '******' : 'none'}`
    );

    // 5. Rate limit: Resend cooldown within 60s returns 429
    const cooldownRes = await fetch(`${baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, role: 'CUSTOMER' })
    });
    const cooldownJson = await cooldownRes.json();
    record(
      'Immediate resend within cooldown returns 429 (RESEND_COOLDOWN)',
      cooldownRes.status === 429 && cooldownJson.code === 'RESEND_COOLDOWN',
      JSON.stringify(cooldownJson)
    );

    // 6. OTP Verification: incorrect OTP returns 400 and remaining attempts
    const wrongOtpRes = await fetch(`${baseUrl}/auth/verify-reset-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, otp: '000000', role: 'CUSTOMER' })
    });
    const wrongOtpJson = await wrongOtpRes.json();
    record(
      'Incorrect OTP returns 400 and decrements attempt count',
      wrongOtpRes.status === 400 && wrongOtpJson.code === 'INVALID_OTP' && wrongOtpJson.remainingAttempts === 4,
      JSON.stringify(wrongOtpJson)
    );

    // 7. Lockout after max attempts
    for (let i = 0; i < 3; i++) {
      await fetch(`${baseUrl}/auth/verify-reset-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, otp: '000000', role: 'CUSTOMER' })
      });
    }
    // 5th attempt
    const lockoutRes = await fetch(`${baseUrl}/auth/verify-reset-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, otp: '000000', role: 'CUSTOMER' })
    });
    const lockoutJson = await lockoutRes.json();
    record(
      'Exceeding maximum OTP attempts locks out with 429 (MAX_ATTEMPTS_EXCEEDED)',
      lockoutRes.status === 429 && lockoutJson.code === 'MAX_ATTEMPTS_EXCEEDED',
      JSON.stringify(lockoutJson)
    );

    // 8. Expired OTP rejection
    // Create an expired record directly
    await PasswordReset.create({
      userId: user._id,
      email: testEmail,
      role: 'CUSTOMER',
      otpHash: 'dummyhash',
      expiresAt: new Date(Date.now() - 1000), // expired 1s ago
      attempts: 0,
      maxAttempts: 5,
      lastResendAt: new Date(Date.now() - 10000),
      consumed: false
    });
    const expiredRes = await fetch(`${baseUrl}/auth/verify-reset-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, otp: '123456', role: 'CUSTOMER' })
    });
    const expiredJson = await expiredRes.json();
    record(
      'Expired OTP returns 400 (OTP_EXPIRED)',
      expiredRes.status === 400 && expiredJson.code === 'OTP_EXPIRED',
      JSON.stringify(expiredJson)
    );

    // 9. Generate fresh valid OTP and verify
    // Invalidate old records to bypass cooldown for test
    await PasswordReset.deleteMany({ email: testEmail });
    capturedOtp = null;
    await fetch(`${baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, role: 'CUSTOMER' })
    });

    const verifyValidRes = await fetch(`${baseUrl}/auth/verify-reset-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, otp: capturedOtp!, role: 'CUSTOMER' })
    });
    const verifyValidJson = await verifyValidRes.json();
    const resetToken = verifyValidJson.resetToken;
    record(
      'Correct OTP returns single-use reset authorization token (no JWT issued)',
      verifyValidRes.status === 200 && Boolean(resetToken && resetToken.length === 64) && !verifyValidJson.token,
      `resetToken received: ${resetToken ? resetToken.slice(0, 10) + '...' : 'none'}`
    );

    // 10. Reset Password: weak password rejected (400)
    const weakPassRes = await fetch(`${baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetToken, newPassword: 'weak' })
    });
    record(
      'Reset password rejects weak password (<8 chars / missing criteria) with 400',
      weakPassRes.status === 400
    );

    // 11. Reset Password: mismatched confirmation rejected (400)
    const mismatchPassRes = await fetch(`${baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resetToken,
        newPassword: updatedPassword,
        confirmPassword: 'DifferentPassword123!'
      })
    });
    record(
      'Reset password rejects mismatched confirmPassword with 400',
      mismatchPassRes.status === 400
    );

    // 12. Successful Password Reset
    const successResetRes = await fetch(`${baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resetToken,
        newPassword: updatedPassword,
        confirmPassword: updatedPassword
      })
    });
    const successResetJson = await successResetRes.json();
    record(
      'Successful password reset returns 200 and updates password hash',
      successResetRes.status === 200,
      JSON.stringify(successResetJson)
    );

    // 13. Single-use token: token reuse rejected (400)
    const reuseTokenRes = await fetch(`${baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resetToken,
        newPassword: 'AnotherPassword99!',
        confirmPassword: 'AnotherPassword99!'
      })
    });
    const reuseTokenJson = await reuseTokenRes.json();
    record(
      'Reset authorization token cannot be reused (400 INVALID_OR_EXPIRED_RESET_TOKEN)',
      reuseTokenRes.status === 400 && reuseTokenJson.code === 'INVALID_OR_EXPIRED_RESET_TOKEN',
      JSON.stringify(reuseTokenJson)
    );

    // 14. Old password rejected, new password accepted for login
    const oldLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: initialPassword })
    });
    record('Login with previous old password fails (401 Unauthorized)', oldLoginRes.status === 401);

    const newLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: updatedPassword })
    });
    const newLoginJson = await newLoginRes.json();
    const customerToken = newLoginJson.token;
    record(
      'Login with new reset password succeeds (200 OK)',
      newLoginRes.status === 200 && Boolean(customerToken)
    );

    // 15. Change Password: unauthenticated rejected (401)
    const unauthChangeRes = await fetch(`${baseUrl}/auth/change-password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword: updatedPassword,
        newPassword: finalPassword,
        confirmPassword: finalPassword
      })
    });
    record(
      'Unauthenticated change-password request rejected (401 Unauthorized)',
      unauthChangeRes.status === 401
    );

    // 16. Change Password: wrong current password rejected (400)
    const wrongCurrentRes = await fetch(`${baseUrl}/auth/change-password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`
      },
      body: JSON.stringify({
        currentPassword: 'WrongCurrentPassword123!',
        newPassword: finalPassword,
        confirmPassword: finalPassword
      })
    });
    const wrongCurrentJson = await wrongCurrentRes.json();
    record(
      'Incorrect current password rejected (400 INCORRECT_CURRENT_PASSWORD)',
      wrongCurrentRes.status === 400 && wrongCurrentJson.code === 'INCORRECT_CURRENT_PASSWORD',
      JSON.stringify(wrongCurrentJson)
    );

    // 17. Change Password: password reuse rejected (400)
    const reuseCurrentRes = await fetch(`${baseUrl}/auth/change-password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`
      },
      body: JSON.stringify({
        currentPassword: updatedPassword,
        newPassword: updatedPassword,
        confirmPassword: updatedPassword
      })
    });
    const reuseCurrentJson = await reuseCurrentRes.json();
    record(
      'Reusing the current password rejected (400 PASSWORD_REUSED)',
      reuseCurrentRes.status === 400 && reuseCurrentJson.code === 'PASSWORD_REUSED',
      JSON.stringify(reuseCurrentJson)
    );

    // 18. Successful Change Password
    const successChangeRes = await fetch(`${baseUrl}/auth/change-password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`
      },
      body: JSON.stringify({
        currentPassword: updatedPassword,
        newPassword: finalPassword,
        confirmPassword: finalPassword
      })
    });
    const successChangeJson = await successChangeRes.json();
    record(
      'Authenticated password change succeeds (200 OK)',
      successChangeRes.status === 200,
      JSON.stringify(successChangeJson)
    );

    // 19. Verify login with changed password
    const postChangeLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: finalPassword })
    });
    record(
      'Login with updated password succeeds after change-password (200 OK)',
      postChangeLoginRes.status === 200
    );

    // Cleanup test user
    await User.deleteOne({ _id: user._id });
    await PasswordReset.deleteMany({ userId: user._id });

  } finally {
    server.close();
    await mongoose.disconnect();
  }

  console.log('\n=== PASSWORD RECOVERY SUITE SUMMARY ===\n');
  const allPassed = results.every((r) => r.passed);
  console.log(`TOTAL TESTS: ${results.length}`);
  console.log(`PASSED: ${results.filter((r) => r.passed).length}`);
  console.log(`FAILED: ${results.filter((r) => !r.passed).length}`);

  if (allPassed) {
    console.log('\n🎉 ALL PASSWORD RECOVERY & CHANGE SECURITY TESTS PASSED PERFECTLY!\n');
    process.exit(0);
  } else {
    console.error('\n❌ SOME TESTS FAILED!\n');
    process.exit(1);
  }
}

runPasswordRecoveryTests();
