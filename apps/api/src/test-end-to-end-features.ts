import mongoose, { Types } from 'mongoose';
import { app } from './application.js';
import { env } from './config/env.js';
import { User } from './models/User.js';
import { Salon } from './models/Salon.js';
import { Notification } from './models/Notification.js';
import { AccountDeletionRequest } from './models/AccountDeletionRequest.js';
import { emailService } from './services/email.service.js';
import { issueToken } from './services/token.service.js';

interface TestCaseResult {
  num: number;
  title: string;
  passed: boolean;
  notes: string;
}

const results: TestCaseResult[] = [];

function record(num: number, title: string, passed: boolean, notes: string) {
  results.push({ num, title, passed, notes });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${icon}] Case ${num}: ${title}`);
  console.log(`       ${notes}\n`);
}

async function runTestSuite() {
  console.log('========================================================================');
  console.log('   BOOK MY SALON: 5-REQUIREMENTS END-TO-END VERIFICATION TEST SUITE     ');
  console.log('========================================================================\n');

  await mongoose.connect(env.MONGODB_URI);

  const server = app.listen(0);
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

  const ts = Date.now();
  const createdUserIds: Types.ObjectId[] = [];
  const createdSalonIds: Types.ObjectId[] = [];

  let capturedEmails: Array<{ to: string; subject: string; text: string; html?: string }> = [];
  emailService.setMockSender(async (opts) => {
    capturedEmails.push(opts);
  });

  try {
    // Setup: Find or create a SUPER_ADMIN to test admin notifications and protection
    let superAdmin = await User.findOne({ role: 'SUPER_ADMIN' });
    if (!superAdmin) {
      superAdmin = await User.create({
        name: 'Super Administrator',
        email: `superadmin_test_${ts}@bookmysalon.test`,
        password: '$2a$10$FakeHashedPasswordForAdminTesting12345678901234567890',
        phone: '9999988888',
        role: 'SUPER_ADMIN',
        isEmailVerified: true
      });
      createdUserIds.push(superAdmin._id);
    }

    // Generate token for Super Admin
    const adminToken = issueToken({ sub: superAdmin._id.toString(), role: 'SUPER_ADMIN' });

    // -------------------------------------------------------------------------
    // REQUIREMENT 1 & 4: Customer Registration sends OTP, NOT admin welcome email
    // -------------------------------------------------------------------------
    capturedEmails = [];
    const custEmail = `cust_verify_${ts}@test.com`;
    const regRes = await fetch(`${baseUrl}/auth/register/customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Aishwarya Rai',
        email: custEmail,
        password: 'Password123!',
        phone: '9876543210'
      })
    });
    const regData = (await regRes.json()) as any;

    const custUser = await User.findOne({ email: custEmail });
    if (custUser) createdUserIds.push(custUser._id);

    const otpEmail = capturedEmails.find((e) => e.to.toLowerCase() === custEmail.toLowerCase());
    const adminGotWelcome = capturedEmails.some((e) => e.to.toLowerCase().includes('admin'));

    record(
      1,
      'Customer Registration sends OTP to customer, NOT welcome email to admin',
      regRes.status === 201 &&
        regData.requiresVerification === true &&
        Boolean(otpEmail) &&
        !adminGotWelcome &&
        custUser?.isEmailVerified === false,
      `Status: ${regRes.status}, requiresVerification: ${regData.requiresVerification}, OTP email sent to ${otpEmail?.to}, Admin received welcome: ${adminGotWelcome}`
    );

    // -------------------------------------------------------------------------
    // REQUIREMENT 4: Unverified customer login blocked
    // -------------------------------------------------------------------------
    const unverifiedLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: custEmail,
        password: 'Password123!',
        expectedRole: 'CUSTOMER'
      })
    });
    const unverifiedLoginData = (await unverifiedLoginRes.json()) as any;

    record(
      2,
      'Unverified Customer login returns 403 EMAIL_NOT_VERIFIED',
      unverifiedLoginRes.status === 403 &&
        unverifiedLoginData.code === 'EMAIL_NOT_VERIFIED' &&
        unverifiedLoginData.requiresVerification === true,
      `Status: ${unverifiedLoginRes.status}, code: ${unverifiedLoginData.code}`
    );

    // -------------------------------------------------------------------------
    // REQUIREMENT 4: Wrong OTP handling & attempt tracking
    // -------------------------------------------------------------------------
    const wrongOtpRes = await fetch(`${baseUrl}/auth/verify-email-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: custEmail,
        otp: '000000'
      })
    });
    const wrongOtpData = (await wrongOtpRes.json()) as any;

    record(
      3,
      'Invalid OTP verification fails with remaining attempts',
      wrongOtpRes.status === 400 && wrongOtpData.code === 'INVALID_OTP',
      `Status: ${wrongOtpRes.status}, message: ${wrongOtpData.message}`
    );

    // -------------------------------------------------------------------------
    // REQUIREMENT 4: Successful OTP verification sends single welcome email & issues token
    // -------------------------------------------------------------------------
    // Retrieve OTP from the email subject/body or set a known OTP hash
    const crypto = await import('crypto');
    const validTestOtp = '789123';
    const validHash = crypto.createHash('sha256').update(validTestOtp + env.JWT_SECRET).digest('hex');
    await User.updateOne(
      { email: custEmail },
      {
        emailVerificationOtpHash: validHash,
        emailVerificationExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
        emailVerificationAttempts: 0
      }
    );

    capturedEmails = [];
    const verifySuccessRes = await fetch(`${baseUrl}/auth/verify-email-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: custEmail,
        otp: validTestOtp
      })
    });
    const verifySuccessData = (await verifySuccessRes.json()) as any;
    const verifiedUser = await User.findOne({ email: custEmail });

    const welcomeEmailToCustomer = capturedEmails.find(
      (e) => e.to.toLowerCase() === custEmail.toLowerCase() && e.subject.toLowerCase().includes('welcome')
    );

    record(
      4,
      'Valid OTP verification marks email verified, sends welcome email to customer, and issues JWT',
      verifySuccessRes.status === 200 &&
        verifiedUser?.isEmailVerified === true &&
        Boolean(welcomeEmailToCustomer) &&
        Boolean(verifySuccessData.token),
      `Verified: ${verifiedUser?.isEmailVerified}, Welcome email sent: ${Boolean(welcomeEmailToCustomer)}, Token present: ${Boolean(verifySuccessData.token)}`
    );

    // -------------------------------------------------------------------------
    // REQUIREMENT 1: Normal login for verified customer does NOT resend welcome email
    // -------------------------------------------------------------------------
    capturedEmails = [];
    const verifiedLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: custEmail,
        password: 'Password123!',
        expectedRole: 'CUSTOMER'
      })
    });
    const verifiedLoginData = (await verifiedLoginRes.json()) as any;

    record(
      5,
      'Verified customer login succeeds without sending duplicate welcome emails',
      verifiedLoginRes.status === 200 &&
        capturedEmails.length === 0 &&
        Boolean(verifiedLoginData.token),
      `Status: ${verifiedLoginRes.status}, Captured emails count: ${capturedEmails.length}`
    );

    // -------------------------------------------------------------------------
    // REQUIREMENT 2: Salon Owner Registration triggers Admin Notifications
    // -------------------------------------------------------------------------
    capturedEmails = [];
    const ownerEmail = `owner_notif_${ts}@test.com`;
    const regOwnerRes = await fetch(`${baseUrl}/auth/register/salon-owner`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Rohan Mehra',
        email: ownerEmail,
        password: 'Password123!',
        phone: '9812345678',
        salonName: 'Mehra Luxury Studio',
        address: '100 MG Road',
        city: 'Bengaluru',
        identityProof: {
          url: 'https://res.cloudinary.com/demo/image/upload/sample_aadhar.pdf',
          filename: 'aadhar_card.pdf',
          fileType: 'application/pdf'
        }
      })
    });
    const regOwnerData = (await regOwnerRes.json()) as any;
    const ownerUser = await User.findOne({ email: ownerEmail });
    if (ownerUser) createdUserIds.push(ownerUser._id);
    const ownerSalon = await Salon.findOne({ ownerId: ownerUser?._id });
    if (ownerSalon) createdSalonIds.push(ownerSalon._id);

    // Check DB for Admin Notification
    const adminNotif = await Notification.findOne({
      recipientId: superAdmin._id,
      type: 'ADMIN_NEW_SALON_REGISTRATION'
    }).sort({ createdAt: -1 });

    record(
      6,
      'Salon Owner registration stores offline Admin Notification in database',
      regOwnerRes.status === 201 &&
        Boolean(adminNotif) &&
        adminNotif?.title.includes('New Salon Owner'),
      `Status: ${regOwnerRes.status}, Notif found: ${Boolean(adminNotif)}, Title: "${adminNotif?.title}"`
    );

    // -------------------------------------------------------------------------
    // REQUIREMENT 2: Admin Notification APIs & mark-as-read
    // -------------------------------------------------------------------------
    // Ordinary user cannot access admin notifications
    const custToken = verifySuccessData.token;
    const custNotifRes = await fetch(`${baseUrl}/admin/notifications`, {
      headers: { Authorization: `Bearer ${custToken}` }
    });

    // Admin can access notifications and mark them as read
    const adminNotifRes = await fetch(`${baseUrl}/admin/notifications`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const adminNotifData = (await adminNotifRes.json()) as any;

    // Mark single notification read
    let markReadPassed = false;
    if (adminNotif) {
      const readRes = await fetch(`${baseUrl}/admin/notifications/${adminNotif._id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      markReadPassed = readRes.status === 200;
    }

    record(
      7,
      'Admin notifications protected, listed, and marked as read',
      custNotifRes.status === 403 &&
        adminNotifRes.status === 200 &&
        (Array.isArray(adminNotifData.notifications) || Array.isArray(adminNotifData.data)) &&
        markReadPassed,
      `Customer access: ${custNotifRes.status} (expected 403), Admin count: ${adminNotifData.notifications?.length || adminNotifData.data?.length}, Mark read passed: ${markReadPassed}`
    );

    // -------------------------------------------------------------------------
    // REQUIREMENT 5: Account Deletion Request with 30-Day Grace Period
    // -------------------------------------------------------------------------
    // 1) Super Admin protection: Cannot delete Super Admin account
    const deleteSuperAdminRes = await fetch(`${baseUrl}/profile/account-deletion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ reason: 'testing' })
    });

    record(
      8,
      'SUPER_ADMIN accounts cannot be deleted via account deletion API',
      deleteSuperAdminRes.status === 403,
      `Status: ${deleteSuperAdminRes.status} (expected 403)`
    );

    // 2) Customer requests deletion
    capturedEmails = [];
    const deleteCustRes = await fetch(`${baseUrl}/profile/account-deletion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${custToken}`
      },
      body: JSON.stringify({
        reason: 'Privacy concerns',
        feedback: 'Great service, just taking a break.'
      })
    });
    const deleteCustData = (await deleteCustRes.json()) as any;

    const updatedCust = await User.findById(custUser?._id);
    const deletionRecord = await AccountDeletionRequest.findOne({
      userId: custUser?._id,
      status: 'PENDING'
    });

    const scheduledEmailSent = capturedEmails.some((e) =>
      e.subject.toLowerCase().includes('deletion') && e.subject.toLowerCase().includes('scheduled')
    );

    record(
      9,
      'Account Deletion Request sets 30-day grace period, marks pending, and sends email',
      deleteCustRes.status === 200 &&
        updatedCust?.isPendingDeletion === true &&
        Boolean(updatedCust?.scheduledDeletionAt) &&
        Boolean(deletionRecord) &&
        scheduledEmailSent,
      `Status: ${deleteCustRes.status}, isPendingDeletion: ${updatedCust?.isPendingDeletion}, scheduledDeletionAt: ${updatedCust?.scheduledDeletionAt?.toISOString()}, Email sent: ${scheduledEmailSent}`
    );

    // 3) Token revocation: Calling protected APIs with old token immediately returns 403
    const protectedAfterDeletionRes = await fetch(`${baseUrl}/profile/me`, {
      headers: { Authorization: `Bearer ${custToken}` }
    });
    const protectedData = (await protectedAfterDeletionRes.json()) as any;

    record(
      10,
      'Pending deletion account is immediately blocked on protected APIs (403 ACCOUNT_PENDING_DELETION)',
      protectedAfterDeletionRes.status === 403 &&
        protectedData.code === 'ACCOUNT_PENDING_DELETION',
      `Status: ${protectedAfterDeletionRes.status}, code: ${protectedData.code}`
    );

    // -------------------------------------------------------------------------
    // REQUIREMENT 5: Login during 30-day grace period cancels deletion
    // -------------------------------------------------------------------------
    capturedEmails = [];
    const restoreLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: custEmail,
        password: 'Password123!',
        expectedRole: 'CUSTOMER'
      })
    });
    const restoreLoginData = (await restoreLoginRes.json()) as any;

    const restoredCust = await User.findById(custUser?._id);
    const cancelledRecord = await AccountDeletionRequest.findOne({
      userId: custUser?._id,
      status: 'CANCELLED'
    });
    const cancellationEmailSent = capturedEmails.some((e) =>
      e.subject.toLowerCase().includes('cancelled') || e.subject.toLowerCase().includes('cancellation')
    );

    record(
      11,
      'Login during grace period cancels deletion, restores active status, and notifies user',
      restoreLoginRes.status === 200 &&
        restoreLoginData.deletionCancelled === true &&
        restoredCust?.isPendingDeletion === false &&
        cancelledRecord !== null &&
        cancellationEmailSent,
      `Login status: ${restoreLoginRes.status}, deletionCancelled: ${restoreLoginData.deletionCancelled}, isPendingDeletion: ${restoredCust?.isPendingDeletion}, Cancelled record: ${Boolean(cancelledRecord)}, Email sent: ${cancellationEmailSent}`
    );

    // -------------------------------------------------------------------------
    // REQUIREMENT 5: Server-side Scheduled Cron Deletion Execution
    // -------------------------------------------------------------------------
    // 1) Test without CRON_SECRET -> 401 Unauthorized
    const unauthCronRes = await fetch(`${baseUrl}/cron/process-deletions`, {
      method: 'POST'
    });

    // 2) Create a mock expired deletion user (scheduledDeletionAt in the past)
    const expiredCust = await User.create({
      name: 'Expired Test User',
      email: `expired_${ts}@test.com`,
      passwordHash: '$2a$10$FakeHashedPasswordForAdminTesting12345678901234567890',
      phone: '9888877777',
      role: 'CUSTOMER',
      isEmailVerified: true,
      isPendingDeletion: true,
      scheduledDeletionAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
    });
    createdUserIds.push(expiredCust._id);

    const expiredRequest = await AccountDeletionRequest.create({
      userId: expiredCust._id,
      role: 'CUSTOMER',
      email: expiredCust.email,
      reason: 'Scheduled test deletion',
      scheduledDeletionAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      status: 'PENDING'
    });

    capturedEmails = [];
    const cronSecret = env.CRON_SECRET || 'book_my_salon_cron_default_secret_2026';
    const authCronRes = await fetch(`${baseUrl}/cron/process-deletions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cronSecret}` }
    });
    const authCronData = (await authCronRes.json()) as any;
    const processedCount = authCronData.result?.processed ?? 0;

    const anonymizedCust = await User.findById(expiredCust._id);
    const emailLookup = await User.findOne({ email: expiredCust.email });
    const updatedRequest = await AccountDeletionRequest.findById(expiredRequest._id);

    record(
      12,
      'Cron processor securely purges expired accounts (>30 days) and marks status COMPLETED',
      unauthCronRes.status === 401 &&
        authCronRes.status === 200 &&
        processedCount >= 1 &&
        emailLookup === null &&
        anonymizedCust?.name === 'Deleted User' &&
        anonymizedCust?.isActive === false &&
        updatedRequest?.status === 'COMPLETED',
      `Unauth status: ${unauthCronRes.status} (expected 401), Cron status: ${authCronRes.status}, Processed count: ${processedCount}, Original email purged: ${emailLookup === null}, User anonymized: ${anonymizedCust?.name === 'Deleted User'}, Request status: ${updatedRequest?.status}`
    );
  } finally {
    // Cleanup created test records
    await User.deleteMany({ _id: { $in: createdUserIds } });
    await Salon.deleteMany({ _id: { $in: createdSalonIds } });
    await AccountDeletionRequest.deleteMany({ email: { $regex: `${ts}@test.com` } });
    server.close();
    await mongoose.disconnect();
  }

  console.log('========================================================================');
  console.log('                         SUMMARY REPORT                                 ');
  console.log('========================================================================');
  const allPassed = results.every((r) => r.passed);
  const passedCount = results.filter((r) => r.passed).length;
  console.log(`Passed: ${passedCount}/${results.length}`);
  if (allPassed) {
    console.log('🎉 ALL 12 END-TO-END TEST CASES PASSED SUCCESSFULLY!\n');
  } else {
    console.log('⚠️ SOME TEST CASES FAILED!\n');
    process.exitCode = 1;
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
