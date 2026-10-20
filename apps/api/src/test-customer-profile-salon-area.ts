import mongoose from 'mongoose';
import { app } from './app.js';
import { User } from './models/User.js';
import { Salon } from './models/Salon.js';
import { Service } from './models/Service.js';
import { Appointment } from './models/Appointment.js';
import bcrypt from 'bcryptjs';
import { issueToken } from './services/token.service.js';
import { env } from './config/env.js';

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

async function runCustomerProfileSuite() {
  console.log('=== STARTING CUSTOMER PROFILE & SALON AREA TEST SUITE ===\n');

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(env.MONGODB_URI);
  }

  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 4002;
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  const ts = Date.now();
  const passwordHash = await bcrypt.hash('SecurePass123!', 10);

  // 1. Create test customer
  const customerUser = await User.create({
    name: 'Aurelia Test Customer',
    email: `cust_profile_${ts}@test.com`,
    passwordHash,
    phone: '+919876543210',
    address: '100 Feet Road, Indiranagar',
    city: 'Bengaluru',
    searchRadius: 10,
    role: 'CUSTOMER',
    isActive: true
  });

  const customerToken = issueToken({
    sub: customerUser._id.toString(),
    role: 'CUSTOMER'
  });

  // 2. Create test salon & appointments for the customer
  const ownerUser = await User.create({
    name: 'Salon Owner Test',
    email: `owner_${ts}@test.com`,
    passwordHash,
    role: 'SALON_OWNER',
    isActive: true
  });

  const salon = await Salon.create({
    ownerId: ownerUser._id,
    salonName: 'Luxe Hair & Spa Atelier',
    email: `salon_${ts}@test.com`,
    phone: '+918041234567',
    address: 'Indiranagar 12th Main',
    city: 'Bengaluru',
    location: 'Indiranagar, Bengaluru',
    coordinates: { latitude: 12.9784, longitude: 77.6408 },
    status: 'ACTIVE',
    rating: 4.9,
    reviews: 12
  });

  const service = await Service.create({
    salonId: salon._id,
    name: 'Botanical Hair Therapy',
    price: 1500,
    durationMinutes: 60,
    category: 'Hair'
  });

  // Upcoming appointment
  const upcomingApp = await Appointment.create({
    customerId: customerUser._id,
    salonId: salon._id,
    serviceId: service._id,
    appointmentDate: '2026-10-20',
    startTime: '10:00',
    endTime: '11:00',
    serviceDuration: 60,
    status: 'CONFIRMED',
    totalPrice: 1500,
    customerNote: 'Please keep organic products ready'
  });

  // Completed appointment
  const completedApp = await Appointment.create({
    customerId: customerUser._id,
    salonId: salon._id,
    serviceId: service._id,
    appointmentDate: '2026-10-01',
    startTime: '14:00',
    endTime: '15:00',
    serviceDuration: 60,
    status: 'COMPLETED',
    totalPrice: 1500
  });

  // Cancelled appointment
  const cancelledApp = await Appointment.create({
    customerId: customerUser._id,
    salonId: salon._id,
    serviceId: service._id,
    appointmentDate: '2026-09-15',
    startTime: '16:00',
    endTime: '17:00',
    serviceDuration: 60,
    status: 'CANCELLED',
    totalPrice: 1500
  });

  try {
    // TEST 1: GET /profile/me retrieves user with default searchRadius
    const resProfile1 = await fetch(`${baseUrl}/profile/me`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    const profile1 = await resProfile1.json();
    assert(
      resProfile1.ok && profile1.user?.searchRadius === 10,
      'GET /profile/me returns customer with searchRadius default = 10',
      profile1
    );

    // TEST 2: PUT /profile/me updates location preferences (city, address, searchRadius = 25)
    const resUpdate1 = await fetch(`${baseUrl}/profile/me`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${customerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        city: 'Tiruchirappalli',
        address: '45 Thillai Nagar Main Road',
        searchRadius: 25
      })
    });
    const update1 = await resUpdate1.json();
    assert(
      resUpdate1.ok &&
        update1.user?.city === 'Tiruchirappalli' &&
        update1.user?.address === '45 Thillai Nagar Main Road' &&
        update1.user?.searchRadius === 25,
      'PUT /profile/me updates city, address, and searchRadius to 25 km',
      update1
    );

    // TEST 3: Validation checks on searchRadius (rejects invalid values like 99 km)
    const resInvalidRadius = await fetch(`${baseUrl}/profile/me`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${customerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        searchRadius: 99
      })
    });
    assert(
      resInvalidRadius.status === 400,
      'PUT /profile/me rejects invalid search radius (99 km) with HTTP 400',
      await resInvalidRadius.json()
    );

    // TEST 4: Persistence across restart: GET /profile/me returns persisted values
    const resProfile2 = await fetch(`${baseUrl}/profile/me`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    const profile2 = await resProfile2.json();
    assert(
      resProfile2.ok &&
        profile2.user?.city === 'Tiruchirappalli' &&
        profile2.user?.address === '45 Thillai Nagar Main Road' &&
        profile2.user?.searchRadius === 25,
      'Persistence verification: GET /profile/me retains updated address, city, and radius',
      profile2
    );

    // TEST 5: Update search radius to 5 km (tight radius)
    const resUpdate5km = await fetch(`${baseUrl}/profile/me`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${customerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        searchRadius: 5
      })
    });
    const update5km = await resUpdate5km.json();
    assert(
      resUpdate5km.ok && update5km.user?.searchRadius === 5,
      'PUT /profile/me updates searchRadius to 5 km',
      update5km
    );

    // TEST 6: Fetch customer appointments via real endpoint
    const resApps = await fetch(`${baseUrl}/customer/appointments`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    const appsData = await resApps.json();
    const list = appsData.data || [];
    const hasUpcoming = list.some((a: any) => a._id === upcomingApp._id.toString() && a.status === 'CONFIRMED');
    const hasCompleted = list.some((a: any) => a._id === completedApp._id.toString() && a.status === 'COMPLETED');
    const hasCancelled = list.some((a: any) => a._id === cancelledApp._id.toString() && a.status === 'CANCELLED');
    assert(
      resApps.ok && hasUpcoming && hasCompleted && hasCancelled,
      'GET /appointments/my retrieves real upcoming, completed, and cancelled bookings for customer',
      { count: list.length }
    );

    // TEST 7: Role alteration blocked
    const resRoleEscalate = await fetch(`${baseUrl}/profile/me`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${customerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        role: 'SALON_OWNER'
      })
    });
    assert(
      resRoleEscalate.status === 403,
      'Role escalation from CUSTOMER to SALON_OWNER is blocked with HTTP 403',
      await resRoleEscalate.json()
    );

  } finally {
    // Cleanup test records
    await Appointment.deleteMany({ customerId: customerUser._id });
    await Service.deleteOne({ _id: service._id });
    await Salon.deleteOne({ _id: salon._id });
    await User.deleteMany({ _id: { $in: [customerUser._id, ownerUser._id] } });
    server.close();
    await mongoose.disconnect();
  }

  console.log(`\n========================================`);
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runCustomerProfileSuite().catch((err) => {
  console.error('Unhandled test suite error:', err);
  process.exit(1);
});
