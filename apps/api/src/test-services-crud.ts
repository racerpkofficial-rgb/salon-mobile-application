import mongoose from 'mongoose';
import { Appointment } from './models/Appointment.js';
import { Salon } from './models/Salon.js';
import { Service } from './models/Service.js';
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
  console.log('   TESTING SERVICES MANAGEMENT ENDPOINTS & BUSINESS LOGIC              ');
  console.log('========================================================================\n');

  const ts = Date.now();
  const password = 'Password123!';

  // 1. Create Owner 1 & Salon 1
  console.log('1. Setting up Owner 1 and Salon 1...');
  const owner1Email = `owner_srv1_${ts}@test.com`;
  const reg1 = await request('/auth/register/salon-owner', {
    method: 'POST',
    body: {
      name: 'Owner Alpha',
      email: owner1Email,
      phone: '+91 98888 11111',
      password,
      confirmPassword: password,
      salonName: `Atelier Salon Alpha ${ts}`,
      address: '123 MG Road, Indiranagar',
      city: 'Bengaluru',
      identityProof: {
        url: 'https://docs.aureliabeaute.internal/secure/id-docs/sample_gst.pdf',
        filename: 'gst_certificate.pdf',
        fileType: 'application/pdf',
        fileSize: 102400
      }
    }
  });
  if (!reg1.ok) throw new Error(`Owner 1 register failed: ${JSON.stringify(reg1.data)}`);
  const token1 = reg1.data.token;
  const salon1Id = reg1.data.salon?._id || reg1.data.salon?.id;
  console.log(`✓ Owner 1 & Salon 1 created: ID ${salon1Id}`);

  // 2. Create Owner 2 & Salon 2 for isolation testing
  console.log('2. Setting up Owner 2 and Salon 2 for multi-tenant isolation...');
  const owner2Email = `owner_srv2_${ts}@test.com`;
  const reg2 = await request('/auth/register/salon-owner', {
    method: 'POST',
    body: {
      name: 'Owner Beta',
      email: owner2Email,
      phone: '+91 98888 22222',
      password,
      confirmPassword: password,
      salonName: `Atelier Salon Beta ${ts}`,
      address: '456 Brigade Road',
      city: 'Bengaluru',
      identityProof: {
        url: 'https://docs.aureliabeaute.internal/secure/id-docs/sample_gst.pdf',
        filename: 'gst_certificate.pdf',
        fileType: 'application/pdf',
        fileSize: 102400
      }
    }
  });
  if (!reg2.ok) throw new Error(`Owner 2 register failed: ${JSON.stringify(reg2.data)}`);
  const token2 = reg2.data.token;
  console.log('✓ Owner 2 & Salon 2 created.');

  // 3. Authorization guard check: Unauthenticated & Customer role
  console.log('3. Verifying authorization guards on /owner/services...');
  const unauthRes = await request('/owner/services');
  if (unauthRes.status !== 401) throw new Error(`Expected 401 for unauthenticated, got ${unauthRes.status}`);

  const customerEmail = `cust_srv_${ts}@test.com`;
  const custReg = await request('/auth/register/customer', {
    method: 'POST',
    body: {
      name: 'Customer Test',
      email: customerEmail,
      phone: '+91 97777 55555',
      password,
      confirmPassword: password
    }
  });
  if (!custReg.ok) throw new Error(`Customer register failed: ${JSON.stringify(custReg.data)}`);
  const custToken = custReg.data.token;
  const custForbidden = await request('/owner/services', { token: custToken });
  if (custForbidden.status !== 403) throw new Error(`Expected 403 for Customer role, got ${custForbidden.status}`);
  console.log('✓ Role guards verified: 401 unauthenticated, 403 Customer.');

  // 4. GET /owner/services for Owner 1 (Syncs embedded if needed)
  console.log('4. Testing GET /owner/services...');
  const listRes1 = await request('/owner/services', { token: token1 });
  if (!listRes1.ok) throw new Error(`List failed: ${JSON.stringify(listRes1.data)}`);
  console.log(`✓ Owner 1 services retrieved: count ${listRes1.data.count}`);
  if (!Array.isArray(listRes1.data.data)) throw new Error('Expected data to be an array of services');

  // 5. POST /owner/services Validation checks
  console.log('5. Testing POST /owner/services validation...');
  // Invalid name (< 2 chars)
  const invalidName = await request('/owner/services', {
    method: 'POST',
    token: token1,
    body: { name: 'A', price: 500, durationMinutes: 30 }
  });
  if (invalidName.status !== 400) throw new Error(`Expected 400 for short name, got ${invalidName.status}`);

  // Invalid negative price
  const invalidPrice = await request('/owner/services', {
    method: 'POST',
    token: token1,
    body: { name: 'Hair Treatment', price: -50, durationMinutes: 30 }
  });
  if (invalidPrice.status !== 400) throw new Error(`Expected 400 for negative price, got ${invalidPrice.status}`);

  // Invalid duration (< 5 mins)
  const invalidDur = await request('/owner/services', {
    method: 'POST',
    token: token1,
    body: { name: 'Hair Treatment', price: 500, durationMinutes: 2 }
  });
  if (invalidDur.status !== 400) throw new Error(`Expected 400 for short duration, got ${invalidDur.status}`);
  console.log('✓ Validation rules verified: short name, negative price, duration < 5 correctly rejected with 400.');

  // 6. Create valid service
  console.log('6. Creating new service via POST /owner/services...');
  const createRes = await request('/owner/services', {
    method: 'POST',
    token: token1,
    body: {
      name: 'Balayage & Hair Gloss',
      category: 'Color & Treatments',
      price: 1800,
      durationMinutes: 90,
      description: 'Premium organic color contouring and hydration hair glossing.',
      isActive: true
    }
  });
  if (createRes.status !== 201) throw new Error(`Expected 201 created, got ${createRes.status}: ${JSON.stringify(createRes.data)}`);
  const createdService = createRes.data.service;
  const serviceId = createdService._id || createdService.id;
  if (!serviceId) throw new Error('Service ID missing from response');
  console.log(`✓ Service created: "${createdService.name}", ID: ${serviceId}, Price: ₹${createdService.price}, Duration: ${createdService.durationMinutes}m`);

  // Verify in MongoDB Service collection and embedded salon
  const dbService = await Service.findById(serviceId);
  if (!dbService || dbService.name !== 'Balayage & Hair Gloss') {
    throw new Error('Service document not found in MongoDB Service collection');
  }
  const dbSalon1 = await Salon.findById(salon1Id);
  const embeddedFound = dbSalon1?.services?.find((s: any) => s.name === 'Balayage & Hair Gloss');
  if (!embeddedFound) {
    throw new Error('Service not found in embedded salon.services');
  }
  console.log('✓ Verified: Persisted in MongoDB Service model & synced to Salon embedded services.');

  // 7. Multi-tenant Isolation: Owner 2 cannot see, edit, toggle, or delete Owner 1's service
  console.log('7. Verifying Multi-Tenant Isolation (Owner 2 vs Owner 1)...');
  const owner2List = await request('/owner/services', { token: token2 });
  const hasOwner1Service = owner2List.data.data?.some((s: any) => (s._id || s.id) === serviceId);
  if (hasOwner1Service) throw new Error('Owner 2 can see Owner 1 service!');

  const owner2Edit = await request(`/owner/services/${serviceId}`, {
    method: 'PUT',
    token: token2,
    body: { name: 'Hacked Name' }
  });
  if (owner2Edit.status !== 404) throw new Error(`Expected 404 when Owner 2 edits Owner 1 service, got ${owner2Edit.status}`);

  const owner2Toggle = await request(`/owner/services/${serviceId}/toggle`, {
    method: 'PATCH',
    token: token2
  });
  if (owner2Toggle.status !== 404) throw new Error(`Expected 404 when Owner 2 toggles Owner 1 service, got ${owner2Toggle.status}`);

  const owner2Delete = await request(`/owner/services/${serviceId}`, {
    method: 'DELETE',
    token: token2
  });
  if (owner2Delete.status !== 404) throw new Error(`Expected 404 when Owner 2 deletes Owner 1 service, got ${owner2Delete.status}`);
  console.log('✓ Multi-tenant isolation verified: Owner 2 cannot view, edit, toggle, or delete Owner 1 services.');

  // 8. PUT /owner/services/:id - Update existing service
  console.log('8. Testing PUT /owner/services/:id...');
  const updateRes = await request(`/owner/services/${serviceId}`, {
    method: 'PUT',
    token: token1,
    body: {
      name: 'Balayage, Gloss & K-18 Treatment',
      price: 2200,
      durationMinutes: 105,
      description: 'Includes molecular repair mask.'
    }
  });
  if (!updateRes.ok) throw new Error(`Update failed: ${JSON.stringify(updateRes.data)}`);
  if (updateRes.data.service.name !== 'Balayage, Gloss & K-18 Treatment' || updateRes.data.service.price !== 2200) {
    throw new Error(`Updated values mismatch: ${JSON.stringify(updateRes.data.service)}`);
  }
  console.log(`✓ Service updated: "${updateRes.data.service.name}", New Price: ₹${updateRes.data.service.price}, Duration: ${updateRes.data.service.durationMinutes}m`);

  // 9. PATCH /owner/services/:id/toggle - Toggle active/inactive
  console.log('9. Testing PATCH /owner/services/:id/toggle & Customer Discovery...');
  const toggleRes1 = await request(`/owner/services/${serviceId}/toggle`, {
    method: 'PATCH',
    token: token1
  });
  if (!toggleRes1.ok) throw new Error(`Toggle failed: ${JSON.stringify(toggleRes1.data)}`);
  if (toggleRes1.data.service.isActive !== false) throw new Error('Expected service to be deactivated (isActive: false)');
  console.log('✓ Service successfully deactivated.');

  // Check customer discovery: inactive service must NOT be returned in /salons/:id/services
  const customerDiscoveryInactive = await request(`/salons/${salon1Id}/services`);
  const foundInactive = customerDiscoveryInactive.data.data?.some((s: any) => (s._id || s.id) === serviceId);
  if (foundInactive) throw new Error('Customer can see deactivated service in public listing!');
  console.log('✓ Verified: Deactivated service is hidden from customer discovery.');

  // Toggle back to active
  const toggleRes2 = await request(`/owner/services/${serviceId}/toggle`, {
    method: 'PATCH',
    token: token1
  });
  if (!toggleRes2.ok) throw new Error(`Toggle failed: ${JSON.stringify(toggleRes2.data)}`);
  if (toggleRes2.data.service.isActive !== true) throw new Error('Expected service to be activated (isActive: true)');

  const customerDiscoveryActive = await request(`/salons/${salon1Id}/services`);
  const foundActive = customerDiscoveryActive.data.data?.some((s: any) => (s._id || s.id) === serviceId);
  if (!foundActive) throw new Error('Customer cannot see reactivated service in public listing!');
  console.log('✓ Verified: Reactivated service is visible to customers again.');

  // 10. Active Booking Protection on DELETE
  console.log('10. Testing active booking protection when deleting a service...');
  // Customer creates a booking for this service
  const customerUser = await User.findOne({ email: customerEmail });
  const appDate = '2026-10-25';
  const testApp = await Appointment.create({
    customerId: customerUser!._id,
    salonId: salon1Id,
    serviceId: serviceId,
    serviceName: 'Balayage, Gloss & K-18 Treatment',
    serviceDuration: 105,
    originalPrice: 2200,
    totalPrice: 2200,
    appointmentDate: appDate,
    startTime: '10:00',
    endTime: '11:45',
    status: 'CONFIRMED'
  });
  console.log(`   Created test CONFIRMED appointment: ${testApp._id}`);

  // Attempt to DELETE the service while active booking exists
  const blockedDelete = await request(`/owner/services/${serviceId}`, {
    method: 'DELETE',
    token: token1
  });
  if (blockedDelete.status !== 400) {
    throw new Error(`Expected 400 Bad Request when deleting service with active booking, got ${blockedDelete.status}: ${JSON.stringify(blockedDelete.data)}`);
  }
  console.log(`✓ Accidental deletion blocked: ${blockedDelete.data.message}`);

  // 11. Delete service after booking is resolved (COMPLETED)
  console.log('11. Testing successful delete after bookings are completed...');
  testApp.status = 'COMPLETED';
  await testApp.save();

  const successDelete = await request(`/owner/services/${serviceId}`, {
    method: 'DELETE',
    token: token1
  });
  if (!successDelete.ok) {
    throw new Error(`Delete failed after booking completion: ${JSON.stringify(successDelete.data)}`);
  }
  console.log('✓ Service deleted successfully when no active bookings remain.');

  // Confirm removed from Service model & embedded salon.services
  const checkServiceDoc = await Service.findById(serviceId);
  if (checkServiceDoc) throw new Error('Service document still exists in Service collection!');
  const checkSalonDoc = await Salon.findById(salon1Id);
  const stillEmbedded = checkSalonDoc?.services?.some((s: any) => (s._id || s.id)?.toString() === serviceId);
  if (stillEmbedded) throw new Error('Service still present in embedded salon.services!');
  console.log('✓ Confirmed: Removed from Service collection and embedded salon.services.');

  // Confirm appointment history is intact
  const pastApp = await Appointment.findById(testApp._id);
  if (!pastApp || pastApp.serviceName !== 'Balayage, Gloss & K-18 Treatment') {
    throw new Error('Appointment historical snapshot damaged!');
  }
  console.log(`✓ Appointment historical snapshot preserved: "${pastApp.serviceName}", Total: ₹${pastApp.totalPrice}`);

  // Verify owner stats calculation doesn't crash on deleted service
  const statsRes = await request('/owner/appointments/stats', { token: token1 });
  if (!statsRes.ok) throw new Error(`Stats endpoint failed: ${JSON.stringify(statsRes.data)}`);
  console.log(`✓ Owner stats revenue calculated smoothly without crash: Total Revenue ₹${statsRes.data.totalRevenue}`);

  console.log('\n========================================================================');
  console.log('   🎉 ALL SERVICES MANAGEMENT TESTS PASSED WITH 100% SUCCESS!          ');
  console.log('========================================================================\n');

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
