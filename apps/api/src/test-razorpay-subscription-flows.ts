import mongoose from 'mongoose';
import crypto from 'crypto';
import { env } from './config/env.js';
import { Salon } from './models/Salon.js';
import { Subscription } from './models/Subscription.js';
import { Payment } from './models/Payment.js';
import { Appointment } from './models/Appointment.js';
import { Notification } from './models/Notification.js';

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
  console.log('Connecting to database...');
  await mongoose.connect(env.MONGODB_URI);
  console.log('========================================================================');
  console.log('       TESTING RAZORPAY SUBSCRIPTION PAYMENT & EXPIRY LIFECYCLE        ');
  console.log('========================================================================\n');

  const ts = Date.now();
  const password = 'Password123!';

  // 1. Setup Actors: Super Admin, Salon Owner, and Customer
  console.log('1. Setting up Test Users (Admin, Owner, Customer)...');

  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: 'admin@example.com', password: 'AdminPassword123!' }
  });
  if (adminLogin.status !== 200) throw new Error('Admin login failed');
  const adminToken = adminLogin.data.token;
  console.log('   ✓ Super Admin authenticated.');

  const ownerReg = await request('/auth/register/salon-owner', {
    method: 'POST',
    body: {
      name: 'Owner Rahul',
      email: `rahul_${ts}@test.com`,
      phone: '+91 98888 88888',
      password,
      confirmPassword: password,
      salonName: `Rahul Luxury Hair Studio ${ts}`,
      address: '10 Richmond Road',
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
  const ownerId = ownerReg.data.user.id;
  console.log('   ✓ Salon Owner registered.');

  const custReg = await request('/auth/register/customer', {
    method: 'POST',
    body: { name: 'Customer Maya', email: `maya_${ts}@test.com`, password }
  });
  if (custReg.status !== 201) throw new Error('Customer registration failed');
  const custToken = custReg.data.token;
  const custId = custReg.data.user.id;
  console.log('   ✓ Customer registered.');

  // Create Salon profile for Owner
  const salonRes = await request('/owner/salon', {
    method: 'POST',
    body: {
      salonName: `Apex Razorpay Studio ${ts}`,
      description: 'Luxury grooming and styling partner salon.',
      phone: '+91 98888 77777',
      email: `apex_${ts}@salon.com`,
      address: '77 Residency Road',
      city: 'Bengaluru',
      location: { latitude: 12.9716, longitude: 77.6412 },
      images: ['https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80'],
      services: [
        { name: 'Royal Haircut', category: 'Hair', price: 600, durationMinutes: 30, description: 'Precision styling' }
      ]
    },
    token: ownerToken
  });
  const salonId = salonRes.data.salon?._id || salonRes.data._id;
  console.log('   ✓ Salon created with status PENDING_APPROVAL and subscriptionStatus PENDING.');

  // 2. Security Check: Role Authorization
  console.log('\n2. Security Check: Only SALON_OWNER can access Razorpay endpoints...');
  const customerOrderAttempt = await request('/owner/subscription/razorpay/order', {
    method: 'POST',
    body: { plan: 'STARTER', billingCycle: 'MONTHLY' },
    token: custToken
  });
  if (customerOrderAttempt.status !== 403) {
    throw new Error(`Expected 403 Forbidden for CUSTOMER role on order creation, got ${customerOrderAttempt.status}`);
  }

  const unauthOrderAttempt = await request('/owner/subscription/razorpay/order', {
    method: 'POST',
    body: { plan: 'STARTER', billingCycle: 'MONTHLY' }
  });
  if (unauthOrderAttempt.status !== 401) {
    throw new Error(`Expected 401 Unauthorized for unauthenticated order creation, got ${unauthOrderAttempt.status}`);
  }
  console.log('   ✓ Customer and unauthenticated requests properly blocked (403 / 401).');

  // 3. Razorpay Order Creation via Backend
  console.log('\n3. Creating Razorpay Order on Backend (Starter Plan - Monthly ₹299)...');
  const orderRes = await request('/owner/subscription/razorpay/order', {
    method: 'POST',
    body: { plan: 'STARTER', billingCycle: 'MONTHLY' },
    token: ownerToken
  });
  if (orderRes.status !== 200) {
    throw new Error(`Order creation failed with status ${orderRes.status}: ${JSON.stringify(orderRes.data)}`);
  }

  const orderData = orderRes.data;
  console.log('   Order created:', {
    orderId: orderData.orderId,
    amountInPaise: orderData.amount,
    amountInRupees: orderData.amountInRupees,
    currency: orderData.currency,
    keyId: orderData.keyId
  });

  if (!orderData.orderId || !orderData.orderId.startsWith('order_')) {
    throw new Error('Invalid Razorpay order ID format');
  }
  if (orderData.amount !== 29900) {
    throw new Error(`Expected order amount in paise 29900, got ${orderData.amount}`);
  }
  if (orderData.amountInRupees !== 299) {
    throw new Error(`Expected order amount in rupees 299, got ${orderData.amountInRupees}`);
  }
  if (!orderData.keyId) {
    throw new Error('Razorpay public Key ID missing in response');
  }
  // CRITICAL SECURITY REQUIREMENT: Never expose secret key
  const stringifiedOrder = JSON.stringify(orderData);
  if (stringifiedOrder.includes(env.RAZORPAY_KEY_SECRET)) {
    throw new Error('SECURITY VIOLATION: Razorpay secret key was exposed in backend API response!');
  }
  console.log('   ✓ Razorpay secret key is NEVER exposed to client.');

  // 4. Verify MongoDB Payment Record created with status PENDING
  console.log('\n4. Verifying initial Payment record in MongoDB...');
  const pendingPayment = await Payment.findOne({ razorpayOrderId: orderData.orderId });
  if (!pendingPayment) throw new Error('Payment record was not created in MongoDB');
  if (pendingPayment.status !== 'PENDING') {
    throw new Error(`Expected Payment status PENDING, got ${pendingPayment.status}`);
  }
  if (pendingPayment.amount !== 299) {
    throw new Error(`Expected Payment amount 299, got ${pendingPayment.amount}`);
  }
  if (pendingPayment.billingCycle !== 'MONTHLY') {
    throw new Error(`Expected Payment billingCycle MONTHLY, got ${pendingPayment.billingCycle}`);
  }
  console.log('   ✓ Payment record created with status PENDING in MongoDB.');

  // 5. Test Signature Verification Security: Tampered / Invalid Signature
  console.log('\n5. Testing Signature Verification with Tampered/Invalid Signature...');
  const fakePaymentId = `pay_fake_${Date.now()}`;
  const badVerifyRes = await request('/owner/subscription/razorpay/verify', {
    method: 'POST',
    body: {
      plan: 'STARTER',
      billingCycle: 'MONTHLY',
      razorpayOrderId: orderData.orderId,
      razorpayPaymentId: fakePaymentId,
      razorpaySignature: 'deadbeef_invalid_tampered_signature_hex_000000000000000000000000'
    },
    token: ownerToken
  });

  if (badVerifyRes.status !== 400) {
    throw new Error(`Expected 400 Bad Request for invalid signature, got ${badVerifyRes.status}`);
  }
  console.log('   ✓ Tampered signature rejected with 400 Bad Request.');

  const failedPayment = await Payment.findOne({ razorpayOrderId: orderData.orderId });
  if (failedPayment?.status !== 'FAILED') {
    throw new Error(`Expected Payment status to be FAILED, got ${failedPayment?.status}`);
  }
  console.log('   ✓ Payment record updated to status FAILED.');

  // Verify salon subscription is NOT activated
  const salonAfterFailure = await Salon.findById(salonId);
  if (salonAfterFailure?.subscriptionStatus !== 'PENDING') {
    throw new Error('Salon subscriptionStatus should remain PENDING after failed signature');
  }
  console.log('   ✓ Subscription NOT activated on failed signature verification.');

  // 6. Test Valid Signature Verification & Subscription Activation
  console.log('\n6. Testing Valid Signature Verification & Subscription Activation...');
  const validPaymentId = `pay_valid_${Date.now()}`;
  // Generate legitimate HMAC SHA-256 signature using test helper
  const sigPayload = `${orderData.orderId}|${validPaymentId}`;
  const validSignature = crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(sigPayload)
    .digest('hex');

  const validVerifyRes = await request('/owner/subscription/razorpay/verify', {
    method: 'POST',
    body: {
      plan: 'STARTER',
      billingCycle: 'MONTHLY',
      razorpayOrderId: orderData.orderId,
      razorpayPaymentId: validPaymentId,
      razorpaySignature: validSignature
    },
    token: ownerToken
  });

  if (validVerifyRes.status !== 200) {
    throw new Error(`Verification failed with status ${validVerifyRes.status}: ${JSON.stringify(validVerifyRes.data)}`);
  }
  console.log('   ✓ Verification succeeded:', validVerifyRes.data.message || 'Subscription Active');

  // Verify Payment updated to SUCCESS
  const successPayment = await Payment.findOne({ razorpayOrderId: orderData.orderId });
  if (successPayment?.status !== 'SUCCESS') {
    throw new Error(`Expected Payment status SUCCESS, got ${successPayment?.status}`);
  }
  if (successPayment.razorpayPaymentId !== validPaymentId) {
    throw new Error(`Expected razorpayPaymentId ${validPaymentId}, got ${successPayment.razorpayPaymentId}`);
  }
  console.log('   ✓ Payment record in MongoDB updated to status SUCCESS.');

  // Verify Subscription document created and activated
  const subscription = await Subscription.findOne({ transactionId: validPaymentId });
  if (!subscription) throw new Error('Subscription document not found in MongoDB');
  if (subscription.status !== 'ACTIVE') {
    throw new Error(`Expected Subscription status ACTIVE, got ${subscription.status}`);
  }
  if (subscription.paymentMethod !== 'RAZORPAY') {
    throw new Error(`Expected paymentMethod RAZORPAY, got ${subscription.paymentMethod}`);
  }
  if (!subscription.startDate || !subscription.endDate) {
    throw new Error('Subscription startDate and endDate must be tracked');
  }

  // Verify monthly duration: endDate should be ~30/31 days from startDate
  const diffDays = Math.round(
    (new Date(subscription.endDate).getTime() - new Date(subscription.startDate).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays < 28 || diffDays > 32) {
    throw new Error(`Monthly subscription expected ~30 days, got ${diffDays} days`);
  }
  console.log(`   ✓ Subscription tracked: Start: ${subscription.startDate.toISOString()}, End: ${subscription.endDate.toISOString()} (${diffDays} days).`);

  // Verify Salon subscriptionStatus updated to ACTIVE
  const activeSalon = await Salon.findById(salonId);
  if (activeSalon?.subscriptionStatus !== 'ACTIVE') {
    throw new Error(`Expected Salon subscriptionStatus ACTIVE, got ${activeSalon?.subscriptionStatus}`);
  }
  if (activeSalon.subscriptionId?.toString() !== subscription._id.toString()) {
    throw new Error('Salon subscriptionId does not match created subscription');
  }
  console.log('   ✓ Salon subscriptionStatus updated to ACTIVE.');

  // Verify FCM notification record created
  const notif = await Notification.findOne({
    recipientId: ownerId,
    type: 'SUBSCRIPTION_STATUS'
  });
  if (!notif) throw new Error('SUBSCRIPTION_STATUS notification was not created in MongoDB');
  console.log('   ✓ Notification record saved in MongoDB with title:', notif.title);

  // 7. Test Yearly Plan Duration & Expiry Calculation
  console.log('\n7. Testing Yearly Plan Expiry Calculation (Business Plan - ₹5999)...');
  const yearlyOrderRes = await request('/owner/subscription/razorpay/order', {
    method: 'POST',
    body: { plan: 'BUSINESS', billingCycle: 'YEARLY' },
    token: ownerToken
  });
  if (yearlyOrderRes.status !== 200) throw new Error('Yearly order creation failed');
  if (yearlyOrderRes.data.amountInRupees !== 5999) {
    throw new Error(`Expected yearly Business plan ₹5999, got ₹${yearlyOrderRes.data.amountInRupees}`);
  }

  const yearlyPaymentId = `pay_yearly_${Date.now()}`;
  const yearlySig = crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(`${yearlyOrderRes.data.orderId}|${yearlyPaymentId}`)
    .digest('hex');

  const yearlyVerifyRes = await request('/owner/subscription/razorpay/verify', {
    method: 'POST',
    body: {
      plan: 'BUSINESS',
      billingCycle: 'YEARLY',
      razorpayOrderId: yearlyOrderRes.data.orderId,
      razorpayPaymentId: yearlyPaymentId,
      razorpaySignature: yearlySig
    },
    token: ownerToken
  });
  if (yearlyVerifyRes.status !== 200) throw new Error('Yearly verification failed');

  const yearlySub = await Subscription.findOne({ transactionId: yearlyPaymentId });
  if (!yearlySub) throw new Error('Yearly subscription not found');
  const yearlyDiffDays = Math.round(
    (new Date(yearlySub.endDate).getTime() - new Date(yearlySub.startDate).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (yearlyDiffDays < 364 || yearlyDiffDays > 367) {
    throw new Error(`Yearly subscription expected ~365 days, got ${yearlyDiffDays} days`);
  }
  console.log(`   ✓ Yearly subscription verified: ~${yearlyDiffDays} days until expiry.`);

  // 8. Test Appointment Booking & Subscription Expiry Enforcement
  console.log('\n8. Testing Subscription Expiry Enforcement on Appointments...');

  // Approve salon first by Super Admin so status is ACTIVE
  const approveRes = await request(`/admin/salons/${salonId}/approve`, {
    method: 'PATCH',
    token: adminToken
  });
  if (approveRes.status !== 200) throw new Error('Admin salon approval failed');
  console.log('   ✓ Salon approved by Super Admin (status = ACTIVE, subscriptionStatus = ACTIVE).');

  // Fetch standalone services for this salon
  const servicesRes = await request(`/salons/${salonId}/services`);
  if (servicesRes.status !== 200 || !servicesRes.data?.data?.length) {
    throw new Error('Failed to fetch salon services');
  }
  const haircutService = servicesRes.data.data[0];

  // Customer creates a booking while subscription is active
  const testDate = getFutureDate(4);
  const bookingRes = await request('/customer/appointments', {
    method: 'POST',
    body: {
      salonId,
      serviceId: haircutService._id,
      appointmentDate: testDate,
      startTime: '10:00',
      customerNote: 'First booking with active subscription'
    },
    token: custToken
  });
  if (bookingRes.status !== 201) {
    throw new Error(`Booking while active failed with status ${bookingRes.status}: ${JSON.stringify(bookingRes.data)}`);
  }
  const activeBookingId = bookingRes.data.appointment?._id || bookingRes.data._id;
  console.log('   ✓ Booking created successfully while subscription is ACTIVE. ID:', activeBookingId);

  // SIMULATE SUBSCRIPTION EXPIRY: Set subscription endDate to 2 days ago
  console.log('\n   Simulating Subscription Expiry in Database (endDate in past)...');
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  await Subscription.findByIdAndUpdate(yearlySub._id, {
    endDate: twoDaysAgo
  });

  // Now Customer attempts to book a NEW appointment at the expired salon
  const expiredBookingAttempt = await request('/customer/appointments', {
    method: 'POST',
    body: {
      salonId,
      serviceId: haircutService._id,
      appointmentDate: testDate,
      startTime: '11:00',
      customerNote: 'Attempt to book at expired salon'
    },
    token: custToken
  });

  if (expiredBookingAttempt.status !== 400) {
    throw new Error(
      `Expected HTTP 400 when booking at expired salon, got ${expiredBookingAttempt.status}: ${JSON.stringify(expiredBookingAttempt.data)}`
    );
  }
  console.log('   ✓ New booking blocked when subscription expired with 400 Bad Request:');
  console.log('     "', expiredBookingAttempt.data.message, '"');

  // Customer attempts to check slot availability for the expired salon
  const availRes = await request(`/salons/${salonId}/availability?date=${testDate}`, {
    token: custToken
  });
  if (availRes.status !== 400) {
    throw new Error(`Expected 400 when querying availability of expired salon, got ${availRes.status}`);
  }
  console.log('   ✓ Availability slots blocked for expired salon (HTTP 400).');

  // Verify Salon document status was updated to EXPIRED
  const updatedSalon = await Salon.findById(salonId);
  if (updatedSalon?.subscriptionStatus !== 'EXPIRED') {
    throw new Error(`Expected salon subscriptionStatus EXPIRED, got ${updatedSalon?.subscriptionStatus}`);
  }
  console.log('   ✓ Salon subscriptionStatus marked EXPIRED in MongoDB.');

  // Verify existing booking history records are kept intact
  const existingBooking = await Appointment.findById(activeBookingId);
  if (!existingBooking) {
    throw new Error('Existing appointment was deleted or corrupted!');
  }
  console.log('   ✓ Existing appointment and history records safely preserved in MongoDB.');

  // Admin Payment records check
  const adminPaymentsRes = await request('/admin/payments', {
    token: adminToken
  });
  if (adminPaymentsRes.status !== 200) throw new Error('Admin payments list failed');
  const adminPayments = adminPaymentsRes.data.data || adminPaymentsRes.data;
  console.log(`   ✓ Admin Payments dashboard reflects ${adminPayments.length} recorded payments.`);

  console.log('\n========================================================================');
  console.log('  🎉 ALL RAZORPAY INTEGRATION & SUBSCRIPTION EXPIRY TESTS PASSED!       ');
  console.log('========================================================================\n');

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('\n❌ TEST RUNNER FAILED:', err);
  process.exit(1);
});
