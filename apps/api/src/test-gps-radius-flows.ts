import http from 'http';
import mongoose from 'mongoose';
import { app } from './application.js';
import { env } from './config/env.js';
import { Salon } from './models/Salon.js';
import { User } from './models/User.js';
import { seedSuperAdmin } from './services/admin-seed.service.js';
import {
  calculateHaversineDistance,
  formatDistance,
  isValidRadius,
  toGeoJsonPoint
} from './utils/location.js';

let server: http.Server;
let baseUrl = '';

async function request(
  path: string,
  options: { method?: string; body?: any; token?: string } = {}
) {
  const res = await fetch(`${baseUrl}${path}`, {
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

async function runGpsRadiusTests() {
  console.log('========================================================================');
  console.log('   ACCURATE GPS-BASED SALON LOCATION & RADIUS SEARCH VERIFICATION       ');
  console.log('========================================================================\n');

  // Connect to DB and start ephemeral server
  await mongoose.connect(env.MONGODB_URI);
  await seedSuperAdmin();

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const address = server.address();
      if (typeof address === 'object' && address) {
        baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
      }
      resolve();
    });
  });

  console.log(`✓ Test API server listening dynamically at ${baseUrl}\n`);

  const ts = Date.now();
  const testPassword = 'SalonPassword2026!';

  // --- UNIT / UTILITY TESTS ---
  console.log('--- Testing Distance & GeoJSON Utility Functions ---');

  // Verify Haversine formula
  // Known distance: Thillai Nagar, Trichy (10.8271, 78.6896) to Srirangam, Trichy (10.8631, 78.6946) ~ 4.04 km
  const dTrichy = calculateHaversineDistance(10.8271, 78.6896, 10.8631, 78.6946);
  if (Math.abs(dTrichy - 4.04) > 0.3) {
    throw new Error(`Haversine calculation error: expected ~4.04 km, got ${dTrichy}`);
  }
  console.log(`✓ Haversine distance validated: ${dTrichy} km (expected ~4.04 km)`);

  // Verify distance formatting
  if (formatDistance(0.4) !== '400 m away') {
    throw new Error(`formatDistance(0.4) unexpected: ${formatDistance(0.4)}`);
  }
  if (formatDistance(2.456) !== '2.5 km away') {
    throw new Error(`formatDistance(2.456) unexpected: ${formatDistance(2.456)}`);
  }
  if (formatDistance(null) !== 'Distance unavailable') {
    throw new Error(`formatDistance(null) unexpected: ${formatDistance(null)}`);
  }
  console.log('✓ formatDistance outputs correct user-friendly distance badges');

  // Verify GeoJSON coordinate order: [longitude, latitude]
  const geoPoint = toGeoJsonPoint(10.8271, 78.6896);
  if (!geoPoint || geoPoint.type !== 'Point' || geoPoint.coordinates[0] !== 78.6896 || geoPoint.coordinates[1] !== 10.8271) {
    throw new Error(`GeoJSON coordinate order must be [longitude, latitude]. Got: ${JSON.stringify(geoPoint)}`);
  }
  console.log('✓ GeoJSON coordinate order confirmed as [longitude, latitude]');

  // Verify radius validation
  if (!isValidRadius(5) || !isValidRadius(10) || isValidRadius(-1) || isValidRadius(500) || isValidRadius(NaN)) {
    throw new Error('Radius validation failed for permitted 0.1-100km values');
  }
  console.log('✓ Radius validation confirmed (0.1–100 km permitted)');

  // Verify MongoDB 2dsphere index
  try {
    await Salon.collection.dropIndex('locationPoint_2dsphere');
  } catch {
    // index might not exist yet
  }
  await Salon.collection.createIndex({ locationPoint: '2dsphere' }, { sparse: true });
  console.log('✓ MongoDB 2dsphere sparse index on locationPoint is active');

  // --- SCENARIO 1: Owner registers salon at Location A with permanent coordinates ---
  console.log('\n--- Scenario 1: Owner registers salon at Location A with permanent coordinates ---');
  const ownerEmail = `loc_owner_${ts}@test.com`;
  const locationA = { latitude: 10.8271, longitude: 78.6896 }; // Thillai Nagar, Trichy

  const regRes = await request('/auth/register/salon-owner', {
    method: 'POST',
    body: {
      name: `Location Owner ${ts}`,
      email: ownerEmail,
      phone: `+91 9999${String(ts).slice(-6)}`,
      password: testPassword,
      confirmPassword: testPassword,
      salonName: `Premises Luxe Salon ${ts}`,
      city: 'Tiruchirappalli',
      state: 'Tamil Nadu',
      country: 'India',
      address: 'No 45, 10th Cross, Thillai Nagar, Tiruchirappalli',
      location: locationA,
      identityProof: {
        url: 'https://docs.aureliabeaute.internal/secure/id-docs/sample_gst.pdf',
        filename: 'gst_certificate.pdf',
        fileType: 'application/pdf',
        fileSize: 102400
      }
    }
  });

  if (regRes.status !== 201) {
    throw new Error(`Registration failed: ${JSON.stringify(regRes.data)}`);
  }
  const ownerToken = regRes.data.token;
  const ownerId = regRes.data.user.id;
  const salonId = regRes.data.salon.id || regRes.data.salon._id;

  // Verify registered salon in DB has numeric coordinates and GeoJSON point
  const dbSalon = await Salon.findById(salonId);
  if (!dbSalon) throw new Error('Salon not found in database');
  if (
    typeof dbSalon.location?.latitude !== 'number' ||
    typeof dbSalon.location?.longitude !== 'number' ||
    dbSalon.location.latitude !== locationA.latitude ||
    dbSalon.location.longitude !== locationA.longitude
  ) {
    throw new Error(`Salon coordinates not saved correctly: ${JSON.stringify(dbSalon.location)}`);
  }
  if (
    !dbSalon.locationPoint ||
    dbSalon.locationPoint.coordinates[0] !== locationA.longitude ||
    dbSalon.locationPoint.coordinates[1] !== locationA.latitude
  ) {
    throw new Error(`GeoJSON locationPoint not synchronized: ${JSON.stringify(dbSalon.locationPoint)}`);
  }
  console.log('✓ Scenario 1 PASSED: Salon registered with permanent numeric coordinates and GeoJSON point.');

  // --- SCENARIO 7: Unapproved salon does NOT appear in customer discovery ---
  console.log('\n--- Scenario 7: Unapproved salon is hidden from customer discovery ---');
  const unapprovedDiscovery = await request(`/salons?lat=${locationA.latitude}&lng=${locationA.longitude}&radius=5`);
  const foundUnapproved = (unapprovedDiscovery.data?.data || []).some((s: any) => s.id === salonId.toString());
  if (foundUnapproved) {
    throw new Error('Unapproved salon appeared in customer discovery!');
  }
  console.log('✓ Scenario 7 PASSED: PENDING_APPROVAL salon is excluded from discovery.');

  // --- SCENARIO 2: Admin approves salon; coordinates remain unchanged ---
  console.log('\n--- Scenario 2: Admin approves salon; coordinates remain unchanged ---');
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: 'admin@example.com', password: 'AdminPassword123!' }
  });
  if (adminLogin.status !== 200) throw new Error('Admin login failed');
  const adminToken = adminLogin.data.token;

  const approveRes = await request(`/admin/salons/${salonId}/approve`, {
    method: 'PATCH',
    token: adminToken
  });
  if (approveRes.status !== 200) {
    throw new Error(`Admin approval failed: ${JSON.stringify(approveRes.data)}`);
  }

  const postApprovalSalon = await Salon.findById(salonId);
  if (
    postApprovalSalon?.location?.latitude !== locationA.latitude ||
    postApprovalSalon?.location?.longitude !== locationA.longitude
  ) {
    throw new Error('Admin approval mutated salon coordinates!');
  }
  console.log('✓ Scenario 2 PASSED: Admin approved salon, coordinates remain exactly at Location A.');

  // --- SCENARIO 3: Owner logs in or updates profile; salon location remains static at Location A ---
  console.log('\n--- Scenario 3: Owner phone location/profile does not overwrite salon coordinates ---');
  // Owner logs in
  const ownerLoginRes = await request('/auth/login', {
    method: 'POST',
    body: { email: ownerEmail, password: testPassword }
  });
  if (ownerLoginRes.status !== 200) throw new Error('Owner login failed');

  // Owner updates personal profile with a different city/phone without touching salon location
  await request('/profile/me', {
    method: 'PUT',
    token: ownerToken,
    body: {
      name: `Location Owner Relocated Phone ${ts}`,
      city: 'Chennai' // Owner travelled to Chennai
    }
  });

  const postTravelSalon = await Salon.findById(salonId);
  if (
    postTravelSalon?.location?.latitude !== locationA.latitude ||
    postTravelSalon?.location?.longitude !== locationA.longitude
  ) {
    throw new Error('Salon coordinates were overwritten by owner profile updates!');
  }
  console.log('✓ Scenario 3 PASSED: Salon coordinates remain static at Location A regardless of owner phone/travel.');

  // --- SCENARIO 4: Customer 2 km away sees salon in both 5 km and 10 km searches ---
  console.log('\n--- Scenario 4: Customer 2 km away sees salon in 5 km and 10 km searches ---');
  // Point roughly 2 km from Location A: ~10.8400, 78.6950
  const customer2km = { latitude: 10.8400, longitude: 78.6950 };
  const d2 = calculateHaversineDistance(customer2km.latitude, customer2km.longitude, locationA.latitude, locationA.longitude);
  console.log(`(Calculated actual distance from customer to salon: ${d2.toFixed(2)} km)`);

  const search5km = await request(`/salons?lat=${customer2km.latitude}&lng=${customer2km.longitude}&radius=5`);
  const in5km = (search5km.data?.data || []).find((s: any) => s.id === salonId.toString());
  if (!in5km) {
    throw new Error('Salon should appear in 5 km radius search for 2 km distant customer');
  }
  if (!in5km.distance.includes('km away') && !in5km.distance.includes('m away')) {
    throw new Error(`Distance formatting missing clean badge: ${in5km.distance}`);
  }

  const search10km = await request(`/salons?lat=${customer2km.latitude}&lng=${customer2km.longitude}&radius=10`);
  const in10km = (search10km.data?.data || []).find((s: any) => s.id === salonId.toString());
  if (!in10km) {
    throw new Error('Salon should appear in 10 km radius search for 2 km distant customer');
  }
  console.log(`✓ Scenario 4 PASSED: Customer 2 km away sees salon in 5 km and 10 km searches with distance: "${in5km.distance}".`);

  // --- SCENARIO 5: Customer 7 km away does NOT see salon in 5 km search, but DOES in 10 km search ---
  console.log('\n--- Scenario 5: Customer 7 km away excluded from 5 km, included in 10 km ---');
  // Point roughly 7 km away: ~10.8800, 78.7100
  const customer7km = { latitude: 10.8800, longitude: 78.7100 };
  const d7 = calculateHaversineDistance(customer7km.latitude, customer7km.longitude, locationA.latitude, locationA.longitude);
  console.log(`(Calculated actual distance from customer to salon: ${d7.toFixed(2)} km)`);

  const search7kmIn5 = await request(`/salons?lat=${customer7km.latitude}&lng=${customer7km.longitude}&radius=5`);
  const found7In5 = (search7kmIn5.data?.data || []).some((s: any) => s.id === salonId.toString());
  if (found7In5) {
    throw new Error('Customer 7 km away incorrectly saw salon in 5 km search!');
  }

  const search7kmIn10 = await request(`/salons?lat=${customer7km.latitude}&lng=${customer7km.longitude}&radius=10`);
  const found7In10 = (search7kmIn10.data?.data || []).some((s: any) => s.id === salonId.toString());
  if (!found7In10) {
    throw new Error('Customer 7 km away failed to see salon in 10 km search!');
  }
  console.log('✓ Scenario 5 PASSED: 7 km customer excluded from 5 km search, included in 10 km search.');

  // --- SCENARIO 6: Salon outside selected radius does not appear ---
  console.log('\n--- Scenario 6: Customer 15 km away excluded from both 5 km and 10 km ---');
  // Point roughly 15 km away: ~10.9500, 78.7500
  const customer15km = { latitude: 10.9500, longitude: 78.7500 };
  const d15 = calculateHaversineDistance(customer15km.latitude, customer15km.longitude, locationA.latitude, locationA.longitude);
  console.log(`(Calculated actual distance from customer to salon: ${d15.toFixed(2)} km)`);

  const search15In5 = await request(`/salons?lat=${customer15km.latitude}&lng=${customer15km.longitude}&radius=5`);
  const search15In10 = await request(`/salons?lat=${customer15km.latitude}&lng=${customer15km.longitude}&radius=10`);
  if ((search15In5.data?.data || []).some((s: any) => s.id === salonId.toString())) {
    throw new Error('Salon 15 km away incorrectly found in 5 km search');
  }
  if ((search15In10.data?.data || []).some((s: any) => s.id === salonId.toString())) {
    throw new Error('Salon 15 km away incorrectly found in 10 km search');
  }
  console.log('✓ Scenario 6 PASSED: Salon outside selected radius does not appear in 5 km or 10 km searches.');

  // --- SCENARIO 8: Salon without valid coordinates is strictly excluded from radius searches ---
  console.log('\n--- Scenario 8: Salon without valid coordinates is excluded from radius searches ---');
  // Create an active salon with no coordinates
  const noCoordSalon = await Salon.create({
    ownerId: new mongoose.Types.ObjectId(),
    salonName: `No Coord Salon ${ts}`,
    name: `No Coord Salon ${ts}`,
    email: `nocoord_${ts}@test.com`,
    phone: `+91 9111${String(ts).slice(-6)}`,
    address: 'Address without coordinates',
    city: 'Tiruchirappalli',
    status: 'ACTIVE',
    subscriptionStatus: 'ACTIVE',
    location: undefined,
    locationPoint: undefined
  });

  // Query with radius: noCoordSalon MUST be excluded
  const radiusQueryWithNoCoord = await request(`/salons?lat=${locationA.latitude}&lng=${locationA.longitude}&radius=10`);
  const foundNoCoordInRadius = (radiusQueryWithNoCoord.data?.data || []).some((s: any) => s.id === noCoordSalon._id.toString());
  if (foundNoCoordInRadius) {
    throw new Error('Salon without coordinates was incorrectly included in radius search results!');
  }

  // Query without radius: noCoordSalon CAN appear, but distance must be "Distance unavailable"
  const generalQuery = await request(`/salons?city=Tiruchirappalli`);
  const foundNoCoordInGeneral = (generalQuery.data?.data || []).find((s: any) => s.id === noCoordSalon._id.toString());
  if (foundNoCoordInGeneral && foundNoCoordInGeneral.distance !== 'Distance unavailable') {
    throw new Error(`Expected 'Distance unavailable' for salon without coordinates, got: ${foundNoCoordInGeneral.distance}`);
  }
  console.log('✓ Scenario 8 PASSED: Salons without coordinates are strictly excluded from radius search.');

  // --- SCENARIO 9: Denied/unavailable GPS handled gracefully without crashing ---
  console.log('\n--- Scenario 9: Denied/unavailable GPS handled safely without crashes ---');
  // Request without GPS coordinates
  const noGpsRes = await request('/salons');
  if (noGpsRes.status !== 200 || !Array.isArray(noGpsRes.data?.data)) {
    throw new Error('Request without GPS coordinates failed');
  }

  // Request with invalid latitude/longitude or bad radius values gives 400 validation error (no 500 crash)
  const badLatRes = await request('/salons?lat=invalid_lat&lng=78.6896');
  if (badLatRes.status !== 400) {
    throw new Error(`Expected 400 for bad latitude, got ${badLatRes.status}`);
  }

  const badRadiusRes = await request('/salons?lat=10.8271&lng=78.6896&radius=-5');
  if (badRadiusRes.status !== 400) {
    throw new Error(`Expected 400 for negative radius, got ${badRadiusRes.status}`);
  }
  console.log('✓ Scenario 9 PASSED: Missing GPS or invalid parameters return graceful responses without crashing.');

  // --- SCENARIO 10: Updating salon location changes customer results only after explicit save ---
  console.log('\n--- Scenario 10: Owner updates registered salon premises location ---');
  const locationC = { latitude: 10.7600, longitude: 78.6400 }; // ~10 km away in Manikandam area

  // Must reject unauthorized user
  const unauthUpdate = await request('/owner/salon/location', {
    method: 'PATCH',
    body: {
      latitude: locationC.latitude,
      longitude: locationC.longitude,
      confirmedPremises: true
    }
  });
  if (unauthUpdate.status !== 401) {
    throw new Error(`Expected 401 for unauthorized location edit, got ${unauthUpdate.status}`);
  }

  // Must reject without premises confirmation
  const unconfirmedUpdate = await request('/owner/salon/location', {
    method: 'PATCH',
    token: ownerToken,
    body: {
      latitude: locationC.latitude,
      longitude: locationC.longitude,
      confirmedPremises: false
    }
  });
  if (unconfirmedUpdate.status !== 400) {
    throw new Error(`Expected 400 for unconfirmed premises, got ${unconfirmedUpdate.status}`);
  }

  // Valid location update
  const validUpdate = await request('/owner/salon/location', {
    method: 'PATCH',
    token: ownerToken,
    body: {
      latitude: locationC.latitude,
      longitude: locationC.longitude,
      address: 'New Location C Avenue, Tiruchirappalli',
      city: 'Tiruchirappalli',
      confirmedPremises: true
    }
  });
  if (validUpdate.status !== 200) {
    throw new Error(`Location update failed: ${JSON.stringify(validUpdate.data)}`);
  }

  // Verify coordinates in DB updated to Location C
  const updatedSalon = await Salon.findById(salonId);
  if (
    updatedSalon?.location?.latitude !== locationC.latitude ||
    updatedSalon?.location?.longitude !== locationC.longitude ||
    updatedSalon?.locationPoint?.coordinates[0] !== locationC.longitude ||
    updatedSalon?.locationPoint?.coordinates[1] !== locationC.latitude
  ) {
    throw new Error('Database did not update to new Location C coordinates');
  }

  // Verify customer search: Customer at customer2km (near Location A) now sees salon at a much further distance
  const newDistanceSearch = await request(`/salons?lat=${customer2km.latitude}&lng=${customer2km.longitude}`);
  const salonAfterMove = (newDistanceSearch.data?.data || []).find((s: any) => s.id === salonId.toString());
  if (!salonAfterMove) {
    throw new Error('Salon missing from discovery after location update');
  }
  const updatedDistance = salonAfterMove.distanceKm;
  const expectedNewDistance = calculateHaversineDistance(customer2km.latitude, customer2km.longitude, locationC.latitude, locationC.longitude);
  if (Math.abs(updatedDistance - expectedNewDistance) > 0.5) {
    throw new Error(`Expected new distance ~${expectedNewDistance} km, got ${updatedDistance} km`);
  }
  console.log(`✓ Scenario 10 PASSED: Location explicitly updated to Location C; customer sees new distance: ${salonAfterMove.distance}.`);

  // --- CLEANUP ---
  console.log('\n--- Cleaning up test records ---');
  await Salon.deleteMany({ _id: { $in: [salonId, noCoordSalon._id] } });
  await User.deleteMany({ _id: ownerId });
  console.log('✓ Test data cleaned up.');

  console.log('\n========================================================================');
  console.log('   ALL 10 GPS LOCATION & RADIUS SCENARIOS VERIFIED WITH 100% SUCCESS!   ');
  console.log('========================================================================');

  server.close();
  await mongoose.disconnect();
}

runGpsRadiusTests().catch(async (err) => {
  console.error('\n❌ GPS RADIUS TESTS FAILED:', err);
  if (server) server.close();
  await mongoose.disconnect();
  process.exit(1);
});
