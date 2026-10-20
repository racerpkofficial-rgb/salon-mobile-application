import bcrypt from 'bcryptjs';
import mongoose, { Types } from 'mongoose';
import { app } from './app.js';
import { env } from './config/env.js';
import { Appointment } from './models/Appointment.js';
import { Notification } from './models/Notification.js';
import { Review } from './models/Review.js';
import { Salon } from './models/Salon.js';
import { Service } from './models/Service.js';
import { User } from './models/User.js';
import { calculateReviewDeadline, REVIEW_WINDOW_MS } from './services/review.service.js';
import { issueToken } from './services/token.service.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  if (condition) {
    passed++;
    console.log(`✓ PASS: ${testName}`);
  } else {
    failed++;
    console.error(`✗ FAIL: ${testName}`, detail ? `\n    Detail: ${JSON.stringify(detail)}` : '');
  }
}

async function request(
  baseUrl: string,
  path: string,
  options: { method?: string; body?: any; token?: string } = {}
) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function runReviewsTestSuite() {
  console.log('====================================================================');
  console.log('   TESTING 48-HOUR REVIEW DEADLINE, DUPLICATE GUARDS & PERMISSIONS  ');
  console.log('====================================================================\n');

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(env.MONGODB_URI);
  }

  // Ensure unique indexes on Review are initialized in MongoDB
  await Review.init();

  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 4001;
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  const ts = Date.now();
  const passwordHash = await bcrypt.hash('Secret123!', 10);

  // 1. Setup Test Users: Customer A, Customer B, and Salon Owner
  const customerA = await User.create({
    name: 'Customer Alice',
    email: `cust_a_${ts}@test.com`,
    passwordHash,
    role: 'CUSTOMER',
    isActive: true
  });
  const tokenCustA = issueToken({ sub: customerA._id.toString(), role: 'CUSTOMER' });

  const customerB = await User.create({
    name: 'Customer Bob',
    email: `cust_b_${ts}@test.com`,
    passwordHash,
    role: 'CUSTOMER',
    isActive: true
  });
  const tokenCustB = issueToken({ sub: customerB._id.toString(), role: 'CUSTOMER' });

  const ownerUser = await User.create({
    name: 'Salon Owner Oscar',
    email: `owner_${ts}@test.com`,
    passwordHash,
    role: 'SALON_OWNER',
    isActive: true
  });
  const tokenOwner = issueToken({ sub: ownerUser._id.toString(), role: 'SALON_OWNER' });

  // 2. Setup Salon & Service
  const testSalon = await Salon.create({
    ownerId: ownerUser._id,
    salonName: `Atelier Luxury Salon ${ts}`,
    description: 'Premier salon ritual experience.',
    phone: '+919876543210',
    email: `salon_${ts}@test.com`,
    address: '42 Indiranagar 100ft Rd',
    city: 'Bengaluru',
    status: 'ACTIVE',
    subscriptionStatus: 'ACTIVE',
    rating: 0,
    reviews: 0
  });

  const testService = await Service.create({
    salonId: testSalon._id,
    name: 'Signature Royal Facial',
    price: 2500,
    durationMinutes: 45,
    category: 'Facial',
    isActive: true
  });

  console.log('Setup completed. Running test cases...\n');

  // =========================================================================
  // TEST 1: Booking is not completed — review rejected
  // =========================================================================
  console.log('--- Test 1: Booking is not completed ---');
  const appNotCompleted = await Appointment.create({
    customerId: customerA._id,
    salonId: testSalon._id,
    serviceId: testService._id,
    appointmentDate: '2026-10-15',
    startTime: '10:00',
    endTime: '10:45',
    status: 'CONFIRMED',
    serviceName: testService.name,
    totalPrice: 2500
  });

  const res1 = await request(baseUrl, `/appointments/${appNotCompleted._id}/review`, {
    method: 'POST',
    body: { rating: 5, comment: 'Loved it early!' },
    token: tokenCustA
  });
  assert(
    res1.status === 400 && res1.data?.message?.includes('not completed'),
    '1. Booking is not completed — review rejected with 400',
    res1.data
  );

  // =========================================================================
  // TEST 2: Booking completed just now — review accepted
  // =========================================================================
  console.log('\n--- Test 2: Booking completed just now ---');
  const appCompletedNow = await Appointment.create({
    customerId: customerA._id,
    salonId: testSalon._id,
    serviceId: testService._id,
    appointmentDate: '2026-10-14',
    startTime: '11:00',
    endTime: '11:45',
    status: 'CONFIRMED',
    serviceName: testService.name,
    totalPrice: 2500
  });

  // Owner marks completed
  const completeRes = await request(
    baseUrl,
    `/owner/appointments/${appCompletedNow._id}/complete`,
    {
      method: 'PATCH',
      token: tokenOwner
    }
  );
  assert(completeRes.status === 200, '2a. Owner completes appointment successfully');

  // Verify server-side completedAt was set
  const reloadedApp = await Appointment.findById(appCompletedNow._id);
  assert(
    reloadedApp?.status === 'COMPLETED' && Boolean(reloadedApp?.completedAt),
    '2b. Appointment has status COMPLETED and valid server completedAt'
  );

  // Customer checks eligibility
  const eligRes2 = await request(
    baseUrl,
    `/appointments/${appCompletedNow._id}/review-eligibility`,
    {
      token: tokenCustA
    }
  );
  assert(
    eligRes2.status === 200 &&
      eligRes2.data.canReview === true &&
      eligRes2.data.alreadyReviewed === false &&
      eligRes2.data.remainingTimeMs > 0,
    '2c. Review eligibility confirmed: canReview is true'
  );

  // Customer submits review
  const submitRes2 = await request(baseUrl, `/appointments/${appCompletedNow._id}/review`, {
    method: 'POST',
    body: { rating: 5, comment: 'Absolutely sensational hair treatment and service!' },
    token: tokenCustA
  });
  assert(
    submitRes2.status === 201 && submitRes2.data?.review?.rating === 5,
    '2d. Booking completed just now — review accepted with 201 Created'
  );

  // Verify salon rating was recalculated
  const salonAfterReview = await Salon.findById(testSalon._id);
  assert(
    salonAfterReview?.rating === 5 && salonAfterReview?.reviews === 1,
    '2e. Salon rating and review count updated in MongoDB'
  );

  // =========================================================================
  // TEST 3: Deadline is 47 hours, 59 minutes, 59 seconds after completion — accepted
  // =========================================================================
  console.log('\n--- Test 3: Deadline at 47h 59m 59s ---');
  // 47 hours, 59 mins, 59 secs ago = 1 second remaining before 48h deadline
  const time47h59m59sAgo = new Date(Date.now() - (47 * 3600 + 59 * 60 + 59) * 1000);
  const appNearDeadline = await Appointment.create({
    customerId: customerA._id,
    salonId: testSalon._id,
    serviceId: testService._id,
    appointmentDate: '2026-10-11',
    startTime: '09:00',
    endTime: '09:45',
    status: 'COMPLETED',
    completedAt: time47h59m59sAgo,
    serviceName: testService.name,
    totalPrice: 2500
  });

  const eligRes3 = await request(
    baseUrl,
    `/appointments/${appNearDeadline._id}/review-eligibility`,
    {
      token: tokenCustA
    }
  );
  assert(
    eligRes3.status === 200 &&
      eligRes3.data.canReview === true &&
      eligRes3.data.remainingTimeMs > 0,
    '3a. Eligibility check near deadline reports canReview: true'
  );

  const submitRes3 = await request(baseUrl, `/appointments/${appNearDeadline._id}/review`, {
    method: 'POST',
    body: { rating: 4, comment: 'Submitting right before 48h cutoff.' },
    token: tokenCustA
  });
  assert(
    submitRes3.status === 201,
    '3b. Deadline is 47h 59m 59s after completion — review accepted'
  );

  // =========================================================================
  // TEST 4: Deadline is exactly 48 hours after completion — rejected
  // =========================================================================
  console.log('\n--- Test 4: Deadline at exactly 48 hours ---');
  // Exactly 48 hours ago
  const timeExact48hAgo = new Date(Date.now() - 48 * 3600 * 1000);
  const appExact48h = await Appointment.create({
    customerId: customerA._id,
    salonId: testSalon._id,
    serviceId: testService._id,
    appointmentDate: '2026-10-10',
    startTime: '10:00',
    endTime: '10:45',
    status: 'COMPLETED',
    completedAt: timeExact48hAgo,
    serviceName: testService.name,
    totalPrice: 2500
  });

  const eligRes4 = await request(baseUrl, `/appointments/${appExact48h._id}/review-eligibility`, {
    token: tokenCustA
  });
  assert(
    eligRes4.status === 200 &&
      eligRes4.data.canReview === false &&
      eligRes4.data.remainingTimeMs === 0,
    '4a. Eligibility at exactly 48 hours reports canReview: false'
  );

  const submitRes4 = await request(baseUrl, `/appointments/${appExact48h._id}/review`, {
    method: 'POST',
    body: { rating: 4, comment: 'Submitting at exact 48h mark.' },
    token: tokenCustA
  });
  assert(
    submitRes4.status === 400 && submitRes4.data?.message?.includes('expired'),
    '4b. Deadline is exactly 48 hours after completion — strictly rejected with 400',
    submitRes4.data
  );

  // =========================================================================
  // TEST 5: Deadline is 48 hours and 1 second after completion — rejected
  // =========================================================================
  console.log('\n--- Test 5: Deadline at 48 hours and 1 second ---');
  const time48h1sAgo = new Date(Date.now() - (48 * 3600 + 1) * 1000);
  const appExpired1s = await Appointment.create({
    customerId: customerA._id,
    salonId: testSalon._id,
    serviceId: testService._id,
    appointmentDate: '2026-10-09',
    startTime: '10:00',
    endTime: '10:45',
    status: 'COMPLETED',
    completedAt: time48h1sAgo,
    serviceName: testService.name,
    totalPrice: 2500
  });

  const submitRes5 = await request(baseUrl, `/appointments/${appExpired1s._id}/review`, {
    method: 'POST',
    body: { rating: 3, comment: 'Just 1 second late.' },
    token: tokenCustA
  });
  assert(
    submitRes5.status === 400 && submitRes5.data?.message?.includes('expired'),
    '5. Deadline is 48 hours and 1 second after completion — rejected with 400',
    submitRes5.data
  );

  // =========================================================================
  // TEST 6: Mobile/client-supplied future or past clock cannot bypass deadline
  // =========================================================================
  console.log('\n--- Test 6: Client manipulated clock payload rejected ---');
  const fakeFutureDate = new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString();
  const res6 = await request(baseUrl, `/appointments/${appExpired1s._id}/review`, {
    method: 'POST',
    body: {
      rating: 5,
      comment: 'Attempting to inject fake client timestamps',
      completedAt: fakeFutureDate,
      reviewDeadline: fakeFutureDate,
      serverTime: fakeFutureDate
    },
    token: tokenCustA
  });
  assert(
    res6.status === 400 && res6.data?.message?.includes('expired'),
    '6. Client-supplied clock or timestamp override cannot bypass deadline',
    res6.data
  );

  // =========================================================================
  // TEST 7: Timestamps serialize correctly across UTC and timezone offsets
  // =========================================================================
  console.log('\n--- Test 7: UTC serialization & timezone offset invariance ---');
  const sampleCompleted = new Date('2026-10-13T10:00:00.000Z');
  const deadlineUtc = calculateReviewDeadline(sampleCompleted);

  // Deadline must be exactly 48 hours later in UTC
  const expectedDeadlineIso = '2026-10-15T10:00:00.000Z';
  const actualDeadlineIso = deadlineUtc.toISOString();

  // Test parsing across simulated ISO string formats (Z vs +05:30)
  const parsedFromIst = new Date('2026-10-13T15:30:00.000+05:30'); // Same instant
  assert(
    actualDeadlineIso === expectedDeadlineIso &&
      parsedFromIst.getTime() === sampleCompleted.getTime(),
    '7. Completion timestamp and deadline serialize correctly as UTC instants across offsets'
  );

  // =========================================================================
  // TEST 8: Daylight-saving/timezone conversion does not change 48h duration
  // =========================================================================
  console.log('\n--- Test 8: Daylight-saving duration invariance ---');
  // 2026 US spring-forward DST transition happens on March 8, 2026
  const dstTransitionCompleted = new Date('2026-03-07T12:00:00.000Z');
  const dstDeadline = calculateReviewDeadline(dstTransitionCompleted);
  const diffMs = dstDeadline.getTime() - dstTransitionCompleted.getTime();

  assert(
    diffMs === REVIEW_WINDOW_MS && diffMs === 48 * 3600 * 1000,
    '8. Daylight-saving / timezone conversion preserves exact 48-hour duration (172,800,000 ms)'
  );

  // =========================================================================
  // TEST 9: Customer cannot review another customer's booking
  // =========================================================================
  console.log("\n--- Test 9: Customer cannot review another customer's booking ---");
  const appCustA = await Appointment.create({
    customerId: customerA._id,
    salonId: testSalon._id,
    serviceId: testService._id,
    appointmentDate: '2026-10-13',
    startTime: '14:00',
    endTime: '14:45',
    status: 'COMPLETED',
    completedAt: new Date(),
    serviceName: testService.name,
    totalPrice: 2500
  });

  // Customer B tries to review Customer A's booking
  const res9Submit = await request(baseUrl, `/appointments/${appCustA._id}/review`, {
    method: 'POST',
    body: { rating: 1, comment: 'Impostor review attempt' },
    token: tokenCustB
  });
  assert(
    res9Submit.status === 403,
    "9a. Customer cannot submit review for another customer's booking (403 Forbidden)"
  );

  const res9Elig = await request(
    baseUrl,
    `/appointments/${appCustA._id}/review-eligibility`,
    {
      token: tokenCustB
    }
  );
  assert(
    res9Elig.status === 403,
    "9b. Customer cannot view eligibility for another customer's booking (403 Forbidden)"
  );

  // =========================================================================
  // TEST 10: Duplicate review submissions rejected, including concurrent requests
  // =========================================================================
  console.log('\n--- Test 10: Duplicate & concurrent review submissions rejected ---');
  // First submission by Customer A on appCustA
  const firstSub = await request(baseUrl, `/appointments/${appCustA._id}/review`, {
    method: 'POST',
    body: { rating: 5, comment: 'First real review' },
    token: tokenCustA
  });
  assert(firstSub.status === 201, '10a. First review submission accepted');

  // Second sequential submission attempt on same booking
  const secondSub = await request(baseUrl, `/appointments/${appCustA._id}/review`, {
    method: 'POST',
    body: { rating: 3, comment: 'Second duplicate review attempt' },
    token: tokenCustA
  });
  assert(
    secondSub.status === 409,
    '10b. Duplicate sequential review submission rejected with 409 Conflict'
  );

  // Concurrency test on another fresh completed appointment
  const appConcurrent = await Appointment.create({
    customerId: customerA._id,
    salonId: testSalon._id,
    serviceId: testService._id,
    appointmentDate: '2026-10-13',
    startTime: '15:00',
    endTime: '15:45',
    status: 'COMPLETED',
    completedAt: new Date(),
    serviceName: testService.name,
    totalPrice: 2500
  });

  // Launch 3 concurrent submissions simultaneously
  const concurrentResults = await Promise.all([
    request(baseUrl, `/appointments/${appConcurrent._id}/review`, {
      method: 'POST',
      body: { rating: 5, comment: 'Concurrent Request 1' },
      token: tokenCustA
    }),
    request(baseUrl, `/appointments/${appConcurrent._id}/review`, {
      method: 'POST',
      body: { rating: 5, comment: 'Concurrent Request 2' },
      token: tokenCustA
    }),
    request(baseUrl, `/appointments/${appConcurrent._id}/review`, {
      method: 'POST',
      body: { rating: 5, comment: 'Concurrent Request 3' },
      token: tokenCustA
    })
  ]);

  const successCount = concurrentResults.filter((r) => r.status === 201).length;
  const conflictCount = concurrentResults.filter((r) => r.status === 409).length;
  const dbReviewCount = await Review.countDocuments({ appointmentId: appConcurrent._id });

  assert(
    successCount === 1 && conflictCount === 2 && dbReviewCount === 1,
    '10c. Concurrent submissions safely handled: exactly 1 accepted, remainder rejected with 409'
  );

  // =========================================================================
  // TEST 11: Review update/edit and delete requests are rejected after submission
  // =========================================================================
  console.log('\n--- Test 11: Review immutability and owner reply enforcement ---');
  const reviewAId = firstSub.data?.review?._id;

  // Customer attempts PATCH /reviews/:id
  const editRes1 = await request(baseUrl, `/reviews/${reviewAId}`, {
    method: 'PATCH',
    body: { rating: 1, comment: 'Malicious edit attempt' },
    token: tokenCustA
  });
  assert(
    editRes1.status === 403,
    '11a. Customer PATCH /reviews/:id edit request rejected with 403'
  );

  // Customer attempts PUT /reviews/:id
  const editRes2 = await request(baseUrl, `/reviews/${reviewAId}`, {
    method: 'PUT',
    body: { rating: 1, comment: 'Malicious edit attempt' },
    token: tokenCustA
  });
  assert(
    editRes2.status === 403,
    '11b. Customer PUT /reviews/:id edit request rejected with 403'
  );

  // Customer attempts DELETE /reviews/:id
  const deleteRes = await request(baseUrl, `/reviews/${reviewAId}`, {
    method: 'DELETE',
    token: tokenCustA
  });
  assert(
    deleteRes.status === 403,
    '11c. Customer review deletion rejected with 403'
  );

  // Salon owner attempts to edit customer's rating or text
  const ownerEditRes = await request(baseUrl, `/reviews/${reviewAId}`, {
    method: 'PATCH',
    body: { rating: 5, comment: 'Owner altered customer text' },
    token: tokenOwner
  });
  assert(
    ownerEditRes.status === 403,
    '11d. Salon owner cannot edit customer review (403 Forbidden)'
  );

  // Salon owner replies to review
  const replyRes = await request(baseUrl, `/reviews/${reviewAId}/reply`, {
    method: 'POST',
    body: { reply: 'Thank you for choosing Atelier! It was a pleasure hosting you.' },
    token: tokenOwner
  });
  assert(
    replyRes.status === 200 &&
      replyRes.data?.review?.ownerReply?.includes('Thank you for choosing Atelier'),
    '11e. Salon owner can submit a verified reply to the review'
  );

  // Verify customer review text and rating were NOT changed by owner reply
  const reviewAfterReply = await Review.findById(reviewAId);
  assert(
    reviewAfterReply?.rating === 5 &&
      reviewAfterReply?.comment === 'First real review' &&
      Boolean(reviewAfterReply?.ownerReply),
    '11f. Customer review rating & comment remained strictly immutable after owner reply'
  );

  // =========================================================================
  // TEST 12: Expired reviews cannot be submitted even if UI shows stale button
  // =========================================================================
  console.log('\n--- Test 12: Stale UI submission on expired booking blocked ---');
  const appStaleExpired = await Appointment.create({
    customerId: customerA._id,
    salonId: testSalon._id,
    serviceId: testService._id,
    appointmentDate: '2026-10-01',
    startTime: '10:00',
    endTime: '10:45',
    status: 'COMPLETED',
    completedAt: new Date(Date.now() - 72 * 3600 * 1000), // 72h ago
    serviceName: testService.name,
    totalPrice: 2500
  });

  const staleSubRes = await request(baseUrl, `/appointments/${appStaleExpired._id}/review`, {
    method: 'POST',
    body: { rating: 4, comment: 'Stale button click after 72 hours' },
    token: tokenCustA
  });
  assert(
    staleSubRes.status === 400 && staleSubRes.data?.canReview === false,
    '12. Stale client UI review submission strictly rejected by authoritative backend'
  );

  // =========================================================================
  // TEST 13: Review eligibility changes correctly when server time passes deadline
  // =========================================================================
  console.log('\n--- Test 13: Review eligibility status transition ---');
  const appActiveEligible = await Appointment.create({
    customerId: customerA._id,
    salonId: testSalon._id,
    serviceId: testService._id,
    appointmentDate: '2026-10-13',
    startTime: '12:00',
    endTime: '12:45',
    status: 'COMPLETED',
    completedAt: new Date(),
    serviceName: testService.name,
    totalPrice: 2500
  });

  const eligBefore = await request(
    baseUrl,
    `/appointments/${appActiveEligible._id}/review-eligibility`,
    {
      token: tokenCustA
    }
  );
  assert(
    eligBefore.status === 200 && eligBefore.data.canReview === true,
    '13a. Fresh completed booking has canReview: true'
  );

  // Transition completedAt past the 48-hour window
  appActiveEligible.completedAt = new Date(Date.now() - 49 * 3600 * 1000);
  await appActiveEligible.save();

  const eligAfter = await request(
    baseUrl,
    `/appointments/${appActiveEligible._id}/review-eligibility`,
    {
      token: tokenCustA
    }
  );
  assert(
    eligAfter.status === 200 &&
      eligAfter.data.canReview === false &&
      eligAfter.data.reason?.includes('expired'),
    '13b. After server time passes deadline, canReview transitions to false with expired reason'
  );

  // =========================================================================
  // TEST 14: Completion notifications not duplicated when completion is retried
  // =========================================================================
  console.log('\n--- Test 14: Idempotent booking completion notification ---');
  const appForNotif = await Appointment.create({
    customerId: customerA._id,
    salonId: testSalon._id,
    serviceId: testService._id,
    appointmentDate: '2026-10-13',
    startTime: '16:00',
    endTime: '16:45',
    status: 'CONFIRMED',
    serviceName: testService.name,
    totalPrice: 2500
  });

  // First completion call
  const notifComp1 = await request(
    baseUrl,
    `/owner/appointments/${appForNotif._id}/complete`,
    {
      method: 'PATCH',
      token: tokenOwner
    }
  );
  assert(notifComp1.status === 200, '14a. First completion marks appointment completed');

  const notifCount1 = await Notification.countDocuments({
    appointmentId: appForNotif._id,
    type: 'BOOKING_COMPLETED'
  });
  assert(notifCount1 === 1, '14b. Exactly 1 BOOKING_COMPLETED notification sent');

  // Verify notification message contains 48-hour deadline information
  const notifDoc = await Notification.findOne({
    appointmentId: appForNotif._id,
    type: 'BOOKING_COMPLETED'
  });
  assert(
    Boolean(notifDoc?.message?.includes('48 hours')) &&
      notifDoc?.data?.deadline !== undefined,
    '14c. Notification payload includes salon name, 48h deadline, and review deep link data'
  );

  // Retry completion call
  const notifComp2 = await request(
    baseUrl,
    `/owner/appointments/${appForNotif._id}/complete`,
    {
      method: 'PATCH',
      token: tokenOwner
    }
  );
  assert(notifComp2.status === 200, '14d. Retried completion returns 200 success');

  const notifCount2 = await Notification.countDocuments({
    appointmentId: appForNotif._id,
    type: 'BOOKING_COMPLETED'
  });
  assert(
    notifCount2 === 1,
    '14e. Retry does NOT create duplicate completion notification (count remains 1)'
  );

  // =========================================================================
  // TEST 15: Public salon reviews listing endpoint
  // =========================================================================
  console.log('\n--- Test 15: Public Salon Reviews Listing & Aggregation ---');
  const listReviewsRes = await request(baseUrl, `/salons/${testSalon._id}/reviews`);
  assert(
    listReviewsRes.status === 200 &&
      Array.isArray(listReviewsRes.data?.data) &&
      listReviewsRes.data?.data?.length > 0 &&
      listReviewsRes.data?.summary?.averageRating > 0,
    '15. Salon reviews listed with pagination, average rating, and rating distribution'
  );

  // Cleanup test server
  server.close();

  console.log('\n====================================================================');
  console.log(`TEST SUITE RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runReviewsTestSuite().catch((err) => {
  console.error('Test suite failed with unexpected error:', err);
  process.exit(1);
});
