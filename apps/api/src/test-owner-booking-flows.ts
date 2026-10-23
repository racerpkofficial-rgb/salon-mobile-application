import mongoose from 'mongoose';
import { Appointment } from './models/Appointment.js';
import { User } from './models/User.js';
import { env } from './config/env.js';

const BASE_URL = 'http://127.0.0.1:4000/api/v1';

async function request(path: string, options: { method?: string; body?: any; token?: string } = {}) {
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

function getFutureDate(daysAhead: number = 3): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function run() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('========================================================================');
  console.log('   TESTING SALON OWNER BOOKING MANAGEMENT & NOTIFICATION LIFECYCLE     ');
  console.log('========================================================================\n');

  const ts = Date.now();
  const password = 'Password123!';

  // 1. Authenticate Super Admin
  console.log('1. Authenticating Super Admin...');
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: 'admin@example.com', password: 'AdminPassword123!' }
  });
  if (adminLogin.status !== 200) throw new Error('Admin login failed');
  const adminToken = adminLogin.data.token;
  console.log('   ✓ Super Admin authenticated.');

  // 2. Setup Salon Owner & Approved Active Salon
  console.log('\n2. Setting up Salon Owner with Working Hours & Services...');
  const ownerReg = await request('/auth/register/salon-owner', {
    method: 'POST',
    body: {
      name: 'Owner Elena',
      email: `elena_${ts}@test.com`,
      phone: '+91 98888 44444',
      password,
      confirmPassword: password,
      salonName: `Elena Haute Coiffure ${ts}`,
      address: '12 Lavelle Road',
      city: 'Bengaluru',
      identityProof: {
        url: 'https://docs.aureliabeaute.internal/secure/id-docs/sample_gst.pdf',
        filename: 'gst_certificate.pdf',
        fileType: 'application/pdf',
        fileSize: 102400
      }
    }
  });
  if (ownerReg.status !== 201) throw new Error('Owner registration failed');
  const ownerToken = ownerReg.data.token;

  const salonRes = await request('/owner/salon', {
    method: 'POST',
    body: {
      salonName: `Elena Haute Coiffure ${ts}`,
      description: 'Bespoke European haircutting, scalp diagnostics, and restorative hair treatments.',
      phone: '+91 94444 88888',
      email: `elena_${ts}@test.com`,
      address: '42 Lavelle Road',
      city: 'Bengaluru',
      location: { latitude: 12.9719, longitude: 77.5937 },
      workingHours: {
        openTime: '09:00',
        closeTime: '19:00',
        slotIntervalMinutes: 30,
        daysOpen: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      },
      services: [
        { name: 'Balayage Cut & Blowdry', category: 'Hair', price: 1800, durationMinutes: 60, description: 'Artisanal haircut with blowout' },
        { name: 'Olaplex Bond Therapy', category: 'Treatment', price: 2500, durationMinutes: 45, description: 'Molecular bond repairing treatment' }
      ]
    },
    token: ownerToken
  });
  const salonId = salonRes.data.salon._id;

  // Checkout Subscription
  await request('/owner/subscription/mock-checkout', {
    method: 'POST',
    body: { plan: 'PREMIUM', billingCycle: 'YEARLY' },
    token: ownerToken
  });

  // Admin approves salon
  await request(`/admin/salons/${salonId}/approve`, { method: 'PATCH', token: adminToken });
  console.log(`   ✓ Salon approved and ACTIVE: "Elena Haute Coiffure ${ts}"`);

  // Get synced services
  const servRes = await request(`/salons/${salonId}/services`);
  const services = servRes.data.data;
  const balayageService = services.find((s: any) => s.name === 'Balayage Cut & Blowdry');
  const olaplexService = services.find((s: any) => s.name === 'Olaplex Bond Therapy');

  // 3. Register Customer Alice and Customer Bob
  console.log('\n3. Registering Customers Alice and Bob...');
  const custAlice = await request('/auth/register/customer', {
    method: 'POST',
    body: { name: 'Alice Walker', email: `alice_mgmt_${ts}@test.com`, password }
  });
  const aliceToken = custAlice.data.token;
  const aliceId = custAlice.data.user.id;

  const custBob = await request('/auth/register/customer', {
    method: 'POST',
    body: { name: 'Bob Henderson', email: `bob_mgmt_${ts}@test.com`, password }
  });
  const bobToken = custBob.data.token;
  const bobId = custBob.data.user.id;
  await User.updateMany({ _id: { $in: [aliceId, bobId] } }, { isEmailVerified: true });
  console.log('   ✓ Customers Alice and Bob registered and verified.');

  // 4. Create Pending Bookings
  const bookingDate = getFutureDate(4);
  console.log(`\n4. Customers submitting booking requests for date ${bookingDate}...`);

  // Alice books Balayage at 10:00 - 11:00 (60 mins)
  const aliceBooking = await request('/customer/appointments', {
    method: 'POST',
    body: {
      salonId,
      serviceId: balayageService._id,
      appointmentDate: bookingDate,
      startTime: '10:00',
      customerNote: 'Prefer natural warm tone glaze styling'
    },
    token: aliceToken
  });
  if (aliceBooking.status !== 201) throw new Error('Alice booking failed');
  const aliceAppId = aliceBooking.data.appointment._id;
  console.log(`   ✓ Alice booking request created (ID: ${aliceAppId}, Status: PENDING)`);

  // Bob books Olaplex at 14:00 - 14:45 (45 mins)
  const bobBooking = await request('/customer/appointments', {
    method: 'POST',
    body: {
      salonId,
      serviceId: olaplexService._id,
      appointmentDate: bookingDate,
      startTime: '14:00',
      customerNote: 'Sensitized bleached hair, gentle wash requested'
    },
    token: bobToken
  });
  if (bobBooking.status !== 201) throw new Error('Bob booking failed');
  const bobAppId = bobBooking.data.appointment._id;
  console.log(`   ✓ Bob booking request created (ID: ${bobAppId}, Status: PENDING)`);

  // 5. Test Owner Dashboard Summary Stats
  console.log('\n5. Testing Owner Dashboard Summary Stats API (GET /owner/appointments/stats)...');
  const statsRes = await request('/owner/appointments/stats', { token: ownerToken });
  if (statsRes.status !== 200) throw new Error('Stats fetch failed');
  console.log(`   ✓ Pending count: ${statsRes.data.pendingCount} (Expected: >= 2)`);
  if (statsRes.data.pendingCount < 2) throw new Error('Expected at least 2 pending requests');

  // 6. Test Owner Pending Requests Screen Data & Verification
  console.log('\n6. Testing Owner Pending Requests Screen Data (GET /owner/appointments?status=PENDING)...');
  const pendingRes = await request('/owner/appointments?status=PENDING', { token: ownerToken });
  if (pendingRes.status !== 200) throw new Error('Pending list fetch failed');
  const pendingList = pendingRes.data.data;
  const foundAlice = pendingList.find((p: any) => p._id === aliceAppId);
  const foundBob = pendingList.find((p: any) => p._id === bobAppId);

  if (!foundAlice || !foundBob) throw new Error('Pending requests not found in owner queue');

  console.log('   ✓ Verifying fields displayed on Pending Requests Screen for Alice:');
  console.log(`     - Customer Name: ${foundAlice.customerId.name}`);
  console.log(`     - Service: ${foundAlice.serviceId.name}`);
  console.log(`     - Date: ${foundAlice.appointmentDate}`);
  console.log(`     - Time: ${foundAlice.startTime} – ${foundAlice.endTime}`);
  console.log(`     - Duration: ${foundAlice.serviceId.duration} mins`);
  console.log(`     - Price: ₹${foundAlice.serviceId.price}`);
  console.log(`     - Customer Note: "${foundAlice.customerNote}"`);

  if (!foundAlice.customerId.name || !foundAlice.serviceId.name || !foundAlice.customerNote) {
    throw new Error('Pending request card missing required fields');
  }

  // 7. Test Owner Booking Details Screen (GET /owner/appointments/:id)
  console.log(`\n7. Testing Booking Details Screen endpoint (GET /owner/appointments/${aliceAppId})...`);
  const detailsRes = await request(`/owner/appointments/${aliceAppId}`, { token: ownerToken });
  if (detailsRes.status !== 200) throw new Error('Appointment details fetch failed');
  const detailedApp = detailsRes.data.appointment;
  console.log(`   ✓ Details populated successfully: ${detailedApp.serviceId.name} for ${detailedApp.customerId.name}`);

  // 8. Test Action: ACCEPT (PENDING → CONFIRMED)
  // When accepted:
  // - Lock the slot
  // - Update customer status
  // - Send customer notification
  // - Backend must verify that the booking still has availability before accepting
  console.log('\n8. Testing Action: ACCEPT (PENDING → CONFIRMED)...');
  const acceptRes = await request(`/owner/appointments/${aliceAppId}/accept`, {
    method: 'PATCH',
    token: ownerToken
  });
  if (acceptRes.status !== 200) throw new Error(`Accept failed: ${JSON.stringify(acceptRes.data)}`);
  console.log(`   ✓ Status transitioned to: "${acceptRes.data.appointment.status}" (Expected: CONFIRMED)`);
  if (acceptRes.data.appointment.status !== 'CONFIRMED') throw new Error('Expected CONFIRMED status');

  // Verify slot is locked on calendar
  const slotCheck = await request(`/salons/${salonId}/availability?date=${bookingDate}&serviceId=${balayageService._id}`);
  const slot1000 = slotCheck.data.slots.find((s: any) => s.startTime === '10:00');
  console.log(`   ✓ Slot 10:00 lock status isAvailable: ${slot1000?.isAvailable} (Expected: false - LOCKED)`);
  if (slot1000?.isAvailable !== false) throw new Error('Slot must be locked upon acceptance');

  // Verify Customer Alice received notification
  console.log('   - Verifying Customer Notification was sent to Alice...');
  const notifResAlice = await request('/customer/notifications', { token: aliceToken });
  if (notifResAlice.status !== 200) throw new Error('Failed to fetch Alice notifications');
  const aliceNotifs = notifResAlice.data.data;
  console.log(`   ✓ Alice received ${aliceNotifs.length} notification(s):`);
  const confNotif = aliceNotifs.find((n: any) => n.type === 'BOOKING_CONFIRMED' || n.type === 'BOOKING_ACCEPTED');
  if (!confNotif) throw new Error('Alice did not receive booking acceptance/confirmation notification');
  console.log(`     * Title: "${confNotif.title}"`);
  console.log(`     * Message: "${confNotif.message}"`);
  console.log(`     * Unread: ${!confNotif.isRead}`);

  // 9. Test Backend Conflict Verification Before Accepting
  console.log('\n9. Testing Conflict Verification Before Accepting...');
  // Inject a synthetic pending appointment directly on the exact same overlapping slot (10:00-11:00)
  const conflictingPending = await Appointment.create({
    customerId: bobId,
    salonId,
    serviceId: balayageService._id,
    appointmentDate: bookingDate,
    startTime: '10:00',
    endTime: '11:00',
    status: 'PENDING',
    customerNote: 'Attempting to book already confirmed time window'
  });

  const conflictAcceptRes = await request(`/owner/appointments/${conflictingPending._id}/accept`, {
    method: 'PATCH',
    token: ownerToken
  });
  console.log(`   ✓ Attempting to accept conflicting booking returned status: ${conflictAcceptRes.status} (Expected: 409 Conflict)`);
  console.log(`   ✓ Backend error message: "${conflictAcceptRes.data.message}"`);
  if (conflictAcceptRes.status !== 409) throw new Error('Backend failed to reject conflict on accept');

  // Clean up synthetic appointment
  await Appointment.deleteOne({ _id: conflictingPending._id });

  // 10. Test Action: REJECT (PENDING → REJECTED)
  // When rejected:
  // - Release the slot
  // - Notify customer
  console.log('\n10. Testing Action: REJECT (PENDING → REJECTED)...');
  const rejectRes = await request(`/owner/appointments/${bobAppId}/reject`, {
    method: 'PATCH',
    body: { rejectionReason: 'Master stylist Elena is leading a masterclass at this hour.' },
    token: ownerToken
  });
  if (rejectRes.status !== 200) throw new Error('Reject failed');
  console.log(`   ✓ Status transitioned to: "${rejectRes.data.appointment.status}" (Expected: REJECTED)`);
  if (rejectRes.data.appointment.status !== 'REJECTED') throw new Error('Expected REJECTED status');

  // Verify slot is released
  const bobSlotCheck = await request(`/salons/${salonId}/availability?date=${bookingDate}&serviceId=${olaplexService._id}`);
  const slot1400 = bobSlotCheck.data.slots.find((s: any) => s.startTime === '14:00');
  console.log(`   ✓ Rejected slot 14:00 isAvailable: ${slot1400?.isAvailable} (Expected: true - RELEASED)`);
  if (slot1400?.isAvailable !== true) throw new Error('Slot must be released upon rejection');

  // Verify Customer Bob received notification
  const notifResBob = await request('/customer/notifications', { token: bobToken });
  const bobNotifs = notifResBob.data.data;
  const rejNotif = bobNotifs.find((n: any) => n.type === 'BOOKING_REJECTED');
  if (!rejNotif) throw new Error('Bob did not receive BOOKING_REJECTED notification');
  console.log(`   ✓ Bob received rejection notification: "${rejNotif.title}" - "${rejNotif.message}"`);

  // 11. Test Confirmed Bookings Screen endpoint
  console.log('\n11. Testing Confirmed Bookings Screen query (GET /owner/appointments?status=CONFIRMED)...');
  const confirmedRes = await request('/owner/appointments?status=CONFIRMED', { token: ownerToken });
  const confirmedList = confirmedRes.data.data;
  console.log(`   ✓ Confirmed bookings count: ${confirmedList.length}`);
  const hasAlice = confirmedList.some((c: any) => c._id === aliceAppId);
  if (!hasAlice) throw new Error('Alice appointment not found in confirmed list');

  // 12. Test Calendar Screen daily query (GET /owner/appointments?date=...)
  console.log(`\n12. Testing Calendar Daily query (GET /owner/appointments?date=${bookingDate})...`);
  const calendarRes = await request(`/owner/appointments?date=${bookingDate}`, { token: ownerToken });
  console.log(`   ✓ Day ${bookingDate} returned ${calendarRes.data.data.length} appointment entries.`);

  // 13. Test Complete Appointment & History Screen
  console.log(`\n13. Testing Complete Appointment (PATCH /owner/appointments/${aliceAppId}/complete)...`);
  const completeRes = await request(`/owner/appointments/${aliceAppId}/complete`, {
    method: 'PATCH',
    token: ownerToken
  });
  if (completeRes.status !== 200) throw new Error('Complete failed');
  console.log(`   ✓ Status is now: "${completeRes.data.appointment.status}" (Expected: COMPLETED)`);

  // Verify Appointment History query
  console.log('   - Testing Appointment History Screen query (COMPLETED, REJECTED, CANCELLED)...');
  const historyRes = await request('/owner/appointments?status=COMPLETED,REJECTED,CANCELLED', {
    token: ownerToken
  });
  const historyList = historyRes.data.data;
  console.log(`   ✓ Retrieved ${historyList.length} historical appointments.`);
  const hasCompletedAlice = historyList.some((h: any) => h._id === aliceAppId && h.status === 'COMPLETED');
  const hasRejectedBob = historyList.some((h: any) => h._id === bobAppId && h.status === 'REJECTED');
  if (!hasCompletedAlice || !hasRejectedBob) throw new Error('History list missing completed or rejected records');

  console.log('\n========================================================================');
  console.log('   ALL SALON OWNER BOOKING MANAGEMENT TESTS PASSED (13/13)!             ');
  console.log('========================================================================');
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:\n', err);
  process.exit(1);
});
