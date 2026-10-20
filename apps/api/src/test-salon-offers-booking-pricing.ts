import mongoose from 'mongoose';
import { Salon } from './models/Salon.js';
import { SalonOffer } from './models/SalonOffer.js';
import { Service } from './models/Service.js';
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
  return { status: res.status, ok: res.ok, data };
}

async function run() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('========================================================================');
  console.log('   TESTING SALON OFFERS, PRICING CALCULATION & BOOKING LIFECYCLE        ');
  console.log('========================================================================\n');

  const ts = Date.now();
  const password = 'Password123!';

  // 1. Setup Salon Owner and Salon
  console.log('1. Setting up Owner and Salon...');
  const ownerEmail = `offer_owner_${ts}@test.com`;
  const ownerReg = await request('/auth/register/salon-owner', {
    method: 'POST',
    body: {
      name: 'Kavita Menon',
      email: ownerEmail,
      phone: '+91 98888 77665',
      password,
      confirmPassword: password,
      salonName: `Kavita Style Hub ${ts}`,
      address: '77 Indiranagar 100ft Rd',
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

  // Onboard salon
  await request('/owner/salon', {
    method: 'POST',
    token: ownerToken,
    body: {
      salonName: `Kavita Style Hub ${ts}`,
      phone: '+91 98888 77665',
      email: ownerEmail,
      address: '77 Indiranagar 100ft Rd',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560038',
      latitude: 12.9716,
      longitude: 77.5946,
      services: [{ name: 'Setup Svc', category: 'General', price: 100, durationMinutes: 30, description: '' }]
    }
  });

  // Approve salon via Admin
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: env.SUPER_ADMIN_EMAIL || 'admin@example.com', password: env.SUPER_ADMIN_PASSWORD || 'AdminPassword123!' }
  });
  const adminToken = adminLogin.data.token;
  await request(`/admin/salons/${salonId}/approve`, { method: 'PATCH', token: adminToken });
  console.log(`✓ Salon approved: ID ${salonId}`);

  // 2. Create Services
  console.log('\n2. Creating Salon Services (Haircut ₹300, Facial ₹300, Threading ₹50)...');
  const s1Res = await request('/owner/services', {
    method: 'POST',
    token: ownerToken,
    body: { name: 'Classic Haircut', price: 300, durationMinutes: 30, category: 'Hair', description: 'Precision hair styling' }
  });
  if (!s1Res.ok) throw new Error(`Create S1 failed: ${JSON.stringify(s1Res.data)}`);
  const s1Id = s1Res.data.service._id;

  const s2Res = await request('/owner/services', {
    method: 'POST',
    token: ownerToken,
    body: { name: 'Gold Glow Facial', price: 300, durationMinutes: 45, category: 'Facial', description: 'Rejuvenating facial glow' }
  });
  if (!s2Res.ok) throw new Error(`Create S2 failed: ${JSON.stringify(s2Res.data)}`);
  const s2Id = s2Res.data.service._id;

  const s3Res = await request('/owner/services', {
    method: 'POST',
    token: ownerToken,
    body: { name: 'Basic Threading', price: 50, durationMinutes: 15, category: 'Skin', description: 'Eyebrow shaping' }
  });
  if (!s3Res.ok) throw new Error(`Create S3 failed: ${JSON.stringify(s3Res.data)}`);
  const s3Id = s3Res.data.service._id;
  console.log('✓ Services created successfully.');

  // 3. Register Customer
  console.log('\n3. Registering Customer...');
  const custEmail = `cust_offer_${ts}@test.com`;
  const custReg = await request('/auth/register/customer', {
    method: 'POST',
    body: { name: 'Aarav Patel', email: custEmail, phone: '+91 97777 66554', password, confirmPassword: password }
  });
  const custToken = custReg.data.token;
  console.log('✓ Customer registered.');

  // Test 1: ₹300 Service with NO offer -> ₹300
  console.log('\n--- TEST 1: ₹300 service with NO offer ---');
  const b1Res = await request('/customer/appointments', {
    method: 'POST',
    token: custToken,
    body: {
      salonId,
      serviceId: s1Id,
      appointmentDate: '2026-10-20',
      startTime: '10:00'
    }
  });
  if (!b1Res.ok) throw new Error(`Booking 1 failed: ${JSON.stringify(b1Res.data)}`);
  const apt1 = b1Res.data.appointment || b1Res.data.data;
  console.log(`Original: ₹${apt1.originalPrice}, Discount: ₹${apt1.discountAmount}, Total: ₹${apt1.totalPrice}`);
  if (apt1.originalPrice !== 300 || apt1.discountAmount !== 0 || apt1.totalPrice !== 300) {
    throw new Error(`TEST 1 FAILED: Expected 300 / 0 / 300, got ${apt1.originalPrice} / ${apt1.discountAmount} / ${apt1.totalPrice}`);
  }
  console.log('✓ Test 1 PASSED: ₹300 service with no offer = ₹300 total (discount: ₹0).');

  // Test 2: ₹300 Service with valid 50% offer -> ₹150
  console.log('\n--- TEST 2: ₹300 service with 50% PERCENTAGE offer ---');
  const futureEnd = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
  const off1Res = await request('/owner/offers', {
    method: 'POST',
    token: ownerToken,
    body: {
      title: 'Grand 50% Festive Discount',
      description: 'Half price across all treatments',
      discountType: 'PERCENTAGE',
      discountValue: 50,
      applicableService: 'ALL',
      endDate: futureEnd
    }
  });
  if (!off1Res.ok) throw new Error(`Create Offer 1 failed: ${JSON.stringify(off1Res.data)}`);
  const off1Id = off1Res.data.offer._id || off1Res.data.offer.id;

  const b2Res = await request('/customer/appointments', {
    method: 'POST',
    token: custToken,
    body: {
      salonId,
      serviceId: s1Id,
      offerId: off1Id,
      appointmentDate: '2026-10-20',
      startTime: '11:00'
    }
  });
  if (!b2Res.ok) throw new Error(`Booking 2 failed: ${JSON.stringify(b2Res.data)}`);
  const apt2 = b2Res.data.appointment || b2Res.data.data;
  console.log(`Original: ₹${apt2.originalPrice}, Discount: ₹${apt2.discountAmount}, Total: ₹${apt2.totalPrice}`);
  if (apt2.originalPrice !== 300 || apt2.discountAmount !== 150 || apt2.totalPrice !== 150) {
    throw new Error(`TEST 2 FAILED: Expected 300 / 150 / 150, got ${apt2.originalPrice} / ${apt2.discountAmount} / ${apt2.totalPrice}`);
  }
  console.log('✓ Test 2 PASSED: ₹300 service with 50% discount = ₹150 total (discount: ₹150).');

  // Test 3: ₹300 Service with valid ₹50 FIXED discount -> ₹250
  console.log('\n--- TEST 3: ₹300 service with ₹50 FIXED discount offer ---');
  const off2Res = await request('/owner/offers', {
    method: 'POST',
    token: ownerToken,
    body: {
      title: 'Flat ₹50 Off Facial Glow',
      description: 'Exclusive 50 rupees off facial treatment',
      discountType: 'FIXED',
      discountValue: 50,
      applicableService: s2Id,
      endDate: futureEnd
    }
  });
  if (!off2Res.ok) throw new Error(`Create Offer 2 failed: ${JSON.stringify(off2Res.data)}`);
  const off2Id = off2Res.data.offer._id || off2Res.data.offer.id;

  const b3Res = await request('/customer/appointments', {
    method: 'POST',
    token: custToken,
    body: {
      salonId,
      serviceId: s2Id,
      offerId: off2Id,
      appointmentDate: '2026-10-20',
      startTime: '12:00'
    }
  });
  if (!b3Res.ok) throw new Error(`Booking 3 failed: ${JSON.stringify(b3Res.data)}`);
  const apt3 = b3Res.data.appointment || b3Res.data.data;
  console.log(`Original: ₹${apt3.originalPrice}, Discount: ₹${apt3.discountAmount}, Total: ₹${apt3.totalPrice}`);
  if (apt3.originalPrice !== 300 || apt3.discountAmount !== 50 || apt3.totalPrice !== 250) {
    throw new Error(`TEST 3 FAILED: Expected 300 / 50 / 250, got ${apt3.originalPrice} / ${apt3.discountAmount} / ${apt3.totalPrice}`);
  }
  console.log('✓ Test 3 PASSED: ₹300 service with ₹50 fixed discount = ₹250 total (discount: ₹50).');

  // Test 4: Offer applies ONLY to selected eligible services
  console.log('\n--- TEST 4: Service eligibility restriction ---');
  // Attempt to book Haircut (s1Id) using Offer 2 (which is strictly for Facial s2Id)
  const bIneligible = await request('/customer/appointments', {
    method: 'POST',
    token: custToken,
    body: {
      salonId,
      serviceId: s1Id,
      offerId: off2Id,
      appointmentDate: '2026-10-20',
      startTime: '14:00'
    }
  });
  if (bIneligible.status !== 400) {
    throw new Error(`TEST 4 FAILED: Expected 400 for ineligible service, got status ${bIneligible.status}`);
  }
  console.log(`✓ Test 4 PASSED: Rejected with 400: "${bIneligible.data.message}"`);

  // Test 5: Expired and Inactive offers cannot be applied
  console.log('\n--- TEST 5: Expired and Inactive offer prevention ---');
  // Create an expired offer directly in DB
  const pastDate = new Date(Date.now() - 5 * 86400000);
  const expiredOffer = await SalonOffer.create({
    salonId: new mongoose.Types.ObjectId(salonId),
    title: 'Old Expired Promo',
    description: 'No longer valid',
    discountType: 'PERCENTAGE',
    discountValue: 25,
    applicableService: 'ALL',
    startDate: new Date(Date.now() - 15 * 86400000),
    endDate: pastDate,
    status: 'EXPIRED',
    isActive: false
  });

  const bExpired = await request('/customer/appointments', {
    method: 'POST',
    token: custToken,
    body: {
      salonId,
      serviceId: s1Id,
      offerId: expiredOffer._id.toString(),
      appointmentDate: '2026-10-20',
      startTime: '15:00'
    }
  });
  if (bExpired.status !== 400) {
    throw new Error(`TEST 5 FAILED: Expected 400 for expired offer, got status ${bExpired.status}`);
  }
  console.log(`✓ Test 5 PASSED: Expired offer rejected with 400: "${bExpired.data.message}"`);

  // Test 6: Invalid discounts and negative price prevention
  console.log('\n--- TEST 6: Fixed discount exceeding service price clamps to ₹0 (no negative prices) ---');
  const offLargeFixed = await SalonOffer.create({
    salonId: new mongoose.Types.ObjectId(salonId),
    title: 'Huge ₹400 Voucher',
    description: '400 rupees off',
    discountType: 'FIXED',
    discountValue: 400,
    applicableService: 'ALL',
    startDate: new Date(),
    endDate: new Date(Date.now() + 10 * 86400000),
    status: 'ACTIVE',
    isActive: true
  });

  // Apply to ₹50 service (s3Id)
  const bLargeFixed = await request('/customer/appointments', {
    method: 'POST',
    token: custToken,
    body: {
      salonId,
      serviceId: s3Id,
      offerId: offLargeFixed._id.toString(),
      appointmentDate: '2026-10-20',
      startTime: '16:00'
    }
  });
  if (!bLargeFixed.ok) throw new Error(`Large fixed booking failed: ${JSON.stringify(bLargeFixed.data)}`);
  const aptLarge = bLargeFixed.data.appointment || bLargeFixed.data.data;
  console.log(`Original: ₹${aptLarge.originalPrice}, Discount: ₹${aptLarge.discountAmount}, Total: ₹${aptLarge.totalPrice}`);
  if (aptLarge.originalPrice !== 50 || aptLarge.discountAmount !== 50 || aptLarge.totalPrice !== 0) {
    throw new Error(`TEST 6 FAILED: Expected 50 / 50 / 0, got ${aptLarge.originalPrice} / ${aptLarge.discountAmount} / ${aptLarge.totalPrice}`);
  }
  console.log('✓ Test 6 PASSED: ₹400 voucher on ₹50 service clamped discount to ₹50, final price = ₹0 (never negative).');

  // Test 7: Persisted records and email privacy
  console.log('\n--- TEST 7: Persisted record retrieval & email privacy ---');
  const ownerAptRes = await request(`/owner/appointments/${apt2._id}`, { token: ownerToken });
  if (!ownerAptRes.ok) throw new Error(`Fetch owner appointment failed: ${JSON.stringify(ownerAptRes.data)}`);
  const ownerView = ownerAptRes.data.appointment;

  if (ownerView.originalPrice !== 300 || ownerView.discountAmount !== 150 || ownerView.totalPrice !== 150) {
    throw new Error('Owner view price mismatch');
  }
  if (!ownerView.offerId) {
    throw new Error('Owner view missing populated offerId');
  }
  if (ownerView.customerId?.email) {
    throw new Error(`Email privacy leak: ${ownerView.customerId.email}`);
  }
  console.log(`✓ Owner view verified: Original: ₹${ownerView.originalPrice}, Discount: ₹${ownerView.discountAmount}, Total: ₹${ownerView.totalPrice}`);
  console.log(`  Populated Offer: "${ownerView.offerId.title}" (${ownerView.offerId.discountValue}% OFF)`);
  console.log('  Customer Email: strictly undefined (privacy verified).');

  console.log('\n========================================================================');
  console.log('   🎉 ALL 7 SALON OFFERS & PRICING VERIFICATION SCENARIOS PASSED!      ');
  console.log('========================================================================');
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
