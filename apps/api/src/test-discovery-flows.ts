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

async function run() {
  console.log('=== TESTING CUSTOMER SALON DISCOVERY & EXPERIENCE ===\n');

  const ts = Date.now();
  const password = 'Password123!';

  // 1. Authenticate Admin to prepare verified test salons
  console.log('1. Authenticating Super Admin...');
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: 'admin@example.com', password: 'AdminPassword123!' }
  });
  if (adminLogin.status !== 200) throw new Error('Admin login failed');
  const adminToken = adminLogin.data.token;
  console.log('✓ Admin authenticated');

  // 2. Register Owner A and create Active Salon in Bengaluru (Hair & Spa)
  console.log('\n2. Setting up Active Salon A (Bengaluru - Hair & Spa)...');
  const ownerA = await request('/auth/register/salon-owner', {
    method: 'POST',
    body: {
      name: 'Owner Discovery A',
      email: `disc_a_${ts}@test.com`,
      phone: '+91 98888 11111',
      password,
      confirmPassword: password,
      salonName: `Aurelia Hair Sanctuary ${ts}`,
      address: '88 MG Road, Central District',
      city: 'Bengaluru',
      identityProof: {
        url: 'https://docs.aureliabeaute.internal/secure/id-docs/sample_gst.pdf',
        filename: 'gst_certificate.pdf',
        fileType: 'application/pdf',
        fileSize: 102400
      }
    }
  });
  const ownerAToken = ownerA.data.token;

  const salonARes = await request('/owner/salon', {
    method: 'POST',
    body: {
      salonName: `Aurelia Hair Sanctuary ${ts}`,
      description: 'Award-winning hair color studio and botanical scalp wellness retreat.',
      phone: '+91 98888 11111',
      email: `disc_a_${ts}@test.com`,
      address: '88 MG Road, Central District',
      city: 'Bengaluru',
      location: { latitude: 12.9752, longitude: 77.6094 },
      images: [
        'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=800&q=80'
      ],
      services: [
        { name: 'Kérastase Caviar Hair Ritual', category: 'Hair', price: 2200, durationMinutes: 60, description: 'Intense revitalizing hair and scalp therapy' },
        { name: 'French Balayage Couture', category: 'Color', price: 5500, durationMinutes: 120, description: 'Hand-blended artisanal gradient hair coloring' },
        { name: 'Ayurvedic Scalp Massage', category: 'Spa', price: 1400, durationMinutes: 45, description: 'Herbal oil tension relieving head spa' }
      ]
    },
    token: ownerAToken
  });
  const salonAId = salonARes.data.salon._id;

  // Pay subscription for Salon A
  await request('/owner/subscription/mock-checkout', {
    method: 'POST',
    body: { plan: 'BUSINESS', billingCycle: 'YEARLY' },
    token: ownerAToken
  });

  // Admin approves Salon A
  await request(`/admin/salons/${salonAId}/approve`, { method: 'PATCH', token: adminToken });
  console.log(`✓ Salon A approved and ACTIVE: "Aurelia Hair Sanctuary ${ts}"`);

  // 3. Register Owner B and create Active Salon in Mumbai (Facial & Bridal)
  console.log('\n3. Setting up Active Salon B (Mumbai - Facial & Bridal)...');
  const ownerB = await request('/auth/register/salon-owner', {
    method: 'POST',
    body: {
      name: 'Owner Discovery B',
      email: `disc_b_${ts}@test.com`,
      phone: '+91 97777 22222',
      password,
      confirmPassword: password,
      salonName: `Luxe Skin Atelier ${ts}`,
      address: '14 Linking Road, Bandra West',
      city: 'Mumbai',
      identityProof: {
        url: 'https://docs.aureliabeaute.internal/secure/id-docs/sample_pan.png',
        filename: 'pan_card.png',
        fileType: 'image/png',
        fileSize: 204800
      }
    }
  });
  const ownerBToken = ownerB.data.token;

  const salonBRes = await request('/owner/salon', {
    method: 'POST',
    body: {
      salonName: `Luxe Skin Atelier ${ts}`,
      description: 'Couture aesthetic facials, glass skin treatments and bridal beauty.',
      phone: '+91 97777 22222',
      email: `disc_b_${ts}@test.com`,
      address: '14 Linking Road, Bandra West',
      city: 'Mumbai',
      location: { latitude: 19.0596, longitude: 72.8295 },
      images: [
        'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=800&q=80'
      ],
      services: [
        { name: 'Hydra-Infusion Facial', category: 'Facial', price: 3200, durationMinutes: 60, description: 'Deep vacuum pore cleansing and peptide infusion' },
        { name: 'Royal Bridal Glow', category: 'Bridal', price: 7500, durationMinutes: 150, description: 'Full face luminosity and wedding radiance' }
      ]
    },
    token: ownerBToken
  });
  const salonBId = salonBRes.data.salon._id;

  // Pay subscription for Salon B
  await request('/owner/subscription/mock-checkout', {
    method: 'POST',
    body: { plan: 'PREMIUM', billingCycle: 'MONTHLY' },
    token: ownerBToken
  });

  // Admin approves Salon B
  await request(`/admin/salons/${salonBId}/approve`, { method: 'PATCH', token: adminToken });
  console.log(`✓ Salon B approved and ACTIVE: "Luxe Skin Atelier ${ts}"`);

  // 4. Create a Pending Salon C (MUST NOT be discoverable)
  console.log('\n4. Setting up Pending Salon C (Should be excluded)...');
  const ownerC = await request('/auth/register/salon-owner', {
    method: 'POST',
    body: {
      name: 'Owner Discovery C',
      email: `disc_c_${ts}@test.com`,
      phone: '+91 96666 33333',
      password,
      confirmPassword: password,
      salonName: `Unapproved Salon C ${ts}`,
      address: '99 Secret Road',
      city: 'Bengaluru',
      identityProof: {
        url: 'https://docs.aureliabeaute.internal/secure/id-docs/sample_gst.pdf',
        filename: 'gst_certificate.pdf',
        fileType: 'application/pdf',
        fileSize: 102400
      }
    }
  });
  const salonCRes = await request('/owner/salon', {
    method: 'POST',
    body: {
      salonName: `Unapproved Salon C ${ts}`,
      description: 'Pending inspection salon.',
      phone: '+91 96666 33333',
      email: `disc_c_${ts}@test.com`,
      address: '99 Secret Road',
      city: 'Bengaluru',
      services: [{ name: 'Test Cut', price: 100 }]
    },
    token: ownerC.data.token
  });
  const salonCId = salonCRes.data.salon._id;
  console.log('✓ Salon C created with status PENDING_APPROVAL');

  // 5. Test Customer Discovery - Verify Strict ACTIVE filter
  console.log('\n5. Verifying Strict Discovery Filter (Only ACTIVE + ACTIVE Subscriptions)...');
  const allSalonsRes = await request('/salons');
  if (allSalonsRes.status !== 200) throw new Error('Fetch /salons failed');
  const allSalons = allSalonsRes.data.data;
  console.log(`✓ Total active discoverable salons: ${allSalons.length}`);

  const hasSalonA = allSalons.some((s: any) => s._id === salonAId);
  const hasSalonB = allSalons.some((s: any) => s._id === salonBId);
  const hasSalonC = allSalons.some((s: any) => s._id === salonCId);

  if (!hasSalonA) throw new Error('Active Salon A was not returned in discovery!');
  if (!hasSalonB) throw new Error('Active Salon B was not returned in discovery!');
  if (hasSalonC) throw new Error('Pending Salon C was illegally returned in discovery!');
  console.log('✓ Salon A and B are discoverable; Pending Salon C is strictly excluded');

  // 6. Test Search by Name
  console.log('\n6. Testing Search by Name...');
  const searchNameRes = await request(`/salons?q=Sanctuary%20${ts}`);
  const searchNameSalons = searchNameRes.data.data;
  if (!searchNameSalons.some((s: any) => s._id === salonAId)) {
    throw new Error('Search by name did not return Salon A');
  }
  if (searchNameSalons.some((s: any) => s._id === salonBId)) {
    throw new Error('Search by name returned non-matching Salon B');
  }
  console.log(`✓ Search by name successfully isolated "${searchNameSalons[0].name}"`);

  // 7. Test Search by City
  console.log('\n7. Testing Search by City...');
  const cityMumbRes = await request('/salons?city=Mumbai');
  const mumbSalons = cityMumbRes.data.data;
  const inMumb = mumbSalons.some((s: any) => s._id === salonBId);
  const wrongInMumb = mumbSalons.some((s: any) => s._id === salonAId); // Salon A is Bengaluru
  if (!inMumb || wrongInMumb) throw new Error('Search by city filter failed');
  console.log(`✓ City filter "Mumbai" returned ${mumbSalons.length} salon(s), including Salon B`);

  const cityBlrRes = await request('/salons?city=Bengaluru');
  const blrSalons = cityBlrRes.data.data;
  const inBlr = blrSalons.some((s: any) => s._id === salonAId);
  if (!inBlr) throw new Error('City filter "Bengaluru" missing Salon A');
  console.log(`✓ City filter "Bengaluru" returned ${blrSalons.length} salon(s), including Salon A`);

  // 8. Test Filter by Service Category / Name
  console.log('\n8. Testing Filter by Service...');
  const hairRes = await request('/salons?service=Hair');
  const hairSalons = hairRes.data.data;
  if (!hairSalons.some((s: any) => s._id === salonAId)) {
    throw new Error('Filter by service "Hair" did not return Salon A');
  }
  console.log(`✓ Service filter "Hair" returned ${hairSalons.length} salon(s), including Salon A`);

  const bridalRes = await request('/salons?service=Bridal');
  const bridalSalons = bridalRes.data.data;
  if (!bridalSalons.some((s: any) => s._id === salonBId)) {
    throw new Error('Filter by service "Bridal" did not return Salon B');
  }
  console.log(`✓ Service filter "Bridal" returned ${bridalSalons.length} salon(s), including Salon B`);

  // 9. Verify Salon Card metadata
  console.log('\n9. Verifying Salon Card Data Fields...');
  const item = hairSalons.find((s: any) => s._id === salonAId);
  console.log('✓ Salon Data Fields:');
  console.log(`  - Name: ${item.name}`);
  console.log(`  - City: ${item.city}`);
  console.log(`  - Location: ${item.location}`);
  console.log(`  - Distance: ${item.distance}`);
  console.log(`  - Rating: ${item.rating} (${item.reviews} reviews)`);
  console.log(`  - Starting Price: ${item.startingPrice}`);
  console.log(`  - Images count: ${item.images.length}`);
  console.log(`  - Services count: ${item.services.length}`);

  if (!item.name || !item.distance || !item.startingPrice || !item.images?.length) {
    throw new Error('Incomplete salon card fields');
  }
  if (item.startingPrice !== 'From ₹1400') {
    throw new Error(`Expected starting price 'From ₹1400', got '${item.startingPrice}'`);
  }
  console.log('✓ Starting price correctly calculated from lowest service price (₹1400)');

  // 10. Test Single Salon Details Inspection
  console.log('\n10. Testing Salon Details Inspection Endpoint...');
  const detailRes = await request(`/salons/${salonAId}`);
  if (detailRes.status !== 200) throw new Error('Fetch salon details failed');
  const detail = detailRes.data.data;

  console.log(`✓ Salon details retrieved: "${detail.name}"`);
  console.log(`  - Full Address: ${detail.address}, ${detail.city}`);
  console.log(`  - Contact: ${detail.phone} | ${detail.email}`);
  console.log(`  - Coordinates: (${detail.coordinates?.latitude || 'N/A'}, ${detail.coordinates?.longitude || 'N/A'})`);
  if (!detail.coordinates?.latitude || !detail.coordinates?.longitude) {
    throw new Error('Coordinates missing in salon details response');
  }
  console.log(`  - Description: ${detail.description}`);
  console.log(`  - Full Services Menu:`);
  for (const svc of detail.services) {
    console.log(`    * ${svc.name} (${svc.category}): ₹${svc.price} [⏱ ${svc.durationMinutes} mins] - ${svc.description}`);
  }
  if (detail.services.length !== 3) throw new Error('Services count mismatch');

  // 11. Test Active Offers Endpoint
  console.log('\n11. Testing Active Offers Endpoint...');
  const offersRes = await request('/salons/offers');
  if (offersRes.status !== 200) throw new Error('Fetch offers failed');
  const offers = offersRes.data.data;
  console.log(`✓ Retrieved ${offers.length} active platform offer(s):`);
  for (const off of offers) {
    console.log(`  - ${off.code}: ${off.discountPercent}% OFF ("${off.title}")`);
  }
  if (!offers.length) throw new Error('Expected at least 1 active offer');

  console.log('\n======================================================');
  console.log(' ALL CUSTOMER SALON DISCOVERY & EXPERIENCE TESTS PASSED!');
  console.log('======================================================\n');
}

run().catch((e) => {
  console.error('\n❌ Customer discovery test failed:', e);
  process.exit(1);
});
