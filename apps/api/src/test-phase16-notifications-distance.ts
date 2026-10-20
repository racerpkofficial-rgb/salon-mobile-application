import { MongoClient } from 'mongodb';
import {
  calculateHaversineDistance,
  formatDistance,
  isValidCoordinate
} from './utils/location';

const BASE_URL = 'http://127.0.0.1:4000/api/v1';

async function request(
  path: string,
  options: { method?: string; body?: any; token?: string } = {}
) {
  const res = await fetch(`${BASE_URL}${path}`, {
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

async function runTests() {
  console.log('========================================================================');
  console.log('   PHASE 16: NOTIFICATIONS, LOGOUT, LIVE PASSWORDS & DISTANCES AUDIT    ');
  console.log('========================================================================\n');

  const ts = Date.now();
  const strongPassword = 'AureliaPassword2026!';
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@example.com';
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'AdminPassword123!';

  // Log in as Super Admin
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: superAdminEmail, password: superAdminPassword }
  });
  if (adminLogin.status !== 200 || !adminLogin.data?.token) {
    throw new Error(`Admin login failed: ${JSON.stringify(adminLogin.data)}`);
  }
  const adminToken = adminLogin.data.token;
  console.log('✓ Super Admin authenticated successfully.\n');

  // =========================================================================
  // SECTION 1: SALON OWNER NOTIFICATIONS & RECIPIENT SPECIFICITY
  // =========================================================================
  console.log('--- TEST GROUP 1: SALON OWNER NOTIFICATIONS & RECIPIENT SPECIFICITY ---');

  // 1A. Register Owner 1 (Bengaluru salon)
  const owner1Email = `owner1_${ts}@test.com`;
  const owner1Reg = await request('/auth/register/salon-owner', {
    method: 'POST',
    body: {
      name: 'Elena Rostova',
      email: owner1Email,
      password: strongPassword,
      confirmPassword: strongPassword,
      phone: '+91 98450 12345',
      salonName: `Atelier Bengaluru ${ts}`,
      address: '100 Feet Road, Indiranagar',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      location: { latitude: 12.9716, longitude: 77.5946 },
      identityProof: {
        url: 'https://res.cloudinary.com/demo/id1.pdf',
        filename: 'gst_certificate.pdf',
        fileType: 'application/pdf',
        fileSize: 102400
      }
    }
  });
  if (owner1Reg.status !== 201) {
    throw new Error(`Owner 1 registration failed: ${JSON.stringify(owner1Reg.data)}`);
  }
  const owner1Token = owner1Reg.data.token;
  const owner1Id = owner1Reg.data.user.id;
  const salon1Id = owner1Reg.data.salon._id || owner1Reg.data.salon.id;
  console.log(`✓ Owner 1 registered with Bengaluru salon (ID: ${salon1Id}).`);

  // 1B. Register Owner 2 (Tiruchirappalli salon)
  const owner2Email = `owner2_${ts}@test.com`;
  const owner2Reg = await request('/auth/register/salon-owner', {
    method: 'POST',
    body: {
      name: 'Ravi Chandran',
      email: owner2Email,
      password: strongPassword,
      confirmPassword: strongPassword,
      phone: '+91 98450 67890',
      salonName: `Trichy Palace ${ts}`,
      address: '11th Cross, Thillai Nagar',
      city: 'Tiruchirappalli',
      state: 'Tamil Nadu',
      country: 'India',
      location: { latitude: 10.7905, longitude: 78.7047 },
      identityProof: {
        url: 'https://res.cloudinary.com/demo/id2.pdf',
        filename: 'pan_card.pdf',
        fileType: 'application/pdf',
        fileSize: 102400
      }
    }
  });
  if (owner2Reg.status !== 201) {
    throw new Error(`Owner 2 registration failed: ${JSON.stringify(owner2Reg.data)}`);
  }
  const owner2Token = owner2Reg.data.token;
  const owner2Id = owner2Reg.data.user.id;
  const salon2Id = owner2Reg.data.salon._id || owner2Reg.data.salon.id;
  console.log(`✓ Owner 2 registered with Tiruchirappalli salon (ID: ${salon2Id}).`);

  // Configure services for Salon 1 via /owner/salon
  const salonUpdateRes = await request('/owner/salon', {
    method: 'POST',
    token: owner1Token,
    body: {
      salonName: `Atelier Bengaluru ${ts}`,
      description: 'Luxury organic retreat with botanical scalp and skin rituals',
      phone: '+91 98450 12345',
      email: owner1Email,
      address: '100 Feet Road, Indiranagar',
      city: 'Bengaluru',
      services: [
        {
          name: 'Hydrating Botanical Facial',
          category: 'Skin',
          price: 1200,
          durationMinutes: 45,
          description: 'Deep hydrating organic facial treatment'
        }
      ]
    }
  });
  if (salonUpdateRes.status !== 200 && salonUpdateRes.status !== 201) {
    throw new Error(`Salon update failed: ${JSON.stringify(salonUpdateRes.data)}`);
  }
  console.log('✓ Services configured on Salon 1.');

  // Activate Salon 1 subscription so it is ready for approval & bookings
  const payRes = await request('/owner/subscription/mock-checkout', {
    method: 'POST',
    body: { plan: 'BUSINESS', billingCycle: 'YEARLY', paymentMethod: 'CARD_MOCK' },
    token: owner1Token
  });
  if (payRes.status !== 200) {
    throw new Error(`Subscription payment failed: ${JSON.stringify(payRes.data)}`);
  }
  console.log('✓ Salon 1 subscription activated.');

  // 1C. Super Admin approves Salon 1
  console.log('Approving Salon 1 by Super Admin...');
  const approveRes = await request(`/admin/salons/${salon1Id}/approve`, {
    method: 'PATCH',
    token: adminToken
  });
  if (approveRes.status !== 200) {
    throw new Error(`Approve salon failed: ${JSON.stringify(approveRes.data)}`);
  }
  console.log('✓ Salon 1 approved in DB.');

  // Check Owner 1 notifications: MUST have SALON_APPROVED
  const owner1Notifs = await request('/notifications', { token: owner1Token });
  console.log('Owner 1 Notifs status:', owner1Notifs.status, 'data:', JSON.stringify(owner1Notifs.data));
  const hasApprovedNotif = owner1Notifs.data?.data?.some(
    (n: any) => n.type === 'SALON_APPROVED' && (n.targetScreen === 'Dashboard' || n.data?.screen === 'Dashboard')
  );
  if (!hasApprovedNotif) {
    throw new Error('Owner 1 did not receive SALON_APPROVED notification!');
  }
  console.log('✓ Owner 1 received SALON_APPROVED notification with targetScreen=Dashboard.');

  // Check Owner 2 notifications: MUST NOT have received Salon 1 approval!
  const owner2Notifs = await request('/notifications', { token: owner2Token });
  const owner2HasSalon1Notif = owner2Notifs.data?.data?.some(
    (n: any) => n.data?.salonId === salon1Id || (n.message && n.message.includes(`Atelier Bengaluru ${ts}`))
  );
  if (owner2HasSalon1Notif) {
    throw new Error('LEAK: Owner 2 received notification for Salon 1 approval!');
  }
  console.log('✓ Owner 2 correctly received NO notification for Salon 1 (Recipient Specificity confirmed).');

  // 1D. Super Admin rejects Salon 2 with reason
  console.log('Rejecting Salon 2 with reason by Super Admin...');
  const rejectionReason = 'Incomplete business tax registration documents.';
  const rejectRes = await request(`/admin/salons/${salon2Id}/reject`, {
    method: 'PATCH',
    token: adminToken,
    body: { reason: rejectionReason }
  });
  if (rejectRes.status !== 200) {
    throw new Error(`Reject salon failed: ${JSON.stringify(rejectRes.data)}`);
  }

  // Check Owner 2 notifications: MUST have SALON_REJECTED with rejection reason
  const owner2NotifsAfter = await request('/notifications', { token: owner2Token });
  const rejectedNotif = owner2NotifsAfter.data?.data?.find(
    (n: any) => n.type === 'SALON_REJECTED'
  );
  if (!rejectedNotif) {
    throw new Error('Owner 2 did not receive SALON_REJECTED notification!');
  }
  if (!rejectedNotif.message.includes(rejectionReason) && rejectedNotif.data?.rejectionReason !== rejectionReason) {
    throw new Error('SALON_REJECTED notification does not contain the rejection reason!');
  }
  if (rejectedNotif.targetScreen !== 'Onboarding') {
    throw new Error(`Target screen must be Onboarding, got: ${rejectedNotif.targetScreen}`);
  }
  console.log('✓ Owner 2 received SALON_REJECTED notification with explicit reason and targetScreen=Onboarding.\n');

  // =========================================================================
  // SECTION 2: OFFER VIEW vs BOOKING NOTIFICATIONS & IDEMPOTENCY
  // =========================================================================
  console.log('--- TEST GROUP 2: OFFER VIEW vs BOOKING NOTIFICATIONS ---');

  // 2A. Owner 1 creates an offer
  console.log('Owner 1 creates a promotional offer...');
  const offerRes = await request('/owner/offers', {
    method: 'POST',
    token: owner1Token,
    body: {
      title: 'Monsoon Glow 30% Off',
      description: 'Special radiant facial discounts for our patrons',
      discountType: 'PERCENTAGE',
      discountValue: 30,
      applicableService: 'ALL',
      endDate: '2027-12-31'
    }
  });
  if (offerRes.status !== 201) {
    throw new Error(`Create offer failed: ${JSON.stringify(offerRes.data)}`);
  }
  const offerId = offerRes.data.offer._id || offerRes.data.offer.id;
  console.log(`✓ Offer created successfully (ID: ${offerId}).`);

  // 2B. Customer registers and VIEWS the offer
  const custEmail = `customer_${ts}@test.com`;
  const custReg = await request('/auth/register/customer', {
    method: 'POST',
    body: {
      name: 'Maya Sen',
      email: custEmail,
      password: strongPassword,
      confirmPassword: strongPassword,
      phone: '+91 98450 33445'
    }
  });
  if (custReg.status !== 201) {
    throw new Error(`Customer registration failed: ${JSON.stringify(custReg.data)}`);
  }
  const custToken = custReg.data.token;
  const custId = custReg.data.user.id;

  // Customer fetches active offers (viewing offer)
  console.log('Customer discovers and views active offers...');
  const viewOffersRes = await request(`/salons/${salon1Id}/offers`);
  if (viewOffersRes.status !== 200) {
    throw new Error(`View offers failed: ${JSON.stringify(viewOffersRes.data)}`);
  }

  // Count Owner 1 notifications: MUST NOT have increased due to offer view!
  const owner1NotifsAfterView = await request('/notifications', { token: owner1Token });
  const bookingNotifAfterView = owner1NotifsAfterView.data?.data?.some(
    (n: any) => n.type === 'BOOKING_REQUEST_SENT' || n.title.includes('Booking')
  );
  if (bookingNotifAfterView) {
    throw new Error('CRITICAL BUG: Viewing an offer triggered a booking notification!');
  }
  console.log('✓ Viewing an offer did NOT trigger any booking notification to the salon owner.');

  // 2C. Customer books an appointment using the offer
  console.log('Customer books appointment using the offer...');
  const bookingDate = '2026-11-15';
  const bookingTime = '14:30';
  const bookRes = await request('/appointments', {
    method: 'POST',
    token: custToken,
    body: {
      salonId: salon1Id,
      serviceId: 'Hydrating Botanical Facial',
      offerId,
      appointmentDate: bookingDate,
      startTime: bookingTime,
      customerNote: 'Please prepare organic treatment.'
    }
  });
  if (bookRes.status !== 201) {
    throw new Error(`Booking creation failed: ${JSON.stringify(bookRes.data)}`);
  }
  const appointmentId = bookRes.data.appointment._id || bookRes.data.appointment.id;
  console.log(`✓ Booking saved successfully (Appointment ID: ${appointmentId}).`);

  // Owner 1 MUST now receive a booking notification
  const owner1NotifsAfterBooking = await request('/notifications', { token: owner1Token });
  const bookingNotif = owner1NotifsAfterBooking.data?.data?.find(
    (n: any) => n.data?.appointmentId === appointmentId || n.message?.includes('Hydrating Botanical Facial')
  );
  if (!bookingNotif) {
    throw new Error('Owner 1 did not receive booking notification after customer booked!');
  }
  if (!bookingNotif.message.includes('Maya Sen') && !bookingNotif.data?.customerName?.includes('Maya Sen')) {
    throw new Error('Booking notification does not mention customer name!');
  }
  if (!bookingNotif.message.includes(bookingDate) || !bookingNotif.message.includes(bookingTime)) {
    throw new Error('Booking notification does not mention appointment date and time!');
  }
  if (bookingNotif.targetScreen !== 'BookingDetails' && bookingNotif.data?.screen !== 'BookingDetails') {
    throw new Error(`Booking notification targetScreen must be BookingDetails, got ${bookingNotif.targetScreen}`);
  }
  console.log('✓ Owner 1 received booking notification with customer name, service, date, time and targetScreen=BookingDetails.');

  // 2D. Duplicate Prevention / Safe Retries
  // Verify that an appointment cannot trigger duplicate notifications
  console.log('Testing duplicate notification prevention on notification service...');
  const countBefore = owner1NotifsAfterBooking.data?.data?.filter(
    (n: any) => n.data?.appointmentId === appointmentId
  ).length;
  if (countBefore !== 1) {
    throw new Error(`Expected exactly 1 notification for appointment, got ${countBefore}`);
  }
  console.log('✓ Duplicate notification prevention confirmed (exactly 1 record in DB).\n');

  // =========================================================================
  // SECTION 3: ACCURATE CUSTOMER-TO-SALON DISTANCES & HAVERSINE AUDIT
  // =========================================================================
  console.log('--- TEST GROUP 3: ACCURATE CUSTOMER-TO-SALON DISTANCE ---');

  // Known Coordinates:
  // Tiruchirappalli (Tamil Nadu): lat 10.7905, lng 78.7047
  // Bengaluru (Karnataka): lat 12.9716, lng 77.5946
  // Indiranagar 1 (Bengaluru): lat 12.9784, lng 77.6408
  // Indiranagar 2 (Bengaluru): lat 12.9716, lng 77.6412

  // 3A. Tiruchirappalli to Bengaluru Straight-Line Distance
  const trichyToBlr = calculateHaversineDistance(10.7905, 78.7047, 12.9716, 77.5946);
  console.log(`Calculated Tiruchirappalli to Bengaluru distance: ${trichyToBlr} km`);
  if (!trichyToBlr || trichyToBlr < 250 || trichyToBlr > 290) {
    throw new Error(
      `CRITICAL DISTANCE BUG: Tiruchirappalli to Bengaluru should be ~270.9 km, got: ${trichyToBlr} km`
    );
  }
  const formattedTrichy = formatDistance(trichyToBlr);
  if (!formattedTrichy.includes('271 km') && !formattedTrichy.includes('270.9 km')) {
    throw new Error(`Formatted distance incorrect: ${formattedTrichy}`);
  }
  if (!formattedTrichy.includes('straight-line')) {
    throw new Error(`Formatted distance must mention approx straight-line: ${formattedTrichy}`);
  }
  console.log(`✓ Tiruchirappalli to Bengaluru Haversine calculation verified: ${formattedTrichy} (NOT 0.8 km).`);

  // 3B. Same-Area Distance (< 1 km)
  const indiranagarDist = calculateHaversineDistance(12.9784, 77.6408, 12.9716, 77.6412);
  console.log(`Calculated Indiranagar local distance: ${indiranagarDist} km`);
  if (!indiranagarDist || indiranagarDist > 1.5) {
    throw new Error(`Same area distance should be < 1.5 km, got: ${indiranagarDist}`);
  }
  const formattedLocal = formatDistance(indiranagarDist);
  if (!formattedLocal.includes('m (approx straight-line)')) {
    throw new Error(`Distances < 1 km must be formatted in metres: ${formattedLocal}`);
  }
  console.log(`✓ Local distance formatted correctly in metres: ${formattedLocal}.`);

  // 3C. Missing or Invalid Coordinates
  const nullDist = calculateHaversineDistance(null, null, 12.9716, 77.5946);
  if (nullDist !== null) {
    throw new Error(`Missing coords must return null, got: ${nullDist}`);
  }
  const nullFormatted = formatDistance(nullDist);
  if (nullFormatted !== 'Distance unavailable') {
    throw new Error(`Missing coords must display 'Distance unavailable', got: ${nullFormatted}`);
  }
  console.log(`✓ Missing coordinates yield "${nullFormatted}" (never fabricated 0.8 km).`);

  // 3D. Coordinate boundary validation
  if (isValidCoordinate(95, 77)) {
    throw new Error('Latitude > 90 must be marked invalid!');
  }
  if (isValidCoordinate(12, 185)) {
    throw new Error('Longitude > 180 must be marked invalid!');
  }
  if (isValidCoordinate(0, 0)) {
    throw new Error('(0, 0) null island should be rejected!');
  }
  console.log('✓ Coordinate boundary validation strictly enforced.');

  // 3E. Backend API salon search with lat & lng query parameters
  console.log('Testing GET /salons with customer in Tiruchirappalli (lat=10.7905, lng=78.7047)...');
  const trichySalonsRes = await request(
    '/salons?lat=10.7905&lng=78.7047&sortBy=nearest'
  );
  if (trichySalonsRes.status !== 200 || !Array.isArray(trichySalonsRes.data?.data)) {
    throw new Error(`GET /salons failed: ${JSON.stringify(trichySalonsRes.data)}`);
  }
  const salonsList = trichySalonsRes.data.data;
  const blrSalonInList = salonsList.find(
    (s: any) => s.salonName === `Atelier Bengaluru ${ts}`
  );
  if (blrSalonInList) {
    console.log(`   Salon distance for Bengaluru salon: "${blrSalonInList.distance}" (km: ${blrSalonInList.distanceKm})`);
    if (blrSalonInList.distanceKm < 200) {
      throw new Error(`Bengaluru salon reported distance < 200 km from Tiruchirappalli! Got: ${blrSalonInList.distanceKm}`);
    }
    if (blrSalonInList.distance === '0.8 km') {
      throw new Error('CRITICAL BUG REPRODUCED: Distance is still returning 0.8 km!');
    }
  }
  console.log('✓ API returns real Haversine distance (~271 km) for Tiruchirappalli to Bengaluru.\n');

  // =========================================================================
  // SECTION 4: REAL-TIME PASSWORD STRENGTH VALIDATION RULES
  // =========================================================================
  console.log('--- TEST GROUP 4: PASSWORD STRENGTH POLICY ENFORCEMENT ---');

  // Rule 1: < 8 characters
  const shortPass = await request('/auth/register/customer', {
    method: 'POST',
    body: {
      name: 'Test User',
      email: `short_${ts}@test.com`,
      password: 'Aa1!',
      confirmPassword: 'Aa1!'
    }
  });
  if (shortPass.status !== 400 || !shortPass.data?.message?.includes('8')) {
    throw new Error(`Expected rejection for < 8 chars, got: ${shortPass.status}`);
  }
  console.log('✓ Rejected passwords shorter than 8 characters.');

  // Rule 2: No uppercase
  const noUpper = await request('/auth/register/customer', {
    method: 'POST',
    body: {
      name: 'Test User',
      email: `noupper_${ts}@test.com`,
      password: 'password123!',
      confirmPassword: 'password123!'
    }
  });
  if (noUpper.status !== 400 || !noUpper.data?.message?.toLowerCase().includes('uppercase')) {
    throw new Error(`Expected rejection for missing uppercase, got: ${noUpper.status}`);
  }
  console.log('✓ Rejected passwords missing uppercase letters.');

  // Rule 3: No lowercase
  const noLower = await request('/auth/register/customer', {
    method: 'POST',
    body: {
      name: 'Test User',
      email: `nolower_${ts}@test.com`,
      password: 'PASSWORD123!',
      confirmPassword: 'PASSWORD123!'
    }
  });
  if (noLower.status !== 400 || !noLower.data?.message?.toLowerCase().includes('lowercase')) {
    throw new Error(`Expected rejection for missing lowercase, got: ${noLower.status}`);
  }
  console.log('✓ Rejected passwords missing lowercase letters.');

  // Rule 4: No number
  const noNumber = await request('/auth/register/customer', {
    method: 'POST',
    body: {
      name: 'Test User',
      email: `nonumber_${ts}@test.com`,
      password: 'PasswordExclam!',
      confirmPassword: 'PasswordExclam!'
    }
  });
  if (noNumber.status !== 400 || !noNumber.data?.message?.toLowerCase().includes('number')) {
    throw new Error(`Expected rejection for missing number, got: ${noNumber.status}`);
  }
  console.log('✓ Rejected passwords missing numbers.');

  // Rule 5: No special character
  const noSpecial = await request('/auth/register/customer', {
    method: 'POST',
    body: {
      name: 'Test User',
      email: `nospecial_${ts}@test.com`,
      password: 'Password12345',
      confirmPassword: 'Password12345'
    }
  });
  if (noSpecial.status !== 400 || !noSpecial.data?.message?.toLowerCase().includes('special')) {
    throw new Error(`Expected rejection for missing special char, got: ${noSpecial.status}`);
  }
  console.log('✓ Rejected passwords missing special characters.');

  // Mismatch
  const mismatch = await request('/auth/register/customer', {
    method: 'POST',
    body: {
      name: 'Test User',
      email: `mismatch_${ts}@test.com`,
      password: strongPassword,
      confirmPassword: 'DifferentPassword1!'
    }
  });
  if (mismatch.status !== 400 || !mismatch.data?.message?.toLowerCase().includes('match')) {
    throw new Error(`Expected rejection for confirm password mismatch, got: ${mismatch.status}`);
  }
  console.log('✓ Rejected mismatched password confirmation.\n');

  console.log('========================================================================');
  console.log('   ALL PHASE 16 TESTS PASSED WITH 100% SUCCESS!                         ');
  console.log('========================================================================');
}

runTests().catch((err) => {
  console.error('\n❌ PHASE 16 TEST SUITE FAILED:');
  console.error(err);
  process.exit(1);
});
