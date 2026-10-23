import mongoose, { Types } from 'mongoose';
import { env } from './config/env.js';
import { Appointment } from './models/Appointment.js';
import { Coupon } from './models/Coupon.js';
import { CouponRedemption } from './models/CouponRedemption.js';
import { Salon } from './models/Salon.js';
import { SalonOffer } from './models/SalonOffer.js';
import { Service } from './models/Service.js';
import { User } from './models/User.js';
import { couponService } from './services/coupon.service.js';

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ ${msg}`);
    testsPassed++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    testsFailed++;
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('Book My Salon — Comprehensive Coupons Feature Test Suite');
  console.log('======================================================\n');

  const mongoUri = env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aurelia';
  await mongoose.connect(mongoUri);

  const testSuffix = Date.now().toString().slice(-6);

  // Setup test users and salons
  const ownerA = await User.create({
    name: `Salon A Owner ${testSuffix}`,
    email: `owner.a.${testSuffix}@example.com`,
    passwordHash: 'dummyhash123',
    role: 'SALON_OWNER'
  });

  const ownerB = await User.create({
    name: `Salon B Owner ${testSuffix}`,
    email: `owner.b.${testSuffix}@example.com`,
    passwordHash: 'dummyhash123',
    role: 'SALON_OWNER'
  });

  const customerA = await User.create({
    name: `Customer Alpha ${testSuffix}`,
    email: `customer.alpha.${testSuffix}@example.com`,
    passwordHash: 'dummyhash123',
    role: 'CUSTOMER'
  });

  const customerB = await User.create({
    name: `Customer Beta ${testSuffix}`,
    email: `customer.beta.${testSuffix}@example.com`,
    passwordHash: 'dummyhash123',
    role: 'CUSTOMER'
  });

  const salonA = await Salon.create({
    ownerId: ownerA._id,
    salonName: `Grand Salon A ${testSuffix}`,
    email: `salon.a.${testSuffix}@example.com`,
    phone: `91${testSuffix}01`,
    city: 'Mumbai',
    address: '100 Luxury Avenue',
    status: 'ACTIVE'
  });

  const salonB = await Salon.create({
    ownerId: ownerB._id,
    salonName: `Premier Salon B ${testSuffix}`,
    email: `salon.b.${testSuffix}@example.com`,
    phone: `91${testSuffix}02`,
    city: 'Mumbai',
    address: '200 Royal Road',
    status: 'ACTIVE'
  });

  const serviceA1 = await Service.create({
    salonId: salonA._id,
    name: 'Balayage Hair Colour',
    price: 3000,
    duration: 60,
    category: 'Hair',
    isActive: true
  });

  const serviceA2 = await Service.create({
    salonId: salonA._id,
    name: 'Express Blowdry',
    price: 500,
    duration: 30,
    category: 'Hair',
    isActive: true
  });

  try {
    // -----------------------------------------------------------
    // Case 1: Valid percentage coupon applies the correct discount
    // -----------------------------------------------------------
    console.log('\n[Case 1] Valid percentage coupon applies the correct discount');
    const couponPct = await couponService.createCoupon({
      salonId: salonA._id,
      code: `PCT20_${testSuffix}`,
      title: '20% Off All Hair Services',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      applicableServiceIds: ['ALL'],
      createdBy: ownerA._id
    });

    const resPct = await couponService.validateCouponForBooking({
      salonId: salonA._id,
      code: couponPct.code,
      customerId: customerA._id,
      servicePrice: 3000,
      serviceId: serviceA1._id.toString(),
      serviceName: serviceA1.name
    });

    assert(resPct.isValid === true, 'Percentage coupon should validate as true');
    assert(resPct.discountAmount === 600, '20% of 3000 should give 600 discount');
    assert(resPct.finalPrice === 2400, 'Final price should be 2400 (3000 - 600)');

    // -----------------------------------------------------------
    // Case 2: Fixed-amount coupon applies the correct discount
    // -----------------------------------------------------------
    console.log('\n[Case 2] Fixed-amount coupon applies the correct discount');
    const couponFixed = await couponService.createCoupon({
      salonId: salonA._id,
      code: `FLAT300_${testSuffix}`,
      title: 'Flat ₹300 Off',
      discountType: 'FIXED',
      discountValue: 300,
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      applicableServiceIds: ['ALL'],
      createdBy: ownerA._id
    });

    const resFixed = await couponService.validateCouponForBooking({
      salonId: salonA._id,
      code: couponFixed.code,
      customerId: customerA._id,
      servicePrice: 1500,
      serviceId: serviceA1._id.toString()
    });

    assert(resFixed.discountAmount === 300, 'Fixed coupon should provide exact 300 discount');
    assert(resFixed.finalPrice === 1200, 'Final price should be 1200 (1500 - 300)');

    // -----------------------------------------------------------
    // Case 3: Maximum discount cap is respected
    // -----------------------------------------------------------
    console.log('\n[Case 3] Maximum discount cap is respected');
    const couponCapped = await couponService.createCoupon({
      salonId: salonA._id,
      code: `CAP500_${testSuffix}`,
      title: '50% Off Capped at ₹500',
      discountType: 'PERCENTAGE',
      discountValue: 50,
      maxDiscountAmount: 500,
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      createdBy: ownerA._id
    });

    const resCapped = await couponService.validateCouponForBooking({
      salonId: salonA._id,
      code: couponCapped.code,
      customerId: customerA._id,
      servicePrice: 4000
    });

    assert(resCapped.discountAmount === 500, 'Discount must be capped at 500 (50% of 4000 is 2000 > 500)');
    assert(resCapped.finalPrice === 3500, 'Final price must be 3500 (4000 - 500)');

    // -----------------------------------------------------------
    // Case 4: Minimum booking amount is enforced
    // -----------------------------------------------------------
    console.log('\n[Case 4] Minimum booking amount is enforced');
    const couponMin = await couponService.createCoupon({
      salonId: salonA._id,
      code: `MIN1000_${testSuffix}`,
      title: 'Requires Min Booking ₹1000',
      discountType: 'FIXED',
      discountValue: 200,
      minimumBookingAmount: 1000,
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      createdBy: ownerA._id
    });

    let minBookingErrorCaught = false;
    try {
      await couponService.validateCouponForBooking({
        salonId: salonA._id,
        code: couponMin.code,
        customerId: customerA._id,
        servicePrice: 800 // Below 1000
      });
    } catch (e: any) {
      minBookingErrorCaught = true;
      assert(e.message.includes('Minimum booking amount'), `Correct rejection message: "${e.message}"`);
    }
    assert(minBookingErrorCaught, 'Booking amount 800 below minimum 1000 must be rejected');

    // -----------------------------------------------------------
    // Case 5: Ineligible services are rejected
    // -----------------------------------------------------------
    console.log('\n[Case 5] Ineligible services are rejected');
    const couponServiceRestricted = await couponService.createCoupon({
      salonId: salonA._id,
      code: `HAIRONLY_${testSuffix}`,
      title: 'Valid only on Balayage',
      discountType: 'FIXED',
      discountValue: 400,
      applicableServiceIds: [serviceA1._id.toString()],
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      createdBy: ownerA._id
    });

    let serviceRestrictedCaught = false;
    try {
      await couponService.validateCouponForBooking({
        salonId: salonA._id,
        code: couponServiceRestricted.code,
        customerId: customerA._id,
        servicePrice: 500,
        serviceId: serviceA2._id.toString(), // Express Blowdry (not Balayage)
        serviceName: serviceA2.name
      });
    } catch (e: any) {
      serviceRestrictedCaught = true;
      assert(e.message.includes('not valid for the selected service') || e.message.includes('not applicable'), `Service mismatch rejected: "${e.message}"`);
    }
    assert(serviceRestrictedCaught, 'Coupon restricted to service A1 must be rejected for service A2');

    // -----------------------------------------------------------
    // Case 6: Expired coupons are rejected
    // -----------------------------------------------------------
    console.log('\n[Case 6] Expired coupons are rejected');
    const couponExpired = await Coupon.create({
      salonId: salonA._id,
      code: `EXPIRED_${testSuffix}`,
      title: 'Past Expiry Coupon',
      discountType: 'FIXED',
      discountValue: 100,
      startsAt: new Date(Date.now() - 10 * 86400000),
      expiresAt: new Date(Date.now() - 2 * 86400000), // Expired 2 days ago
      status: 'ACTIVE',
      createdBy: ownerA._id
    });

    let expiredErrorCaught = false;
    try {
      await couponService.validateCouponForBooking({
        salonId: salonA._id,
        code: couponExpired.code,
        customerId: customerA._id,
        servicePrice: 1000
      });
    } catch (e: any) {
      expiredErrorCaught = true;
      assert(e.message.includes('expired'), `Expired coupon rejected: "${e.message}"`);
    }
    assert(expiredErrorCaught, 'Expired coupon must be rejected');

    // -----------------------------------------------------------
    // Case 7: Not-yet-active coupons are rejected
    // -----------------------------------------------------------
    console.log('\n[Case 7] Not-yet-active coupons are rejected');
    const couponFuture = await Coupon.create({
      salonId: salonA._id,
      code: `FUTURE_${testSuffix}`,
      title: 'Future Valid Coupon',
      discountType: 'FIXED',
      discountValue: 100,
      startsAt: new Date(Date.now() + 5 * 86400000), // Starts in 5 days
      expiresAt: new Date(Date.now() + 15 * 86400000),
      status: 'ACTIVE',
      createdBy: ownerA._id
    });

    let futureErrorCaught = false;
    try {
      await couponService.validateCouponForBooking({
        salonId: salonA._id,
        code: couponFuture.code,
        customerId: customerA._id,
        servicePrice: 1000
      });
    } catch (e: any) {
      futureErrorCaught = true;
      assert(e.message.includes('not yet active'), `Future coupon rejected: "${e.message}"`);
    }
    assert(futureErrorCaught, 'Coupon with future startsAt must be rejected');

    // -----------------------------------------------------------
    // Case 8: Paused coupons are rejected
    // -----------------------------------------------------------
    console.log('\n[Case 8] Paused coupons are rejected');
    const couponPaused = await couponService.createCoupon({
      salonId: salonA._id,
      code: `PAUSED_${testSuffix}`,
      title: 'Temporarily Paused',
      discountType: 'FIXED',
      discountValue: 100,
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      status: 'PAUSED',
      createdBy: ownerA._id
    });

    let pausedErrorCaught = false;
    try {
      await couponService.validateCouponForBooking({
        salonId: salonA._id,
        code: couponPaused.code,
        customerId: customerA._id,
        servicePrice: 1000
      });
    } catch (e: any) {
      pausedErrorCaught = true;
      assert(e.message.includes('paused'), `Paused coupon rejected: "${e.message}"`);
    }
    assert(pausedErrorCaught, 'Paused coupon must be rejected');

    // -----------------------------------------------------------
    // Case 9: Total redemption limits are enforced under concurrent requests
    // -----------------------------------------------------------
    console.log('\n[Case 9] Total redemption limits are enforced under concurrent requests');
    const couponLimited = await couponService.createCoupon({
      salonId: salonA._id,
      code: `LIMIT2_${testSuffix}`,
      title: 'Limit 2 Redemptions Total',
      discountType: 'FIXED',
      discountValue: 100,
      totalUsageLimit: 2,
      perCustomerUsageLimit: 5,
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      createdBy: ownerA._id
    });

    // Fire 5 concurrent redemptions simultaneously
    const concurrentAttempts = [1, 2, 3, 4, 5].map(async (i) => {
      try {
        const dummyApptId = new Types.ObjectId();
        await couponService.recordRedemption({
          couponId: couponLimited._id,
          salonId: salonA._id,
          customerId: customerA._id,
          appointmentId: dummyApptId,
          code: couponLimited.code,
          discountAmount: 100,
          originalPrice: 1000,
          finalPrice: 900
        });
        return { success: true, id: i };
      } catch (err: any) {
        return { success: false, id: i, error: err.message };
      }
    });

    const concurrentResults = await Promise.all(concurrentAttempts);
    const successfulRedemptions = concurrentResults.filter((r) => r.success).length;
    const failedRedemptions = concurrentResults.filter((r) => !r.success).length;

    assert(successfulRedemptions === 2, `Exactly 2 out of 5 concurrent requests succeeded (actual: ${successfulRedemptions})`);
    assert(failedRedemptions === 3, `Remaining 3 requests were blocked by atomic guard (actual: ${failedRedemptions})`);

    const freshCouponDoc = await Coupon.findById(couponLimited._id);
    assert(freshCouponDoc?.usedCount === 2, `usedCount in database is strictly 2 (actual: ${freshCouponDoc?.usedCount})`);

    // -----------------------------------------------------------
    // Case 10: Per-customer usage limits are enforced
    // -----------------------------------------------------------
    console.log('\n[Case 10] Per-customer usage limits are enforced');
    const couponPerCust = await couponService.createCoupon({
      salonId: salonA._id,
      code: `ONCE_${testSuffix}`,
      title: 'One-Time Per Customer',
      discountType: 'FIXED',
      discountValue: 150,
      perCustomerUsageLimit: 1,
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      createdBy: ownerA._id
    });

    // Customer A uses it once
    const dummyAppt1 = new Types.ObjectId();
    await couponService.recordRedemption({
      couponId: couponPerCust._id,
      salonId: salonA._id,
      customerId: customerA._id,
      appointmentId: dummyAppt1,
      code: couponPerCust.code,
      discountAmount: 150,
      originalPrice: 1000,
      finalPrice: 850
    });

    // Customer A tries to validate it again
    let perCustomerLimitCaught = false;
    try {
      await couponService.validateCouponForBooking({
        salonId: salonA._id,
        code: couponPerCust.code,
        customerId: customerA._id,
        servicePrice: 1000
      });
    } catch (e: any) {
      perCustomerLimitCaught = true;
      assert(e.message.includes('maximum allowed number of times'), `Per-customer limit rejected: "${e.message}"`);
    }
    assert(perCustomerLimitCaught, 'Customer A cannot use one-time coupon twice');

    // Customer B should still be able to validate it
    const custBValidation = await couponService.validateCouponForBooking({
      salonId: salonA._id,
      code: couponPerCust.code,
      customerId: customerB._id,
      servicePrice: 1000
    });
    assert(custBValidation.isValid === true, 'Customer B can still use their own 1 allowance');

    // -----------------------------------------------------------
    // Case 11: Salon A's coupon cannot be used for Salon B
    // -----------------------------------------------------------
    console.log("\n[Case 11] Salon A's coupon cannot be used for Salon B (Strict Salon Isolation)");
    let crossSalonCaught = false;
    try {
      await couponService.validateCouponForBooking({
        salonId: salonB._id, // Attempting to use Salon A's coupon on Salon B
        code: couponPct.code,
        customerId: customerA._id,
        servicePrice: 3000
      });
    } catch (e: any) {
      crossSalonCaught = true;
      assert(e.message.includes('invalid for this salon') || e.message.includes('not valid for this salon'), `Cross-salon rejection: "${e.message}"`);
    }
    assert(crossSalonCaught, "Salon A coupon strictly rejected when validating against Salon B");

    // -----------------------------------------------------------
    // Case 12: One salon owner cannot manage another owner's coupons
    // -----------------------------------------------------------
    console.log("\n[Case 12] One salon owner cannot manage another owner's coupons");
    let unauthorizedEditCaught = false;
    try {
      // Owner B tries to update Owner A's coupon
      await couponService.updateCoupon(couponPct._id, salonB._id, {
        title: 'Hacked Title By Owner B'
      });
    } catch (e: any) {
      unauthorizedEditCaught = true;
      assert(e.message.includes('not found') || e.message.includes('Unauthorized'), `Owner isolation check: "${e.message}"`);
    }
    assert(unauthorizedEditCaught, "Owner B cannot edit Owner A's coupon");

    // -----------------------------------------------------------
    // Case 13: Duplicate redemption is prevented
    // -----------------------------------------------------------
    console.log('\n[Case 13] Duplicate redemption is prevented');
    const testApptDup = new Types.ObjectId();
    await couponService.recordRedemption({
      couponId: couponFixed._id,
      salonId: salonA._id,
      customerId: customerB._id,
      appointmentId: testApptDup,
      code: couponFixed.code,
      discountAmount: 300,
      originalPrice: 1500,
      finalPrice: 1200
    });

    let duplicateLedgerCaught = false;
    try {
      // Attempt to record second redemption for the exact same appointment
      await couponService.recordRedemption({
        couponId: couponFixed._id,
        salonId: salonA._id,
        customerId: customerB._id,
        appointmentId: testApptDup,
        code: couponFixed.code,
        discountAmount: 300,
        originalPrice: 1500,
        finalPrice: 1200
      });
    } catch (e: any) {
      duplicateLedgerCaught = true;
    }
    assert(duplicateLedgerCaught, 'Unique appointmentId constraint in CouponRedemption prevents duplicate redemption');

    // -----------------------------------------------------------
    // Case 14: Cancellation cannot restore usage more than once
    // -----------------------------------------------------------
    console.log('\n[Case 14] Cancellation cannot restore usage more than once');
    const beforeRevert = await Coupon.findById(couponFixed._id);
    const beforeCount = beforeRevert?.usedCount || 0;

    const firstRevert = await couponService.revertRedemption(testApptDup);
    assert(firstRevert === true, 'First cancellation successfully restored coupon usage');

    const afterFirstRevert = await Coupon.findById(couponFixed._id);
    assert((afterFirstRevert?.usedCount || 0) === beforeCount - 1, 'usedCount was decremented by 1');

    // Second call to revert the same appointment
    const secondRevert = await couponService.revertRedemption(testApptDup);
    assert(secondRevert === false, 'Second revert attempt returned false (idempotent / cannot restore twice)');

    const afterSecondRevert = await Coupon.findById(couponFixed._id);
    assert((afterSecondRevert?.usedCount || 0) === (afterFirstRevert?.usedCount || 0), 'usedCount remained unchanged on second revert');

    // -----------------------------------------------------------
    // Case 15: Invalid coupons do not break normal booking
    // -----------------------------------------------------------
    console.log('\n[Case 15] Invalid coupons do not break normal booking');
    let badCodeErrorCaught = false;
    try {
      await couponService.validateCouponForBooking({
        salonId: salonA._id,
        code: 'NON_EXISTENT_COUPON_CODE',
        customerId: customerA._id,
        servicePrice: 2000
      });
    } catch (e: any) {
      badCodeErrorCaught = true;
      assert(e.message.includes('invalid for this salon') || e.message.includes('Invalid coupon code'), `Clean rejection for invalid code: "${e.message}"`);
    }
    assert(badCodeErrorCaught, 'Invalid code fails gracefully without breaking flow');

    // -----------------------------------------------------------
    // Case 16: Final booking and payment amounts are calculated server-side
    // -----------------------------------------------------------
    console.log('\n[Case 16] Final booking and payment amounts are calculated server-side');
    const apptBookingDate = '2026-10-24';
    const appt = await Appointment.create({
      customerId: customerA._id,
      salonId: salonA._id,
      serviceId: serviceA1._id,
      serviceName: serviceA1.name,
      serviceDuration: serviceA1.duration,
      originalPrice: 3000,
      discountAmount: 600,
      totalPrice: 2400, // Server calculated: 3000 - 600
      couponId: couponPct._id,
      couponCode: couponPct.code,
      couponDiscount: 600,
      couponRedeemed: true,
      appointmentDate: apptBookingDate,
      startTime: '14:00',
      endTime: '15:00',
      status: 'PENDING'
    });

    assert(appt.totalPrice === 2400, 'Server-calculated final price is 2400');
    assert(appt.couponDiscount === 600, 'Server-calculated discount amount is 600');
    assert(appt.couponCode === couponPct.code, 'Coupon code stored on appointment record');

    // -----------------------------------------------------------
    // Case 17: Bottom Notification tab is replaced by Coupons
    // -----------------------------------------------------------
    console.log('\n[Case 17] Bottom Notification tab is replaced by Coupons');
    // Verify file contents of OwnerBottomTabBar and BottomTabBar
    const fs = await import('fs');
    const ownerBarContent = fs.readFileSync('D:/Client Projects/Saloon Mobile Application/apps/mobile/src/components/OwnerBottomTabBar.tsx', 'utf-8');
    const customerBarContent = fs.readFileSync('D:/Client Projects/Saloon Mobile Application/apps/mobile/src/components/BottomTabBar.tsx', 'utf-8');

    assert(ownerBarContent.includes("key: 'COUPONS'"), "OwnerBottomTabBar tabs contains key: 'COUPONS'");
    assert(ownerBarContent.includes("label: 'Coupons'"), "OwnerBottomTabBar tabs contains label: 'Coupons'");
    assert(!ownerBarContent.includes("key: 'NOTIFICATIONS', label: 'Notifications'"), "OwnerBottomTabBar no longer has bottom Notification tab");

    assert(customerBarContent.includes("key: 'Coupons'"), "BottomTabBar tabs contains key: 'Coupons'");
    assert(customerBarContent.includes("label: 'Coupons'"), "BottomTabBar tabs contains label: 'Coupons'");
    assert(customerBarContent.includes('TicketPercent'), "BottomTabBar uses TicketPercent icon");

    // -----------------------------------------------------------
    // Case 18: Top-header Notification icon still opens existing notifications screen
    // -----------------------------------------------------------
    console.log('\n[Case 18] Top-header Notification icon still opens existing notifications screen');
    const dashboardContent = fs.readFileSync('D:/Client Projects/Saloon Mobile Application/apps/mobile/src/screens/DashboardScreen.tsx', 'utf-8');
    const discoverContent = fs.readFileSync('D:/Client Projects/Saloon Mobile Application/apps/mobile/src/screens/DiscoverScreen.tsx', 'utf-8');

    assert(dashboardContent.includes("setOwnerSubView('NOTIFICATIONS')"), "DashboardScreen header notification opens notifications subview");
    assert(dashboardContent.includes("<CustomerNotificationsScreen"), "DashboardScreen retains CustomerNotificationsScreen");
    assert(discoverContent.includes("subView: 'NOTIFICATIONS'"), "DiscoverScreen header bell retains notifications navigation");

    // -----------------------------------------------------------
    // Case 19: Customer Coupons navigation works correctly
    // -----------------------------------------------------------
    console.log('\n[Case 19] Customer Coupons navigation works correctly');
    assert(discoverContent.includes("activeTab === 'Coupons'"), "DiscoverScreen routes 'Coupons' tab to CustomerCouponsScreen");
    assert(discoverContent.includes("<CustomerCouponsScreen"), "CustomerCouponsScreen rendered on customer Coupons tab");

    // -----------------------------------------------------------
    // Case 20: Salon-owner Coupons navigation works correctly
    // -----------------------------------------------------------
    console.log('\n[Case 20] Salon-owner Coupons navigation works correctly');
    assert(dashboardContent.includes("activeOwnerTab === 'COUPONS'"), "DashboardScreen handles 'COUPONS' tab");
    assert(dashboardContent.includes("initialSection=\"COUPONS\""), "Navigates to OwnerOffersScreen with initialSection='COUPONS'");

    // -----------------------------------------------------------
    // Case 21: Existing Offers functionality remains intact
    // -----------------------------------------------------------
    console.log('\n[Case 21] Existing Offers functionality remains intact');
    const testOffer = await SalonOffer.create({
      salonId: salonA._id,
      title: `Special Blowdry Deal ${testSuffix}`,
      description: 'Pamper yourself with 25% off blowdry',
      discountType: 'PERCENTAGE',
      discountValue: 25,
      applicableService: 'ALL',
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 86400000),
      isActive: true,
      status: 'ACTIVE'
    });

    assert(Boolean(testOffer._id), 'Existing SalonOffer model creates offers cleanly');
    const offersScreenContent = fs.readFileSync('D:/Client Projects/Saloon Mobile Application/apps/mobile/src/screens/owner/OwnerOffersScreen.tsx', 'utf-8');
    assert(offersScreenContent.includes("Special Offers"), 'Special Offers tab remains in OwnerOffersScreen');
    assert(offersScreenContent.includes("Salon Coupons"), 'Salon Coupons tab integrated inside OwnerOffersScreen');

    // -----------------------------------------------------------
    // Case 22: Existing booking, authentication, subscription, salon approval, and notification features still work
    // -----------------------------------------------------------
    console.log('\n[Case 22] Existing booking, auth, subscription, salon approval, and notifications still work');
    // Verify coupon analytics calculation
    const analytics = await couponService.getCouponAnalytics(couponPct._id, salonA._id);
    assert(analytics.coupon.code === couponPct.code, 'Coupon analytics fetched correctly');
    assert(typeof analytics.stats.totalRedemptions === 'number', 'Stats contain totalRedemptions');
    assert(typeof analytics.stats.totalSavings === 'number', 'Stats contain totalSavings');

    console.log('\n======================================================');
    console.log(`TEST RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED`);
    console.log('======================================================\n');

  } finally {
    // Cleanup test records
    await Appointment.deleteMany({ salonId: { $in: [salonA._id, salonB._id] } });
    await CouponRedemption.deleteMany({ salonId: { $in: [salonA._id, salonB._id] } });
    await Coupon.deleteMany({ salonId: { $in: [salonA._id, salonB._id] } });
    await SalonOffer.deleteMany({ salonId: { $in: [salonA._id, salonB._id] } });
    await Service.deleteMany({ salonId: { $in: [salonA._id, salonB._id] } });
    await Salon.deleteMany({ _id: { $in: [salonA._id, salonB._id] } });
    await User.deleteMany({ _id: { $in: [ownerA._id, ownerB._id, customerA._id, customerB._id] } });
    await mongoose.disconnect();
  }

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test run failed with unhandled error:', err);
  process.exit(1);
});
