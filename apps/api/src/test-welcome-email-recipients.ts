import mongoose, { Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
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
    // TEST CASE 1: Customer registration sends OTP, NOT premature welcome email
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

    const regCustData = (await regCustRes.json()) as any;
    if (regCustData.user?.id) createdUserIds.push(new Types.ObjectId(regCustData.user.id));

    const custOtpEmail = capturedEmails.find(
      (m) => m.to.toLowerCase() === customerEmail.toLowerCase() && m.subject.includes('Verification')
    );
    const custAdminEmailLeak = capturedEmails.some(
      (m) => m.to.toLowerCase() === ADMIN_EMAIL.toLowerCase()
    );

    const case1Passed =
      regCustRes.status === 201 &&
      Boolean(custOtpEmail) &&
      custOtpEmail?.to.toLowerCase() === customerEmail.toLowerCase() &&
      !custAdminEmailLeak;

    record(
      1,
      'New customer registers → Email OTP sent to customer; no welcome email to admin',
      case1Passed,
      `Status: ${regCustRes.status}, Recipient: "${custOtpEmail?.to}", Subject: "${custOtpEmail?.subject}", Admin Leak: ${custAdminEmailLeak}`
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

    const regOwnerData = (await regOwnerRes.json()) as any;
    if (regOwnerData.user?.id) createdUserIds.push(new Types.ObjectId(regOwnerData.user.id));
    if (regOwnerData.salon?.id) createdSalonIds.push(new Types.ObjectId(regOwnerData.salon.id));

    const ownerWelcomeEmail = capturedEmails.find(
      (m) => m.to.toLowerCase() === ownerEmail.toLowerCase() && m.subject.includes('Welcome')
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
    // TEST CASE 3: Customer completes OTP verification -> Welcome email sent to customer
    // -------------------------------------------------------------------------
    capturedEmails = [];
    const testOtp = '123456';
    const testOtpHash = crypto.createHash('sha256').update(testOtp + env.JWT_SECRET).digest('hex');
    await User.updateOne(
      { email: customerEmail },
      {
        emailVerificationOtpHash: testOtpHash,
        emailVerificationExpiresAt: new Date(Date.now() + 10 * 60 * 1000)
      }
    );

    const verifyRes = await fetch(`${baseUrl}/auth/verify-email-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: customerEmail,
        otp: testOtp
      })
    });
    const verifyData = (await verifyRes.json()) as any;

    const custVerifiedWelcomeEmail = capturedEmails.find(
      (m) => m.to.toLowerCase() === customerEmail.toLowerCase() && m.subject.includes('Welcome')
    );
    const verifyAdminEmailLeak = capturedEmails.some(
      (m) => m.to.toLowerCase() === ADMIN_EMAIL.toLowerCase()
    );

    const case3Passed =
      verifyRes.status === 200 &&
      Boolean(verifyData.token) &&
      Boolean(custVerifiedWelcomeEmail) &&
      custVerifiedWelcomeEmail?.to.toLowerCase() === customerEmail.toLowerCase() &&
      !verifyAdminEmailLeak;

    record(
      3,
      'Customer verifies email OTP → Single Welcome email sent to customer (no admin leak)',
      case3Passed,
      `Status: ${verifyRes.status}, Recipient: "${custVerifiedWelcomeEmail?.to}", Subject: "${custVerifiedWelcomeEmail?.subject}", Admin Leak: ${verifyAdminEmailLeak}`
    );

    // -------------------------------------------------------------------------
    // TEST CASE 4: Normal login for verified customer does NOT send duplicate welcome emails
    // -------------------------------------------------------------------------
    capturedEmails = [];
    const custLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: customerEmail,
        password: 'SecurePassword123!',
        expectedRole: 'CUSTOMER'
      })
    });

    const custLoginData = (await custLoginRes.json()) as any;
    const case4Passed =
      custLoginRes.status === 200 &&
      Boolean(custLoginData.token) &&
      capturedEmails.length === 0;

    record(
      4,
      'Normal login for verified customer → No duplicate welcome emails spammed',
      case4Passed,
      `Status: ${custLoginRes.status}, Captured Emails: ${capturedEmails.length} (Expected 0)`
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

    const adminLoginData = (await adminLoginRes.json()) as any;
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
    // TEST CASE 6: SMTP fails -> Handled gracefully without crash or unverified bypass
    // -------------------------------------------------------------------------
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

    const failRegData = (await failRegRes.json()) as any;
    const dbUser = await User.findOne({ email: smtpFailCustEmail });
    if (dbUser) createdUserIds.push(dbUser._id);

    // 6B. Login attempt without OTP verification is blocked
    const failLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: smtpFailCustEmail,
        password: 'SecurePassword123!',
        expectedRole: 'CUSTOMER'
      })
    });

    const case6Passed =
      failRegRes.status === 201 &&
      failRegData.requiresVerification === true &&
      Boolean(dbUser) &&
      dbUser?.isEmailVerified === false &&
      failLoginRes.status === 403;

    record(
      6,
      'SMTP failure → Handled safely without server crash; unverified user remains blocked',
      case6Passed,
      `Reg Status: ${failRegRes.status}, requiresVerification: ${failRegData.requiresVerification}, Unverified Login Status: ${failLoginRes.status} (expected 403)`
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
