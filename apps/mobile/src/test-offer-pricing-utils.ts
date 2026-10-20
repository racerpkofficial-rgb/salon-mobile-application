import {
  isOfferValid,
  isOfferApplicableToService,
  calculateServicePriceWithOffer,
  getBestOfferForService
} from './utils/offer';
import { CustomerOffer, Service } from './types';

console.log('========================================================================');
console.log('   TESTING FRONTEND OFFER PRICING UTILITY (offer.ts)                   ');
console.log('========================================================================\n');

const s1: Service = { id: 's1', name: 'Classic Haircut', price: 300, durationMinutes: 30, category: 'Hair' };
const s2: Service = { id: 's2', name: 'Gold Glow Facial', price: 300, durationMinutes: 45, category: 'Facial' };
const s3: Service = { id: 's3', name: 'Basic Threading', price: 50, durationMinutes: 15, category: 'Skin' };

// Test 1: ₹300 service with no offer -> ₹300
console.log('1. Testing ₹300 service with no offer...');
const p1 = calculateServicePriceWithOffer(s1, null);
if (p1.originalPrice !== 300 || p1.discountAmount !== 0 || p1.finalPrice !== 300 || p1.hasDiscount !== false) {
  throw new Error(`Test 1 Failed: ${JSON.stringify(p1)}`);
}
console.log(`✓ Test 1 Passed: Original ₹${p1.originalPrice}, Discount ₹${p1.discountAmount}, Final ₹${p1.finalPrice}`);

// Test 2: ₹300 service with a valid 50% offer -> ₹150
console.log('\n2. Testing ₹300 service with a valid 50% offer...');
const off50: CustomerOffer = {
  id: 'off50',
  title: '50% Off Everything',
  description: 'Half price',
  discountType: 'PERCENTAGE',
  discountValue: 50,
  applicableService: 'ALL',
  endDate: new Date(Date.now() + 86400000).toISOString(),
  isActive: true,
  status: 'ACTIVE'
};
const p2 = calculateServicePriceWithOffer(s1, off50);
if (p2.originalPrice !== 300 || p2.discountAmount !== 150 || p2.finalPrice !== 150 || p2.hasDiscount !== true) {
  throw new Error(`Test 2 Failed: ${JSON.stringify(p2)}`);
}
console.log(`✓ Test 2 Passed: Original ₹${p2.originalPrice}, Discount ₹${p2.discountAmount} (${p2.discountLabel}), Final ₹${p2.finalPrice}`);

// Test 3: ₹300 service with a valid ₹50 fixed discount -> ₹250
console.log('\n3. Testing ₹300 service with a valid ₹50 fixed discount...');
const offFixed50: CustomerOffer = {
  id: 'offFixed50',
  title: 'Flat ₹50 Off',
  description: 'Fixed discount',
  discountType: 'FIXED',
  discountValue: 50,
  applicableService: 'ALL',
  endDate: new Date(Date.now() + 86400000).toISOString(),
  isActive: true,
  status: 'ACTIVE'
};
const p3 = calculateServicePriceWithOffer(s1, offFixed50);
if (p3.originalPrice !== 300 || p3.discountAmount !== 50 || p3.finalPrice !== 250 || p3.hasDiscount !== true) {
  throw new Error(`Test 3 Failed: ${JSON.stringify(p3)}`);
}
console.log(`✓ Test 3 Passed: Original ₹${p3.originalPrice}, Discount ₹${p3.discountAmount} (${p3.discountLabel}), Final ₹${p3.finalPrice}`);

// Test 4: Offer applies only to selected eligible services
console.log('\n4. Testing offer service eligibility restriction...');
const offFacialOnly: CustomerOffer = {
  id: 'offFacialOnly',
  title: 'Facial Special',
  description: 'Only for Gold Glow Facial',
  discountType: 'PERCENTAGE',
  discountValue: 20,
  applicableService: 's2', // specifically s2
  endDate: new Date(Date.now() + 86400000).toISOString(),
  isActive: true,
  status: 'ACTIVE'
};
if (isOfferApplicableToService(offFacialOnly, s1)) {
  throw new Error('Test 4 Failed: Offer for Facial should not apply to Haircut');
}
if (!isOfferApplicableToService(offFacialOnly, s2)) {
  throw new Error('Test 4 Failed: Offer for Facial should apply to Facial');
}
const p4Ineligible = calculateServicePriceWithOffer(s1, offFacialOnly);
if (p4Ineligible.hasDiscount !== false || p4Ineligible.finalPrice !== 300) {
  throw new Error('Test 4 Failed: Ineligible service should not get discount');
}
console.log('✓ Test 4 Passed: Offer applies strictly to s2 (Facial), rejected on s1 (Haircut).');

// Test 5: Expired / inactive offers cannot be applied
console.log('\n5. Testing expired / inactive offers...');
const offExpired: CustomerOffer = {
  id: 'offExpired',
  title: 'Yesterday Deal',
  description: 'Expired',
  discountType: 'PERCENTAGE',
  discountValue: 40,
  applicableService: 'ALL',
  endDate: new Date(Date.now() - 86400000).toISOString(), // in past
  isActive: true,
  status: 'EXPIRED'
};
if (isOfferValid(offExpired)) {
  throw new Error('Test 5 Failed: Expired offer should not be valid');
}
const p5Expired = calculateServicePriceWithOffer(s1, offExpired);
if (p5Expired.hasDiscount !== false || p5Expired.finalPrice !== 300) {
  throw new Error('Test 5 Failed: Expired offer gave discount');
}
console.log('✓ Test 5 Passed: Expired offer is not valid and gives ₹0 discount.');

// Test 6: Fixed discount exceeding service price never creates negative price
console.log('\n6. Testing negative price prevention...');
const offHuge: CustomerOffer = {
  id: 'offHuge',
  title: '₹200 Mega Voucher',
  description: 'Big voucher',
  discountType: 'FIXED',
  discountValue: 200,
  applicableService: 'ALL',
  endDate: new Date(Date.now() + 86400000).toISOString(),
  isActive: true,
  status: 'ACTIVE'
};
const p6 = calculateServicePriceWithOffer(s3, offHuge); // ₹50 service with ₹200 voucher
if (p6.finalPrice !== 0 || p6.discountAmount !== 50) {
  throw new Error(`Test 6 Failed: Expected 50 / 0, got ${p6.discountAmount} / ${p6.finalPrice}`);
}
console.log(`✓ Test 6 Passed: ₹200 voucher on ₹50 service clamped to discount: ₹50, finalPrice: ₹0 (never negative).`);

// Test 7: getBestOfferForService selects highest saving offer
console.log('\n7. Testing getBestOfferForService...');
const bestP = getBestOfferForService(s1, [offFixed50, off50]); // 50% of ₹300 = ₹150 vs fixed ₹50
if (bestP.discountAmount !== 150 || bestP.appliedOffer?.id !== 'off50') {
  throw new Error(`Test 7 Failed: Expected off50 (₹150 discount), got ${bestP.discountAmount}`);
}
console.log(`✓ Test 7 Passed: Successfully selected offer with highest savings (50% = ₹150 vs ₹50 fixed).`);

console.log('\n========================================================================');
console.log('   🎉 ALL 7 FRONTEND OFFER CALCULATION UNIT TESTS PASSED!              ');
console.log('========================================================================');
