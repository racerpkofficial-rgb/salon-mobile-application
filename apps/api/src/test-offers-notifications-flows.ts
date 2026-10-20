import mongoose from 'mongoose';
import { env } from './config/env.js';
import { Notification } from './models/Notification.js';
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

function getFutureDate(daysAhead: number = 3): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function run() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('========================================================================');
  console.log('   TESTING SALON OFFERS & FIREBASE PUSH NOTIFICATIONS SYSTEM            ');
  console.log('========================================================================\n');

  const ts = Date.now();
  const password = 'Password123!';

  // 1. Authenticate Super Admin
  console.log('1. Authenticating Super Admin...');
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: 'admin@example.com', password: 'AdminPassword123!' }
  });
  if (adminLogin.status !== 200) throw new Error('Admin login failed');
  const adminToken = adminLogin.data.token;
  console.log('   ✓ Super Admin authenticated.');

  // 2. Register Salon Owner & Create Salon
  console.log('\n2. Registering Salon Owner & Onboarding Salon...');
  const ownerReg = await request('/auth/register/salon-owner', {
    method: 'POST',
    body: {
      name: 'Owner Glow',
      email: `glow_${ts}@test.com`,
      phone: '+91 98888 77777',
      password,
      confirmPassword: password,
      salonName: `Glow Beauty Sanctuary ${ts}`,
      address: '22 Indiranagar 12th Main',
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

  const salonRes = await request('/owner/salon', {
    method: 'POST',
    body: {
      salonName: `Glow Beauty Sanctuary ${ts}`,
      description: 'Artisanal hair rituals and radiant aesthetics sanctuary',
      phone: '+91 98888 77777',
      email: `glow_${ts}@test.com`,
      address: '88 Jubilee Hills Road',
      city: 'Hyderabad',
      location: { latitude: 17.43, longitude: 78.41 },
      services: [
        {
          name: 'Hair Spa & Cut Ritual',
          price: 1500,
          duration: '45 mins',
          durationMinutes: 45,
          category: 'Hair'
        },
        {
          name: 'Radiance Illuminating Facial',
          price: 2500,
          duration: '60 mins',
          durationMinutes: 60,
          category: 'Skin'
        }
      ]
    },
    token: ownerToken
  });
  if (salonRes.status !== 201 && salonRes.status !== 200) throw new Error('Salon creation failed');
  const salonId = salonRes.data.salon._id;
  console.log(`   ✓ Salon created: ${salonRes.data.salon.salonName} (ID: ${salonId})`);

  // 3. Subscription Payment & Verification of Trigger 6: SUBSCRIPTION_STATUS
  console.log('\n3. Processing Mock Subscription Payment & Testing Trigger 6 (SUBSCRIPTION_STATUS)...');
  const checkoutRes = await request('/owner/subscription/mock-checkout', {
    method: 'POST',
    body: {
      plan: 'BUSINESS',
      billingCycle: 'MONTHLY',
      paymentMethod: 'UPI'
    },
    token: ownerToken
  });
  if (checkoutRes.status !== 200) throw new Error('Subscription checkout failed');

  // Verify SUBSCRIPTION_STATUS notification stored in MongoDB for Salon Owner
  const subNotif = await Notification.findOne({
    recipientId: ownerId,
    type: 'SUBSCRIPTION_STATUS'
  });
  if (!subNotif) throw new Error('Trigger 6 Failed: SUBSCRIPTION_STATUS notification not found for owner');
  console.log(`   ✓ Trigger 6 Verified: Owner received SUBSCRIPTION_STATUS notification ("${subNotif.title}")`);

  // 4. Admin Approves Salon & Verification of Trigger 7: SALON_APPROVED
  console.log('\n4. Admin Approving Salon & Testing Trigger 7 (SALON_APPROVED)...');
  const approveRes = await request(`/admin/salons/${salonId}/approve`, {
    method: 'PATCH',
    token: adminToken
  });
  if (approveRes.status !== 200) throw new Error('Admin salon approval failed');

  // Verify SALON_APPROVED notification stored in MongoDB for Salon Owner
  const approvedNotif = await Notification.findOne({
    recipientId: ownerId,
    type: 'SALON_APPROVED'
  });
  if (!approvedNotif) throw new Error('Trigger 7 Failed: SALON_APPROVED notification not found for owner');
  console.log(`   ✓ Trigger 7 Verified: Owner received SALON_APPROVED notification ("${approvedNotif.title}")`);

  // Fetch synced services
  const servRes = await request(`/salons/${salonId}/services`);
  const services = servRes.data.data;
  const hairService = services?.find((s: any) => s.name === 'Hair Spa & Cut Ritual');
  const hairServiceId = hairService?._id;

  // 5. Register Customer & Device Push Token
  console.log('\n5. Registering Customer & Device FCM Push Token...');
  const custReg = await request('/auth/register/customer', {
    method: 'POST',
    body: { name: 'Customer Sophia', email: `sophia_${ts}@test.com`, password }
  });
  if (custReg.status !== 201) throw new Error('Customer registration failed');
  const custToken = custReg.data.token;
  const custId = custReg.data.user.id;

  const fcmDeviceToken = `fcm_device_token_mock_${ts}_xyz`;
  const regFcmRes = await request('/notifications/fcm-token', {
    method: 'POST',
    body: { token: fcmDeviceToken },
    token: custToken
  });
  if (regFcmRes.status !== 200) throw new Error('Failed to register FCM token');

  // Verify user document has token
  const custUser = await User.findById(custId);
  if (!custUser?.fcmTokens?.includes(fcmDeviceToken)) {
    throw new Error('FCM token was not persisted to User in MongoDB');
  }
  console.log('   ✓ Customer registered and FCM token persisted in MongoDB.');

  // 6. Salon Owner Creates Offer (Trigger 5: OFFER_PUBLISHED Push Broadcast)
  console.log('\n6. Owner Creating Promotional Offer & Broadcasting Push Notification (Trigger 5)...');
  const validUntilStr = getFutureDate(14);
  const offerRes = await request('/owner/offers', {
    method: 'POST',
    body: {
      title: '20% OFF Hair Services',
      description: 'Luxury botanical deep conditioning and signature finish.',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      applicableService: hairServiceId,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 14 * 86400000).toISOString(),
      image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80',
      isActive: true
    },
    token: ownerToken
  });
  if (offerRes.status !== 201) throw new Error(`Offer creation failed: ${JSON.stringify(offerRes.data)}`);
  const offerId = offerRes.data.offer._id;
  console.log(`   ✓ Offer created: "${offerRes.data.offer.title}" (ID: ${offerId})`);

  // Verify push notification broadcast persisted to MongoDB for Customer
  const offerNotif = await Notification.findOne({
    recipientId: custId,
    type: 'OFFER_PUBLISHED',
    offerId
  });
  if (!offerNotif) throw new Error('Trigger 5 Failed: OFFER_PUBLISHED notification not found in customer inbox');
  console.log(`   ✓ Trigger 5 Verified: Customer received push notification:`);
  console.log(`     Title: "${offerNotif.title}"`);
  console.log(`     Message:\n${offerNotif.message.split('\n').map((l) => '       ' + l).join('\n')}`);
  console.log(`     Payload Data: screen="${offerNotif.data?.screen}", salonId="${offerNotif.data?.salonId}"`);

  if ((offerNotif.data?.screen !== 'OfferDetails' && offerNotif.data?.screen !== 'SalonDetails') || offerNotif.data?.salonId !== salonId.toString()) {
    throw new Error('Deep link data payload incorrect in offer notification');
  }

  // 7. Customer Views Notification Inbox & History from MongoDB
  console.log('\n7. Customer Fetching Notifications History & Marking Read...');
  const notifHistory = await request('/customer/notifications', { token: custToken });
  if (notifHistory.status !== 200) throw new Error('Customer notifications fetch failed');
  if (notifHistory.data.count < 1) throw new Error('Customer notification inbox is empty');
  console.log(`   ✓ In-app Notification History retrieved (${notifHistory.data.count} items, ${notifHistory.data.unreadCount} unread)`);

  // Mark single notification as read
  const markReadRes = await request(`/customer/notifications/${offerNotif._id}/read`, {
    method: 'PATCH',
    token: custToken
  });
  if (markReadRes.status !== 200) throw new Error('Mark notification read failed');
  if (!markReadRes.data.notification.isRead) throw new Error('Notification isRead was not updated to true');
  console.log('   ✓ Notification marked as read.');

  // Mark all read
  const markAllRes = await request('/customer/notifications/mark-all-read', {
    method: 'PATCH',
    token: custToken
  });
  if (markAllRes.status !== 200) throw new Error('Mark all read failed');
  console.log('   ✓ All notifications marked as read.');

  // 8. Salon Owner Edits Offer
  console.log('\n8. Salon Owner Editing Offer Details...');
  const editOfferRes = await request(`/owner/offers/${offerId}`, {
    method: 'PUT',
    body: {
      title: '25% OFF Festive Hair Care',
      description: 'Updated deluxe treatment terms with organic gloss serum.',
      discountType: 'PERCENTAGE',
      discountValue: 25,
      applicableService: hairServiceId,
      endDate: new Date(Date.now() + 20 * 86400000).toISOString(),
      isActive: true
    },
    token: ownerToken
  });
  if (editOfferRes.status !== 200) throw new Error('Edit offer failed');
  if (editOfferRes.data.offer.title !== '25% OFF Festive Hair Care' || editOfferRes.data.offer.discountValue !== 25) {
    throw new Error('Offer fields were not updated correctly');
  }
  console.log(`   ✓ Offer successfully updated to: "${editOfferRes.data.offer.title}" (${editOfferRes.data.offer.discountValue}% OFF)`);

  // 9. Salon Owner Toggles Offer (Activate / Deactivate)
  console.log('\n9. Salon Owner Activating / Deactivating Offer...');
  const toggleOffRes = await request(`/owner/offers/${offerId}/toggle`, {
    method: 'PATCH',
    token: ownerToken
  });
  if (toggleOffRes.status !== 200) throw new Error('Offer toggle failed');
  if (toggleOffRes.data.offer.isActive !== false) throw new Error('Offer was not deactivated');
  console.log('   ✓ Offer deactivated.');

  // Check public endpoint does not show deactivated offer
  const publicOffers1 = await request(`/salons/${salonId}/offers`);
  if (publicOffers1.data.count !== 0) throw new Error('Deactivated offer should not be visible to public');
  console.log('   ✓ Deactivated offer excluded from public/customer offers.');

  // Toggle back to active
  const toggleOnRes = await request(`/owner/offers/${offerId}/toggle`, {
    method: 'PATCH',
    token: ownerToken
  });
  if (toggleOnRes.data.offer.isActive !== true) throw new Error('Offer was not reactivated');

  const publicOffers2 = await request(`/salons/${salonId}/offers`);
  if (publicOffers2.data.count !== 1) throw new Error('Reactivated offer should be visible to public');
  console.log('   ✓ Offer reactivated and visible in public customer API.');

  // 10. Test Trigger 1: BOOKING_REQUEST_SENT (Customer Books Slot -> Owner Notified)
  console.log('\n10. Customer Booking Appointment & Testing Trigger 1 (BOOKING_REQUEST_SENT)...');
  const bookDate = getFutureDate(4);
  const bookRes = await request('/customer/appointments', {
    method: 'POST',
    body: {
      salonId,
      serviceId: hairServiceId,
      appointmentDate: bookDate,
      startTime: '11:00',
      customerNote: 'First time visiting, excited for hair treatment!'
    },
    token: custToken
  });
  if (bookRes.status !== 201) throw new Error(`Booking failed: ${JSON.stringify(bookRes.data)}`);
  const appointmentId = bookRes.data.appointment._id;

  // Check owner received BOOKING_REQUEST_SENT notification in MongoDB
  const requestSentNotif = await Notification.findOne({
    recipientId: ownerId,
    type: 'BOOKING_REQUEST_SENT',
    appointmentId
  });
  if (!requestSentNotif) throw new Error('Trigger 1 Failed: BOOKING_REQUEST_SENT notification not found for owner');
  console.log(`   ✓ Trigger 1 Verified: Salon Owner received BOOKING_REQUEST_SENT notification ("${requestSentNotif.title}")`);

  // 11. Test Trigger 2: BOOKING_ACCEPTED (Owner Accepts -> Customer Notified)
  console.log('\n11. Salon Owner Accepting Appointment & Testing Trigger 2 (BOOKING_ACCEPTED)...');
  const acceptRes = await request(`/owner/appointments/${appointmentId}/accept`, {
    method: 'PATCH',
    token: ownerToken
  });
  if (acceptRes.status !== 200) throw new Error('Appointment acceptance failed');

  // Check customer received BOOKING_ACCEPTED notification in MongoDB
  const acceptedNotif = await Notification.findOne({
    recipientId: custId,
    type: 'BOOKING_ACCEPTED',
    appointmentId
  });
  if (!acceptedNotif) throw new Error('Trigger 2 Failed: BOOKING_ACCEPTED notification not found for customer');
  console.log(`   ✓ Trigger 2 Verified: Customer received BOOKING_ACCEPTED notification ("${acceptedNotif.title}")`);

  // 12. Test Trigger 4: APPOINTMENT_REMINDER (Owner Reminds -> Customer Notified)
  console.log('\n12. Triggering Appointment Reminder & Testing Trigger 4 (APPOINTMENT_REMINDER)...');
  const remindRes = await request(`/owner/appointments/${appointmentId}/remind`, {
    method: 'POST',
    token: ownerToken
  });
  if (remindRes.status !== 200) throw new Error('Reminder send failed');

  const reminderNotif = await Notification.findOne({
    recipientId: custId,
    type: 'APPOINTMENT_REMINDER',
    appointmentId
  });
  if (!reminderNotif) throw new Error('Trigger 4 Failed: APPOINTMENT_REMINDER notification not found for customer');
  console.log(`   ✓ Trigger 4 Verified: Customer received APPOINTMENT_REMINDER ("${reminderNotif.title}")`);

  // 13. Test Trigger 3: BOOKING_REJECTED (Customer Books -> Owner Declines -> Customer Notified)
  console.log('\n13. Testing Decline Flow & Trigger 3 (BOOKING_REJECTED)...');
  const bookRes2 = await request('/customer/appointments', {
    method: 'POST',
    body: {
      salonId,
      serviceId: hairServiceId,
      appointmentDate: bookDate,
      startTime: '14:00',
      customerNote: 'Afternoon slot'
    },
    token: custToken
  });
  if (bookRes2.status !== 201) throw new Error('Second booking failed');
  const appointmentId2 = bookRes2.data.appointment._id;

  const rejectRes = await request(`/owner/appointments/${appointmentId2}/reject`, {
    method: 'PATCH',
    body: { reason: 'Stylist attending specialist masterclass' },
    token: ownerToken
  });
  if (rejectRes.status !== 200) throw new Error('Appointment rejection failed');

  const rejectedNotif = await Notification.findOne({
    recipientId: custId,
    type: 'BOOKING_REJECTED',
    appointmentId: appointmentId2
  });
  if (!rejectedNotif) throw new Error('Trigger 3 Failed: BOOKING_REJECTED notification not found for customer');
  console.log(`   ✓ Trigger 3 Verified: Customer received BOOKING_REJECTED notification ("${rejectedNotif.title}")`);

  // 14. Unregister FCM Token
  console.log('\n14. Unregistering Device Push Token...');
  const unregRes = await request('/notifications/fcm-token', {
    method: 'DELETE',
    body: { token: fcmDeviceToken },
    token: custToken
  });
  if (unregRes.status !== 200) throw new Error('FCM unregister failed');

  const custUserAfter = await User.findById(custId);
  if (custUserAfter?.fcmTokens?.includes(fcmDeviceToken)) {
    throw new Error('FCM token was not removed from User');
  }
  console.log('   ✓ Device token unregistered.');

  // 15. Delete Offer
  console.log('\n15. Owner Deleting Offer...');
  const deleteRes = await request(`/owner/offers/${offerId}`, {
    method: 'DELETE',
    token: ownerToken
  });
  if (deleteRes.status !== 200) throw new Error('Delete offer failed');

  const offerAfter = await SalonOffer.findById(offerId);
  if (offerAfter) throw new Error('Offer was not deleted from database');
  console.log('   ✓ Offer deleted from database.');

  console.log('\n========================================================================');
  console.log('   ALL 7 NOTIFICATION TRIGGERS & SALON OFFERS TESTS PASSED (100%)       ');
  console.log('========================================================================');

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error('\n❌ TEST RUNNER FAILED:', err);
  await mongoose.disconnect();
  process.exit(1);
});
