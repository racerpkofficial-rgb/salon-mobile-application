import mongoose from 'mongoose';
import { env } from './config/env.js';
import { Salon } from './models/Salon.js';
import { SalonOffer } from './models/SalonOffer.js';
import { User } from './models/User.js';

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

async function runPhase18Tests() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('========================================================================');
  console.log('   PHASE 18: DISCOVER SEARCH, NAVIGATION & LOCATION DISCOVERY TESTS     ');
  console.log('========================================================================\n');

  const ts = Date.now();
  const strongPassword = 'AureliaPassword2026!';

  // STEP 1: Super Admin Login
  console.log('--- STEP 1: Super Admin Setup ---');
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: 'admin@example.com', password: 'AdminPassword123!' }
  });
  if (adminLogin.status !== 200) throw new Error('Admin login failed');
  const adminToken = adminLogin.data.token;
  console.log('✓ Admin authenticated.');

  // STEP 2: Register Valid Trichy Salon
  console.log('\n--- STEP 2: Register & Approve Trichy Salon ---');
  const trichyOwnerEmail = `trichy_owner_${ts}@test.com`;
  const trichyOwnerRes = await request('/auth/register/salon-owner', {
    method: 'POST',
    body: {
      name: `Trichy Owner ${ts}`,
      email: trichyOwnerEmail,
      phone: `+91 9842${String(ts).slice(-6)}`,
      password: strongPassword,
      confirmPassword: strongPassword,
      salonName: `Aurelia Trichy Lounge ${ts}`,
      city: 'Tiruchirappalli',
      state: 'Tamil Nadu',
      country: 'India',
      address: 'Thillai Nagar Main Road, Trichy',
      location: { latitude: 10.8271, longitude: 78.6896 },
      identityProof: {
        url: 'https://docs.aureliabeaute.internal/secure/id-docs/sample_gst.pdf',
        filename: 'gst_certificate.pdf',
        fileType: 'application/pdf',
        fileSize: 102400
      }
    }
  });
  if (trichyOwnerRes.status !== 201) {
    throw new Error(`Trichy owner registration failed: ${JSON.stringify(trichyOwnerRes.data)}`);
  }
  const trichyOwnerToken = trichyOwnerRes.data.token;
  const trichySalonId = trichyOwnerRes.data.salon.id || trichyOwnerRes.data.salon._id;

  // Add services to Trichy salon
  await request('/owner/salon', {
    method: 'POST',
    token: trichyOwnerToken,
    body: {
      salonName: `Aurelia Trichy Lounge ${ts}`,
      description: 'Finest artisanal hair & wellness studio in Tiruchirappalli.',
      phone: `+91 9842${String(ts).slice(-6)}`,
      email: trichyOwnerEmail,
      address: 'Thillai Nagar Main Road, Trichy',
      city: 'Tiruchirappalli',
      location: { latitude: 10.8271, longitude: 78.6896 },
      services: [
        {
          name: 'Royal Herbal Haircut & Style',
          price: 650,
          category: 'Hair',
          durationMinutes: 45,
          description: 'Customized precision haircut with revitalizing scalp massage.'
        },
        {
          name: 'Kaveri Ayurvedic Head Spa',
          price: 1200,
          category: 'Spa',
          durationMinutes: 60,
          description: 'Traditional soothing head and neck ritual.'
        }
      ]
    }
  });

  // Create an active offer for Trichy salon
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 14);
  const offerRes = await request('/owner/offers', {
    method: 'POST',
    token: trichyOwnerToken,
    body: {
      title: 'Trichy Grand Welcome Special',
      discountType: 'PERCENTAGE',
      discountValue: 25,
      applicableService: 'Royal Herbal Haircut & Style',
      description: 'Exclusive 25% launch privilege for Tiruchirappalli patrons.',
      endDate: futureDate.toISOString()
    }
  });
  if (offerRes.status !== 201) {
    throw new Error(`Failed to create Trichy offer: ${JSON.stringify(offerRes.data)}`);
  }

  // Activate subscription and approve salon
  await Salon.findByIdAndUpdate(trichySalonId, {
    status: 'ACTIVE',
    subscriptionStatus: 'ACTIVE'
  });
  console.log(`✓ Trichy salon approved & active (ID: ${trichySalonId}, Coordinates: 10.8271, 78.6896).`);

  // STEP 3: Register Valid Bengaluru Salon
  console.log('\n--- STEP 3: Register & Approve Bengaluru Salon ---');
  const blrOwnerEmail = `blr_owner_${ts}@test.com`;
  const blrOwnerRes = await request('/auth/register/salon-owner', {
    method: 'POST',
    body: {
      name: `Bangalore Owner ${ts}`,
      email: blrOwnerEmail,
      phone: `+91 9843${String(ts).slice(-6)}`,
      password: strongPassword,
      confirmPassword: strongPassword,
      salonName: `Aurelia Indiranagar Atelier ${ts}`,
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      address: '100 Feet Road, Indiranagar',
      location: { latitude: 12.9784, longitude: 77.6408 },
      identityProof: {
        url: 'https://docs.aureliabeaute.internal/secure/id-docs/sample_gst.pdf',
        filename: 'gst_certificate.pdf',
        fileType: 'application/pdf',
        fileSize: 102400
      }
    }
  });
  if (blrOwnerRes.status !== 201) {
    throw new Error(`Bengaluru owner registration failed: ${JSON.stringify(blrOwnerRes.data)}`);
  }
  const blrOwnerToken = blrOwnerRes.data.token;
  const blrSalonId = blrOwnerRes.data.salon.id || blrOwnerRes.data.salon._id;

  await request('/owner/salon', {
    method: 'POST',
    token: blrOwnerToken,
    body: {
      salonName: `Aurelia Indiranagar Atelier ${ts}`,
      description: 'Haute coiffure in Indiranagar, Bengaluru.',
      phone: `+91 9843${String(ts).slice(-6)}`,
      email: blrOwnerEmail,
      address: '100 Feet Road, Indiranagar',
      city: 'Bengaluru',
      location: { latitude: 12.9784, longitude: 77.6408 },
      services: [
        {
          name: 'French Luxe Balayage',
          price: 4500,
          category: 'Hair',
          durationMinutes: 90
        }
      ]
    }
  });

  await Salon.findByIdAndUpdate(blrSalonId, {
    status: 'ACTIVE',
    subscriptionStatus: 'ACTIVE'
  });
  console.log(`✓ Bengaluru salon approved & active (ID: ${blrSalonId}, Coordinates: 12.9784, 77.6408).`);

  // STEP 4: Register an Inactive / Unapproved Salon (Negative Test)
  console.log('\n--- STEP 4: Register Inactive / Unapproved Salon ---');
  const inactiveSalon = await Salon.create({
    ownerId: new mongoose.Types.ObjectId(),
    salonName: `Pending Unapproved Salon ${ts}`,
    city: 'Tiruchirappalli',
    address: 'Cantonment, Trichy',
    phone: `+91 9849${String(ts).slice(-6)}`,
    email: `inactive_${ts}@test.com`,
    location: { latitude: 10.805, longitude: 78.685 },
    status: 'PENDING_APPROVAL',
    subscriptionStatus: 'PENDING'
  });
  console.log(`✓ Inactive salon created (ID: ${inactiveSalon._id}).`);

  // STEP 5: Register Customer
  console.log('\n--- STEP 5: Register Customer ---');
  const custRes = await request('/auth/register/customer', {
    method: 'POST',
    body: {
      name: `Trichy Customer ${ts}`,
      email: `trichy_customer_${ts}@test.com`,
      phone: `+91 9844${String(ts).slice(-6)}`,
      password: strongPassword,
      confirmPassword: strongPassword,
      city: 'Tiruchirappalli'
    }
  });
  if (custRes.status !== 201) throw new Error(`Customer registration failed: ${JSON.stringify(custRes.data)}`);
  const custToken = custRes.data.token;
  console.log('✓ Customer registered in Tiruchirappalli.');

  // ========================================================================
  // VERIFYING ISSUE 1: DISCOVER SCREEN SEARCH
  // ========================================================================
  console.log('\n========================================================================');
  console.log('VERIFYING ISSUE 1: DISCOVER SCREEN SEARCH & QUERIES');
  console.log('========================================================================');

  // 1.1 Search by salon name
  const s1 = await request(`/salons?q=${encodeURIComponent(`Trichy Lounge ${ts}`)}`);
  if (s1.status !== 200 || !s1.data.data.some((s: any) => s.id === trichySalonId.toString())) {
    throw new Error('Search by salon name failed to find Trichy salon');
  }
  console.log('✓ 1.1: Search by salon name found Trichy salon.');

  // 1.2 Search by "Trichy" (city alias normalization)
  const s2 = await request('/salons?q=Trichy');
  if (s2.status !== 200 || !s2.data.data.some((s: any) => s.id === trichySalonId.toString())) {
    throw new Error('Search by "Trichy" failed to match Tiruchirappalli salon');
  }
  console.log('✓ 1.2: Search by "Trichy" matched Tiruchirappalli salon.');

  // 1.3 Search by "Tiruchirappalli"
  const s3 = await request('/salons?q=Tiruchirappalli');
  if (s3.status !== 200 || !s3.data.data.some((s: any) => s.id === trichySalonId.toString())) {
    throw new Error('Search by "Tiruchirappalli" failed to match salon');
  }
  console.log('✓ 1.3: Search by canonical "Tiruchirappalli" matched salon.');

  // 1.4 Search by service name ("Haircut")
  const s4 = await request('/salons?q=Haircut');
  if (s4.status !== 200 || !s4.data.data.some((s: any) => s.id === trichySalonId.toString())) {
    throw new Error('Search by service name "Haircut" failed');
  }
  console.log('✓ 1.4: Search by service name "Haircut" successfully returned salon.');

  // 1.5 Search by offer title ("Grand Welcome")
  const s5 = await request('/salons?q=Grand%20Welcome');
  if (s5.status !== 200 || !s5.data.data.some((s: any) => s.id === trichySalonId.toString())) {
    throw new Error('Search by offer title failed to match salon');
  }
  console.log('✓ 1.5: Search by offer title "Grand Welcome" successfully returned salon.');

  // 1.6 Search by address ("Thillai Nagar")
  const s6 = await request('/salons?q=Thillai%20Nagar');
  if (s6.status !== 200 || !s6.data.data.some((s: any) => s.id === trichySalonId.toString())) {
    throw new Error('Search by address failed to match salon');
  }
  console.log('✓ 1.6: Search by area/address "Thillai Nagar" successfully returned salon.');

  // 1.7 Empty search safely returns eligible salons
  const s7 = await request('/salons?q=');
  if (s7.status !== 200 || s7.data.data.length < 2) {
    throw new Error('Empty search failed or returned empty list');
  }
  console.log('✓ 1.7: Empty search safely returned all eligible salons.');

  // 1.8 Case-insensitive search ("tRiChY")
  const s8 = await request('/salons?q=tRiChY');
  if (s8.status !== 200 || !s8.data.data.some((s: any) => s.id === trichySalonId.toString())) {
    throw new Error('Case-insensitive search "tRiChY" failed');
  }
  console.log('✓ 1.8: Case-insensitive search "tRiChY" successfully matched salon.');

  // 1.9 Unapproved / inactive salon is strictly excluded
  const inactiveInSearch = s7.data.data.some((s: any) => s.id === inactiveSalon._id.toString());
  if (inactiveInSearch) {
    throw new Error('Unapproved salon was incorrectly returned in search results');
  }
  console.log('✓ 1.9: Unapproved salon strictly excluded from search and discover.');

  // ========================================================================
  // VERIFYING ISSUE 5 & 6: LOCATION-BASED DISCOVERY & TRICHY ACCURACY
  // ========================================================================
  console.log('\n========================================================================');
  console.log('VERIFYING ISSUE 5 & 6: REAL CUSTOMER LOCATION & TRICHY SALON DISCOVERY');
  console.log('========================================================================');

  // Customer is in Trichy (lat: 10.7905, lng: 78.7047)
  const trichyLocRes = await request('/salons?lat=10.7905&lng=78.7047');
  if (trichyLocRes.status !== 200) throw new Error('GET /salons with coords failed');
  const trichyResults = trichyLocRes.data.data;

  const foundTrichy = trichyResults.find((s: any) => s.id === trichySalonId.toString());
  const foundBlr = trichyResults.find((s: any) => s.id === blrSalonId.toString());

  if (!foundTrichy || !foundBlr) {
    throw new Error('Both salons should be returned when discovery queries all active salons');
  }

  console.log(`   Trichy salon distance for Trichy customer: ${foundTrichy.distance} (km: ${foundTrichy.distanceKm})`);
  console.log(`   Bengaluru salon distance for Trichy customer: ${foundBlr.distance} (km: ${foundBlr.distanceKm})`);

  // Verify Trichy distance is local (< 10 km)
  if (foundTrichy.distanceKm > 10) {
    throw new Error(`Expected Trichy salon to be < 10 km, got ${foundTrichy.distanceKm} km`);
  }

  // Verify Bengaluru distance is ~270 km
  if (foundBlr.distanceKm < 200) {
    throw new Error(`Expected Bengaluru salon to be > 200 km, got ${foundBlr.distanceKm} km`);
  }

  // Verify Trichy salon is prioritized FIRST (#1) in results array
  const trichyIndex = trichyResults.findIndex((s: any) => s.id === trichySalonId.toString());
  const blrIndex = trichyResults.findIndex((s: any) => s.id === blrSalonId.toString());
  if (trichyIndex > blrIndex) {
    throw new Error('Trichy salon was not prioritized before Bengaluru salon for Trichy customer');
  }
  console.log('✓ 5.1: Trichy salon is prioritized FIRST (#1) ahead of Bengaluru salon for Trichy customer.');
  console.log('✓ 5.2: Real Haversine distance used; Bangalore is NOT default fallback.');

  // Customer is in Bengaluru (lat: 12.9716, lng: 77.5946)
  const blrLocRes = await request('/salons?lat=12.9716&lng=77.5946');
  const blrResults = blrLocRes.data.data;
  const blrIndexForBlr = blrResults.findIndex((s: any) => s.id === blrSalonId.toString());
  const trichyIndexForBlr = blrResults.findIndex((s: any) => s.id === trichySalonId.toString());
  if (blrIndexForBlr > trichyIndexForBlr) {
    throw new Error('Bengaluru salon was not prioritized before Trichy salon for Bengaluru customer');
  }
  console.log('✓ 6.1: Bengaluru salon is prioritized FIRST (#1) for Bengaluru customer.');

  // City filter test with "Trichy"
  const cityFilteredRes = await request('/salons?city=Trichy');
  if (cityFilteredRes.status !== 200 || !cityFilteredRes.data.data.some((s: any) => s.id === trichySalonId.toString())) {
    throw new Error('GET /salons?city=Trichy failed to return Trichy salon');
  }
  const blrInTrichyCity = cityFilteredRes.data.data.some((s: any) => s.id === blrSalonId.toString());
  if (blrInTrichyCity) {
    throw new Error('Bengaluru salon should not appear when filtered specifically for city=Trichy');
  }
  console.log('✓ 6.2: City filter "Trichy" returns Tiruchirappalli salons and excludes other cities.');

  // Cleanup test salon records
  await Salon.deleteMany({ _id: { $in: [trichySalonId, blrSalonId, inactiveSalon._id] } });
  await SalonOffer.deleteMany({ salonId: trichySalonId });
  await User.deleteMany({ _id: { $in: [trichyOwnerRes.data.user.id, blrOwnerRes.data.user.id, custRes.data.user.id] } });
  console.log('✓ Test data cleaned up.');

  console.log('\n========================================================================');
  console.log('   ALL PHASE 18 INTEGRATION TESTS PASSED WITH 100% SUCCESS!             ');
  console.log('========================================================================');
  await mongoose.disconnect();
}

runPhase18Tests().catch((err) => {
  console.error('\n❌ PHASE 18 TEST FAILED:', err);
  process.exit(1);
});
