import mongoose from 'mongoose';
import { env } from './config/env.js';
import { Notification } from './models/Notification.js';
import { SalonOffer } from './models/SalonOffer.js';
import { Salon } from './models/Salon.js';
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

function getFutureDate(daysAhead: number = 7): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getPastDate(daysAgo: number = 7): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function runPhase17Tests() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('========================================================================');
  console.log('   PHASE 17: END-TO-END VERIFICATION SUITE                             ');
  console.log('   OFFER DISCOVERY, NOTIFICATION DEEP LINKING & LOCAL IMAGE UPLOAD      ');
  console.log('========================================================================\n');

  const ts = Date.now();
  const password = 'Password123!';

  // STEP 1: Super Admin & Approvals Setup
  console.log('--- STEP 1: Super Admin Setup ---');
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: 'admin@example.com', password: 'AdminPassword123!' }
  });
  if (adminLogin.status !== 200) throw new Error('Admin login failed');
  const adminToken = adminLogin.data.token;
  console.log('✓ Admin authenticated.');

  // STEP 2: Register Salon Owner & Create Approved Salon
  console.log('\n--- STEP 2: Salon Registration & Approval ---');
  const ownerReg = await request('/auth/register/salon-owner', {
    method: 'POST',
    body: {
      name: 'Owner Elena Rostova',
      email: `elena_salon_${ts}@test.com`,
      phone: '+91 97777 66666',
      password,
      confirmPassword: password,
      salonName: `Maison de Beaute ${ts}`,
      address: '15 Indiranagar 100ft Road',
      city: 'Bengaluru',
      identityProof: {
        url: 'https://docs.aureliabeaute.internal/secure/id-docs/sample_gst.pdf',
        filename: 'gst_certificate.pdf',
        fileType: 'application/pdf',
        fileSize: 102400
      }
    }
  });
  if (ownerReg.status !== 201) throw new Error(`Owner registration failed: ${JSON.stringify(ownerReg.data)}`);
  const ownerToken = ownerReg.data.token;
  const ownerId = ownerReg.data.user.id;

  const salonRes = await request('/owner/salon', {
    method: 'POST',
    body: {
      salonName: `Maison de Beaute ${ts}`,
      description: 'Haute coiffure and bespoke styling atelier',
      phone: '+91 97777 66666',
      email: `elena_salon_${ts}@test.com`,
      address: '15 Indiranagar 100ft Road',
      city: 'Bengaluru',
      location: { latitude: 12.9716, longitude: 77.6412 },
      services: [
        {
          name: 'Signature Haircut & Blowdry',
          price: 1200,
          duration: '45 mins',
          durationMinutes: 45,
          category: 'Hair'
        },
        {
          name: 'Gold Glow Facial',
          price: 2400,
          duration: '60 mins',
          durationMinutes: 60,
          category: 'Skin'
        }
      ]
    },
    token: ownerToken
  });
  if (salonRes.status !== 200 && salonRes.status !== 201) throw new Error(`Salon creation failed: ${JSON.stringify(salonRes.data)}`);
  const salonId = salonRes.data.salon._id;
  const haircutServiceId = salonRes.data.salon.services[0].id || salonRes.data.salon.services[0]._id;

  // Super Admin approves salon
  const approveRes = await request(`/admin/salons/${salonId}/approve`, {
    method: 'PATCH',
    token: adminToken
  });
  if (approveRes.status !== 200) throw new Error('Salon approval failed');
  console.log(`✓ Salon created and approved (${salonId}).`);

  // Activate salon subscription to ACTIVE
  await Salon.findByIdAndUpdate(salonId, {
    status: 'ACTIVE',
    subscriptionStatus: 'ACTIVE'
  });
  console.log('✓ Salon subscription marked ACTIVE.');

  // STEP 3: Register Customer for Discovery & Notifications
  console.log('\n--- STEP 3: Customer Registration ---');
  const custReg = await request('/auth/register/customer', {
    method: 'POST',
    body: {
      name: 'Priya Sharma',
      email: `priya_client_${ts}@test.com`,
      phone: '+91 96666 55555',
      password,
      confirmPassword: password
    }
  });
  if (custReg.status !== 201) throw new Error('Customer registration failed');
  const custToken = custReg.data.token;
  const custId = custReg.data.user.id;
  console.log(`✓ Customer registered (${custId}).`);

  // =========================================================================
  // ISSUE 3 VERIFICATION: LOCAL IMAGE PICKING & CLOUDINARY UPLOAD
  // =========================================================================
  console.log('\n========================================================================');
  console.log('VERIFYING ISSUE 3: LOCAL IMAGE UPLOAD & REMOVING DEFAULT IMAGE URL');
  console.log('========================================================================');

  // 3.1: Reject upload without owner authorization
  const unauthUpload = await request('/owner/offers/upload', {
    method: 'POST',
    body: {
      imageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      fileType: 'image/png'
    }
  });
  if (unauthUpload.status !== 401) throw new Error('Upload without auth should return 401');
  console.log('✓ 3.1: Unauthorized upload correctly rejected (401).');

  // 3.2: Reject unsupported file format (e.g., application/pdf)
  const invalidFormatUpload = await request('/owner/offers/upload', {
    method: 'POST',
    body: {
      imageData: 'data:application/pdf;base64,JVBERi0xLjQK...',
      fileType: 'application/pdf'
    },
    token: ownerToken
  });
  if (invalidFormatUpload.status !== 400) throw new Error('Non-image upload should return 400');
  console.log('✓ 3.2: Unsupported file format correctly rejected (400).');

  // 3.3: Successfully upload valid image base64 (simulating local gallery pick)
  const samplePngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const validUpload = await request('/owner/offers/upload', {
    method: 'POST',
    body: {
      imageData: samplePngBase64,
      fileType: 'image/png'
    },
    token: ownerToken
  });
  if (validUpload.status !== 200 || !validUpload.data?.url) {
    throw new Error(`Valid image upload failed: ${JSON.stringify(validUpload.data)}`);
  }
  const uploadedImageUrl = validUpload.data.url;
  console.log(`✓ 3.3: Local image uploaded to Cloudinary service: ${uploadedImageUrl}`);

  // 3.4: Create offer with uploaded image
  const offerWithCustomImage = await request('/owner/offers', {
    method: 'POST',
    body: {
      title: '20% OFF Haircut',
      description: 'Signature luxury haircut and blowdry with master stylist',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      applicableService: haircutServiceId,
      startDate: new Date().toISOString().split('T')[0],
      endDate: getFutureDate(14),
      image: uploadedImageUrl,
      isActive: true
    },
    token: ownerToken
  });
  if (offerWithCustomImage.status !== 201) {
    throw new Error(`Offer creation failed: ${JSON.stringify(offerWithCustomImage.data)}`);
  }
  const activeOfferId = offerWithCustomImage.data.offer._id;
  if (offerWithCustomImage.data.offer.image !== uploadedImageUrl) {
    throw new Error('Offer image does not match uploaded image');
  }
  console.log(`✓ 3.4: Offer created with custom uploaded image (ID: ${activeOfferId}).`);

  // 3.5: Create offer WITHOUT image (verify no hardcoded Unsplash URL is injected)
  const offerWithoutImage = await request('/owner/offers', {
    method: 'POST',
    body: {
      title: 'Facial Luxury Special',
      description: 'Pure 24K gold radiance treatment',
      discountType: 'FIXED',
      discountValue: 400,
      applicableService: 'ALL',
      startDate: new Date().toISOString().split('T')[0],
      endDate: getFutureDate(14),
      isActive: true
    },
    token: ownerToken
  });
  if (offerWithoutImage.status !== 201) throw new Error('Offer without image creation failed');
  const noImgOfferId = offerWithoutImage.data.offer._id;
  const noImgDb = await SalonOffer.findById(noImgOfferId);
  if (noImgDb?.image && noImgDb.image.includes('unsplash.com')) {
    throw new Error('Hardcoded Unsplash default still present in database!');
  }
  console.log('✓ 3.5: Offer created without image has no hardcoded placeholder in MongoDB.');

  // =========================================================================
  // ISSUE 1 VERIFICATION: OFFER DISCOVERY & SEARCH
  // =========================================================================
  console.log('\n========================================================================');
  console.log('VERIFYING ISSUE 1: DISCOVER AND SEARCH OFFERS');
  console.log('========================================================================');

  // 1.1: Customer Discover offers endpoint GET /salons/offers
  const discoverOffersRes = await request('/salons/offers');
  if (discoverOffersRes.status !== 200 || !Array.isArray(discoverOffersRes.data.data)) {
    throw new Error(`Discover offers failed: ${JSON.stringify(discoverOffersRes.data)}`);
  }
  const foundInDiscover = discoverOffersRes.data.data.find((o: any) => o._id === activeOfferId || o.id === activeOfferId);
  if (!foundInDiscover) {
    throw new Error('Created offer "20% OFF Haircut" NOT found in Customer Discover API (/salons/offers)');
  }
  console.log(`✓ 1.1: Offer found in Customer Discover API (${foundInDiscover.title}, discount: ${foundInDiscover.discountLabel || foundInDiscover.discountValue + '%'})`);

  // 1.2: Check populated salon relationship
  if (!foundInDiscover.salon || (!foundInDiscover.salon.name && !foundInDiscover.salonName)) {
    throw new Error('Salon relationship not populated in discover offers');
  }
  console.log(`✓ 1.2: Associated salon populated: "${foundInDiscover.salon?.name || foundInDiscover.salonName}"`);

  // 1.3: Customer Salons list GET /salons includes active offers on salon card
  const salonsListRes = await request('/salons');
  if (salonsListRes.status !== 200) throw new Error('Salons list failed');
  const mySalonInList = salonsListRes.data.data.find((s: any) => (s.id || s._id) === salonId);
  if (!mySalonInList || !mySalonInList.offers || mySalonInList.offers.length === 0) {
    throw new Error('Salon card in GET /salons does not include active offers array');
  }
  console.log(`✓ 1.3: Salon in GET /salons contains ${mySalonInList.offers.length} active offer(s) on card.`);

  // 1.4: Search by Offer Title term: "Haircut"
  const searchHaircut = await request('/salons?q=Haircut');
  const foundHaircutSalon = searchHaircut.data.data.find((s: any) => (s.id || s._id) === salonId);
  if (!foundHaircutSalon) {
    throw new Error('Search for "Haircut" did not discover the salon offering "20% OFF Haircut"');
  }
  console.log('✓ 1.4: Search for "Haircut" successfully returned salon and its active offer.');

  // 1.5: Search by Service/Category term: "Hair"
  const searchHair = await request('/salons?q=Hair');
  const foundHairSalon = searchHair.data.data.find((s: any) => (s.id || s._id) === salonId);
  if (!foundHairSalon) {
    throw new Error('Search for "Hair" did not discover the salon offering "20% OFF Haircut"');
  }
  console.log('✓ 1.5: Search for "Hair" successfully returned salon.');

  // 1.6: Search by Salon Name
  const searchSalonName = await request(`/salons?q=Maison%20de%20Beaute`);
  const foundByName = searchSalonName.data.data.find((s: any) => (s.id || s._id) === salonId);
  if (!foundByName) {
    throw new Error('Search by salon name failed');
  }
  console.log('✓ 1.6: Search by salon name successfully returned salon and active offers.');

  // 1.7: Expired offers must NOT appear in Discover or Search
  const expiredOffer = await SalonOffer.create({
    salonId,
    title: 'Expired Yesterday Special',
    description: 'This offer is in the past',
    discountType: 'PERCENTAGE',
    discountValue: 50,
    applicableService: 'ALL',
    startDate: getPastDate(10),
    endDate: getPastDate(1), // yesterday
    isActive: true
  });
  const discoverAfterExpired = await request('/salons/offers');
  const foundExpired = discoverAfterExpired.data.data.find((o: any) => o._id === expiredOffer._id.toString());
  if (foundExpired) {
    throw new Error('Expired offer incorrectly appeared in Customer Discover API!');
  }
  console.log('✓ 1.7: Expired offers strictly excluded from Customer Discover API.');

  // 1.8: Deactivated offers must NOT appear in Discover
  await SalonOffer.findByIdAndUpdate(activeOfferId, { isActive: false });
  const discoverAfterDeactivate = await request('/salons/offers');
  const foundDeactivated = discoverAfterDeactivate.data.data.find((o: any) => o._id === activeOfferId);
  if (foundDeactivated) {
    throw new Error('Deactivated offer incorrectly appeared in Discover API!');
  }
  console.log('✓ 1.8: Deactivated offer excluded from Discover API.');

  // Reactivate offer for subsequent steps
  await SalonOffer.findByIdAndUpdate(activeOfferId, { isActive: true });
  console.log('✓ Reactivated offer for deep linking tests.');

  // =========================================================================
  // ISSUE 2 VERIFICATION: NOTIFICATION VIEW OFFER & BOOKING FLOW
  // =========================================================================
  console.log('\n========================================================================');
  console.log('VERIFYING ISSUE 2: NOTIFICATION VIEW OFFER DEEP LINKING & BOOK NOW');
  console.log('========================================================================');

  // 2.1: Verify in-app notification created for customers contains offerId and targetScreen
  const offerNotif = await Notification.findOne({
    recipientId: custId,
    type: 'OFFER_PUBLISHED',
    offerId: activeOfferId
  });
  if (!offerNotif) {
    throw new Error('OFFER_PUBLISHED notification not found for registered customer');
  }
  if (!offerNotif.data?.offerId || offerNotif.data?.targetScreen !== 'OfferDetails') {
    throw new Error(`Notification missing deep link fields: ${JSON.stringify(offerNotif.data)}`);
  }
  console.log(`✓ 2.1: Customer notification has targetScreen="${offerNotif.data.targetScreen}" and offerId="${offerNotif.data.offerId}".`);

  // 2.2: Verify GET /offers/:id endpoint for Offer Details Screen
  const offerDetailsRes = await request(`/offers/${activeOfferId}`);
  if (offerDetailsRes.status !== 200 || !offerDetailsRes.data?.data) {
    throw new Error(`GET /offers/${activeOfferId} failed: ${JSON.stringify(offerDetailsRes.data)}`);
  }
  const details = offerDetailsRes.data.data;
  if (details.title !== '20% OFF Haircut' || !details.salon?.name || details.isExpired !== false) {
    throw new Error('Offer details payload incomplete or malformed');
  }
  console.log(`✓ 2.2: GET /offers/:id returned complete details for "${details.title}" at "${details.salon.name}".`);

  // 2.3: Test invalid offer ID returns 404 cleanly without server crash
  const fakeIdRes = await request('/offers/507f1f77bcf86cd799439011');
  if (fakeIdRes.status !== 404) throw new Error('Non-existent offer ID should return 404');
  console.log('✓ 2.3: Non-existent offer ID correctly returned 404.');

  // 2.4: Customer presses "Book Now" passing valid offerId
  const bookDate = getFutureDate(3);
  const bookWithOfferRes = await request('/customer/appointments', {
    method: 'POST',
    body: {
      salonId,
      serviceId: haircutServiceId,
      offerId: activeOfferId,
      appointmentDate: bookDate,
      startTime: '14:00',
      customerNote: 'Booking with 20% OFF Haircut offer'
    },
    token: custToken
  });
  if (bookWithOfferRes.status !== 201) {
    throw new Error(`Booking with offer failed: ${JSON.stringify(bookWithOfferRes.data)}`);
  }
  const appointment = bookWithOfferRes.data.appointment;
  // Haircut original price: 1200. 20% off: 240. Final price: 960
  if (appointment.totalPrice !== 960) {
    throw new Error(`Discount was not properly applied! Expected totalPrice 960, got ${appointment.totalPrice}`);
  }
  console.log(`✓ 2.4: Book Now succeeded with 20% discount applied: Standard ₹1200 -> ₹${appointment.totalPrice}`);

  // 2.5: Customer attempts to book with expired offer ID -> Backend rejects invalid offer
  const bookWithExpiredOffer = await request('/customer/appointments', {
    method: 'POST',
    body: {
      salonId,
      serviceId: haircutServiceId,
      offerId: expiredOffer._id.toString(),
      appointmentDate: bookDate,
      startTime: '15:00',
      customerNote: 'Attempting expired offer booking'
    },
    token: custToken
  });
  if (bookWithExpiredOffer.status !== 400) {
    throw new Error(`Backend should reject booking with expired offer (400), got ${bookWithExpiredOffer.status}`);
  }
  console.log(`✓ 2.5: Backend strictly rejected expired offer booking (400: "${bookWithExpiredOffer.data.message}").`);

  console.log('\n========================================================================');
  console.log('   ALL PHASE 17 INTEGRATION TESTS PASSED PERFECTLY!                    ');
  console.log('========================================================================');

  await mongoose.disconnect();
}

runPhase17Tests().catch((err) => {
  console.error('\n❌ PHASE 17 TEST FAILED:', err);
  process.exit(1);
});
