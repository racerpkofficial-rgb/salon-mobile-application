import bcrypt from 'bcryptjs';
import mongoose, { Types } from 'mongoose';
import { app } from './app.js';
import { env } from './config/env.js';
import { Appointment } from './models/Appointment.js';
import { Review } from './models/Review.js';
import { Salon } from './models/Salon.js';
import { Service } from './models/Service.js';
import { User } from './models/User.js';
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

async function runPublicReviewsTestSuite() {
  console.log('====================================================================');
  console.log('   TESTING PUBLIC RATINGS & REVIEWS AND SALON OWNER REPLIES FLOWS   ');
  console.log('====================================================================\n');

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(env.MONGODB_URI);
  }

  await Review.init();

  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 4002;
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  const ts = Date.now();
  const passwordHash = await bcrypt.hash('Secret123!', 10);

  // Setup Test Users
  const customer1 = await User.create({
    name: 'Customer Sophia',
    email: `cust_sophia_${ts}@test.com`,
    passwordHash,
    role: 'CUSTOMER',
    isActive: true
  });
  const tokenCust1 = issueToken({ sub: customer1._id.toString(), role: 'CUSTOMER' });

  const customer2 = await User.create({
    name: 'Customer Liam',
    email: `cust_liam_${ts}@test.com`,
    passwordHash,
    role: 'CUSTOMER',
    isActive: true
  });
  const tokenCust2 = issueToken({ sub: customer2._id.toString(), role: 'CUSTOMER' });

  const owner1 = await User.create({
    name: 'Owner Elena (Salon 1)',
    email: `owner_elena_${ts}@test.com`,
    passwordHash,
    role: 'SALON_OWNER',
    isActive: true
  });
  const tokenOwner1 = issueToken({ sub: owner1._id.toString(), role: 'SALON_OWNER' });

  const owner2 = await User.create({
    name: 'Owner Marcus (Salon 2)',
    email: `owner_marcus_${ts}@test.com`,
    passwordHash,
    role: 'SALON_OWNER',
    isActive: true
  });
  const tokenOwner2 = issueToken({ sub: owner2._id.toString(), role: 'SALON_OWNER' });

  // Setup 2 Salons
  const salon1 = await Salon.create({
    ownerId: owner1._id,
    salonName: `Luxe Crown Atelier ${ts}`,
    description: 'Boutique hair and spa rituals.',
    phone: '+919876543201',
    email: `salon1_${ts}@test.com`,
    address: '100 Palm Avenue, Indiranagar',
    city: 'Bengaluru',
    location: { coordinates: [77.6408, 12.9784] },
    services: [],
    status: 'ACTIVE'
  });

  const salon2 = await Salon.create({
    ownerId: owner2._id,
    salonName: `Golden Strand Salon ${ts}`,
    description: 'Artisan styling and facial therapies.',
    phone: '+919876543202',
    email: `salon2_${ts}@test.com`,
    address: '45 MG Road',
    city: 'Bengaluru',
    location: { coordinates: [77.6101, 12.9716] },
    services: [],
    status: 'ACTIVE'
  });

  // Setup Services
  const service1 = await Service.create({
    salonId: salon1._id,
    name: 'Signature Botanical Hair Spa',
    category: 'Hair Care',
    price: 2500,
    durationMinutes: 60,
    isActive: true
  });

  const service2 = await Service.create({
    salonId: salon1._id,
    name: 'Royal Keratin Treatment',
    category: 'Hair Care',
    price: 4500,
    durationMinutes: 90,
    isActive: true
  });

  const serviceSalon2 = await Service.create({
    salonId: salon2._id,
    name: 'Deluxe Beard Grooming',
    category: 'Grooming',
    price: 1200,
    durationMinutes: 45,
    isActive: true
  });

  // Setup Completed Appointments
  const now = new Date();
  const completedRecent1 = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago
  const completedRecent2 = new Date(now.getTime() - 5 * 60 * 60 * 1000); // 5 hours ago
  const completedRecent3 = new Date(now.getTime() - 8 * 60 * 60 * 1000); // 8 hours ago
  const completedExpired = new Date(now.getTime() - 50 * 60 * 60 * 1000); // 50 hours ago (past 48h)

  const dateStrRecent1 = completedRecent1.toISOString().split('T')[0];
  const dateStrRecent2 = completedRecent2.toISOString().split('T')[0];
  const dateStrRecent3 = completedRecent3.toISOString().split('T')[0];
  const dateStrExpired = completedExpired.toISOString().split('T')[0];

  const appt1 = await Appointment.create({
    customerId: customer1._id,
    salonId: salon1._id,
    serviceId: service1._id,
    serviceName: service1.name,
    appointmentDate: dateStrRecent1,
    startTime: '11:00',
    endTime: '12:00',
    status: 'COMPLETED',
    completedAt: completedRecent1,
    customerNote: 'Test booking 1'
  });

  const appt2 = await Appointment.create({
    customerId: customer2._id,
    salonId: salon1._id,
    serviceId: service2._id,
    serviceName: service2.name,
    appointmentDate: dateStrRecent2,
    startTime: '14:00',
    endTime: '15:30',
    status: 'COMPLETED',
    completedAt: completedRecent2,
    customerNote: 'Test booking 2'
  });

  const apptSalon2 = await Appointment.create({
    customerId: customer1._id,
    salonId: salon2._id,
    serviceId: serviceSalon2._id,
    serviceName: serviceSalon2.name,
    appointmentDate: dateStrRecent3,
    startTime: '16:00',
    endTime: '16:45',
    status: 'COMPLETED',
    completedAt: completedRecent3,
    customerNote: 'Test booking for salon 2'
  });

  const apptExpired = await Appointment.create({
    customerId: customer1._id,
    salonId: salon1._id,
    serviceId: service1._id,
    serviceName: service1.name,
    appointmentDate: dateStrExpired,
    startTime: '10:00',
    endTime: '11:00',
    status: 'COMPLETED',
    completedAt: completedExpired,
    customerNote: 'Test expired booking'
  });

  try {
    // ------------------------------------------------------------------------
    // SECTION 1: Customer Review Submission & 48-Hour Enforcement
    // ------------------------------------------------------------------------
    console.log('--- SECTION 1: Customer Review Submission & 48-Hour Rule ---');

    // Submit review within 48 hours (appt1)
    const subRes1 = await request(baseUrl, '/reviews', {
      method: 'POST',
      token: tokenCust1,
      body: {
        appointmentId: appt1._id.toString(),
        rating: 5,
        comment: 'Exceptional service! The botanical hair spa was deeply relaxing.'
      }
    });
    assert(subRes1.status === 201, 'Customer submits review within 48 hours (HTTP 201)', subRes1.data);
    const reviewId1 = (subRes1.data?.data?._id || subRes1.data?.review?._id)?.toString();
    assert(Boolean(reviewId1), 'Review created has valid ID');
    assert((subRes1.data?.data?.rating || subRes1.data?.review?.rating) === 5, 'Customer review rating is 5 stars');

    // Duplicate review prevention for the same booking
    const dupRes = await request(baseUrl, '/reviews', {
      method: 'POST',
      token: tokenCust1,
      body: {
        appointmentId: appt1._id.toString(),
        rating: 4,
        comment: 'Trying to submit duplicate review.'
      }
    });
    assert(dupRes.status === 400 || dupRes.status === 409, 'Duplicate review for same appointment is rejected', dupRes.data);

    // Customer submits second review on different appointment (appt2)
    const subRes2 = await request(baseUrl, '/reviews', {
      method: 'POST',
      token: tokenCust2,
      body: {
        appointmentId: appt2._id.toString(),
        rating: 4,
        comment: 'Great keratin treatment, very shiny hair. Waiting time was a bit long.'
      }
    });
    assert(subRes2.status === 201, 'Customer 2 submits 4-star review (HTTP 201)');
    const reviewId2 = (subRes2.data?.data?._id || subRes2.data?.review?._id)?.toString();

    // Customer submits review for Salon 2
    const subRes3 = await request(baseUrl, '/reviews', {
      method: 'POST',
      token: tokenCust1,
      body: {
        appointmentId: apptSalon2._id.toString(),
        rating: 5,
        comment: 'Top quality beard grooming at Salon 2!'
      }
    });
    assert(subRes3.status === 201, 'Customer submits review for Salon 2 (HTTP 201)');

    // Attempt review after 48-hour deadline (apptExpired)
    const expiredRes = await request(baseUrl, '/reviews', {
      method: 'POST',
      token: tokenCust1,
      body: {
        appointmentId: apptExpired._id.toString(),
        rating: 5,
        comment: 'Late review after 48 hours'
      }
    });
    assert(expiredRes.status === 400, 'Review submission after 48h deadline is rejected (HTTP 400)');
    assert(
      typeof expiredRes.data?.message === 'string' &&
      expiredRes.data.message.toLowerCase().includes('48'),
      'Expired review response specifies 48-hour deadline window'
    );

    // ------------------------------------------------------------------------
    // SECTION 2: Public Reviews Endpoint & Populated Data
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 2: Public Reviews Endpoint & Populated Data ---');

    // Public call with no auth token
    const publicAll = await request(baseUrl, '/reviews');
    assert(publicAll.status === 200, 'Public GET /reviews succeeds without authentication (HTTP 200)');
    assert(Array.isArray(publicAll.data?.data), 'Returns reviews array');
    assert(publicAll.data?.data.length >= 3, `Returns all public reviews (found ${publicAll.data?.data.length})`);

    // Verify populated customer name, salon details, and appointment service name
    const sampleReview = publicAll.data?.data.find((r: any) => r._id === reviewId1);
    assert(sampleReview != null, 'Found Review 1 in public reviews feed');
    assert(sampleReview?.customerId?.name === 'Customer Sophia', 'Populated customer name matches');
    assert(sampleReview?.salonId?.salonName === salon1.salonName, 'Populated salon name matches');
    assert(
      sampleReview?.appointmentId?.serviceName === 'Signature Botanical Hair Spa',
      'Populated service name matches appointment service'
    );
    assert(typeof sampleReview?.createdAt === 'string', 'Review includes valid review date');

    // Verify rating summary metrics
    assert(typeof publicAll.data?.summary?.averageRating === 'number', 'Summary includes averageRating');
    assert(typeof publicAll.data?.summary?.totalReviews === 'number', 'Summary includes totalReviews');
    assert(Boolean(publicAll.data?.summary?.distribution), 'Summary includes rating distribution breakdown');

    // ------------------------------------------------------------------------
    // SECTION 3: Filters, Search, and Sorting
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 3: Filters, Search, and Sorting ---');

    // Filter by salonId
    const salon1Reviews = await request(baseUrl, `/reviews?salonId=${salon1._id.toString()}`);
    assert(salon1Reviews.status === 200, 'Filter by salonId succeeds (HTTP 200)');
    const allBelongToSalon1 = salon1Reviews.data?.data.every(
      (r: any) => (r.salonId?._id || r.salonId) === salon1._id.toString()
    );
    assert(allBelongToSalon1 === true, 'All returned reviews strictly belong to salon 1');
    assert(salon1Reviews.data?.summary?.totalReviews === 2, 'Salon 1 totalReviews in summary is exactly 2');
    assert(salon1Reviews.data?.summary?.averageRating === 4.5, 'Salon 1 averageRating is (5+4)/2 = 4.5');

    // Filter by salon2 - test multi-salon review isolation
    const salon2Reviews = await request(baseUrl, `/reviews?salonId=${salon2._id.toString()}`);
    assert(salon2Reviews.status === 200, 'Filter by salon2 succeeds (HTTP 200)');
    assert(salon2Reviews.data?.data.length === 1, 'Salon 2 has exactly 1 review');
    const allBelongToSalon2 = salon2Reviews.data?.data.every(
      (r: any) => (r.salonId?._id || r.salonId)?.toString() === salon2._id.toString()
    );
    assert(allBelongToSalon2 === true, 'All returned reviews strictly belong to salon 2 (no mixing with salon 1)');
    assert(salon2Reviews.data?.summary?.totalReviews === 1, 'Salon 2 totalReviews in summary is exactly 1');
    assert(salon2Reviews.data?.summary?.averageRating === 5.0, 'Salon 2 averageRating is 5.0');

    // Test invalid salonId does NOT return other salons' reviews
    const invalidSalonReviews = await request(baseUrl, `/reviews?salonId=invalid_mock_salon_id`);
    assert(invalidSalonReviews.status === 200, 'Query with invalid salonId succeeds safely (HTTP 200)');
    assert(invalidSalonReviews.data?.data.length === 0, 'Invalid salonId returns 0 reviews (does not leak other salons)');
    assert(invalidSalonReviews.data?.summary?.totalReviews === 0, 'Invalid salonId summary totalReviews is 0');

    // Filter by star rating (rating=5)
    const rating5Reviews = await request(baseUrl, `/reviews?salonId=${salon1._id.toString()}&rating=5`);
    assert(rating5Reviews.status === 200, 'Filter by rating=5 succeeds');
    assert(
      rating5Reviews.data?.data.length === 1 && rating5Reviews.data?.data[0].rating === 5,
      'Only 5-star reviews returned when rating=5'
    );

    // Search query filter
    const searchRes = await request(baseUrl, `/reviews?search=botanical`);
    assert(searchRes.status === 200, 'Search query filter succeeds');
    assert(
      searchRes.data?.data.some((r: any) => r.comment.toLowerCase().includes('botanical')),
      'Search query returns matching review comments'
    );

    // Sorting by lowest rating first
    const sortLowest = await request(baseUrl, `/reviews?salonId=${salon1._id.toString()}&sortBy=lowest`);
    assert(sortLowest.status === 200, 'Sort by lowest succeeds');
    assert(
      sortLowest.data?.data[0].rating <= sortLowest.data?.data[1].rating,
      'Reviews ordered ascending by rating when sortBy=lowest'
    );

    // Sorting by highest rating first
    const sortHighest = await request(baseUrl, `/reviews?salonId=${salon1._id.toString()}&sortBy=highest`);
    assert(sortHighest.status === 200, 'Sort by highest succeeds');
    assert(
      sortHighest.data?.data[0].rating >= sortHighest.data?.data[1].rating,
      'Reviews ordered descending by rating when sortBy=highest'
    );

    // ------------------------------------------------------------------------
    // SECTION 4: Salon Owner Replies & Ownership Authorization
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 4: Salon Owner Replies & Authorization ---');

    // Owner 1 replies to Review 1 (belongs to Salon 1)
    const replyRes1 = await request(baseUrl, `/reviews/${reviewId1}/reply`, {
      method: 'POST',
      token: tokenOwner1,
      body: {
        reply: 'Thank you so much Sophia! We take great pride in our botanical treatments. Hope to welcome you again soon!'
      }
    });
    assert(replyRes1.status === 200, 'Salon Owner 1 successfully replies to Salon 1 review (HTTP 200)', replyRes1.data);
    const replyText1 = replyRes1.data?.data?.ownerReply || replyRes1.data?.data?.reply || replyRes1.data?.review?.ownerReply;
    assert(
      replyText1?.includes('botanical treatments'),
      'Owner reply text is saved and returned'
    );
    const replyTime1 = replyRes1.data?.data?.ownerRepliedAt || replyRes1.data?.data?.replyCreatedAt || replyRes1.data?.review?.ownerRepliedAt;
    assert(Boolean(replyTime1), 'Owner reply has reply timestamp');

    // Customer attempt to reply -> 403 Forbidden
    const custReply = await request(baseUrl, `/reviews/${reviewId2}/reply`, {
      method: 'POST',
      token: tokenCust1,
      body: { reply: 'Customers should not be allowed to post salon replies.' }
    });
    assert(custReply.status === 403, 'Customer cannot reply to reviews (HTTP 403 Forbidden)');

    // Owner 2 attempts to reply to Salon 1's review -> 403 Forbidden
    const unauthOwnerReply = await request(baseUrl, `/reviews/${reviewId1}/reply`, {
      method: 'POST',
      token: tokenOwner2,
      body: { reply: 'Owner 2 trying to hijack Salon 1 review reply.' }
    });
    assert(
      unauthOwnerReply.status === 403,
      'Owner 2 cannot reply to reviews belonging to Salon 1 (HTTP 403 Forbidden)'
    );

    // Unauthenticated user attempt to reply -> 401 Unauthorized
    const unauthAnonReply = await request(baseUrl, `/reviews/${reviewId1}/reply`, {
      method: 'POST',
      body: { reply: 'Anonymous reply.' }
    });
    assert(unauthAnonReply.status === 401, 'Unauthenticated user cannot reply (HTTP 401 Unauthorized)');

    // Validation: Empty reply rejected
    const emptyReply = await request(baseUrl, `/reviews/${reviewId2}/reply`, {
      method: 'POST',
      token: tokenOwner1,
      body: { reply: '   ' }
    });
    assert(emptyReply.status === 400, 'Empty owner reply is rejected (HTTP 400 Bad Request)');

    // ------------------------------------------------------------------------
    // SECTION 5: Editing Owner Reply & Non-Mutation of Customer Content
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 5: Editing Owner Reply & Preservation of Customer Rating ---');

    // Owner 1 edits reply using PATCH /reviews/:id/reply
    const editReplyRes = await request(baseUrl, `/reviews/${reviewId1}/reply`, {
      method: 'PATCH',
      token: tokenOwner1,
      body: {
        reply: 'Thank you Sophia! We have added complimentary scalp massages to our botanical rituals for your next visit.'
      }
    });
    assert(editReplyRes.status === 200, 'Owner 1 successfully edits their reply (HTTP 200)');
    const editedText = editReplyRes.data?.data?.ownerReply || editReplyRes.data?.data?.reply || editReplyRes.data?.review?.ownerReply;
    assert(
      editedText?.includes('complimentary scalp massages'),
      'Edited reply content is updated'
    );
    const editedTime = editReplyRes.data?.data?.ownerRepliedAt || editReplyRes.data?.data?.replyUpdatedAt || editReplyRes.data?.review?.ownerRepliedAt;
    assert(Boolean(editedTime), 'Edited reply has reply timestamp');

    // Verify Customer Rating & Written Comment were NOT modified
    const reviewAfterEdit = await Review.findById(reviewId1).lean();
    assert(reviewAfterEdit?.rating === 5, 'Customer star rating remains unaltered (5 stars)');
    assert(
      reviewAfterEdit?.comment === 'Exceptional service! The botanical hair spa was deeply relaxing.',
      'Customer written comment remains unaltered'
    );

    // Owner 2 attempts to edit Owner 1's reply -> 403 Forbidden
    const unauthEditReply = await request(baseUrl, `/reviews/${reviewId1}/reply`, {
      method: 'PATCH',
      token: tokenOwner2,
      body: { reply: 'Owner 2 editing Owner 1 reply' }
    });
    assert(unauthEditReply.status === 403, 'Owner 2 cannot edit Salon 1 reply (HTTP 403 Forbidden)');

    // ------------------------------------------------------------------------
    // SECTION 6: Persistence & Rating Calculation Integrity
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 6: Persistence & Rating Calculation Integrity ---');

    // Fetch public reviews again to ensure reply is persisted and visible to anyone
    const publicPersistent = await request(baseUrl, `/reviews?salonId=${salon1._id.toString()}`);
    assert(publicPersistent.status === 200, 'Public GET reviews returns persistent data');
    const persistedRev1 = publicPersistent.data?.data.find((r: any) => r._id === reviewId1);
    const persistedText = persistedRev1?.ownerReply || persistedRev1?.reply;
    assert(
      persistedText?.includes('complimentary scalp massages'),
      'Owner reply persists in database and is returned in public review query'
    );

    // Ensure Salon's overall rating is strictly derived from customer reviews (5 and 4 = 4.5)
    // and owner reply does NOT count as a review or alter review count
    const updatedSalon1 = await Salon.findById(salon1._id).lean();
    assert(updatedSalon1?.reviews === 2, `Salon 1 total reviews is 2 (found ${updatedSalon1?.reviews})`);
    assert(updatedSalon1?.rating === 4.5, `Salon 1 average rating is 4.5 (found ${updatedSalon1?.rating})`);

    // Customer cannot modify or resubmit their review
    const custEditAttempt = await request(baseUrl, `/reviews/${reviewId1}`, {
      method: 'PATCH',
      token: tokenCust1,
      body: { rating: 1, comment: 'Trying to change review.' }
    });
    assert(
      custEditAttempt.status === 403,
      'Customer review editing is forbidden (HTTP 403 Forbidden)'
    );

  } finally {
    // Teardown
    console.log('\nCleaning up test artifacts...');
    await Review.deleteMany({ salonId: { $in: [salon1._id, salon2._id] } });
    await Appointment.deleteMany({ _id: { $in: [appt1._id, appt2._id, apptSalon2._id, apptExpired._id] } });
    await Service.deleteMany({ _id: { $in: [service1._id, service2._id, serviceSalon2._id] } });
    await Salon.deleteMany({ _id: { $in: [salon1._id, salon2._id] } });
    await User.deleteMany({ _id: { $in: [customer1._id, customer2._id, owner1._id, owner2._id] } });
    server.close();
    await mongoose.disconnect();
  }

  console.log('\n====================================================================');
  console.log(`   TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

void runPublicReviewsTestSuite();
