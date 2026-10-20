const BASE_URL = 'http://127.0.0.1:4000/api/v1';

async function request(path: string, options: { method?: string; body?: any; token?: string }) {
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

async function run() {
  console.log('=== TESTING SALON OWNER ONBOARDING, SUBSCRIPTIONS & APPROVAL ===\n');

  const ts = Date.now();
  const ownerEmail = `onboard_owner_${ts}@test.com`;
  const password = 'Password123!';

  // 1. Register a new salon owner
  console.log('1. Registering Salon Owner...');
  const regRes = await request('/auth/register/salon-owner', {
    method: 'POST',
    body: {
      name: 'Elena Gilbert',
      email: ownerEmail,
      phone: '+91 98765 43210',
      password,
      confirmPassword: password,
      salonName: `Aura Salon & Spa ${ts}`,
      address: '42, 100 Feet Road, Indiranagar',
      city: 'Bengaluru',
      identityProof: {
        url: 'https://docs.aureliabeaute.internal/secure/id-docs/sample_gst.pdf',
        filename: 'gst_certificate.pdf',
        fileType: 'application/pdf',
        fileSize: 102400
      }
    }
  });
  if (regRes.status !== 201) throw new Error(`Owner registration failed: ${JSON.stringify(regRes)}`);
  const ownerToken = regRes.data.token;
  console.log('✓ Salon owner registered successfully');

  // 2. Fetch subscription plans
  console.log('\n2. Fetching Subscription Plans...');
  const plansRes = await request('/subscriptions/plans', {});
  if (plansRes.status !== 200 || !plansRes.data.data?.length) {
    throw new Error(`Failed to fetch plans: ${JSON.stringify(plansRes)}`);
  }
  const plans = plansRes.data.data;
  console.log(`✓ Fetched ${plans.length} plans:`);
  for (const p of plans) {
    console.log(`  - ${p.name}: Monthly ₹${p.monthlyPrice}, Yearly ₹${p.yearlyPrice}`);
  }

  // Verify plan prices
  const starter = plans.find((p: any) => p.id === 'STARTER');
  const business = plans.find((p: any) => p.id === 'BUSINESS');
  const premium = plans.find((p: any) => p.id === 'PREMIUM');
  if (starter.monthlyPrice !== 299 || starter.yearlyPrice !== 2999) throw new Error('STARTER price mismatch');
  if (business.monthlyPrice !== 599 || business.yearlyPrice !== 5999) throw new Error('BUSINESS price mismatch');
  if (premium.monthlyPrice !== 999 || premium.yearlyPrice !== 9999) throw new Error('PREMIUM price mismatch');
  console.log('✓ Plan pricing strictly verified against specification');

  // 3. Submit Salon Onboarding details
  console.log('\n3. Submitting Salon Onboarding Details...');
  const salonPayload = {
    salonName: `Aura Salon & Spa ${ts}`,
    description: 'Boutique organic hair styling, head spa rituals and luxury facials.',
    phone: '+91 98450 12345',
    email: ownerEmail,
    address: '42, 100 Feet Road, Indiranagar',
    city: 'Bengaluru',
    location: { latitude: 12.9716, longitude: 77.6412 },
    images: ['https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80'],
    services: [
      { name: 'Kérastase Botanical Scalp Ritual', category: 'Hair', price: 1800, durationMinutes: 60, description: 'Deep scalp therapy' },
      { name: 'Luxe French Balayage', category: 'Color', price: 4500, durationMinutes: 120, description: 'Artisanal hair color' }
    ]
  };

  const onboardRes = await request('/owner/salon', {
    method: 'POST',
    body: salonPayload,
    token: ownerToken
  });

  if (onboardRes.status !== 201 && onboardRes.status !== 200) {
    throw new Error(`Onboarding failed: ${JSON.stringify(onboardRes)}`);
  }
  const salon = onboardRes.data.salon;
  console.log(`✓ Salon created: "${salon.salonName}"`);
  console.log(`  Initial Status: ${salon.status}`);
  console.log(`  Subscription Status: ${salon.subscriptionStatus}`);
  console.log(`  Notice Message: "${onboardRes.data.message}"`);

  if (salon.status !== 'PENDING_APPROVAL') {
    throw new Error(`Expected PENDING_APPROVAL, got ${salon.status}`);
  }
  if (onboardRes.data.message !== 'Your salon registration is under review.') {
    throw new Error(`Expected review message, got ${onboardRes.data.message}`);
  }

  // 4. Process Mock Payment for BUSINESS plan (Yearly ₹5999)
  console.log('\n4. Processing Mock Payment for BUSINESS Plan (Yearly ₹5999)...');
  const checkoutRes = await request('/owner/subscription/mock-checkout', {
    method: 'POST',
    body: {
      plan: 'BUSINESS',
      billingCycle: 'YEARLY',
      paymentMethod: 'UPI_MOCK'
    },
    token: ownerToken
  });

  if (checkoutRes.status !== 200) {
    throw new Error(`Mock checkout failed: ${JSON.stringify(checkoutRes)}`);
  }
  console.log(`✓ Mock payment successful:`);
  console.log(`  Transaction ID: ${checkoutRes.data.transactionId}`);
  console.log(`  Amount Paid: ₹${checkoutRes.data.amount}`);
  console.log(`  Subscription Status: ${checkoutRes.data.subscription.status}`);
  console.log(`  Salon Status after payment: ${checkoutRes.data.salon.status}`);
  console.log(`  Notice: "${checkoutRes.data.message}"`);

  if (checkoutRes.data.salon.status !== 'PENDING_APPROVAL') {
    throw new Error('Salon MUST NOT be active immediately after payment! Must be PENDING_APPROVAL');
  }

  // 5. Test Customer Discovery - MUST NOT find salon while PENDING_APPROVAL
  console.log('\n5. Testing Customer Discovery for PENDING_APPROVAL Salon...');
  const discoverRes = await request(`/salons?q=Aura`, {});
  const foundSalons = discoverRes.data?.data || [];
  const foundOurSalon = foundSalons.some((s: any) => s._id === salon._id || s.salonName === salon.salonName);

  if (foundOurSalon) {
    throw new Error('Customer was able to discover salon while PENDING_APPROVAL! This is forbidden.');
  }
  console.log('✓ Salon is hidden from customer discovery (0 matches while under review)');

  // 6. Login as SUPER_ADMIN to inspect pending salons
  console.log('\n6. Logging in as SUPER_ADMIN...');
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: 'admin@example.com', password: 'AdminPassword123!' }
  });
  if (adminLogin.status !== 200) throw new Error('Admin login failed');
  const adminToken = adminLogin.data.token;
  console.log('✓ Super Admin authenticated');

  // Check pending salons list
  const pendingRes = await request('/admin/salons/pending', { token: adminToken });
  const pendingSalons = pendingRes.data?.data || [];
  const inPending = pendingSalons.some((s: any) => s._id === salon._id);
  if (!inPending) throw new Error('Newly created salon not found in admin pending list');
  console.log(`✓ Found salon in admin pending review queue (${pendingSalons.length} pending total)`);

  // 7. SUPER_ADMIN Approves Salon
  console.log('\n7. SUPER_ADMIN Approving Salon...');
  const approveRes = await request(`/admin/salons/${salon._id}/approve`, {
    method: 'PATCH',
    token: adminToken
  });
  if (approveRes.status !== 200) throw new Error(`Approval failed: ${JSON.stringify(approveRes)}`);
  console.log(`✓ Admin approved salon. Server response: "${approveRes.data.message}"`);
  console.log(`  New Status: ${approveRes.data.salon.status}`);
  if (approveRes.data.salon.status !== 'ACTIVE') throw new Error('Status did not change to ACTIVE');

  // 8. Test Customer Discovery after Approval - MUST now find salon!
  console.log('\n8. Testing Customer Discovery after Approval...');
  const discoverAfter = await request(`/salons?q=Aura`, {});
  const foundAfter = (discoverAfter.data?.data || []).some((s: any) => s._id === salon._id);
  if (!foundAfter) {
    throw new Error('Approved salon could not be found in customer discovery!');
  }
  console.log('✓ Approved salon is now discoverable by customers!');

  // 9. Check Owner subscription status endpoint
  console.log('\n9. Checking Owner Subscription Status Endpoint...');
  const statusRes = await request('/owner/subscription/status', { token: ownerToken });
  if (statusRes.status !== 200) throw new Error('Status check failed');
  console.log(`✓ Subscription status verified:`);
  console.log(`  Plan: ${statusRes.data.subscription.plan}`);
  console.log(`  Status: ${statusRes.data.subscription.status}`);
  console.log(`  Salon Status: ${statusRes.data.salon.status}`);

  console.log('\n ALL SALON OWNER ONBOARDING, SUBSCRIPTIONS & APPROVAL TESTS PASSED!\n');
}

run().catch((e) => {
  console.error('\n❌ Test failed:', e);
  process.exit(1);
});
