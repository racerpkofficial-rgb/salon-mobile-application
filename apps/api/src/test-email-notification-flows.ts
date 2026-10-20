import mongoose, { Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { app } from './app.js';
import { env } from './config/env.js';
import { User } from './models/User.js';
import { Salon } from './models/Salon.js';
import { EmailLog } from './models/EmailLog.js';
import { emailService } from './services/email.service.js';
import { issueToken } from './services/token.service.js';

const results: { name: string; passed: boolean; details?: string }[] = [];

function record(name: string, passed: boolean, details?: string) {
  results.push({ name, passed, details });
  const symbol = passed ? '✓ PASS' : '✗ FAIL';
  console.log(`${symbol}: ${name}`);
  if (details) console.log(`    Detail: ${details}`);
}

async function runEmailNotificationFlowTests() {
  console.log('=== STARTING BOOK MY SALON EMAIL NOTIFICATION SYSTEM TEST SUITE ===\n');

  await mongoose.connect(env.MONGODB_URI);

  const server = app.listen(0);
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

  const ts = Date.now();
  const createdUserIds: (Types.ObjectId | string)[] = [];
  const createdSalonIds: (Types.ObjectId | string)[] = [];

  // Enable Mock Sender for tests - NO REAL EMAILS SENT!
  let sentMockEmails: Array<{ to: string; subject: string; text: string; html?: string }> = [];
  emailService.setMockSender(async (opts) => {
    sentMockEmails.push(opts);
  });

  try {
    // Setup Admin User
    const adminPasswordHash = await bcrypt.hash('AdminPass123!', 10);
    const adminUser = await User.create({
      name: 'Super Administrator',
      email: `admin_email_test_${ts}@example.com`,
      passwordHash: adminPasswordHash,
      role: 'SUPER_ADMIN',
      isActive: true
    });
    createdUserIds.push(adminUser._id);
    const adminToken = issueToken({ sub: adminUser._id.toString(), role: 'SUPER_ADMIN' });

    // Setup Customer User for non-admin test
    const customerPasswordHash = await bcrypt.hash('CustomerPass123!', 10);
    const standardCustomer = await User.create({
      name: 'Standard Customer',
      email: `standard_cust_${ts}@example.com`,
      passwordHash: customerPasswordHash,
      role: 'CUSTOMER',
      isActive: true
    });
    createdUserIds.push(standardCustomer._id);
    const customerToken = issueToken({ sub: standardCustomer._id.toString(), role: 'CUSTOMER' });

    // =========================================================================
    // 1. Customer Registration Welcome Email
    // =========================================================================
    console.log('\n--- 1. Testing Customer Registration Welcome Email ---');
    sentMockEmails = [];
    const custEmail = `cust_reg_${ts}@example.com`;
    const custRes = await fetch(`${baseUrl}/auth/register/customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Priya Sharma',
        email: custEmail,
        password: 'ValidPassword123!',
        phone: '9876543210'
      })
    });
    const custData = await custRes.json();
    if (custData.user?._id) createdUserIds.push(custData.user._id);

    const custStatusOk = custRes.status === 201;
    const custEmailSent = sentMockEmails.find((m) => m.to.toLowerCase() === custEmail.toLowerCase() && m.subject.includes('Welcome'));
    const custEmailCorrect =
      custEmailSent &&
      (custEmailSent.subject === 'Welcome to Book My Salon!' || custEmailSent.subject === 'Welcome to BookMy Salon!') &&
      custEmailSent.text.includes('Hi Priya Sharma,') &&
      (custEmailSent.text.includes('Welcome to Book My Salon!') || custEmailSent.text.includes('Welcome to BookMy Salon!')) &&
      (custEmailSent.text.includes('Team Book My Salon') || custEmailSent.text.includes('Team BookMy Salon'));

    record(
      'Customer registration sends 1 welcome email with correct subject and body',
      custStatusOk && !!custEmailCorrect,
      `Status: ${custRes.status}, Subject: ${custEmailSent?.subject}`
    );

    // =========================================================================
    // 2. Salon Owner Registration Received Email (Pending Approval)
    // =========================================================================
    console.log('\n--- 2. Testing Salon Owner Registration Received Email ---');
    sentMockEmails = [];
    const ownerEmail = `owner_reg_${ts}@example.com`;
    const ownerRes = await fetch(`${baseUrl}/auth/register/salon-owner`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Ramesh Patel',
        email: ownerEmail,
        password: 'ValidOwnerPass123!',
        phone: '9123456780',
        salonName: 'Royal Glow Lounge',
        address: '100 Main Boulevard',
        city: 'Chennai',
        state: 'Tamil Nadu',
        identityProof: {
          url: 'https://res.cloudinary.com/demo/image/upload/id.pdf',
          filename: 'owner_aadhaar.pdf',
          fileType: 'application/pdf',
          fileSize: 1024 * 500
        }
      })
    });
    const ownerData = await ownerRes.json();
    if (ownerData.user?._id) createdUserIds.push(ownerData.user._id);
    if (ownerData.salon?.id) createdSalonIds.push(ownerData.salon.id);

    const ownerStatusOk = ownerRes.status === 201;
    const ownerEmailSent = sentMockEmails.find(
      (m) => m.to.toLowerCase() === ownerEmail.toLowerCase() && m.subject.includes('Registration Has Been Received')
    );
    const ownerEmailCorrect =
      ownerEmailSent &&
      ownerEmailSent.subject === 'Your Book My Salon Salon Registration Has Been Received' &&
      ownerEmailSent.text.includes('Hi Ramesh Patel,') &&
      ownerEmailSent.text.includes('Your current application status is: Pending Approval.') &&
      ownerEmailSent.text.includes('Book My Salon Admin Team') &&
      !ownerEmailSent.text.includes('Congratulations!'); // NOT an approval email

    const ownerWelcomeSent = sentMockEmails.find(
      (m) => m.to.toLowerCase() === ownerEmail.toLowerCase() && (m.subject === 'Welcome to BookMy Salon!' || m.subject === 'Welcome to Book My Salon!')
    );

    record(
      'Salon owner registration sends pending-approval acknowledgement email and welcome email',
      ownerStatusOk && !!ownerEmailCorrect && !!ownerWelcomeSent,
      `Status: ${ownerRes.status}, Ack Subject: ${ownerEmailSent?.subject}, Welcome Subject: ${ownerWelcomeSent?.subject}`
    );

    // =========================================================================
    // 3. Admin Accepts / Approves Salon Owner Registration
    // =========================================================================
    console.log('\n--- 3. Testing Admin Approval Email ---');
    sentMockEmails = [];
    const salonIdToApprove = ownerData.salon.id;
    const approveRes = await fetch(`${baseUrl}/admin/salons/${salonIdToApprove}/approve`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      }
    });

    const approveStatusOk = approveRes.status === 200;
    const approveEmailSent = sentMockEmails.find((m) => m.to.toLowerCase() === ownerEmail.toLowerCase());
    const approveEmailCorrect =
      approveEmailSent &&
      approveEmailSent.subject === 'Congratulations! Your Salon Has Been Approved on Book My Salon' &&
      approveEmailSent.text.includes('Hi Ramesh Patel,') &&
      approveEmailSent.text.includes('Congratulations! 🎉') &&
      approveEmailSent.text.includes('Book My Salon Admin Team');

    const updatedSalon = await Salon.findById(salonIdToApprove);
    const dbFieldsOk =
      updatedSalon?.status === 'ACTIVE' &&
      updatedSalon.reviewedBy?.toString() === adminUser._id.toString() &&
      updatedSalon.reviewedAt instanceof Date;

    record(
      'Admin approval sends congratulatory email and persists reviewer ID and decision timestamp',
      approveStatusOk && !!approveEmailCorrect && dbFieldsOk,
      `Status: ${approveRes.status}, DbStatus: ${updatedSalon?.status}, ReviewedBy: ${updatedSalon?.reviewedBy}`
    );

    // =========================================================================
    // 4. Admin Rejects Salon Owner Registration with Mandatory Reason
    // =========================================================================
    console.log('\n--- 4. Testing Admin Rejection Flow ---');
    // Register another salon to test rejection
    const rejectOwnerEmail = `reject_owner_${ts}@example.com`;
    const rejectOwnerRes = await fetch(`${baseUrl}/auth/register/salon-owner`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Kavitha Devi',
        email: rejectOwnerEmail,
        password: 'ValidOwnerPass123!',
        phone: '9876543219',
        salonName: 'Kavitha Spa',
        address: '45 Lake View Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        identityProof: {
          url: 'https://res.cloudinary.com/demo/image/upload/id.jpg',
          filename: 'kavitha_id.jpg',
          fileType: 'image/jpeg',
          fileSize: 1024 * 300
        }
      })
    });
    const rejectOwnerData = await rejectOwnerRes.json();
    if (rejectOwnerData.user?._id) createdUserIds.push(rejectOwnerData.user._id);
    if (rejectOwnerData.salon?.id) createdSalonIds.push(rejectOwnerData.salon.id);
    const salonIdToReject = rejectOwnerData.salon.id;

    sentMockEmails = [];
    const testRejectionReason = 'Uploaded government identity proof is blurred and expiry date is missing.';
    const rejectRes = await fetch(`${baseUrl}/admin/salons/${salonIdToReject}/reject`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ reason: testRejectionReason })
    });

    const rejectStatusOk = rejectRes.status === 200;
    const rejectEmailSent = sentMockEmails.find((m) => m.to.toLowerCase() === rejectOwnerEmail.toLowerCase());
    const rejectEmailCorrect =
      rejectEmailSent &&
      rejectEmailSent.subject === 'Update Regarding Your Book My Salon Salon Registration' &&
      rejectEmailSent.text.includes('Hi Kavitha Devi,') &&
      rejectEmailSent.text.includes(testRejectionReason) &&
      rejectEmailSent.text.includes('bookmysalonadmin@gmail.com') &&
      rejectEmailSent.text.includes('Book My Salon Admin Team');

    const dbRejectedSalon = await Salon.findById(salonIdToReject);
    const dbRejectFieldsOk =
      dbRejectedSalon?.status === 'REJECTED' &&
      dbRejectedSalon.rejectionReason === testRejectionReason &&
      dbRejectedSalon.reviewedBy?.toString() === adminUser._id.toString() &&
      dbRejectedSalon.reviewedAt instanceof Date;

    record(
      'Admin rejection sends decision email with exact reason and persists timestamp and reviewer ID',
      rejectStatusOk && !!rejectEmailCorrect && dbRejectFieldsOk,
      `Status: ${rejectRes.status}, Reason Saved: "${dbRejectedSalon?.rejectionReason}"`
    );

    // =========================================================================
    // 5. Rejecting without a Reason Returns 400 Validation Error
    // =========================================================================
    console.log('\n--- 5. Testing Rejection Validation (Mandatory Reason) ---');
    sentMockEmails = [];
    const emptyRejectRes = await fetch(`${baseUrl}/admin/salons/${salonIdToReject}/reject`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ reason: '    ' })
    });

    const missingReasonRes = await fetch(`${baseUrl}/admin/salons/${salonIdToReject}/reject`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({})
    });

    const validationFailedBoth = emptyRejectRes.status === 400 && missingReasonRes.status === 400;
    const noEmailSentOnValidationFailure = sentMockEmails.length === 0;

    record(
      'Rejecting with empty or missing reason is rejected with HTTP 400 without sending email',
      validationFailedBoth && noEmailSentOnValidationFailure,
      `Empty Reason Status: ${emptyRejectRes.status}, Missing Reason Status: ${missingReasonRes.status}`
    );

    // =========================================================================
    // 6. Failed Registration Does Not Send Email
    // =========================================================================
    console.log('\n--- 6. Testing Failed Registration Does Not Send Email ---');
    sentMockEmails = [];
    const failedCustRes = await fetch(`${baseUrl}/auth/register/customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Invalid User',
        email: 'invalid-email-format',
        password: 'weak'
      })
    });

    record(
      'Failed registration returns 400 and sends NO email',
      failedCustRes.status === 400 && sentMockEmails.length === 0,
      `Status: ${failedCustRes.status}, Emails Sent: ${sentMockEmails.length}`
    );

    // =========================================================================
    // 7. Failed Database Decisions Do Not Send Emails
    // =========================================================================
    console.log('\n--- 7. Testing Failed Database Decision ---');
    sentMockEmails = [];
    const nonExistentSalonId = new Types.ObjectId().toString();
    const failedApproveRes = await fetch(`${baseUrl}/admin/salons/${nonExistentSalonId}/approve`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      }
    });

    record(
      'Non-existent salon decision returns 404 and sends NO email',
      failedApproveRes.status === 404 && sentMockEmails.length === 0,
      `Status: ${failedApproveRes.status}, Emails Sent: ${sentMockEmails.length}`
    );

    // =========================================================================
    // 8. Email Delivery Failure Does Not Undo Database Decision
    // =========================================================================
    console.log('\n--- 8. Testing Email Failure Does Not Roll Back Decision ---');
    // Register another salon
    const failureTestEmail = `failure_test_${ts}@example.com`;
    const failureSalonRes = await fetch(`${baseUrl}/auth/register/salon-owner`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Vikram Singh',
        email: failureTestEmail,
        password: 'ValidOwnerPass123!',
        phone: '9888877770',
        salonName: 'Vikram Cuts',
        address: '12 Temple Lane',
        city: 'Madurai',
        state: 'Tamil Nadu',
        identityProof: {
          url: 'https://res.cloudinary.com/demo/image/upload/id.pdf',
          filename: 'doc.pdf',
          fileType: 'application/pdf',
          fileSize: 1024 * 100
        }
      })
    });
    const failureSalonData = await failureSalonRes.json();
    if (failureSalonData.user?._id) createdUserIds.push(failureSalonData.user._id);
    if (failureSalonData.salon?.id) createdSalonIds.push(failureSalonData.salon.id);
    const salonIdForFailureTest = failureSalonData.salon.id;

    // Set mock sender to throw an error (simulating SMTP down)
    emailService.setMockSender(async () => {
      throw new Error('Connection timeout to smtp.gmail.com:587');
    });

    const failedSendApproveRes = await fetch(`${baseUrl}/admin/salons/${salonIdForFailureTest}/approve`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      }
    });

    const salonAfterEmailFailure = await Salon.findById(salonIdForFailureTest);
    const emailLogRecord = await EmailLog.findOne({
      recipientEmail: failureTestEmail,
      eventType: 'OWNER_APPLICATION_APPROVED'
    });

    const decisionPersisted =
      failedSendApproveRes.status === 200 &&
      salonAfterEmailFailure?.status === 'ACTIVE';
    const logRecordedFailure =
      emailLogRecord?.status === 'FAILED' &&
      emailLogRecord.error?.includes('Connection timeout');

    // Restore functioning mock sender
    emailService.setMockSender(async (opts) => {
      sentMockEmails.push(opts);
    });

    record(
      'Email delivery failure does NOT roll back admin approval; failure is recorded in EmailLog',
      decisionPersisted && !!logRecordedFailure,
      `Approve Status: ${failedSendApproveRes.status}, DB Status: ${salonAfterEmailFailure?.status}, EmailLog Status: ${emailLogRecord?.status}`
    );

    // =========================================================================
    // 9. Repeated Requests Do Not Send Duplicate Emails
    // =========================================================================
    console.log('\n--- 9. Testing Duplicate Email Prevention on Retries ---');
    sentMockEmails = [];
    // Approve salonIdToApprove again (already ACTIVE)
    const repeatApproveRes = await fetch(`${baseUrl}/admin/salons/${salonIdToApprove}/approve`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      }
    });

    record(
      'Repeated approve request on already-approved salon skips duplicate email',
      repeatApproveRes.status === 200 && sentMockEmails.length === 0,
      `Status: ${repeatApproveRes.status}, Duplicate Emails Sent: ${sentMockEmails.length}`
    );

    sentMockEmails = [];
    // Reject salonIdToReject again with identical reason (already REJECTED)
    const repeatRejectRes = await fetch(`${baseUrl}/admin/salons/${salonIdToReject}/reject`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ reason: testRejectionReason })
    });

    record(
      'Repeated reject request with same reason skips duplicate email',
      repeatRejectRes.status === 200 && sentMockEmails.length === 0,
      `Status: ${repeatRejectRes.status}, Duplicate Emails Sent: ${sentMockEmails.length}`
    );

    // =========================================================================
    // 10. Non-Admin Users Cannot Trigger Approval / Rejection
    // =========================================================================
    console.log('\n--- 10. Testing Non-Admin Authorization Guard ---');
    sentMockEmails = [];
    const unauthApprove = await fetch(`${baseUrl}/admin/salons/${salonIdToApprove}/approve`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`
      }
    });

    const unauthReject = await fetch(`${baseUrl}/admin/salons/${salonIdToApprove}/reject`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`
      },
      body: JSON.stringify({ reason: 'Illegal customer attempt' })
    });

    record(
      'Customer accounts receive 403 Forbidden on approve/reject endpoints',
      unauthApprove.status === 403 && unauthReject.status === 403 && sentMockEmails.length === 0,
      `Approve Status: ${unauthApprove.status}, Reject Status: ${unauthReject.status}`
    );

    // =========================================================================
    // 11. HTML Content Escaping for Security
    // =========================================================================
    console.log('\n--- 11. Testing HTML Content Escaping ---');
    sentMockEmails = [];
    const maliciousName = '<script>alert("xss")</script> & "Tester"';
    const xssCustEmail = `xss_cust_${ts}@example.com`;
    const xssRes = await fetch(`${baseUrl}/auth/register/customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: maliciousName,
        email: xssCustEmail,
        password: 'ValidPassword123!',
        phone: '9876543201'
      })
    });
    const xssData = await xssRes.json();
    if (xssData.user?._id) createdUserIds.push(xssData.user._id);

    const xssEmail = sentMockEmails.find((m) => m.to.toLowerCase() === xssCustEmail.toLowerCase());
    const isEscaped =
      xssEmail &&
      xssEmail.html &&
      !xssEmail.html.includes('<script>') &&
      xssEmail.html.includes('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; &quot;Tester&quot;');

    record(
      'Malicious user-supplied content is safely escaped in HTML emails',
      !!isEscaped,
      `HTML contains escaped: ${!xssEmail?.html?.includes('<script>')}`
    );

  } finally {
    // Cleanup created test records
    console.log('\n--- Cleaning up test records ---');
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    if (createdSalonIds.length > 0) {
      await Salon.deleteMany({ _id: { $in: createdSalonIds } });
      await EmailLog.deleteMany({ referenceId: { $in: createdSalonIds } });
    }
    if (createdUserIds.length > 0) {
      await EmailLog.deleteMany({ referenceId: { $in: createdUserIds } });
    }
    server.close();
    await mongoose.disconnect();
    emailService.clearTestState();
  }

  // Print Summary
  console.log('\n======================================================');
  console.log('                 TEST SUMMARY                         ');
  console.log('======================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`);

  if (failed > 0) {
    console.error('\nSome tests FAILED!');
    process.exit(1);
  } else {
    console.log('\nALL EMAIL NOTIFICATION SYSTEM TESTS PASSED SUCCESSFULLY! 🎉');
    process.exit(0);
  }
}

void runEmailNotificationFlowTests();
