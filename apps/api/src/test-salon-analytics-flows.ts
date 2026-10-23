import mongoose from 'mongoose';
import { Appointment } from './models/Appointment.js';
import { Salon } from './models/Salon.js';
import { User } from './models/User.js';
import { analyticsService } from './services/analytics.service.js';

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
  console.log('\n=== Testing Salon Analytics Backend Service ===\n');
  await mongoose.connect('mongodb://127.0.0.1:27017/aurelia');

  const testSuffix = Date.now().toString().slice(-6);

  // 1. Create a test owner and salon
  const ownerA = await User.create({
    name: `Owner Analytics ${testSuffix}`,
    email: `owner.analytics.${testSuffix}@example.com`,
    passwordHash: 'dummyhash123',
    role: 'SALON_OWNER',
    phone: `99${testSuffix}11`
  });

  const salonA = await Salon.create({
    ownerId: ownerA._id,
    salonName: `Analytics Salon ${testSuffix}`,
    phone: `99${testSuffix}11`,
    email: `owner.analytics.${testSuffix}@example.com`,
    address: '100 Analytics Way',
    city: 'Bangalore',
    location: { latitude: 12.9716, longitude: 77.5946 },
    status: 'ACTIVE'
  });

  const customerA = await User.create({
    name: `Customer Analytics ${testSuffix}`,
    email: `cust.analytics.${testSuffix}@example.com`,
    passwordHash: 'dummyhash123',
    role: 'CUSTOMER'
  });

  // 2. Test Empty Salon (0 bookings)
  console.log('1. Testing Empty Salon Analytics:');
  const emptyRes = await analyticsService.getSalonAnalytics(salonA._id, 'weekly', '2026-10-23');
  assert(emptyRes.summary.totalBookings === 0, 'Total bookings should be 0');
  assert(emptyRes.summary.grossBookingValue === 0, 'Gross booking value should be 0');
  assert(emptyRes.summary.recordedRevenue === 0, 'Recorded revenue should be 0 (no fake revenue)');
  assert(emptyRes.timeline.length === 7, 'Weekly period should produce 7 daily buckets');
  assert(emptyRes.statusBreakdown.every((s) => s.count === 0), 'All status breakdown counts should be 0');
  assert(emptyRes.candlestick.hasSufficientData === false, 'Candlestick should be marked insufficient for 0 bookings');
  assert(emptyRes.histogram.hasData === false, 'Histogram should report no data for 0 bookings');

  // 3. Create real test bookings on various dates and statuses
  const dummyServiceId = new mongoose.Types.ObjectId();
  const testAppointments = [
    // Completed on Oct 20 (Week of Oct 19 - Oct 25)
    {
      customerId: customerA._id,
      salonId: salonA._id,
      serviceId: dummyServiceId,
      serviceName: 'Hair Styling Pro',
      appointmentDate: '2026-10-20',
      startTime: '10:00',
      endTime: '11:00',
      status: 'COMPLETED' as const,
      totalPrice: 800
    },
    // Another completed on Oct 20
    {
      customerId: customerA._id,
      salonId: salonA._id,
      serviceId: dummyServiceId,
      serviceName: 'Hair Styling Pro',
      appointmentDate: '2026-10-20',
      startTime: '14:30',
      endTime: '15:30',
      status: 'COMPLETED' as const,
      totalPrice: 1200
    },
    // Confirmed on Oct 22
    {
      customerId: customerA._id,
      salonId: salonA._id,
      serviceId: dummyServiceId,
      serviceName: 'Beard Trim',
      appointmentDate: '2026-10-22',
      startTime: '11:00',
      endTime: '11:30',
      status: 'CONFIRMED' as const,
      totalPrice: 300
    },
    // Pending on Oct 23
    {
      customerId: customerA._id,
      salonId: salonA._id,
      serviceId: dummyServiceId,
      serviceName: 'Facial Glow',
      appointmentDate: '2026-10-23',
      startTime: '16:00',
      endTime: '17:00',
      status: 'PENDING' as const,
      totalPrice: 1500
    },
    // Cancelled on Oct 23
    {
      customerId: customerA._id,
      salonId: salonA._id,
      serviceId: dummyServiceId,
      serviceName: 'Head Massage',
      appointmentDate: '2026-10-23',
      startTime: '18:00',
      endTime: '18:30',
      status: 'CANCELLED' as const,
      totalPrice: 400
    },
    // Booking outside current week (in Nov 2026)
    {
      customerId: customerA._id,
      salonId: salonA._id,
      serviceId: dummyServiceId,
      serviceName: 'Hair Color',
      appointmentDate: '2026-11-05',
      startTime: '12:00',
      endTime: '13:00',
      status: 'COMPLETED' as const,
      totalPrice: 2500
    }
  ];

  await Appointment.insertMany(testAppointments);

  // 4. Test Weekly Analytics with bookings
  console.log('\n2. Testing Weekly Analytics with multiple statuses:');
  const weekRes = await analyticsService.getSalonAnalytics(salonA._id, 'weekly', '2026-10-23');
  // In the week Oct 19 - Oct 25: 5 bookings (800, 1200, 300, 1500, 400)
  assert(weekRes.summary.totalBookings === 5, 'Weekly totalBookings should be exactly 5');
  assert(weekRes.summary.completedBookings === 2, 'Weekly completedBookings should be 2');
  assert(weekRes.summary.confirmedBookings === 1, 'Weekly confirmedBookings should be 1');
  assert(weekRes.summary.pendingBookings === 1, 'Weekly pendingBookings should be 1');
  assert(weekRes.summary.cancelledBookings === 1, 'Weekly cancelledBookings should be 1');
  assert(weekRes.summary.grossBookingValue === 4200, 'Gross booking value should be ₹4,200 (800+1200+300+1500+400)');
  assert(weekRes.summary.completedBookingValue === 2000, 'Completed booking value should be ₹2,000 (800+1200)');
  assert(weekRes.summary.confirmedBookingValue === 300, 'Confirmed booking value should be ₹300');
  assert(weekRes.summary.recordedRevenue === 0, 'Recorded revenue must remain 0 (distinguished from gross value)');
  assert(weekRes.summary.averageBookingValue === 840, 'Average booking value should be ₹840 (4200 / 5)');

  // Timeline reconciliation: sum of bucket values must equal summary totals!
  const sumTimelineBookings = weekRes.timeline.reduce((acc, t) => acc + t.totalBookings, 0);
  const sumTimelineGross = weekRes.timeline.reduce((acc, t) => acc + t.grossBookingValue, 0);
  assert(sumTimelineBookings === 5, 'Sum of timeline bookings must reconcile with summary total');
  assert(sumTimelineGross === 4200, 'Sum of timeline gross value must reconcile with summary gross value');

  // Status breakdown reconciliation
  const sumStatusCounts = weekRes.statusBreakdown.reduce((acc, s) => acc + s.count, 0);
  assert(sumStatusCounts === 5, 'Sum of status breakdown counts must equal 5');

  // 5. Test Daily Analytics
  console.log('\n3. Testing Daily Analytics (Oct 20, 2026):');
  const dayRes = await analyticsService.getSalonAnalytics(salonA._id, 'daily', '2026-10-20');
  assert(dayRes.summary.totalBookings === 2, 'Daily totalBookings on Oct 20 should be 2');
  assert(dayRes.summary.completedBookings === 2, 'Daily completedBookings should be 2');
  assert(dayRes.summary.grossBookingValue === 2000, 'Daily gross booking value should be 2000');
  assert(dayRes.timeline.length === 14, 'Daily timeline should contain 14 hourly buckets (08:00 to 21:00)');
  const hour10 = dayRes.timeline.find((t) => t.bucketKey === '10:00');
  const hour14 = dayRes.timeline.find((t) => t.bucketKey === '14:00');
  assert(hour10?.totalBookings === 1 && hour10?.grossBookingValue === 800, '10:00 AM bucket should have 1 booking for ₹800');
  assert(hour14?.totalBookings === 1 && hour14?.grossBookingValue === 1200, '2:00 PM bucket should have 1 booking for ₹1200');

  // 6. Test Monthly Analytics (October 2026)
  console.log('\n4. Testing Monthly Analytics (October 2026):');
  const monthRes = await analyticsService.getSalonAnalytics(salonA._id, 'monthly', '2026-10-15');
  assert(monthRes.summary.totalBookings === 5, 'October monthly bookings should be 5 (excluding Nov)');
  assert(monthRes.timeline.length === 31, 'October should have 31 daily buckets');

  // 7. Test Yearly Analytics (2026)
  console.log('\n5. Testing Yearly Analytics (Year 2026):');
  const yearRes = await analyticsService.getSalonAnalytics(salonA._id, 'yearly', '2026-10-15');
  // Includes all 6 bookings in 2026 (5 in Oct + 1 in Nov)
  assert(yearRes.summary.totalBookings === 6, 'Yearly totalBookings should be 6 (including Nov)');
  assert(yearRes.summary.grossBookingValue === 6700, 'Yearly gross booking value should be 6700');
  assert(yearRes.timeline.length === 12, 'Yearly timeline should have 12 monthly buckets');
  const octBucket = yearRes.timeline.find((t) => t.bucketKey === '2026-10');
  const novBucket = yearRes.timeline.find((t) => t.bucketKey === '2026-11');
  assert(octBucket?.totalBookings === 5, 'October bucket in yearly should have 5 bookings');
  assert(novBucket?.totalBookings === 1 && novBucket?.grossBookingValue === 2500, 'November bucket should have 1 booking for ₹2500');

  // 8. Test Candlestick & Histogram
  console.log('\n6. Testing Candlestick & Histogram calculations:');
  assert(weekRes.histogram.hasData === true, 'Weekly histogram should have data');
  assert(weekRes.histogram.bins.length >= 1, 'Histogram should have calculated bins');
  const histTotalCount = weekRes.histogram.bins.reduce((acc, b) => acc + b.count, 0);
  assert(histTotalCount === 5, 'Histogram total frequency must reconcile with total priced bookings');

  // 9. Owner Data Isolation Check
  console.log('\n7. Testing Owner Data Isolation:');
  const ownerB = await User.create({
    name: `Owner B Isolation ${testSuffix}`,
    email: `owner.b.${testSuffix}@example.com`,
    passwordHash: 'dummyhash123',
    role: 'SALON_OWNER',
    phone: `99${testSuffix}22`
  });
  const salonB = await Salon.create({
    ownerId: ownerB._id,
    salonName: `Salon B ${testSuffix}`,
    phone: `99${testSuffix}22`,
    email: `owner.b.${testSuffix}@example.com`,
    address: '200 Isolation St',
    city: 'Bangalore',
    location: { latitude: 12.9716, longitude: 77.5946 },
    status: 'ACTIVE'
  });
  const isolationRes = await analyticsService.getSalonAnalytics(salonB._id, 'weekly', '2026-10-23');
  assert(isolationRes.summary.totalBookings === 0, 'Salon B must NOT see any of Salon A bookings');
  assert(isolationRes.summary.grossBookingValue === 0, 'Salon B gross booking value must be 0');

  // Cleanup test documents safely
  await Appointment.deleteMany({ salonId: { $in: [salonA._id, salonB._id] } });
  await Salon.deleteMany({ _id: { $in: [salonA._id, salonB._id] } });
  await User.deleteMany({ _id: { $in: [ownerA._id, ownerB._id, customerA._id] } });

  console.log(`\n========================================`);
  console.log(`Tests Passed: ${testsPassed}, Tests Failed: ${testsFailed}`);
  console.log(`========================================\n`);

  await mongoose.disconnect();
  if (testsFailed > 0) process.exit(1);
}

runTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
