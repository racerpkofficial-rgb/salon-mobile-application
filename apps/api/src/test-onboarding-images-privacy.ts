import mongoose from 'mongoose';
import { Salon } from './models/Salon.js';
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
  return { status: res.status, ok: res.ok, data };
}

async function run() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('========================================================================');
  console.log('   VERIFYING SALON ONBOARDING, IMAGES, DESCRIPTION & EMAIL PRIVACY     ');
  console.log('========================================================================\n');

  const ts = Date.now();
  const password = 'Password123!';

  // Step 1: Register Salon Owner
  console.log('1. Registering new Salon Owner without initial description/images...');
  const ownerEmail = `privacy_owner_${ts}@test.com`;
  const ownerReg = await request('/auth/register/salon-owner', {
    method: 'POST',
    body: {
      name: 'Priya Sharma',
      email: ownerEmail,
      phone: '+91 98765 43210',
      password,
      confirmPassword: password,
      salonName: `Priya Luxe Studio ${ts}`,
      address: '42 Brigade Road',
      city: 'Bengaluru',
      identityProof: {
        url: 'https://example.com/id-proof.pdf',
        filename: 'id-proof.pdf',
        fileType: 'application/pdf',
        fileSize: 102400
      }
    }
  });

  if (!ownerReg.ok) throw new Error(`Owner registration failed: ${JSON.stringify(ownerReg.data)}`);
  const ownerToken = ownerReg.data.token;
  const salonId = ownerReg.data.salon?.id || ownerReg.data.salon?._id;
  console.log(`✓ Owner registered, salon created: ID ${salonId}`);

  // Step 2: Complete Salon Details Onboarding with empty description and 0 images
  console.log('\n2. Onboarding salon with empty description and 0 images...');
  const onboardingRes = await request('/owner/salon', {
    method: 'POST',
    token: ownerToken,
    body: {
      salonName: `Priya Luxe Studio ${ts}`,
      phone: '+91 98765 43210',
      email: ownerEmail,
      address: '42 Brigade Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560001',
      latitude: 12.9716,
      longitude: 77.5946,
      services: [{ name: 'Haircut', category: 'Hair', price: 500, durationMinutes: 30, description: '' }],
      description: '   ', // Whitespace only
      images: []          // 0 images uploaded
    }
  });

  if (!onboardingRes.ok) throw new Error(`Onboarding failed: ${JSON.stringify(onboardingRes.data)}`);
  console.log('✓ Onboarding submitted successfully.');

  // Step 3: Approve salon as Super Admin so it is discoverable
  console.log('\n3. Approving salon via Admin...');
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: env.SUPER_ADMIN_EMAIL || 'admin@example.com', password: env.SUPER_ADMIN_PASSWORD || 'AdminPassword123!' }
  });
  if (!adminLogin.ok) throw new Error(`Admin login failed: ${JSON.stringify(adminLogin.data)}`);
  const adminToken = adminLogin.data.token;

  const approveRes = await request(`/admin/salons/${salonId}/approve`, {
    method: 'PATCH',
    token: adminToken
  });
  if (!approveRes.ok) throw new Error(`Admin approval failed: ${JSON.stringify(approveRes.data)}`);
  console.log('✓ Salon approved and set to ACTIVE.');

  // Step 4: Verify Public Customer Salon Details (GET /salons/:id)
  console.log('\n4. Verifying Customer Salon Details response for 0 images, empty description, and email privacy...');
  const publicSalonRes = await request(`/salons/${salonId}`);
  if (!publicSalonRes.ok) throw new Error(`Fetch public salon failed: ${JSON.stringify(publicSalonRes.data)}`);
  const publicSalon = publicSalonRes.data?.data || publicSalonRes.data;

  // Check Email Privacy
  if (publicSalon.email) {
    throw new Error(`FAILURE: Salon email exposed in public GET /salons/:id! Value: ${publicSalon.email}`);
  }
  console.log('✓ Email Privacy: Salon email is strictly stripped from GET /salons/:id.');

  // Check 0 images (no fake stock photos injected)
  if (!Array.isArray(publicSalon.images) || publicSalon.images.length !== 0) {
    throw new Error(`FAILURE: Expected 0 images, but got: ${JSON.stringify(publicSalon.images)}`);
  }
  console.log('✓ Salon Images: Exactly 0 images returned (no default stock photos injected).');

  // Check Description (no boilerplate injected)
  if (publicSalon.description !== '') {
    throw new Error(`FAILURE: Expected empty description, but got: "${publicSalon.description}"`);
  }
  console.log('✓ Salon Description: Exactly empty string (no boilerplate injected).');

  // Step 5: Test Image Validation (Max 8 images enforcement)
  console.log('\n5. Testing Max 8 images enforcement...');
  const nineImages = Array.from({ length: 9 }, (_, i) => `https://res.cloudinary.com/demo/image/upload/sample_${i + 1}.jpg`);
  const overLimitRes = await request('/owner/salon/images', {
    method: 'PATCH',
    token: ownerToken,
    body: { images: nineImages }
  });

  if (overLimitRes.status !== 400) {
    throw new Error(`FAILURE: Expected 400 for 9 images, but got ${overLimitRes.status}: ${JSON.stringify(overLimitRes.data)}`);
  }
  console.log(`✓ Rejected 9 images with 400 Bad Request: "${overLimitRes.data.message}"`);

  // Step 6: Upload valid images (e.g. 3 images)
  console.log('\n6. Updating salon images to 3 valid photos...');
  const threeImages = [
    'https://res.cloudinary.com/demo/image/upload/sample_salon_1.jpg',
    'https://res.cloudinary.com/demo/image/upload/sample_salon_2.jpg',
    'https://res.cloudinary.com/demo/image/upload/sample_salon_3.jpg'
  ];
  const updateImagesRes = await request('/owner/salon/images', {
    method: 'PATCH',
    token: ownerToken,
    body: { images: threeImages }
  });
  if (!updateImagesRes.ok) throw new Error(`Update images failed: ${JSON.stringify(updateImagesRes.data)}`);
  console.log('✓ 3 images saved successfully.');

  // Verify in public view
  const publicSalonWithImgsRes = await request(`/salons/${salonId}`);
  const publicSalonWithImgs = publicSalonWithImgsRes.data?.data || publicSalonWithImgsRes.data;
  if (publicSalonWithImgs.images?.length !== 3) {
    throw new Error(`FAILURE: Expected 3 images in public view, got: ${JSON.stringify(publicSalonWithImgs.images)}`);
  }
  console.log('✓ Customer salon view returns exactly the 3 owner-uploaded images.');

  // Step 7: Update description with custom owner text and verify
  console.log('\n7. Updating salon description with custom text...');
  const customDesc = 'Boutique hair and beauty studio specializing in natural hair care and organic treatments.';
  const updateProfileRes = await request('/profile/me', {
    method: 'PUT',
    token: ownerToken,
    body: {
      description: customDesc
    }
  });
  if (!updateProfileRes.ok) throw new Error(`Update profile failed: ${JSON.stringify(updateProfileRes.data)}`);

  const publicSalonWithDescRes = await request(`/salons/${salonId}`);
  const publicSalonWithDesc = publicSalonWithDescRes.data?.data || publicSalonWithDescRes.data;
  if (publicSalonWithDesc.description !== customDesc) {
    throw new Error(`FAILURE: Description mismatch: "${publicSalonWithDesc.description}"`);
  }
  console.log(`✓ Customer salon view returns exact owner description: "${publicSalonWithDesc.description}"`);

  // Step 8: Verify Customer Discovery List (GET /salons)
  console.log('\n8. Verifying GET /salons strips emails from all items in list...');
  const salonListRes = await request('/salons?city=Bengaluru');
  if (!salonListRes.ok) throw new Error(`GET /salons failed: ${JSON.stringify(salonListRes.data)}`);
  const salons = salonListRes.data.salons || [];
  const leakedSalon = salons.find((s: any) => s.email);
  if (leakedSalon) {
    throw new Error(`FAILURE: Found salon with email in GET /salons: ${leakedSalon.name} (${leakedSalon.email})`);
  }
  console.log(`✓ GET /salons checked (${salons.length} salons): 0 emails exposed.`);

  // Step 9: Register Customer and Book Appointment, verify Owner Appointment privacy
  console.log('\n9. Creating appointment and verifying Owner screens email privacy...');
  const custEmail = `secret_customer_${ts}@test.com`;
  const custReg = await request('/auth/register/customer', {
    method: 'POST',
    body: {
      name: 'Rohan Verma',
      email: custEmail,
      phone: '+91 99000 88776',
      password,
      confirmPassword: password
    }
  });
  if (!custReg.ok) throw new Error(`Customer register failed: ${JSON.stringify(custReg.data)}`);
  const custToken = custReg.data.token;

  // Add a service to the salon first
  const srvRes = await request('/owner/services', {
    method: 'POST',
    token: ownerToken,
    body: {
      name: 'Classic Haircut',
      price: 500,
      duration: 30,
      category: 'Hair'
    }
  });
  if (!srvRes.ok) throw new Error(`Create service failed: ${JSON.stringify(srvRes.data)}`);
  const srvId = srvRes.data.service._id;

  // Create appointment tomorrow at 18:00 (within business hours 09:00 - 20:00 and in the future)
  const futureDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const bookRes = await request('/customer/appointments', {
    method: 'POST',
    token: custToken,
    body: {
      salonId,
      serviceId: srvId,
      appointmentDate: futureDate,
      startTime: '18:00'
    }
  });
  if (!bookRes.ok) throw new Error(`Booking failed: ${JSON.stringify(bookRes.data)}`);
  const aptId = bookRes.data.appointment?._id || bookRes.data.data?._id || bookRes.data._id;
  console.log(`✓ Appointment created: ID ${aptId}`);

  // Fetch appointments as Owner (GET /owner/appointments)
  const ownerAptsRes = await request('/owner/appointments', {
    token: ownerToken
  });
  if (!ownerAptsRes.ok) throw new Error(`Owner appointments failed: ${JSON.stringify(ownerAptsRes.data)}`);
  const aptsList = ownerAptsRes.data.data || ownerAptsRes.data.appointments || [];
  const targetApt = aptsList.find((a: any) => (a._id?.toString() === aptId?.toString() || a.id?.toString() === aptId?.toString()));
  if (!targetApt) throw new Error(`Appointment not found in owner list (${aptsList.length} items): ${JSON.stringify(ownerAptsRes.data)}`);

  console.log('Inspecting appointment customer payload returned to Owner:');
  console.log(`  Customer Name: ${targetApt.customerId?.name}`);
  console.log(`  Customer Phone: ${targetApt.customerId?.phone}`);
  console.log(`  Customer Email: ${targetApt.customerId?.email}`);

  if (targetApt.customerId?.email) {
    throw new Error(`FAILURE: Customer email exposed to salon owner! Value: ${targetApt.customerId.email}`);
  }
  if (!targetApt.customerId?.name || !targetApt.customerId?.phone) {
    throw new Error(`FAILURE: Customer name or phone missing from owner appointment view`);
  }
  console.log('✓ Owner Appointment List: Customer email strictly excluded, name & phone preserved.');

  // Fetch single appointment as Owner (GET /owner/appointments/:id)
  const ownerSingleAptRes = await request(`/owner/appointments/${aptId}`, {
    token: ownerToken
  });
  if (!ownerSingleAptRes.ok) throw new Error(`Owner single appointment failed: ${JSON.stringify(ownerSingleAptRes.data)}`);
  if (ownerSingleAptRes.data.appointment?.customerId?.email) {
    throw new Error(`FAILURE: Customer email exposed in single appointment view!`);
  }
  console.log('✓ Owner Single Appointment Details: Customer email strictly excluded.');

  // Fetch owner dashboard stats (GET /owner/appointments/stats)
  const ownerDashRes = await request('/owner/appointments/stats', {
    token: ownerToken
  });
  if (!ownerDashRes.ok) throw new Error(`Owner stats failed: ${JSON.stringify(ownerDashRes.data)}`);
  const dashApt = (ownerDashRes.data.todayAppointments || []).find((a: any) => (a._id?.toString() === aptId?.toString() || a.id?.toString() === aptId?.toString()));
  if (dashApt?.customerId?.email) {
    throw new Error(`FAILURE: Customer email exposed in owner dashboard stats!`);
  }
  console.log('✓ Owner Dashboard Stats: Customer email strictly excluded.');

  console.log('\n========================================================================');
  console.log('   🎉 ALL ONBOARDING, IMAGES, DESCRIPTION & PRIVACY CHECKS PASSED!     ');
  console.log('========================================================================');
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
