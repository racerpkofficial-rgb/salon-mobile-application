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
  console.log('=== COMPREHENSIVE SUPER_ADMIN PLATFORM & APPROVAL FLOW TESTS ===\n');

  const ts = Date.now();
  const customerEmail = `admin_test_cust_${ts}@test.com`;
  const owner1Email = `admin_test_owner1_${ts}@test.com`;
  const owner2Email = `admin_test_owner2_${ts}@test.com`;
  const password = 'Password123!';

  // --- STEP 1: Register Customer & Salon Owners for Setup ---
  console.log('1. Setting up Test Users (Customer & Salon Owners)...');
  const custRes = await request('/auth/register/customer', {
    method: 'POST',
    body: { name: 'Admin Test Customer', email: customerEmail, password }
  });
  if (custRes.status !== 201) throw new Error('Customer registration failed');
  const customerToken = custRes.data.token;

  const owner1Res = await request('/auth/register/salon-owner', {
    method: 'POST',
    body: {
      name: 'Owner Alpha',
      email: owner1Email,
      phone: '+91 98765 11111',
      password,
      confirmPassword: password,
      salonName: `Aurelia Palace ${ts}`,
      address: '100 Feet Road, Indiranagar',
      city: 'Bengaluru',
      identityProof: {
        url: 'https://docs.aureliabeaute.internal/secure/id-docs/sample_gst.pdf',
        filename: 'gst_certificate.pdf',
        fileType: 'application/pdf',
        fileSize: 102400
      }
    }
  });
  if (owner1Res.status !== 201) throw new Error('Owner 1 registration failed');
  const owner1Token = owner1Res.data.token;

  const owner2Res = await request('/auth/register/salon-owner', {
    method: 'POST',
    body: {
      name: 'Owner Beta',
      email: owner2Email,
      phone: '+91 98765 22222',
      password,
      confirmPassword: password,
      salonName: `Aurelia Spa Sanctuary ${ts}`,
      address: '200 Feet Road, Koramangala',
      city: 'Bengaluru',
      identityProof: {
        url: 'https://docs.aureliabeaute.internal/secure/id-docs/sample_pan.png',
        filename: 'pan_card.png',
        fileType: 'image/png',
        fileSize: 204800
      }
    }
  });
  if (owner2Res.status !== 201) throw new Error('Owner 2 registration failed');
  const owner2Token = owner2Res.data.token;

  console.log('✓ Users registered (Customer, Owner 1, Owner 2)');

  // Onboard Salon 1 (to be approved)
  const salon1Res = await request('/owner/salon', {
    method: 'POST',
    body: {
      salonName: `Aurelia Palace ${ts}`,
      description: 'Ultra luxury organic hair & wellness retreat with VIP suites',
      phone: '+91 99999 11111',
      email: owner1Email,
      address: '77 Residency Road',
      city: 'Bengaluru',
      location: { latitude: 12.9716, longitude: 77.5946 },
      services: [{ name: 'Royal Hair Spa', price: 2500, durationMinutes: 60, description: 'Gold infused hair therapy' }]
    },
    token: owner1Token
  });
  if (salon1Res.status !== 201 && salon1Res.status !== 200) throw new Error('Salon 1 creation failed');
  const salon1Id = salon1Res.data.salon._id;

  // Process Mock Payment for Salon 1 (BUSINESS Yearly ₹5999)
  const pay1Res = await request('/owner/subscription/mock-checkout', {
    method: 'POST',
    body: { plan: 'BUSINESS', billingCycle: 'YEARLY', paymentMethod: 'UPI_MOCK' },
    token: owner1Token
  });
  if (pay1Res.status !== 200) throw new Error('Salon 1 payment failed');
  console.log('✓ Salon 1 onboarded and subscription paid (BUSINESS Yearly ₹5999)');

  // Onboard Salon 2 (to be rejected)
  const salon2Res = await request('/owner/salon', {
    method: 'POST',
    body: {
      salonName: `Substandard Salon ${ts}`,
      description: 'Quick unverified haircuts without valid credentials',
      phone: '+91 88888 22222',
      email: owner2Email,
      address: '12 Unknown Lane',
      city: 'Bengaluru',
      location: { latitude: 12.9352, longitude: 77.6245 },
      services: [{ name: 'Basic Cut', price: 200, durationMinutes: 15 }]
    },
    token: owner2Token
  });
  if (salon2Res.status !== 201 && salon2Res.status !== 200) throw new Error('Salon 2 creation failed');
  const salon2Id = salon2Res.data.salon._id;

  // Process Mock Payment for Salon 2 (STARTER Monthly ₹299)
  const pay2Res = await request('/owner/subscription/mock-checkout', {
    method: 'POST',
    body: { plan: 'STARTER', billingCycle: 'MONTHLY', paymentMethod: 'CARD_MOCK' },
    token: owner2Token
  });
  if (pay2Res.status !== 200) throw new Error('Salon 2 payment failed');
  console.log('✓ Salon 2 onboarded and subscription paid (STARTER Monthly ₹299)');

  // --- STEP 2: Screen 1 - Admin Login ---
  console.log('\n2. Testing Screen 1: Admin Login...');
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: 'admin@example.com', password: 'AdminPassword123!' }
  });
  if (adminLogin.status !== 200) throw new Error(`Admin login failed: ${JSON.stringify(adminLogin)}`);
  const adminToken = adminLogin.data.token;
  console.log('✓ Super Admin authenticated successfully (Role: SUPER_ADMIN)');

  // --- STEP 3: Strict Backend Authorization Enforcement ---
  console.log('\n3. Testing Backend Authorization Guards...');

  // 3a. Unauthenticated call
  const noTokenApprove = await request(`/admin/salons/${salon1Id}/approve`, { method: 'PATCH' });
  if (noTokenApprove.status !== 401) throw new Error(`Expected 401 Unauthorized, got ${noTokenApprove.status}`);
  console.log('✓ Unauthenticated approval request blocked with 401 Unauthorized');

  // 3b. Customer call
  const custApprove = await request(`/admin/salons/${salon1Id}/approve`, {
    method: 'PATCH',
    token: customerToken
  });
  if (custApprove.status !== 403) throw new Error(`Expected 403 Forbidden for Customer, got ${custApprove.status}`);
  console.log('✓ Customer approval attempt blocked with 403 Forbidden');

  // 3c. Salon Owner call
  const ownerApprove = await request(`/admin/salons/${salon1Id}/approve`, {
    method: 'PATCH',
    token: owner1Token
  });
  if (ownerApprove.status !== 403) throw new Error(`Expected 403 Forbidden for Salon Owner, got ${ownerApprove.status}`);
  console.log('✓ Salon Owner approval attempt blocked with 403 Forbidden');

  // --- STEP 4: Screen 2 - Dashboard Overview ---
  console.log('\n4. Testing Screen 2: Dashboard Overview & Metrics...');
  const dashRes = await request('/admin/dashboard', { token: adminToken });
  if (dashRes.status !== 200) throw new Error(`Admin dashboard failed: ${JSON.stringify(dashRes)}`);
  const { stats, recentRegistrations, recentPayments } = dashRes.data;

  console.log('✓ Admin Dashboard stats retrieved:');
  console.log(`  - Pending Salons count: ${stats.pendingSalons}`);
  console.log(`  - Active Salons count: ${stats.activeSalons}`);
  console.log(`  - Total Customers: ${stats.totalCustomers}`);
  console.log(`  - Active Subscriptions: ${stats.activeSubscriptions}`);
  console.log(`  - Recent Salons registered: ${recentRegistrations.salons.length}`);
  console.log(`  - Recent Customers registered: ${recentRegistrations.customers.length}`);
  console.log(`  - Recent Payments: ${recentPayments.length}`);

  if (typeof stats.pendingSalons !== 'number' || stats.pendingSalons < 2) {
    throw new Error(`Expected at least 2 pending salons, got ${stats.pendingSalons}`);
  }
  if (typeof stats.totalCustomers !== 'number' || stats.totalCustomers < 1) {
    throw new Error('Customer count missing or invalid');
  }
  if (typeof stats.activeSubscriptions !== 'number') {
    throw new Error('Active subscriptions stat missing');
  }

  // --- STEP 5: Screen 3 - Pending Salons List ---
  console.log('\n5. Testing Screen 3: Pending Salons List...');
  const pendingRes = await request('/admin/salons/pending', { token: adminToken });
  if (pendingRes.status !== 200) throw new Error('Pending salons fetch failed');
  const pendingList = pendingRes.data.data;
  console.log(`✓ Retrieved ${pendingList.length} pending salons`);

  const foundSalon1 = pendingList.find((s: any) => s._id === salon1Id);
  const foundSalon2 = pendingList.find((s: any) => s._id === salon2Id);
  if (!foundSalon1 || !foundSalon2) throw new Error('Both new salons must appear in pending list');
  console.log('✓ Both newly submitted salons verified in Pending queue');

  // Verify Customer CANNOT discover pending salons
  const discPending1 = await request(`/salons?q=Aurelia%20Palace`, {});
  const disc1Found = (discPending1.data?.data || []).some((s: any) => s._id === salon1Id);
  if (disc1Found) throw new Error('Salon 1 is discoverable before admin approval!');
  console.log('✓ Salon 1 is strictly hidden from customer discovery while PENDING_APPROVAL');

  // --- STEP 6: Screen 4 - Salon Details Inspection ---
  console.log('\n6. Testing Screen 4: Salon Details Inspection...');
  const detailRes = await request(`/admin/salons/${salon1Id}`, { token: adminToken });
  if (detailRes.status !== 200) throw new Error('Salon details fetch failed');
  const details = detailRes.data.data;
  console.log(`✓ Salon details inspected: "${details.salonName}"`);
  console.log(`  - Owner: ${details.ownerId.name} (${details.ownerId.email})`);
  console.log(`  - Address: ${details.address}, ${details.city}`);
  console.log(`  - Phone: ${details.phone} | Email: ${details.email}`);
  console.log(`  - Location: (${details.location.latitude}, ${details.location.longitude})`);
  console.log(`  - Services count: ${details.services.length}`);
  console.log(`  - Subscription: ${details.subscriptionId?.plan} (${details.subscriptionId?.billingCycle})`);

  if (!details.ownerId?.email || !details.services?.length || !details.subscriptionId) {
    throw new Error('Incomplete populated salon details');
  }

  // --- STEP 7: Screen 5 - Approve Salon Flow ---
  console.log('\n7. Testing Screen 5: Approve Salon Flow...');
  const approveRes = await request(`/admin/salons/${salon1Id}/approve`, {
    method: 'PATCH',
    token: adminToken
  });
  if (approveRes.status !== 200) throw new Error(`Approve failed: ${JSON.stringify(approveRes)}`);
  console.log(`✓ Admin approved salon: "${approveRes.data.message}"`);
  console.log(`  Status is now: ${approveRes.data.salon.status}`);
  if (approveRes.data.salon.status !== 'ACTIVE') throw new Error('Salon status did not change to ACTIVE');

  // Verify Customer CAN now discover the approved salon!
  const discApproved = await request(`/salons?q=Aurelia%20Palace`, {});
  const discApprovedFound = (discApproved.data?.data || []).some((s: any) => s._id === salon1Id);
  if (!discApprovedFound) throw new Error('Approved salon could not be discovered by customers!');
  console.log('✓ Approved salon is now actively discoverable by customers on marketplace');

  // --- STEP 8: Screen 6 - Reject Salon Flow with Reason ---
  console.log('\n8. Testing Screen 6: Reject Salon Flow with Rejection Reason...');
  const rejectionReason = 'Incomplete business registration proof and invalid tax identification details.';
  const rejectRes = await request(`/admin/salons/${salon2Id}/reject`, {
    method: 'PATCH',
    body: { reason: rejectionReason },
    token: adminToken
  });
  if (rejectRes.status !== 200) throw new Error(`Reject failed: ${JSON.stringify(rejectRes)}`);
  console.log(`✓ Admin rejected salon: "${rejectRes.data.message}"`);
  console.log(`  Status is now: ${rejectRes.data.salon.status}`);
  console.log(`  Rejection Reason stored: "${rejectRes.data.salon.rejectionReason}"`);
  if (rejectRes.data.salon.status !== 'REJECTED') throw new Error('Salon status did not change to REJECTED');
  if (rejectRes.data.salon.rejectionReason !== rejectionReason) throw new Error('Rejection reason mismatch');

  // Verify Owner receives notification / notice upon viewing their salon
  const owner2Check = await request('/owner/salon', { token: owner2Token });
  if (owner2Check.status !== 200) throw new Error('Owner 2 salon check failed');
  console.log(`✓ Owner received rejection status:`);
  console.log(`  Salon Status: ${owner2Check.data.salon.status}`);
  console.log(`  Rejection Reason: "${owner2Check.data.salon.rejectionReason}"`);
  console.log(`  Server Notice: "${owner2Check.data.message}"`);
  if (owner2Check.data.salon.status !== 'REJECTED') throw new Error('Owner salon status was not REJECTED');

  // Customer cannot discover rejected salon
  const discRejected = await request(`/salons?q=Substandard`, {});
  const discRejectedFound = (discRejected.data?.data || []).some((s: any) => s._id === salon2Id);
  if (discRejectedFound) throw new Error('Rejected salon must NOT be discoverable!');
  console.log('✓ Rejected salon is NOT discoverable by customers');

  // --- STEP 9: Screen 7 - Active Salons List ---
  console.log('\n9. Testing Screen 7: Active Salons List...');
  const activeRes = await request('/admin/salons/active', { token: adminToken });
  if (activeRes.status !== 200) throw new Error('Active salons fetch failed');
  const activeSalons = activeRes.data.data;
  const inActive = activeSalons.some((s: any) => s._id === salon1Id);
  if (!inActive) throw new Error('Approved salon not found in Active Salons list');
  console.log(`✓ Verified approved salon in Active Salons list (${activeSalons.length} active total)`);

  // --- STEP 10: Screen 8 - Suspended Salons & Reactivation Flow ---
  console.log('\n10. Testing Screen 8: Suspend & Reactivate Salons Flow...');
  const suspendRes = await request(`/admin/salons/${salon1Id}/suspend`, {
    method: 'PATCH',
    token: adminToken
  });
  if (suspendRes.status !== 200) throw new Error('Suspend failed');
  console.log(`✓ Salon suspended: "${suspendRes.data.message}"`);

  // Verify Customer cannot discover suspended salon
  const discSuspended = await request(`/salons?q=Aurelia%20Palace`, {});
  const discSuspendedFound = (discSuspended.data?.data || []).some((s: any) => s._id === salon1Id);
  if (discSuspendedFound) throw new Error('Suspended salon was discoverable by customer!');
  console.log('✓ Suspended salon is hidden from customer discovery');

  // Verify in Suspended Salons list
  const suspendedRes = await request('/admin/salons/suspended', { token: adminToken });
  const suspendedList = suspendedRes.data.data;
  const inSuspended = suspendedList.some((s: any) => s._id === salon1Id);
  if (!inSuspended) throw new Error('Suspended salon not found in Suspended Salons list');
  console.log(`✓ Verified salon in Suspended Salons queue (${suspendedList.length} suspended total)`);

  // Reactivate salon
  const reactivateRes = await request(`/admin/salons/${salon1Id}/reactivate`, {
    method: 'PATCH',
    token: adminToken
  });
  if (reactivateRes.status !== 200) throw new Error('Reactivate failed');
  console.log(`✓ Salon reactivated: "${reactivateRes.data.message}"`);
  console.log(`  Status is now: ${reactivateRes.data.salon.status}`);

  // Customer can discover again
  const discReactivated = await request(`/salons?q=Aurelia%20Palace`, {});
  const discReactivatedFound = (discReactivated.data?.data || []).some((s: any) => s._id === salon1Id);
  if (!discReactivatedFound) throw new Error('Reactivated salon not discoverable!');
  console.log('✓ Reactivated salon is discoverable again');

  // --- STEP 11: Screen 9 - Subscription Plans with Stats ---
  console.log('\n11. Testing Screen 9: Subscription Plans with Stats...');
  const plansStatsRes = await request('/admin/subscriptions/plans', { token: adminToken });
  if (plansStatsRes.status !== 200) throw new Error('Subscription plans stats failed');
  const planStats = plansStatsRes.data.data;
  console.log(`✓ Subscription Plans & Revenue stats retrieved:`);
  for (const ps of planStats) {
    console.log(`  - ${ps.name} (${ps.id}): ₹${ps.monthlyPrice}/mo, ₹${ps.yearlyPrice}/yr | Active: ${ps.activeSubscribers}, Total: ${ps.totalSubscribers}, Volume: ₹${ps.totalRevenue}`);
  }
  const starterStat = planStats.find((p: any) => p.id === 'STARTER');
  const businessStat = planStats.find((p: any) => p.id === 'BUSINESS');
  if (!starterStat || !businessStat) throw new Error('Missing plan stats');
  if (starterStat.totalRevenue <= 0 || businessStat.totalRevenue <= 0) {
    throw new Error('Expected positive revenue figures from mock payments');
  }

  // --- STEP 12: Screen 10 - Payments & Transactions Log ---
  console.log('\n12. Testing Screen 10: Payments & Transactions Ledger...');
  const paymentsRes = await request('/admin/payments', { token: adminToken });
  if (paymentsRes.status !== 200) throw new Error('Payments fetch failed');
  console.log(`✓ Payments ledger retrieved:`);
  console.log(`  - Total Volume: ₹${paymentsRes.data.totalVolume}`);
  console.log(`  - Total Transactions: ${paymentsRes.data.count}`);
  const tx = paymentsRes.data.data[0];
  console.log(`  - Latest Transaction ID: ${tx.transactionId}`);
  console.log(`    Amount: ₹${tx.amount} | Plan: ${tx.plan} (${tx.billingCycle})`);
  console.log(`    Salon: ${tx.salonId?.salonName || 'N/A'} | Owner: ${tx.ownerId?.email || 'N/A'}`);
  if (paymentsRes.data.totalVolume < 6298) throw new Error('Total volume should be at least 299 + 5999');

  // --- STEP 13: Screen 11 - Customers List ---
  console.log('\n13. Testing Screen 11: Customers List...');
  const customersRes = await request('/admin/customers', { token: adminToken });
  if (customersRes.status !== 200) throw new Error('Customers fetch failed');
  const custList = customersRes.data.data;
  console.log(`✓ Retrieved ${customersRes.data.count} registered customers`);
  const foundCust = custList.find((c: any) => c.email === customerEmail);
  if (!foundCust) throw new Error('Test customer not found in customer list');
  console.log(`✓ Test customer found: ${foundCust.name} (${foundCust.email})`);

  // --- STEP 14: Screen 12 - Offers Management ---
  console.log('\n14. Testing Screen 12: Promotional Offers Management...');
  // 14a. List offers
  const offersListRes = await request('/admin/offers', { token: adminToken });
  if (offersListRes.status !== 200) throw new Error('Offers list failed');
  console.log(`✓ Platform offers list fetched (${offersListRes.data.data.length} offers)`);

  // 14b. Create new offer
  const newOfferCode = `FESTIVE${ts.toString().slice(-4)}`;
  const createOfferRes = await request('/admin/offers', {
    method: 'POST',
    body: {
      title: 'Festive Season Glamour Special',
      code: newOfferCode,
      discountPercent: 30,
      description: '30% flat discount on premium salon services for wedding season.',
      validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()
    },
    token: adminToken
  });
  if (createOfferRes.status !== 201) throw new Error(`Create offer failed: ${JSON.stringify(createOfferRes)}`);
  const createdOffer = createOfferRes.data.data;
  console.log(`✓ Created new offer: ${createdOffer.code} (-${createdOffer.discountPercent}%)`);

  // 14c. Toggle offer active status
  const toggleRes = await request(`/admin/offers/${createdOffer._id}/toggle`, {
    method: 'PATCH',
    token: adminToken
  });
  if (toggleRes.status !== 200) throw new Error('Toggle offer failed');
  console.log(`✓ Toggled offer: ${toggleRes.data.message} (isActive: ${toggleRes.data.data.isActive})`);

  // 14d. Delete offer
  const deleteOfferRes = await request(`/admin/offers/${createdOffer._id}`, {
    method: 'DELETE',
    token: adminToken
  });
  if (deleteOfferRes.status !== 200) throw new Error('Delete offer failed');
  console.log(`✓ Offer deleted successfully: "${deleteOfferRes.data.message}"`);

  console.log('\n================================================================');
  console.log(' ALL 12 SUPER_ADMIN DASHBOARD SCREENS & APPROVAL FLOWS VERIFIED!');
  console.log('================================================================\n');
}

run().catch((e) => {
  console.error('\n❌ Admin flow test failed:', e);
  process.exit(1);
});
