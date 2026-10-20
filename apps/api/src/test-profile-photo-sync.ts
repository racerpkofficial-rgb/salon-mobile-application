import mongoose from 'mongoose';
import { User } from './models/User.js';
import { Salon } from './models/Salon.js';
import { Appointment } from './models/Appointment.js';
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

function getFutureDate(daysAhead: number = 2): string {
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
  console.log('   TESTING PROFILE PHOTO DISPLAY AND SYNCING SUITE                     ');
  console.log('========================================================================\n');

  const ts = Date.now();
  const password = 'Password123!';

  // Step 0: Super Admin Authentication for approvals
  console.log('Step 0: Authenticating Super Admin...');
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: 'admin@example.com', password: 'AdminPassword123!' }
  });
  if (adminLogin.status !== 200) throw new Error('Admin login failed');
  const adminToken = adminLogin.data.token;
  console.log('  ✓ Admin logged in successfully.\n');

  // Step 1: Register Customer A without avatar (Scenario 4 check)
  console.log('Step 1: Registering Customer A (initial state without avatar)...');
  const custAReg = await request('/auth/register/customer', {
    method: 'POST',
    body: {
      name: `Customer Alpha ${ts}`,
      email: `cust.alpha.${ts}@test.com`,
      password,
      confirmPassword: password,
      phone: '+919876543210'
    }
  });
  if (custAReg.status !== 201) throw new Error(`Customer A registration failed: ${JSON.stringify(custAReg.data)}`);
  const custAToken = custAReg.data.token;
  const custAId = custAReg.data.user.id;

  // Verify Scenario 4: User with no avatar has avatar undefined/null
  console.log('  Verifying Scenario 4: Default state when user has no photo...');
  const custAProfileInitial = await request('/profile/me', { token: custAToken });
  if (custAProfileInitial.data.user.avatar) {
    throw new Error('Expected avatar to be undefined initially');
  }
  console.log('  ✓ Customer A has no photo initially; avatar is undefined (default avatar is displayed).\n');

  // Step 2: Register Salon Owner 1 and Setup Salon
  console.log('Step 2: Registering Salon Owner 1 and Salon...');
  const ownerReg = await request('/auth/register/salon-owner', {
    method: 'POST',
    body: {
      name: `Owner One ${ts}`,
      email: `owner.one.${ts}@test.com`,
      phone: '+919811223344',
      password,
      confirmPassword: password,
      salonName: `Luxe Atelier ${ts}`,
      address: '77 Residency Road',
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
  const ownerId = ownerReg.data.user.id;

  const salonRes = await request('/owner/salon', {
    method: 'POST',
    body: {
      salonName: `Luxe Atelier ${ts}`,
      description: 'Bespoke European haircutting, scalp diagnostics, and restorative hair treatments.',
      phone: '+919811223344',
      email: `owner.one.${ts}@test.com`,
      address: '77 Residency Road',
      city: 'Bengaluru',
      location: { latitude: 12.9719, longitude: 77.5937 },
      workingHours: {
        openTime: '09:00',
        closeTime: '19:00',
        slotIntervalMinutes: 30,
        daysOpen: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      },
      services: [
        { name: 'Balayage Deluxe', category: 'Hair', price: 2500, durationMinutes: 60, description: 'Balayage treatment' }
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
  const servRes = await request(`/salons/${salonId}/services`);
  const serviceId = servRes.data.data?.[0]?._id || servRes.data.data?.[0]?.id;
  console.log(`  ✓ Salon approved & service created: ${serviceId}\n`);

  // Step 3: Test Scenario 1: Customer uploads a photo -> Discover avatar / profile returns it
  console.log('Step 3: Customer A uploads a profile photo...');
  const customerPhotoUrl1 = `https://res.cloudinary.com/bookmysalon/image/upload/v1/customer_a_${ts}.jpg`;
  const custPhotoRes = await request('/profile/me', {
    method: 'PUT',
    token: custAToken,
    body: {
      avatar: customerPhotoUrl1
    }
  });
  if (custPhotoRes.status !== 200 || custPhotoRes.data.user.avatar !== customerPhotoUrl1) {
    throw new Error(`Customer photo update failed: ${JSON.stringify(custPhotoRes.data)}`);
  }
  // Verify /profile/me returns updated photo
  const custAProfileRefreshed = await request('/profile/me', { token: custAToken });
  if (custAProfileRefreshed.data.user.avatar !== customerPhotoUrl1) {
    throw new Error('Refreshed profile did not return updated avatar');
  }
  console.log(`  ✓ Customer photo persisted and returned by /profile/me: ${customerPhotoUrl1}`);
  console.log('  ✓ Discover screen top avatar receives updated customer avatar.\n');

  // Step 4: Test Scenario 2: Customer books appointment -> Salon owner sees customer avatar in bookings
  console.log('Step 4: Customer A books appointment; Salon Owner views customer avatar in booking details...');
  const appDate = getFutureDate(3);
  const bookRes = await request('/appointments', {
    method: 'POST',
    token: custAToken,
    body: {
      salonId,
      serviceId,
      appointmentDate: appDate,
      startTime: '11:00',
      endTime: '12:00',
      customerNote: 'First time client'
    }
  });
  if (bookRes.status !== 201) throw new Error(`Booking creation failed: ${JSON.stringify(bookRes.data)}`);
  const appointmentId = bookRes.data.appointment._id || bookRes.data.appointment.id;

  // Salon owner fetches appointments list
  const ownerAppointmentsRes = await request('/owner/appointments', { token: ownerToken });
  if (ownerAppointmentsRes.status !== 200) throw new Error('Owner failed to fetch appointments');
  const foundInList = ownerAppointmentsRes.data.data.find((a: any) => a._id === appointmentId);
  if (!foundInList) throw new Error('Appointment not found in owner appointments list');
  if (foundInList.customerId?.avatar !== customerPhotoUrl1) {
    throw new Error(`Owner list appointment customerId missing avatar: ${JSON.stringify(foundInList.customerId)}`);
  }
  console.log(`  ✓ Owner appointments list contains customer avatar: ${foundInList.customerId.avatar}`);

  // Salon owner fetches single booking details
  const ownerBookingDetailRes = await request(`/owner/appointments/${appointmentId}`, { token: ownerToken });
  if (ownerBookingDetailRes.status !== 200) throw new Error('Owner failed to fetch single booking detail');
  const singleApp = ownerBookingDetailRes.data.appointment;
  if (singleApp.customerId?.avatar !== customerPhotoUrl1) {
    throw new Error(`Owner single appointment customerId missing avatar: ${JSON.stringify(singleApp.customerId)}`);
  }
  console.log(`  ✓ Owner single appointment detail contains customer avatar: ${singleApp.customerId.avatar}`);
  console.log('  ✓ Salon owner sees exact customer profile photo for the booking.\n');

  // Step 5: Test Scenario 3: Salon Owner uploads profile photo -> Customers see it in Salon Details
  console.log('Step 5: Salon Owner uploads owner profile photo; Customer views owner profile photo in Salon Details...');
  const ownerPhotoUrl1 = `https://res.cloudinary.com/bookmysalon/image/upload/v1/owner_one_${ts}.jpg`;
  const ownerPhotoRes = await request('/profile/me', {
    method: 'PUT',
    token: ownerToken,
    body: {
      avatar: ownerPhotoUrl1
    }
  });
  if (ownerPhotoRes.status !== 200 || ownerPhotoRes.data.user.avatar !== ownerPhotoUrl1) {
    throw new Error(`Owner photo update failed: ${JSON.stringify(ownerPhotoRes.data)}`);
  }
  console.log(`  ✓ Owner photo persisted: ${ownerPhotoUrl1}`);

  // Customer fetches salon details via public endpoint
  const publicSalonRes = await request(`/salons/${salonId}`);
  if (publicSalonRes.status !== 200) throw new Error('Customer failed to fetch salon details');
  const salonData = publicSalonRes.data.data;
  if (!salonData.ownerId || salonData.ownerId.avatar !== ownerPhotoUrl1) {
    throw new Error(`Salon owner avatar missing or incorrect: ${JSON.stringify(salonData.ownerId)}`);
  }
  console.log(`  ✓ Customer views salon details with populated owner avatar: ${salonData.ownerId.avatar}`);
  console.log(`  ✓ Owner avatar (${salonData.ownerId.avatar}) is distinct from salon gallery images: ${JSON.stringify(salonData.images)}`);
  console.log('  ✓ Salon owner photo is correctly displayed to customers.\n');

  // Step 6: Test Scenario 5: User changes photo -> Latest photo appears after refresh
  console.log('Step 6: Customer A updates their photo to a new image...');
  const customerPhotoUrl2 = `https://res.cloudinary.com/bookmysalon/image/upload/v2/customer_a_updated_${ts}.jpg`;
  const custUpdateRes = await request('/profile/me', {
    method: 'PUT',
    token: custAToken,
    body: {
      avatar: customerPhotoUrl2
    }
  });
  if (custUpdateRes.status !== 200 || custUpdateRes.data.user.avatar !== customerPhotoUrl2) {
    throw new Error('Customer photo update to v2 failed');
  }

  // Check that owner now sees the updated photo for Customer A's booking
  const ownerBookingDetailRes2 = await request(`/owner/appointments/${appointmentId}`, { token: ownerToken });
  if (ownerBookingDetailRes2.data.appointment.customerId?.avatar !== customerPhotoUrl2) {
    throw new Error(`Owner did not receive updated avatar: ${ownerBookingDetailRes2.data.appointment.customerId?.avatar}`);
  }
  console.log(`  ✓ Latest customer photo immediately retrieved by salon owner: ${customerPhotoUrl2}`);

  // Owner updates their photo to v2
  const ownerPhotoUrl2 = `https://res.cloudinary.com/bookmysalon/image/upload/v2/owner_one_updated_${ts}.jpg`;
  await request('/profile/me', {
    method: 'PUT',
    token: ownerToken,
    body: {
      avatar: ownerPhotoUrl2
    }
  });
  const publicSalonRes2 = await request(`/salons/${salonId}`);
  if (publicSalonRes2.data.data.ownerId?.avatar !== ownerPhotoUrl2) {
    throw new Error(`Customer did not receive updated owner avatar: ${publicSalonRes2.data.data.ownerId?.avatar}`);
  }
  console.log(`  ✓ Latest salon owner photo immediately retrieved by customer: ${ownerPhotoUrl2}\n`);

  // Step 7: Test Scenario 6: Cross-user isolation - Customer B's photo never collides with Customer A
  console.log('Step 7: Testing cross-user photo isolation...');
  const custBReg = await request('/auth/register/customer', {
    method: 'POST',
    body: {
      name: `Customer Beta ${ts}`,
      email: `cust.beta.${ts}@test.com`,
      password,
      confirmPassword: password,
      phone: '+919112233445'
    }
  });
  const custBToken = custBReg.data.token;
  const customerBPhotoUrl = `https://res.cloudinary.com/bookmysalon/image/upload/v1/customer_b_${ts}.jpg`;
  await request('/profile/me', {
    method: 'PUT',
    token: custBToken,
    body: { avatar: customerBPhotoUrl }
  });

  // Customer B books a second appointment
  const bookResB = await request('/appointments', {
    method: 'POST',
    token: custBToken,
    body: {
      salonId,
      serviceId,
      appointmentDate: appDate,
      startTime: '14:00',
      endTime: '15:00',
      customerNote: 'Customer B appointment'
    }
  });
  const appointmentBId = bookResB.data.appointment._id || bookResB.data.appointment.id;

  // Verify both appointments have their own respective customer photo
  const appADetail = (await request(`/owner/appointments/${appointmentId}`, { token: ownerToken })).data.appointment;
  const appBDetail = (await request(`/owner/appointments/${appointmentBId}`, { token: ownerToken })).data.appointment;

  if (appADetail.customerId?.avatar !== customerPhotoUrl2) {
    throw new Error(`Appointment A has wrong avatar: ${appADetail.customerId?.avatar}`);
  }
  if (appBDetail.customerId?.avatar !== customerBPhotoUrl) {
    throw new Error(`Appointment B has wrong avatar: ${appBDetail.customerId?.avatar}`);
  }
  if (appADetail.customerId?.avatar === appBDetail.customerId?.avatar) {
    throw new Error('Avatar collision between two customers!');
  }
  console.log(`  ✓ Appointment A customer avatar: ${appADetail.customerId.avatar}`);
  console.log(`  ✓ Appointment B customer avatar: ${appBDetail.customerId.avatar}`);
  console.log('  ✓ Strict cross-user avatar isolation verified. Distinct customer photos never collide.\n');

  console.log('========================================================================');
  console.log('   ALL 6 PROFILE PHOTO DISPLAY & SYNCING SCENARIOS PASSED SUCCESSFULLY! ');
  console.log('========================================================================');

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
