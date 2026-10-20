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

async function runPhase19Tests() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('========================================================================');
  console.log('   PHASE 19: AUTH ROLES, OFFER LIFECYCLE & SALON ELIGIBILITY TESTS       ');
  console.log('========================================================================\n');

  const ts = Date.now();
  const strongPassword = 'AureliaPassword2026!';

  // ==========================================
  // SECTION 1: AUTHENTICATION ROLE SEPARATION
  // ==========================================
  console.log('--- TEST GROUP 1: Auth Role Separation & Super Admin Routing ---');

  // Register Customer
  const custEmail = `cust_phase19_${ts}@test.com`;
  const custReg = await request('/auth/register/customer', {
    method: 'POST',
    body: {
      name: `Customer P19 ${ts}`,
      email: custEmail,
      password: strongPassword,
      confirmPassword: strongPassword,
      phone: `+91 9900${String(ts).slice(-6)}`
    }
  });
  if (custReg.status !== 201) throw new Error(`Customer registration failed: ${JSON.stringify(custReg.data)}`);
  const custToken = custReg.data.token;
  console.log('✓ 1. Customer registered.');

  // Register Salon Owner
  const ownerEmail = `owner_phase19_${ts}@test.com`;
  const ownerReg = await request('/auth/register/salon-owner', {
    method: 'POST',
    body: {
      name: `Pradeep Owner ${ts}`,
      email: ownerEmail,
      phone: `+91 9840${String(ts).slice(-6)}`,
      password: strongPassword,
      confirmPassword: strongPassword,
      salonName: `Pradeep's Salon ${ts}`,
      city: 'Tiruchirappalli',
      state: 'Tamil Nadu',
      country: 'India',
      address: '10 Cantonment Road, Trichy',
      location: { latitude: 10.7905, longitude: 78.7047 },
      identityProof: {
        url: 'https://docs.aureliabeaute.internal/secure/id-docs/sample_gst.pdf',
        filename: 'gst_pradeep.pdf',
        fileType: 'application/pdf',
        fileSize: 102400
      }
    }
  });
  if (ownerReg.status !== 201) throw new Error(`Owner registration failed: ${JSON.stringify(ownerReg.data)}`);
  const ownerToken = ownerReg.data.token;
  const ownerSalonId = ownerReg.data.salon.id;
  console.log(`✓ 2. Salon owner registered for "Pradeep's Salon ${ts}".`);

  // 1.1: Customer credentials -> Customer Login -> SUCCESS
  const custLoginRes = await request('/auth/customer/login', {
    method: 'POST',
    body: { email: custEmail, password: strongPassword }
  });
  if (custLoginRes.status !== 200 || custLoginRes.data.user.role !== 'CUSTOMER') {
    throw new Error(`Customer login failed: status ${custLoginRes.status}, data: ${JSON.stringify(custLoginRes.data)}`);
  }
  console.log('✓ 1.1: Customer credentials -> Customer Login (200 OK, role=CUSTOMER).');

  // 1.2: Customer credentials -> Salon Owner Login -> REJECT (403)
  const custOnOwnerRes = await request('/auth/salon-owner/login', {
    method: 'POST',
    body: { email: custEmail, password: strongPassword }
  });
  if (custOnOwnerRes.status !== 403 || custOnOwnerRes.data.code !== 'CUSTOMER_CREDENTIALS') {
    throw new Error(`Customer on Owner Login should be 403 with CUSTOMER_CREDENTIALS: ${JSON.stringify(custOnOwnerRes)}`);
  }
  console.log('✓ 1.2: Customer credentials -> Salon Owner Login (403 Forbidden with CUSTOMER_CREDENTIALS).');

  // 1.3: Salon Owner credentials -> Salon Owner Login -> SUCCESS
  const ownerLoginRes = await request('/auth/salon-owner/login', {
    method: 'POST',
    body: { email: ownerEmail, password: strongPassword }
  });
  if (ownerLoginRes.status !== 200 || ownerLoginRes.data.user.role !== 'SALON_OWNER') {
    throw new Error(`Owner login failed: status ${ownerLoginRes.status}, data: ${JSON.stringify(ownerLoginRes.data)}`);
  }
  console.log('✓ 1.3: Salon Owner credentials -> Salon Owner Login (200 OK, role=SALON_OWNER).');

  // 1.4: Salon Owner credentials -> Customer Login -> REJECT (403)
  const ownerOnCustRes = await request('/auth/customer/login', {
    method: 'POST',
    body: { email: ownerEmail, password: strongPassword }
  });
  if (ownerOnCustRes.status !== 403 || ownerOnCustRes.data.code !== 'SALON_OWNER_CREDENTIALS') {
    throw new Error(`Owner on Customer Login should be 403 with SALON_OWNER_CREDENTIALS: ${JSON.stringify(ownerOnCustRes)}`);
  }
  console.log('✓ 1.4: Salon Owner credentials -> Customer Login (403 Forbidden with SALON_OWNER_CREDENTIALS).');

  // 1.5: Super Admin credentials -> Customer Login -> SUCCESS (role=SUPER_ADMIN)
  const adminOnCustRes = await request('/auth/customer/login', {
    method: 'POST',
    body: { email: 'admin@example.com', password: 'AdminPassword123!' }
  });
  if (adminOnCustRes.status !== 200 || adminOnCustRes.data.user.role !== 'SUPER_ADMIN') {
    throw new Error(`Admin on Customer Login failed: ${JSON.stringify(adminOnCustRes)}`);
  }
  console.log('✓ 1.5: Super Admin credentials -> Customer Login (200 OK, retained role=SUPER_ADMIN).');

  // 1.6: Super Admin credentials -> Salon Owner Login -> SUCCESS (role=SUPER_ADMIN)
  const adminOnOwnerRes = await request('/auth/salon-owner/login', {
    method: 'POST',
    body: { email: 'admin@example.com', password: 'AdminPassword123!' }
  });
  if (adminOnOwnerRes.status !== 200 || adminOnOwnerRes.data.user.role !== 'SUPER_ADMIN') {
    throw new Error(`Admin on Owner Login failed: ${JSON.stringify(adminOnOwnerRes)}`);
  }
  const adminToken = adminOnOwnerRes.data.token;
  console.log('✓ 1.6: Super Admin credentials -> Salon Owner Login (200 OK, retained role=SUPER_ADMIN).');

  // 1.7: Invalid password -> REJECT (401)
  const badPassRes = await request('/auth/customer/login', {
    method: 'POST',
    body: { email: custEmail, password: 'WrongPassword123!' }
  });
  if (badPassRes.status !== 401) throw new Error(`Invalid password should be 401: ${badPassRes.status}`);
  console.log('✓ 1.7: Invalid password correctly rejected with 401 Unauthorized.');

  // ==========================================
  // SECTION 2: SALON APPROVAL & CUSTOMER DISCOVERY
  // ==========================================
  console.log('\n--- TEST GROUP 2: Salon Approval & Customer Discovery End-to-End ---');

  // Before approval: verify salon is NOT discoverable
  const unapprovedDisc = await request(`/salons?q=Pradeep's+Salon+${ts}`);
  if (unapprovedDisc.data.count > 0) {
    throw new Error('Unapproved salon should not appear in customer discovery');
  }
  console.log('✓ 2.1: Unapproved salon is correctly hidden from customer search.');

  // Super Admin approves "Pradeep's Salon"
  const approveRes = await request(`/admin/salons/${ownerSalonId}/approve`, {
    method: 'PATCH',
    token: adminToken
  });
  if (approveRes.status !== 200) {
    throw new Error(`Salon approval failed: ${JSON.stringify(approveRes.data)}`);
  }
  const approvedSalon = await Salon.findById(ownerSalonId).lean();
  if (approvedSalon?.status !== 'ACTIVE' || approvedSalon?.subscriptionStatus !== 'ACTIVE') {
    throw new Error(`Salon status (${approvedSalon?.status}) or subscriptionStatus (${approvedSalon?.subscriptionStatus}) not ACTIVE`);
  }
  console.log('✓ 2.2: Super Admin approved salon; status=ACTIVE & subscriptionStatus=ACTIVE.');

  // After approval: verify Pradeep's Salon appears in customer search
  const approvedSearch = await request(`/salons?q=Pradeep's+Salon+${ts}`);
  if (approvedSearch.status !== 200 || approvedSearch.data.count === 0) {
    throw new Error(`Approved salon not found in search: ${JSON.stringify(approvedSearch.data)}`);
  }
  console.log(`✓ 2.3: "Pradeep's Salon" is immediately discoverable in customer search (count: ${approvedSearch.data.count}).`);

  // Add services to Pradeep's Salon via /owner/salon
  await request('/owner/salon', {
    method: 'POST',
    token: ownerToken,
    body: {
      salonName: `Pradeep's Salon ${ts}`,
      description: 'Luxury grooming and couture styling.',
      phone: `+91 9840${String(ts).slice(-6)}`,
      email: ownerEmail,
      address: '10 Cantonment Road, Trichy',
      city: 'Tiruchirappalli',
      location: { latitude: 10.7905, longitude: 78.7047 },
      images: ['https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80'],
      services: [
        {
          name: 'Signature Haircut & Style',
          category: 'Hair',
          price: 650,
          durationMinutes: 45,
          description: 'Precision haircut with styling finish.'
        }
      ]
    }
  });
  console.log('✓ 2.4: Added service "Signature Haircut & Style" to Pradeep\'s Salon.');

  // ==========================================
  // SECTION 3: OFFER CREATION, DISCOVERY & DETAILS
  // ==========================================
  console.log('\n--- TEST GROUP 3: Promotional Offer Creation & Eligibility ---');

  const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(); // 10 days ahead
  const createOfferRes = await request('/owner/offers', {
    method: 'POST',
    token: ownerToken,
    body: {
      title: '20% OFF Haircut Special',
      description: 'Exclusive haircut privilege for new customers.',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      applicableService: 'Signature Haircut & Style',
      endDate: futureDate,
      isActive: true
    }
  });
  if (createOfferRes.status !== 201) {
    throw new Error(`Offer creation failed: ${JSON.stringify(createOfferRes.data)}`);
  }
  const activeOfferId = createOfferRes.data.offer._id;
  console.log(`✓ 3.1: Created promotional offer "${createOfferRes.data.offer.title}" (ID: ${activeOfferId}).`);

  // Verify offer is in customer discover offers
  const offersListRes = await request('/salons/offers');
  const foundActiveOffer = offersListRes.data.data.find((o: any) => o.id === activeOfferId || o._id === activeOfferId);
  if (!foundActiveOffer) {
    throw new Error(`Active offer not found in /salons/offers: ${JSON.stringify(offersListRes.data)}`);
  }
  console.log(`✓ 3.2: Offer "${foundActiveOffer.title}" is visible in customer /salons/offers.`);

  // Verify GET /offers/:id returns structured eligibility
  const offerDetailsRes = await request(`/offers/${activeOfferId}`);
  if (offerDetailsRes.status !== 200) {
    throw new Error(`GET /offers/${activeOfferId} failed: ${JSON.stringify(offerDetailsRes.data)}`);
  }
  const details = offerDetailsRes.data.data;
  if (!details.eligibility || !details.eligibility.canView || !details.eligibility.canBook || details.eligibility.reason !== null) {
    throw new Error(`Invalid eligibility on active offer: ${JSON.stringify(details.eligibility)}`);
  }
  if (details.isExpired !== false) throw new Error('Active offer should not be marked expired');
  console.log(`✓ 3.3: GET /offers/:id returned eligibility: canView=true, canBook=true, reason=null.`);

  // Verify Customer Notification was created with reliable offerId
  const notifRes = await request('/customer/notifications', { token: custToken });
  const offerNotif = notifRes.data.data.find((n: any) => n.type === 'OFFER_PUBLISHED');
  if (!offerNotif || !offerNotif.offerId) {
    throw new Error(`Customer notification missing or lacking offerId: ${JSON.stringify(notifRes.data)}`);
  }
  if (offerNotif.isOfferExpired !== false) {
    throw new Error('Active offer notification should not be flagged as expired');
  }
  console.log(`✓ 3.4: Customer notification verified with reliable offerId (${(offerNotif.offerId?._id || offerNotif.offerId)}) and isOfferExpired=false.`);

  // ==========================================
  // SECTION 4: AUTOMATIC OFFER EXPIRATION
  // ==========================================
  console.log('\n--- TEST GROUP 4: Automatic Offer Expiration & Booking Protection ---');

  // Create an expired offer (ended 2 hours ago)
  const pastStartDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const pastEndDate = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago
  const expiredOfferDoc = await SalonOffer.create({
    salonId: ownerSalonId,
    title: 'Flash Sale (Expired)',
    description: 'Expired haircut discount',
    discountType: 'PERCENTAGE',
    discountValue: 30,
    applicableService: 'Signature Haircut & Style',
    startDate: new Date(pastStartDate),
    endDate: new Date(pastEndDate),
    isActive: true,
    status: 'ACTIVE' // Active flag but past end date
  });
  const expiredOfferId = expiredOfferDoc._id.toString();
  console.log(`✓ 4.1: Created offer with past endDate (${expiredOfferId}).`);

  // Verify expired offer is NOT in customer /salons/offers
  const offersAfterExpiry = await request('/salons/offers');
  const foundExpiredInList = offersAfterExpiry.data.data.find((o: any) => o.id === expiredOfferId || o._id === expiredOfferId);
  if (foundExpiredInList) {
    throw new Error(`Expired offer should NOT appear in /salons/offers list!`);
  }
  console.log('✓ 4.2: Expired offer is automatically excluded from /salons/offers query.');

  // Verify GET /offers/:id on expired offer returns canBook: false and reason: OFFER_EXPIRED
  const expiredDetailsRes = await request(`/offers/${expiredOfferId}`);
  if (expiredDetailsRes.status !== 200) {
    throw new Error(`GET /offers/${expiredOfferId} should return 200 with eligibility payload: ${JSON.stringify(expiredDetailsRes.data)}`);
  }
  const expDetails = expiredDetailsRes.data.data;
  if (!expDetails.isExpired || expDetails.eligibility.canBook !== false || expDetails.eligibility.reason !== 'OFFER_EXPIRED') {
    throw new Error(`Expired offer did not return expected eligibility: ${JSON.stringify(expDetails.eligibility)}`);
  }
  console.log('✓ 4.3: GET /offers/:id on expired offer returns canBook=false, reason=OFFER_EXPIRED.');

  // Verify Booking API rejects expired offer
  const serviceDoc = await Salon.findById(ownerSalonId).select('services').lean();
  const serviceId = (serviceDoc?.services?.[0] as any)?._id?.toString() || 'Signature Haircut & Style';
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const bookingWithExpiredOffer = await request('/customer/appointments', {
    method: 'POST',
    token: custToken,
    body: {
      salonId: ownerSalonId,
      serviceId,
      offerId: expiredOfferId,
      appointmentDate: tomorrow,
      startTime: '11:00',
      customerNote: 'Booking with expired offer test'
    }
  });
  if (bookingWithExpiredOffer.status !== 400) {
    throw new Error(`Booking with expired offer should be 400: ${bookingWithExpiredOffer.status} ${JSON.stringify(bookingWithExpiredOffer.data)}`);
  }
  console.log(`✓ 4.4: Booking with expired offer rejected: 400 ("${bookingWithExpiredOffer.data.message}").`);

  // Verify booking with VALID offer succeeds
  const bookingWithValidOffer = await request('/customer/appointments', {
    method: 'POST',
    token: custToken,
    body: {
      salonId: ownerSalonId,
      serviceId,
      offerId: activeOfferId,
      appointmentDate: tomorrow,
      startTime: '14:00',
      customerNote: 'Booking with valid active offer'
    }
  });
  if (bookingWithValidOffer.status !== 201) {
    throw new Error(`Booking with valid offer failed: ${JSON.stringify(bookingWithValidOffer.data)}`);
  }
  console.log(`✓ 4.5: Booking with valid active offer succeeded (201 Created, total: ₹${bookingWithValidOffer.data.appointment.totalPrice}).`);

  // Verify Notifications list annotates expired offer
  // Create a notification referencing the expired offer
  const { Notification } = await import('./models/Notification.js');
  await Notification.create({
    recipientId: custReg.data.user.id,
    salonId: ownerSalonId,
    offerId: expiredOfferId,
    type: 'OFFER_PUBLISHED',
    title: 'Flash Sale (Expired)',
    message: 'Check out our flash sale'
  });

  const updatedNotifRes = await request('/customer/notifications', { token: custToken });
  const expiredNotif = updatedNotifRes.data.data.find((n: any) => (n.offerId?._id || n.offerId)?.toString() === expiredOfferId);
  if (!expiredNotif || expiredNotif.isOfferExpired !== true) {
    throw new Error(`Expired offer notification not marked isOfferExpired=true: ${JSON.stringify(expiredNotif)}`);
  }
  console.log('✓ 4.6: Notification for expired offer has isOfferExpired=true.');

  // ==========================================
  // SECTION 5: INACTIVE / UNAPPROVED SALON OFFER ELIGIBILITY
  // ==========================================
  console.log('\n--- TEST GROUP 5: Inactive / Pending Salon Offer Eligibility ---');

  const pendingOwnerEmail = `pending_owner_${ts}@test.com`;
  const pendingOwnerReg = await request('/auth/register/salon-owner', {
    method: 'POST',
    body: {
      name: `Pending Owner ${ts}`,
      email: pendingOwnerEmail,
      phone: `+91 9841${String(ts).slice(-6)}`,
      password: strongPassword,
      confirmPassword: strongPassword,
      salonName: `Unapproved Salon ${ts}`,
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      address: '100 Indiranagar, Bengaluru',
      identityProof: {
        url: 'https://docs.aureliabeaute.internal/secure/id-docs/sample_gst.pdf',
        filename: 'gst_pending.pdf',
        fileType: 'application/pdf',
        fileSize: 102400
      }
    }
  });
  const pendingSalonId = pendingOwnerReg.data.salon.id;
  const pendingOfferDoc = await SalonOffer.create({
    salonId: pendingSalonId,
    title: 'Pending Salon Offer',
    description: 'Offer from unapproved salon',
    discountType: 'PERCENTAGE',
    discountValue: 15,
    applicableService: 'ALL',
    startDate: new Date(),
    endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    isActive: true,
    status: 'ACTIVE'
  });
  const pendingOfferDetails = await request(`/offers/${pendingOfferDoc._id}`);
  if (
    pendingOfferDetails.status !== 200 ||
    pendingOfferDetails.data.data.eligibility.canBook !== false ||
    pendingOfferDetails.data.data.eligibility.reason !== 'SALON_NOT_APPROVED'
  ) {
    throw new Error(`Unapproved salon offer should return reason=SALON_NOT_APPROVED: ${JSON.stringify(pendingOfferDetails.data)}`);
  }
  console.log('✓ 5.1: Offer from unapproved salon returns canBook=false, reason=SALON_NOT_APPROVED.');

  console.log('\n========================================================================');
  console.log('   🎉 ALL PHASE 19 AUTH & OFFER LIFECYCLE TESTS PASSED (100%)           ');
  console.log('========================================================================\n');

  await mongoose.disconnect();
}

runPhase19Tests().catch((err) => {
  console.error('\n❌ PHASE 19 TEST FAILURE:', err);
  process.exit(1);
});
