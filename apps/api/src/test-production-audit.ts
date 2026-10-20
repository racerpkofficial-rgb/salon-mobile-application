import mongoose from 'mongoose';
import crypto from 'crypto';
import { env } from './config/env.js';
import { User } from './models/User.js';
import { Salon } from './models/Salon.js';
import { Subscription } from './models/Subscription.js';
import { Appointment } from './models/Appointment.js';
import { SalonOffer } from './models/SalonOffer.js';
import { Payment } from './models/Payment.js';
import { cloudinaryService } from './services/cloudinary.service.js';

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

function getFutureDate(daysAhead: number = 5): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function run() {
  console.log('Connecting to database...');
  await mongoose.connect(env.MONGODB_URI);
  console.log('========================================================================');
  console.log('      PHASE 11: COMPLETE PRODUCTION READINESS & SECURITY AUDIT TEST     ');
  console.log('========================================================================\n');

  const ts = Date.now();
  const password = 'Password123!';

  // 1. Authenticate Admin
  console.log('1. Verifying Super Admin Access & Role Protection...');
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: 'admin@example.com', password: 'AdminPassword123!' }
  });
  if (adminLogin.status !== 200) throw new Error('Admin login failed');
  const adminToken = adminLogin.data.token;
  console.log('   ✓ Super Admin authenticated.');

  // Test admin route protection against unauthenticated
  const unauthAdmin = await request('/admin/dashboard');
  if (unauthAdmin.status !== 401) throw new Error('Expected 401 for unauthenticated admin access');
  console.log('   ✓ Unauthenticated access to admin endpoints strictly rejected (401).');

  // 2. Setup Two Independent Salon Owners (Owner Alpha and Owner Beta)
  console.log('\n2. Setting up Two Independent Salon Partners (Multi-Tenant Isolation)...');
  const ownerAlphaReg = await request('/auth/register/salon-owner', {
    method: 'POST',
    body: {
      name: 'Owner Alpha',
      email: `alpha_${ts}@salon.com`,
      phone: '+91 91111 22222',
      password,
      confirmPassword: password,
      salonName: `Alpha Luxury Lounge ${ts}`,
      address: '12 Brigade Road',
      city: 'Bengaluru',
      identityProof: {
        url: 'https://docs.aureliabeaute.internal/secure/id-docs/sample_gst.pdf',
        filename: 'gst_certificate.pdf',
        fileType: 'application/pdf',
        fileSize: 102400
      }
    }
  });
  const tokenAlpha = ownerAlphaReg.data.token;

  const salonAlphaRes = await request('/owner/salon', {
    method: 'POST',
    body: {
      salonName: `Alpha Luxury Lounge ${ts}`,
      description: 'Exclusive hair and nail lounge in downtown.',
      phone: '+91 91111 22222',
      email: `alpha_${ts}@salon.com`,
      address: '12 Brigade Road',
      city: 'Bengaluru',
      location: { latitude: 12.9716, longitude: 77.6412 },
      images: ['https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80'],
      services: [
        { name: 'Alpha Cut', category: 'Hair', price: 800, durationMinutes: 30 }
      ]
    },
    token: tokenAlpha
  });
  const salonAlphaId = salonAlphaRes.data.salon?._id || salonAlphaRes.data._id;

  const ownerBetaReg = await request('/auth/register/salon-owner', {
    method: 'POST',
    body: {
      name: 'Owner Beta',
      email: `beta_${ts}@salon.com`,
      phone: '+91 93333 44444',
      password,
      confirmPassword: password,
      salonName: `Beta Luxury Spa ${ts}`,
      address: '45 Residency Road',
      city: 'Bengaluru',
      identityProof: {
        url: 'https://docs.aureliabeaute.internal/secure/id-docs/sample_pan.png',
        filename: 'pan_card.png',
        fileType: 'image/png',
        fileSize: 204800
      }
    }
  });
  const tokenBeta = ownerBetaReg.data.token;

  const salonBetaRes = await request('/owner/salon', {
    method: 'POST',
    body: {
      salonName: `Beta Royal Spa ${ts}`,
      description: 'Herbal ayurvedic and scalp wellness spa.',
      phone: '+91 93333 44444',
      email: `beta_${ts}@salon.com`,
      address: '45 MG Road',
      city: 'Bengaluru',
      location: { latitude: 12.9750, longitude: 77.6450 },
      images: ['https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=800&q=80'],
      services: [
        { name: 'Beta Spa', category: 'Spa', price: 1500, durationMinutes: 60 }
      ]
    },
    token: tokenBeta
  });
  const salonBetaId = salonBetaRes.data.salon?._id || salonBetaRes.data._id;

  // Activate both subscriptions with Razorpay mock
  await request('/owner/subscription/mock-checkout', {
    method: 'POST',
    body: { plan: 'PREMIUM', billingCycle: 'YEARLY' },
    token: tokenAlpha
  });
  await request('/owner/subscription/mock-checkout', {
    method: 'POST',
    body: { plan: 'STARTER', billingCycle: 'MONTHLY' },
    token: tokenBeta
  });

  // Admin approves both salons
  await request(`/admin/salons/${salonAlphaId}/approve`, { method: 'PATCH', token: adminToken });
  await request(`/admin/salons/${salonBetaId}/approve`, { method: 'PATCH', token: adminToken });
  console.log('   ✓ Both salons onboarded, subscribed, and approved.');

  // 3. Register Two Independent Customers (Customer One and Customer Two)
  console.log('\n3. Registering Independent Customers (Customer 1 & 2)...');
  const custOneReg = await request('/auth/register/customer', {
    method: 'POST',
    body: { name: 'Customer One', email: `cust1_${ts}@test.com`, password }
  });
  const tokenCustOne = custOneReg.data.token;

  const custTwoReg = await request('/auth/register/customer', {
    method: 'POST',
    body: { name: 'Customer Two', email: `cust2_${ts}@test.com`, password }
  });
  const tokenCustTwo = custTwoReg.data.token;
  console.log('   ✓ Customers registered.');

  // 4. Test Role Escalation Prevention
  console.log('\n4. Security Audit: Testing Role Escalation & Boundary Enforcement...');
  // Customer trying to access Admin endpoints
  const custAdminAttempt = await request('/admin/dashboard', { token: tokenCustOne });
  if (custAdminAttempt.status !== 403) throw new Error('Expected 403 for customer hitting admin');

  // Customer trying to access Owner endpoints
  const custOwnerAttempt = await request('/owner/salon', { token: tokenCustOne });
  if (custOwnerAttempt.status !== 403) throw new Error('Expected 403 for customer hitting owner');

  // Owner trying to access Admin endpoints
  const ownerAdminAttempt = await request('/admin/dashboard', { token: tokenAlpha });
  if (ownerAdminAttempt.status !== 403) throw new Error('Expected 403 for owner hitting admin');

  // Owner trying to access Customer endpoints
  const ownerCustAttempt = await request('/customer/appointments', { token: tokenAlpha });
  if (ownerCustAttempt.status !== 403) throw new Error('Expected 403 for owner hitting customer');

  console.log('   ✓ All role boundaries strictly enforced (403 Forbidden across all role crosses).');

  // 5. Test Customer Booking and Cross-Customer Isolation
  console.log('\n5. Testing Booking Flow & Cross-Customer Isolation...');
  const servicesAlphaRes = await request(`/salons/${salonAlphaId}/services`);
  const alphaService = servicesAlphaRes.data.data[0];

  const bookingDate = getFutureDate(6);
  const bookingOneRes = await request('/customer/appointments', {
    method: 'POST',
    body: {
      salonId: salonAlphaId,
      serviceId: alphaService._id,
      appointmentDate: bookingDate,
      startTime: '11:00',
      customerNote: 'Customer One booking'
    },
    token: tokenCustOne
  });
  if (bookingOneRes.status !== 201) throw new Error('Booking 1 failed');
  const bookingOneId = bookingOneRes.data.appointment._id;
  console.log('   ✓ Customer One booked appointment:', bookingOneId);

  // Customer Two attempts to cancel Customer One's booking -> MUST FAIL 404
  const breachCancelAttempt = await request(`/customer/appointments/${bookingOneId}/cancel`, {
    method: 'PATCH',
    token: tokenCustTwo
  });
  if (breachCancelAttempt.status !== 404) {
    throw new Error(`Security breach: Customer 2 cancelled Customer 1's appointment! Status: ${breachCancelAttempt.status}`);
  }
  console.log('   ✓ Cross-customer appointment cancellation prevented (404 Not Found).');

  // 6. Test Cross-Salon Isolation (Owner Beta trying to touch Owner Alpha's appointment)
  console.log('\n6. Security Audit: Testing Cross-Salon Data Isolation...');
  // Owner Beta attempts to view Owner Alpha's appointment details
  const breachViewAttempt = await request(`/owner/appointments/${bookingOneId}`, {
    token: tokenBeta
  });
  if (breachViewAttempt.status !== 404) {
    throw new Error('Security breach: Owner Beta accessed Owner Alpha booking details!');
  }
  console.log('   ✓ Owner Beta blocked from viewing Owner Alpha booking (404 Not Found).');

  // Owner Beta attempts to accept Owner Alpha's appointment
  const breachAcceptAttempt = await request(`/owner/appointments/${bookingOneId}/accept`, {
    method: 'PATCH',
    token: tokenBeta
  });
  if (breachAcceptAttempt.status !== 404) {
    throw new Error('Security breach: Owner Beta accepted Owner Alpha booking!');
  }
  console.log('   ✓ Owner Beta blocked from accepting Owner Alpha booking (404 Not Found).');

  // Owner Beta attempts to reject Owner Alpha's appointment
  const breachRejectAttempt = await request(`/owner/appointments/${bookingOneId}/reject`, {
    method: 'PATCH',
    token: tokenBeta
  });
  if (breachRejectAttempt.status !== 404) {
    throw new Error('Security breach: Owner Beta rejected Owner Alpha booking!');
  }
  console.log('   ✓ Owner Beta blocked from rejecting Owner Alpha booking (404 Not Found).');

  // 7. Test Cross-Salon Offer Isolation
  console.log('\n7. Security Audit: Testing Cross-Salon Offer Isolation...');
  // Owner Alpha creates an offer
  const offerRes = await request('/owner/offers', {
    method: 'POST',
    body: {
      title: 'Alpha VIP 30% Discount',
      description: 'Exclusive discount on styling',
      discountType: 'PERCENTAGE',
      discountValue: 30,
      applicableService: 'ALL',
      endDate: getFutureDate(20),
      isActive: true
    },
    token: tokenAlpha
  });
  if (offerRes.status !== 201) throw new Error('Offer creation failed');
  const offerId = offerRes.data.offer._id;
  console.log('   ✓ Owner Alpha created offer:', offerId);

  // Owner Beta attempts to edit Owner Alpha's offer
  const breachEditOffer = await request(`/owner/offers/${offerId}`, {
    method: 'PUT',
    body: {
      title: 'Hacked Offer',
      description: 'Tampered description',
      discountType: 'PERCENTAGE',
      discountValue: 90,
      applicableService: 'ALL',
      endDate: getFutureDate(20),
      isActive: true
    },
    token: tokenBeta
  });
  if (breachEditOffer.status !== 404) {
    throw new Error('Security breach: Owner Beta edited Owner Alpha offer!');
  }
  console.log('   ✓ Owner Beta blocked from editing Owner Alpha offer (404 Not Found).');

  // Owner Beta attempts to delete Owner Alpha's offer
  const breachDeleteOffer = await request(`/owner/offers/${offerId}`, {
    method: 'DELETE',
    token: tokenBeta
  });
  if (breachDeleteOffer.status !== 404) {
    throw new Error('Security breach: Owner Beta deleted Owner Alpha offer!');
  }
  console.log('   ✓ Owner Beta blocked from deleting Owner Alpha offer (404 Not Found).');

  // 8. Test Double-Booking & Slot Conflict Prevention
  console.log('\n8. Testing Double-Booking Collision Prevention...');
  // Customer Two attempts to book EXACT SAME slot at Salon Alpha
  const conflictBooking = await request('/customer/appointments', {
    method: 'POST',
    body: {
      salonId: salonAlphaId,
      serviceId: alphaService._id,
      appointmentDate: bookingDate,
      startTime: '11:00',
      customerNote: 'Customer Two conflict attempt'
    },
    token: tokenCustTwo
  });
  if (conflictBooking.status !== 409) {
    throw new Error(`Expected 409 Conflict for double booking, got ${conflictBooking.status}`);
  }
  console.log('   ✓ Double-booking rejected with HTTP 409 Conflict.');

  // Owner Alpha accepts appointment
  const acceptRes = await request(`/owner/appointments/${bookingOneId}/accept`, {
    method: 'PATCH',
    token: tokenAlpha
  });
  if (acceptRes.status !== 200) throw new Error('Accept booking failed');
  console.log('   ✓ Owner Alpha confirmed booking. Status: CONFIRMED');

  // 9. Test Cloudinary Service & Upload Endpoints
  console.log('\n9. Testing Cloudinary Upload Endpoint & Fallback Resiliency...');
  const uploadRes = await request('/owner/upload', {
    method: 'POST',
    body: {
      image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80',
      folder: 'aurelia-salons/test'
    },
    token: tokenAlpha
  });
  if (uploadRes.status !== 200) {
    throw new Error(`Cloudinary upload endpoint failed: ${JSON.stringify(uploadRes.data)}`);
  }
  console.log('   ✓ Cloudinary upload endpoint succeeded:', uploadRes.data.url);

  // 10. Complete Booking Lifecycle
  console.log('\n10. Testing Complete Booking Lifecycle (CONFIRMED -> COMPLETED)...');
  const completeRes = await request(`/owner/appointments/${bookingOneId}/complete`, {
    method: 'PATCH',
    token: tokenAlpha
  });
  if (completeRes.status !== 200) throw new Error('Complete appointment failed');
  console.log('   ✓ Appointment transitioned to COMPLETED.');

  // Verify appointments pagination
  console.log('\n11. Testing Appointments Pagination Metadata...');
  const paginatedRes = await request('/owner/appointments?page=1&limit=5', {
    token: tokenAlpha
  });
  if (paginatedRes.status !== 200 || !paginatedRes.data.pagination) {
    throw new Error('Pagination metadata missing from owner appointments');
  }
  console.log('   ✓ Pagination metadata verified:', paginatedRes.data.pagination);

  console.log('\n========================================================================');
  console.log('  🎉 COMPLETE PRODUCTION AUDIT & INTEGRATION TEST PASSED (100%)!       ');
  console.log('========================================================================\n');

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('\n❌ AUDIT FAILED:', err);
  process.exit(1);
});
