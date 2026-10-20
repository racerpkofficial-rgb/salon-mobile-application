import { getTodayDateString } from './services/booking.service.js';

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

function getFutureDate(daysAhead: number = 2): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function run() {
  console.log('===============================================================');
  console.log('   TESTING COMPLETE APPOINTMENT BOOKING SYSTEM & AVAILABILITY   ');
  console.log('===============================================================\n');

  const ts = Date.now();
  const password = 'Password123!';

  // 1. Authenticate Super Admin
  console.log('1. Authenticating Super Admin...');
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: 'admin@example.com', password: 'AdminPassword123!' }
  });
  if (adminLogin.status !== 200) throw new Error(`Admin login failed: ${JSON.stringify(adminLogin.data)}`);
  const adminToken = adminLogin.data.token;
  console.log('   ✓ Super Admin authenticated successfully.\n');

  // 2. Register Salon Owner & Create Salon with Working Hours
  console.log('2. Setting up Salon with Configurable Working Hours & Subscription...');
  const ownerReg = await request('/auth/register/salon-owner', {
    method: 'POST',
    body: {
      name: 'Aurelia Owner Booking',
      email: `owner_book_${ts}@test.com`,
      phone: '+91 98888 33333',
      password,
      confirmPassword: password,
      salonName: `Aurelia Spa Booking ${ts}`,
      address: '77 Residency Road, Central Area',
      city: 'Bengaluru',
      identityProof: {
        url: 'https://docs.aureliabeaute.internal/secure/id-docs/sample_gst.pdf',
        filename: 'gst_certificate.pdf',
        fileType: 'application/pdf',
        fileSize: 102400
      }
    }
  });
  if (ownerReg.status !== 201) throw new Error(`Owner registration failed: ${JSON.stringify(ownerReg.data)}`);
  const ownerToken = ownerReg.data.token;

  const salonCreateRes = await request('/owner/salon', {
    method: 'POST',
    body: {
      salonName: `Aurelia Premier Atelier ${ts}`,
      description: 'Luxury salon specializing in bespoke hair styling, spa therapies and couture facials.',
      phone: '+91 99999 44444',
      email: `owner_book_${ts}@test.com`,
      address: '77 Residency Road, Central Arc',
      city: 'Bengaluru',
      location: { latitude: 12.9716, longitude: 77.5946 },
      images: [
        'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80'
      ],
      workingHours: {
        openTime: '09:00',
        closeTime: '18:00',
        slotIntervalMinutes: 30,
        daysOpen: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      },
      services: [
        { name: 'Classic Haircut', category: 'Hair', price: 500, durationMinutes: 30, description: 'Precision cut and styling' },
        { name: 'Royal Hair Spa', category: 'Hair', price: 1500, durationMinutes: 60, description: 'Deep nourishing hair and scalp spa' },
        { name: 'Bridal Glow Facial', category: 'Facial', price: 2800, durationMinutes: 90, description: 'Radiance rejuvenating bridal treatment' }
      ]
    },
    token: ownerToken
  });

  if (salonCreateRes.status !== 201 && salonCreateRes.status !== 200) throw new Error(`Salon creation failed: ${JSON.stringify(salonCreateRes.data)}`);
  const salonId = salonCreateRes.data.salon._id;
  console.log(`   ✓ Salon created: "${salonCreateRes.data.salon.salonName}" (ID: ${salonId})`);

  // Subscribe to Business Plan
  const subRes = await request('/owner/subscription/mock-checkout', {
    method: 'POST',
    body: { plan: 'BUSINESS', billingCycle: 'YEARLY' },
    token: ownerToken
  });
  if (subRes.status !== 200) throw new Error(`Subscription payment failed: ${JSON.stringify(subRes.data)}`);
  console.log('   ✓ Business subscription activated.');

  // Admin approves salon
  const approveRes = await request(`/admin/salons/${salonId}/approve`, {
    method: 'PATCH',
    token: adminToken
  });
  if (approveRes.status !== 200) throw new Error(`Salon approval failed: ${JSON.stringify(approveRes.data)}`);
  console.log('   ✓ Super Admin approved salon -> status is now ACTIVE.\n');

  // 3. Register Customer A and Customer B
  console.log('3. Registering Customers...');
  const customerA = await request('/auth/register/customer', {
    method: 'POST',
    body: { name: 'Customer Alice', email: `alice_${ts}@test.com`, password }
  });
  const tokenA = customerA.data.token;

  const customerB = await request('/auth/register/customer', {
    method: 'POST',
    body: { name: 'Customer Bob', email: `bob_${ts}@test.com`, password }
  });
  const tokenB = customerB.data.token;
  console.log('   ✓ Customer Alice and Bob registered.\n');

  // 4. Fetch standalone Services for the salon
  console.log('4. Fetching Salon Services & verifying Service model attributes...');
  const servicesRes = await request(`/salons/${salonId}/services`);
  if (servicesRes.status !== 200) throw new Error(`Failed to get services: ${JSON.stringify(servicesRes.data)}`);
  const services = servicesRes.data.data;
  console.log(`   ✓ Retrieved ${services.length} services:`);
  for (const s of services) {
    console.log(`     - ${s.name}: ${s.duration} mins, ₹${s.price} (Active: ${s.isActive})`);
  }

  const haircutService = services.find((s: any) => s.name === 'Classic Haircut');
  const hairSpaService = services.find((s: any) => s.name === 'Royal Hair Spa');
  const facialService = services.find((s: any) => s.name === 'Bridal Glow Facial');

  if (!haircutService || !hairSpaService || !facialService) {
    throw new Error('Expected services were not found!');
  }

  // 5. Test Availability Calculation on Backend
  const bookingDate = getFutureDate(3);
  console.log(`\n5. Calculating Backend Availability for ${bookingDate}...`);

  // 30-minute haircut slots
  const haircutSlotsRes = await request(`/salons/${salonId}/availability?date=${bookingDate}&serviceId=${haircutService._id}`);
  if (haircutSlotsRes.status !== 200) throw new Error(`Availability fetch failed: ${JSON.stringify(haircutSlotsRes.data)}`);
  const initialHaircutSlots = haircutSlotsRes.data.slots;
  console.log(`   ✓ 30-min Haircut generated ${initialHaircutSlots.length} slots between 09:00 and 18:00.`);
  const slot1000 = initialHaircutSlots.find((s: any) => s.startTime === '10:00');
  if (!slot1000 || !slot1000.isAvailable) {
    throw new Error('Expected 10:00 slot to initially be available');
  }
  console.log('   ✓ 10:00–10:30 slot is initially available.');

  // 60-minute hair spa slots
  const hairSpaSlotsRes = await request(`/salons/${salonId}/availability?date=${bookingDate}&serviceId=${hairSpaService._id}`);
  const initialSpaSlots = hairSpaSlotsRes.data.slots;
  console.log(`   ✓ 60-min Hair Spa generated ${initialSpaSlots.length} continuous slots.`);
  const spaSlot1000 = initialSpaSlots.find((s: any) => s.startTime === '10:00');
  if (!spaSlot1000 || !spaSlot1000.isAvailable) {
    throw new Error('Expected 10:00–11:00 spa slot to initially be available');
  }

  // 6. Customer Alice Books 30-min Classic Haircut at 10:00–10:30
  console.log('\n6. Customer Alice Booking Classic Haircut at 10:00 (30 mins)...');
  const bookRes = await request('/customer/appointments', {
    method: 'POST',
    body: {
      salonId,
      serviceId: haircutService._id,
      appointmentDate: bookingDate,
      startTime: '10:00',
      customerNote: 'First time visiting, looking forward to it!'
    },
    token: tokenA
  });

  if (bookRes.status !== 201) throw new Error(`Booking failed: ${JSON.stringify(bookRes.data)}`);
  const appointmentA = bookRes.data.appointment;
  console.log(`   ✓ Appointment booked with ID: ${appointmentA._id}`);
  console.log(`   ✓ Status is: "${appointmentA.status}" (Expected: PENDING)`);
  console.log(`   ✓ Backend message: "${bookRes.data.message}" (Expected: "Waiting for salon confirmation.")`);
  console.log(`   ✓ Time interval: ${appointmentA.startTime} - ${appointmentA.endTime}`);

  if (appointmentA.status !== 'PENDING') throw new Error('Status must be PENDING');
  if (bookRes.data.message !== 'Waiting for salon confirmation.') throw new Error('Expected "Waiting for salon confirmation."');
  if (appointmentA.endTime !== '10:30') throw new Error(`Expected endTime to be 10:30, got ${appointmentA.endTime}`);

  // 7. Verify Respect for Service Duration and Overlapping Slots
  console.log('\n7. Verifying Backend Availability respects Duration & Overlaps:');

  // A) For 30-min Haircut:
  const postHaircutSlotsRes = await request(`/salons/${salonId}/availability?date=${bookingDate}&serviceId=${haircutService._id}`);
  const postHaircutSlots = postHaircutSlotsRes.data.slots;
  const slot0930 = postHaircutSlots.find((s: any) => s.startTime === '09:30');
  const postSlot1000 = postHaircutSlots.find((s: any) => s.startTime === '10:00');
  const slot1030 = postHaircutSlots.find((s: any) => s.startTime === '10:30');

  console.log(`   - 30-min slot 09:30-10:00 isAvailable: ${slot0930?.isAvailable} (Expected: true)`);
  console.log(`   - 30-min slot 10:00-10:30 isAvailable: ${postSlot1000?.isAvailable} (Expected: false - occupied)`);
  console.log(`   - 30-min slot 10:30-11:00 isAvailable: ${slot1030?.isAvailable} (Expected: true)`);

  if (postSlot1000?.isAvailable !== false) throw new Error('10:00 slot must NOT be available after booking');
  if (slot0930?.isAvailable !== true) throw new Error('09:30 slot should remain available');
  if (slot1030?.isAvailable !== true) throw new Error('10:30 slot should remain available');

  // B) For 60-min Hair Spa:
  const postSpaSlotsRes = await request(`/salons/${salonId}/availability?date=${bookingDate}&serviceId=${hairSpaService._id}`);
  const postSpaSlots = postSpaSlotsRes.data.slots;
  const spa0900 = postSpaSlots.find((s: any) => s.startTime === '09:00'); // 09:00-10:00 -> clean
  const spa0930 = postSpaSlots.find((s: any) => s.startTime === '09:30'); // 09:30-10:30 -> OVERLAPS 10:00-10:30!
  const spa1000 = postSpaSlots.find((s: any) => s.startTime === '10:00'); // 10:00-11:00 -> OVERLAPS 10:00-10:30!
  const spa1030 = postSpaSlots.find((s: any) => s.startTime === '10:30'); // 10:30-11:30 -> clean

  console.log(`   - 60-min Hair Spa 09:00-10:00 isAvailable: ${spa0900?.isAvailable} (Expected: true)`);
  console.log(`   - 60-min Hair Spa 09:30-10:30 isAvailable: ${spa0930?.isAvailable} (Expected: false - overlaps 10:00-10:30)`);
  console.log(`   - 60-min Hair Spa 10:00-11:00 isAvailable: ${spa1000?.isAvailable} (Expected: false - overlaps 10:00-10:30)`);
  console.log(`   - 60-min Hair Spa 10:30-11:30 isAvailable: ${spa1030?.isAvailable} (Expected: true)`);

  if (spa0930?.isAvailable !== false) throw new Error('60-min 09:30 slot must NOT be available due to continuous duration requirement');
  if (spa1000?.isAvailable !== false) throw new Error('60-min 10:00 slot must NOT be available due to continuous duration requirement');
  if (spa0900?.isAvailable !== true) throw new Error('60-min 09:00 slot should be available');
  if (spa1030?.isAvailable !== true) throw new Error('60-min 10:30 slot should be available');

  // 8. Prevent Double Booking (Conflict Rejection)
  console.log('\n8. Testing Double Booking Prevention...');

  // Customer Bob attempts to book the exact same slot (10:00)
  const doubleBook1 = await request('/customer/appointments', {
    method: 'POST',
    body: {
      salonId,
      serviceId: haircutService._id,
      appointmentDate: bookingDate,
      startTime: '10:00'
    },
    token: tokenB
  });
  console.log(`   - Bob booking 10:00 (exact overlap) status: ${doubleBook1.status} (Expected: 409 Conflict)`);
  if (doubleBook1.status !== 409) throw new Error(`Expected 409 Conflict for double booking, got ${doubleBook1.status}`);

  // Customer Bob attempts to book 60-min Spa starting at 09:30 (overlaps 10:00-10:30)
  const doubleBook2 = await request('/customer/appointments', {
    method: 'POST',
    body: {
      salonId,
      serviceId: hairSpaService._id,
      appointmentDate: bookingDate,
      startTime: '09:30'
    },
    token: tokenB
  });
  console.log(`   - Bob booking 09:30 60-min Spa (partial overlap) status: ${doubleBook2.status} (Expected: 409 Conflict)`);
  if (doubleBook2.status !== 409) throw new Error(`Expected 409 Conflict for duration overlap, got ${doubleBook2.status}`);

  console.log('   ✓ Double booking properly prevented by backend atomic collision checks.');

  // 9. Validate Rejections for Past Date, Inactive Salon, Expired Subscription
  console.log('\n9. Testing Booking Restrictions:');

  // Past date
  const pastBook = await request('/customer/appointments', {
    method: 'POST',
    body: {
      salonId,
      serviceId: haircutService._id,
      appointmentDate: '2020-01-01',
      startTime: '10:00'
    },
    token: tokenA
  });
  console.log(`   - Booking past date (2020-01-01) status: ${pastBook.status} (Expected: 400 Bad Request)`);
  if (pastBook.status !== 400) throw new Error(`Expected 400 for past date, got ${pastBook.status}`);

  // Out of working hours (08:00 when salon opens at 09:00)
  const earlyBook = await request('/customer/appointments', {
    method: 'POST',
    body: {
      salonId,
      serviceId: haircutService._id,
      appointmentDate: bookingDate,
      startTime: '08:00'
    },
    token: tokenA
  });
  console.log(`   - Booking before opening hours (08:00) status: ${earlyBook.status} (Expected: 400 Bad Request)`);
  if (earlyBook.status !== 400) throw new Error(`Expected 400 for out-of-hours booking, got ${earlyBook.status}`);

  // Inactive salon test: create a pending salon
  const pendingOwner = await request('/auth/register/salon-owner', {
    method: 'POST',
    body: {
      name: 'Pending Owner',
      email: `pending_${ts}@test.com`,
      phone: '+91 91111 22222',
      password,
      confirmPassword: password,
      salonName: `Unapproved Salon ${ts}`,
      address: 'Test Address 123',
      city: 'Bengaluru',
      identityProof: {
        url: 'https://docs.aureliabeaute.internal/secure/id-docs/sample_gst.pdf',
        filename: 'gst_certificate.pdf',
        fileType: 'application/pdf',
        fileSize: 102400
      }
    }
  });
  const pendingSalonRes = await request('/owner/salon', {
    method: 'POST',
    body: {
      salonName: `Unapproved Salon ${ts}`,
      description: 'Pending salon for testing unapproved authorization and booking denial.',
      phone: '+91 91111 22222',
      email: `pending_${ts}@test.com`,
      address: 'Test Address 123',
      city: 'Bengaluru',
      location: { latitude: 12.97, longitude: 77.59 },
      services: [{ name: 'Basic Trim', price: 200, durationMinutes: 30 }]
    },
    token: pendingOwner.data.token
  });
  const pendingSalonId = pendingSalonRes.data.salon._id;

  const inactiveBook = await request('/customer/appointments', {
    method: 'POST',
    body: {
      salonId: pendingSalonId,
      serviceId: haircutService._id,
      appointmentDate: bookingDate,
      startTime: '11:00'
    },
    token: tokenA
  });
  console.log(`   - Booking unapproved salon status: ${inactiveBook.status} (Expected: 400 Bad Request)`);
  if (inactiveBook.status !== 400) throw new Error(`Expected 400 for inactive salon, got ${inactiveBook.status}`);

  console.log('   ✓ Inactive salons, past dates, and out-of-hours bookings correctly blocked.');

  // 10. Customer Views Appointments
  console.log('\n10. Testing Customer Appointments List...');
  const customerAppsRes = await request('/customer/appointments', { token: tokenA });
  if (customerAppsRes.status !== 200) throw new Error('Customer appointments list failed');
  const customerApps = customerAppsRes.data.data;
  console.log(`   ✓ Alice has ${customerApps.length} appointment(s).`);
  const foundAliceApp = customerApps.find((a: any) => a._id === appointmentA._id);
  if (!foundAliceApp) throw new Error('Created appointment not found in Alice appointments');
  console.log(`   ✓ Found appointment for: ${foundAliceApp.serviceId.name} at ${foundAliceApp.startTime} (${foundAliceApp.status})`);

  // 11. Salon Owner Lifecycle: View, Confirm, Complete
  console.log('\n11. Testing Salon Owner Appointment Management Lifecycle...');
  const ownerAppsRes = await request('/owner/appointments', { token: ownerToken });
  if (ownerAppsRes.status !== 200) throw new Error('Owner appointments fetch failed');
  const ownerApps = ownerAppsRes.data.data;
  console.log(`   ✓ Owner received ${ownerApps.length} booking request(s).`);
  const foundOwnerApp = ownerApps.find((a: any) => a._id === appointmentA._id);
  if (!foundOwnerApp) throw new Error('Created appointment not found in Owner appointments');

  // Confirm booking
  console.log(`   - Owner confirming appointment ${appointmentA._id}...`);
  const confirmRes = await request(`/owner/appointments/${appointmentA._id}/confirm`, {
    method: 'PATCH',
    token: ownerToken
  });
  if (confirmRes.status !== 200) throw new Error(`Confirmation failed: ${JSON.stringify(confirmRes.data)}`);
  console.log(`   ✓ Appointment status is now: ${confirmRes.data.appointment.status} (Expected: CONFIRMED)`);
  if (confirmRes.data.appointment.status !== 'CONFIRMED') throw new Error('Status should be CONFIRMED');

  // Complete appointment
  console.log(`   - Owner completing appointment ${appointmentA._id}...`);
  const completeRes = await request(`/owner/appointments/${appointmentA._id}/complete`, {
    method: 'PATCH',
    token: ownerToken
  });
  if (completeRes.status !== 200) throw new Error(`Completion failed: ${JSON.stringify(completeRes.data)}`);
  console.log(`   ✓ Appointment status is now: ${completeRes.data.appointment.status} (Expected: COMPLETED)`);
  if (completeRes.data.appointment.status !== 'COMPLETED') throw new Error('Status should be COMPLETED');

  // 12. Test Customer Cancellation & Owner Rejection Flows
  console.log('\n12. Testing Rejection & Cancellation Flows...');
  // Customer Bob books 14:00-15:00 for Spa
  const bobBooking = await request('/customer/appointments', {
    method: 'POST',
    body: {
      salonId,
      serviceId: hairSpaService._id,
      appointmentDate: bookingDate,
      startTime: '14:00',
      customerNote: 'Please use herbal organic oil'
    },
    token: tokenB
  });
  if (bobBooking.status !== 201) throw new Error('Bob booking failed');
  const bobAppId = bobBooking.data.appointment._id;

  // Bob cancels his own appointment
  const cancelRes = await request(`/customer/appointments/${bobAppId}/cancel`, {
    method: 'PATCH',
    token: tokenB
  });
  if (cancelRes.status !== 200) throw new Error(`Cancel failed: ${JSON.stringify(cancelRes.data)}`);
  console.log(`   ✓ Bob cancelled appointment -> status: ${cancelRes.data.appointment.status} (Expected: CANCELLED)`);
  if (cancelRes.data.appointment.status !== 'CANCELLED') throw new Error('Status should be CANCELLED');

  // After cancellation, that slot (14:00-15:00) should be available again!
  const freeSlotCheck = await request(`/salons/${salonId}/availability?date=${bookingDate}&serviceId=${hairSpaService._id}`);
  const slot1400 = freeSlotCheck.data.slots.find((s: any) => s.startTime === '14:00');
  console.log(`   ✓ Cancelled slot 14:00 isAvailable: ${slot1400?.isAvailable} (Expected: true - released upon cancellation)`);
  if (slot1400?.isAvailable !== true) throw new Error('Slot should be released upon cancellation');

  // Customer Alice books another slot: 15:30-16:00
  const aliceSecond = await request('/customer/appointments', {
    method: 'POST',
    body: {
      salonId,
      serviceId: haircutService._id,
      appointmentDate: bookingDate,
      startTime: '15:30'
    },
    token: tokenA
  });
  const aliceSecondId = aliceSecond.data.appointment._id;

  // Owner rejects Alice's second booking
  const rejectRes = await request(`/owner/appointments/${aliceSecondId}/reject`, {
    method: 'PATCH',
    token: ownerToken
  });
  if (rejectRes.status !== 200) throw new Error(`Rejection failed: ${JSON.stringify(rejectRes.data)}`);
  console.log(`   ✓ Owner rejected appointment -> status: ${rejectRes.data.appointment.status} (Expected: REJECTED)`);
  if (rejectRes.data.appointment.status !== 'REJECTED') throw new Error('Status should be REJECTED');

  console.log('\n===============================================================');
  console.log('   ALL APPOINTMENT BOOKING & AVAILABILITY TESTS PASSED (12/12)   ');
  console.log('===============================================================');
}

run().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:\n', err);
  process.exit(1);
});
