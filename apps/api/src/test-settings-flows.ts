import mongoose, { Types } from 'mongoose';
import { app } from './app.js';
import { User } from './models/User.js';
import { Salon } from './models/Salon.js';
import { Service } from './models/Service.js';
import { Appointment } from './models/Appointment.js';
import { Subscription } from './models/Subscription.js';
import bcrypt from 'bcryptjs';
import { issueToken } from './services/token.service.js';
import { env } from './config/env.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  if (condition) {
    passed++;
    console.log(`✓ PASS ${testName}`);
  } else {
    failed++;
    console.error(`✗ FAIL ${testName}`, detail ? `\n    Detail: ${JSON.stringify(detail)}` : '');
  }
}

async function runSettingsTestSuite() {
  console.log('=== STARTING BOOK MY SALON SETTINGS TEST SUITE ===\n');

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(env.MONGODB_URI);
  }

  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 4001;
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  const ts = Date.now();
  const passwordHash = await bcrypt.hash('SecurePassword123!', 10);

  // Create test customer
  const customerUser = await User.create({
    name: 'Settings Customer',
    email: `cust_settings_${ts}@test.com`,
    passwordHash,
    phone: '+919876543210',
    address: '123 Luxury Lane',
    city: 'Bengaluru',
    role: 'CUSTOMER',
    isActive: true,
    notificationPreferences: {
      bookingUpdates: true,
      reminders: true,
      promotions: true
    }
  });

  const customerToken = issueToken({
    sub: customerUser._id.toString(),
    role: 'CUSTOMER'
  });

  // Create test owner
  const ownerUser = await User.create({
    name: 'Settings Owner',
    email: `owner_settings_${ts}@test.com`,
    passwordHash,
    phone: '+919876543211',
    role: 'SALON_OWNER',
    isActive: true
  });

  const ownerToken = issueToken({
    sub: ownerUser._id.toString(),
    role: 'SALON_OWNER'
  });

  // Create test salon first
  const salonObjectId = new Types.ObjectId();
  const testSub = await Subscription.create({
    salonId: salonObjectId,
    ownerId: ownerUser._id,
    plan: 'BUSINESS',
    billingCycle: 'MONTHLY',
    amount: 1999,
    currency: 'INR',
    status: 'ACTIVE',
    paymentMethod: 'TEST_CARD',
    transactionId: `txn_${ts}`,
    startDate: new Date(),
    endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000)
  });

  const testSalon = await Salon.create({
    _id: salonObjectId,
    ownerId: ownerUser._id,
    salonName: 'Settings Luxury Atelier',
    phone: '+919876543211',
    email: ownerUser.email,
    address: '456 Atelier Road',
    city: 'Bengaluru',
    status: 'ACTIVE',
    subscriptionId: testSub._id,
    subscriptionStatus: 'ACTIVE',
    workingHours: {
      openTime: '10:00',
      closeTime: '19:00',
      slotIntervalMinutes: 30,
      daysOpen: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    },
    unavailableDates: ['2026-12-25']
  });

  const testService = await Service.create({
    salonId: testSalon._id,
    name: 'Deluxe Hair Spa',
    price: 1500,
    duration: 45,
    category: 'Hair',
    isActive: true
  });

  // Test 1: Customer Profile retrieval includes notificationPreferences
  {
    const res = await fetch(`${baseUrl}/profile/me`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    const body = await res.json();
    assert(
      res.status === 200 &&
        body.user?.email === customerUser.email &&
        body.user?.notificationPreferences?.bookingUpdates === true,
      'Customer profile includes notification preferences',
      body
    );
  }

  // Test 2: Customer Profile update avatar and phone
  {
    const res = await fetch(`${baseUrl}/profile/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`
      },
      body: JSON.stringify({
        avatar: 'https://example.com/avatar_new.jpg',
        city: 'Chennai'
      })
    });
    const body = await res.json();
    assert(
      res.status === 200 &&
        body.user?.avatar === 'https://example.com/avatar_new.jpg' &&
        body.user?.city === 'Chennai',
      'Customer profile update persists avatar and city',
      body
    );
  }

  // Test 3: Dedicated Notification Preferences update
  {
    const res = await fetch(`${baseUrl}/profile/notifications`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`
      },
      body: JSON.stringify({
        bookingUpdates: true,
        reminders: false,
        promotions: false
      })
    });
    const body = await res.json();
    assert(
      res.status === 200 &&
        body.notificationPreferences?.reminders === false &&
        body.notificationPreferences?.promotions === false &&
        body.notificationPreferences?.bookingUpdates === true,
      'PATCH /profile/notifications updates notification preferences',
      body
    );
  }

  // Test 4: Report Problem creates ticket
  {
    const res = await fetch(`${baseUrl}/profile/report-problem`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`
      },
      body: JSON.stringify({
        category: 'App Bug or Technical Glitch',
        description: 'Encountered visual layout overlap when rotating device orientation.'
      })
    });
    const body = await res.json();
    assert(
      res.status === 201 &&
        typeof body.ticketId === 'string' &&
        body.ticketId.startsWith('BMS-'),
      'POST /profile/report-problem generates support ticket',
      body
    );
  }

  // Test 5: Salon Owner Availability GET
  {
    const res = await fetch(`${baseUrl}/owner/salon/availability`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    const body = await res.json();
    assert(
      res.status === 200 &&
        body.workingHours?.openTime === '10:00' &&
        body.unavailableDates?.includes('2026-12-25'),
      'GET /owner/salon/availability returns hours & blackout dates',
      body
    );
  }

  // Test 6: Salon Owner Availability PATCH
  {
    const res = await fetch(`${baseUrl}/owner/salon/availability`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        workingHours: {
          openTime: '09:00',
          closeTime: '21:00',
          slotIntervalMinutes: 45,
          daysOpen: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        },
        unavailableDates: ['2026-12-25', '2026-01-01']
      })
    });
    const body = await res.json();
    assert(
      res.status === 200 &&
        body.workingHours?.closeTime === '21:00' &&
        body.unavailableDates?.includes('2026-01-01'),
      'PATCH /owner/salon/availability updates working hours and blackout dates',
      body
    );
  }

  // Test 7: Booking on Blackout date rejected
  {
    const res = await fetch(`${baseUrl}/customer/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`
      },
      body: JSON.stringify({
        salonId: testSalon._id.toString(),
        serviceId: testService._id.toString(),
        appointmentDate: '2026-12-25',
        startTime: '11:00'
      })
    });
    const body = await res.json();
    assert(
      res.status === 400 &&
        body.message.includes('closed or unavailable'),
      'Booking attempt on blackout date rejected with 400',
      body
    );
  }

  // Test 8: Booking on closed day of week (Sunday) rejected
  {
    // 2026-10-18 is a Sunday
    const res = await fetch(`${baseUrl}/customer/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`
      },
      body: JSON.stringify({
        salonId: testSalon._id.toString(),
        serviceId: testService._id.toString(),
        // 2026-10-25 is a future Sunday
        appointmentDate: '2026-10-25',
        startTime: '11:00'
      })
    });
    const body = await res.json();
    assert(
      res.status === 400 &&
        body.message.includes('closed on Sundays'),
      'Booking attempt on non-operating day (Sunday) rejected with 400',
      body
    );
  }

  // Test 9: Account deletion blocked when active upcoming appointments exist
  {
    // Create an active upcoming appointment on a valid operating day (e.g. 2026-10-20 Tuesday)
    const activeApp = await Appointment.create({
      customerId: customerUser._id,
      salonId: testSalon._id,
      serviceId: testService._id,
      appointmentDate: '2026-10-20',
      startTime: '11:00',
      endTime: '11:45',
      status: 'CONFIRMED'
    });

    const res = await fetch(`${baseUrl}/profile/account`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    const body = await res.json();
    assert(
      res.status === 400 &&
        body.message.includes('active upcoming appointment'),
      'DELETE /profile/account blocked when active bookings exist (400)',
      body
    );

    // Cancel the appointment
    activeApp.status = 'CANCELLED';
    await activeApp.save();
  }

  // Test 10: Successful Account Deletion when clean
  {
    const res = await fetch(`${baseUrl}/profile/account`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    const body = await res.json();
    const updatedUser = await User.findById(customerUser._id);
    assert(
      res.status === 200 &&
        updatedUser?.isActive === false,
      'DELETE /profile/account successfully deactivates user without bookings',
      body
    );
  }

  server.close();

  console.log('\n=== SETTINGS TEST SUITE SUMMARY ===');
  console.log(`TOTAL TESTS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);

  if (failed === 0) {
    console.log('\n🎉 ALL SETTINGS FEATURES PASSED WITH 100% SUCCESS!');
    process.exit(0);
  } else {
    console.error('\n❌ SOME SETTINGS TESTS FAILED.');
    process.exit(1);
  }
}

void runSettingsTestSuite();
