import { Types } from 'mongoose';
import { Appointment, AppointmentStatus } from '../models/Appointment.js';
import { Salon } from '../models/Salon.js';

export type AnalyticsPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface TimelineBucket {
  bucketKey: string;
  label: string;
  shortLabel: string;
  fullDate: string;
  totalBookings: number;
  completedBookings: number;
  confirmedBookings: number;
  pendingBookings: number;
  cancelledBookings: number;
  grossBookingValue: number;
  completedValue: number;
  // Candlestick OHLC (derived from real prices in this interval)
  candle?: {
    open: number;
    high: number;
    low: number;
    close: number;
    count: number;
    avg: number;
  } | null;
}

export interface StatusBreakdownItem {
  status: AppointmentStatus;
  label: string;
  count: number;
  percentage: number;
  color: string;
  value: number;
}

export interface ServiceBreakdownItem {
  serviceName: string;
  count: number;
  revenue: number;
  percentage: number;
}

export interface HistogramBin {
  binKey: string;
  label: string;
  min: number;
  max: number;
  count: number;
  percentage: number;
}

export interface OwnerAnalyticsResult {
  salonId: string;
  salonName: string;
  period: AnalyticsPeriod;
  referenceDate: string;
  startDate: string;
  endDate: string;
  periodLabel: string;
  previousDate: string;
  nextDate: string;
  summary: {
    totalBookings: number;
    completedBookings: number;
    confirmedBookings: number;
    pendingBookings: number;
    cancelledBookings: number;
    grossBookingValue: number;
    completedBookingValue: number;
    confirmedBookingValue: number;
    recordedRevenue: number;
    recordedRevenueNote: string;
    averageBookingValue: number;
  };
  timeline: TimelineBucket[];
  statusBreakdown: StatusBreakdownItem[];
  serviceBreakdown: ServiceBreakdownItem[];
  candlestick: {
    hasSufficientData: boolean;
    reason?: string;
    data: {
      interval: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }[];
  };
  histogram: {
    hasData: boolean;
    reason?: string;
    metric: 'BOOKING_VALUE' | 'DAILY_VOLUME';
    bins: HistogramBin[];
  };
}

function padZero(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatDateString(d: Date): string {
  return `${d.getFullYear()}-${padZero(d.getMonth() + 1)}-${padZero(d.getDate())}`;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export class AnalyticsService {
  /**
   * Resolve date boundaries for the given period & reference date.
   */
  resolveDateRange(period: AnalyticsPeriod, refDateStr?: string) {
    let refDate: Date;
    if (refDateStr && /^\d{4}-\d{2}-\d{2}$/.test(refDateStr)) {
      const [y, m, d] = refDateStr.split('-').map(Number);
      refDate = new Date(y, m - 1, d, 12, 0, 0);
    } else {
      refDate = new Date();
    }

    const currentYear = refDate.getFullYear();
    const currentMonth = refDate.getMonth(); // 0-11
    const currentDate = refDate.getDate();

    let startDate: string;
    let endDate: string;
    let periodLabel: string;
    let previousDate: string;
    let nextDate: string;

    if (period === 'daily') {
      startDate = formatDateString(refDate);
      endDate = startDate;
      const dayOfWeek = DAY_SHORT[refDate.getDay()];
      periodLabel = `${dayOfWeek}, ${MONTH_SHORT[currentMonth]} ${currentDate}, ${currentYear}`;

      const prev = new Date(refDate);
      prev.setDate(prev.getDate() - 1);
      previousDate = formatDateString(prev);

      const next = new Date(refDate);
      next.setDate(next.getDate() + 1);
      nextDate = formatDateString(next);
    } else if (period === 'weekly') {
      // Find Monday of the week
      const day = refDate.getDay();
      // Sunday is 0, Monday is 1 ...
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const monday = new Date(refDate);
      monday.setDate(monday.getDate() + diffToMonday);

      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);

      startDate = formatDateString(monday);
      endDate = formatDateString(sunday);

      const mMonth = MONTH_SHORT[monday.getMonth()];
      const sMonth = MONTH_SHORT[sunday.getMonth()];
      if (mMonth === sMonth) {
        periodLabel = `${mMonth} ${monday.getDate()} – ${sunday.getDate()}, ${currentYear}`;
      } else {
        periodLabel = `${mMonth} ${monday.getDate()} – ${sMonth} ${sunday.getDate()}, ${currentYear}`;
      }

      const prevMon = new Date(monday);
      prevMon.setDate(prevMon.getDate() - 7);
      previousDate = formatDateString(prevMon);

      const nextMon = new Date(monday);
      nextMon.setDate(nextMon.getDate() + 7);
      nextDate = formatDateString(nextMon);
    } else if (period === 'monthly') {
      const firstDay = new Date(currentYear, currentMonth, 1);
      const lastDay = new Date(currentYear, currentMonth + 1, 0);

      startDate = formatDateString(firstDay);
      endDate = formatDateString(lastDay);
      periodLabel = `${MONTH_NAMES[currentMonth]} ${currentYear}`;

      const prevMonth = new Date(currentYear, currentMonth - 1, 1);
      previousDate = formatDateString(prevMonth);

      const nextMonth = new Date(currentYear, currentMonth + 1, 1);
      nextDate = formatDateString(nextMonth);
    } else {
      // Yearly
      startDate = `${currentYear}-01-01`;
      endDate = `${currentYear}-12-31`;
      periodLabel = `Year ${currentYear}`;

      previousDate = `${currentYear - 1}-01-01`;
      nextDate = `${currentYear + 1}-01-01`;
    }

    return {
      referenceDate: formatDateString(refDate),
      startDate,
      endDate,
      periodLabel,
      previousDate,
      nextDate,
      refDate
    };
  }

  /**
   * Main aggregation query and formatting
   */
  async getSalonAnalytics(salonId: Types.ObjectId | string, period: AnalyticsPeriod, refDateStr?: string): Promise<OwnerAnalyticsResult> {
    const salon = await Salon.findById(salonId).select('salonName').lean();
    const salonName = salon?.salonName || 'My Salon';

    const {
      referenceDate,
      startDate,
      endDate,
      periodLabel,
      previousDate,
      nextDate,
      refDate
    } = this.resolveDateRange(period, refDateStr);

    // Fetch authoritative appointments for this salon & date range
    const appointments = await Appointment.find({
      salonId,
      appointmentDate: { $gte: startDate, $lte: endDate }
    })
      .sort({ appointmentDate: 1, startTime: 1 })
      .lean();

    // Summary calculations
    let totalBookings = appointments.length;
    let completedBookings = 0;
    let confirmedBookings = 0;
    let pendingBookings = 0;
    let cancelledBookings = 0;
    let grossBookingValue = 0;
    let completedBookingValue = 0;
    let confirmedBookingValue = 0;

    const statusCounts: Record<string, { count: number; value: number }> = {
      COMPLETED: { count: 0, value: 0 },
      CONFIRMED: { count: 0, value: 0 },
      PENDING: { count: 0, value: 0 },
      CANCELLED: { count: 0, value: 0 },
      REJECTED: { count: 0, value: 0 }
    };

    const serviceCounts: Record<string, { count: number; revenue: number }> = {};
    const bookingPrices: number[] = [];

    for (const app of appointments) {
      const price = Number(app.totalPrice) || 0;
      grossBookingValue += price;
      if (price > 0) bookingPrices.push(price);

      if (app.status === 'COMPLETED') {
        completedBookings++;
        completedBookingValue += price;
      } else if (app.status === 'CONFIRMED') {
        confirmedBookings++;
        confirmedBookingValue += price;
      } else if (app.status === 'PENDING') {
        pendingBookings++;
      } else if (app.status === 'CANCELLED' || app.status === 'REJECTED') {
        cancelledBookings++;
      }

      if (statusCounts[app.status]) {
        statusCounts[app.status].count++;
        statusCounts[app.status].value += price;
      }

      const sName = app.serviceName || 'General Service';
      if (!serviceCounts[sName]) {
        serviceCounts[sName] = { count: 0, revenue: 0 };
      }
      serviceCounts[sName].count++;
      serviceCounts[sName].revenue += price;
    }

    const averageBookingValue = totalBookings > 0 ? Math.round(grossBookingValue / totalBookings) : 0;

    // Timeline construction based on period
    const timeline: TimelineBucket[] = [];

    if (period === 'daily') {
      // 08:00 to 21:00 hourly buckets
      for (let h = 8; h <= 21; h++) {
        const hStr = padZero(h);
        const nextHStr = padZero(h + 1);
        const bucketKey = `${hStr}:00`;
        const hourLabel = h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`;
        const shortLabel = h === 12 ? '12P' : h > 12 ? `${h - 12}P` : `${h}A`;

        const bucketApps = appointments.filter((a) => {
          const startHour = parseInt(a.startTime.split(':')[0], 10);
          return startHour === h;
        });

        const bTotal = bucketApps.length;
        const bComp = bucketApps.filter((a) => a.status === 'COMPLETED').length;
        const bConf = bucketApps.filter((a) => a.status === 'CONFIRMED').length;
        const bPend = bucketApps.filter((a) => a.status === 'PENDING').length;
        const bCanc = bucketApps.filter((a) => a.status === 'CANCELLED' || a.status === 'REJECTED').length;
        const bGross = bucketApps.reduce((acc, a) => acc + (Number(a.totalPrice) || 0), 0);
        const bCompVal = bucketApps
          .filter((a) => a.status === 'COMPLETED')
          .reduce((acc, a) => acc + (Number(a.totalPrice) || 0), 0);

        // Derive real Candlestick OHLC if appointments exist
        const priced = bucketApps.map((a) => Number(a.totalPrice) || 0).filter((p) => p > 0);
        let candle = null;
        if (priced.length > 0) {
          candle = {
            open: priced[0],
            high: Math.max(...priced),
            low: Math.min(...priced),
            close: priced[priced.length - 1],
            count: priced.length,
            avg: Math.round(priced.reduce((a, b) => a + b, 0) / priced.length)
          };
        }

        timeline.push({
          bucketKey,
          label: hourLabel,
          shortLabel,
          fullDate: `${startDate} ${bucketKey}`,
          totalBookings: bTotal,
          completedBookings: bComp,
          confirmedBookings: bConf,
          pendingBookings: bPend,
          cancelledBookings: bCanc,
          grossBookingValue: bGross,
          completedValue: bCompVal,
          candle
        });
      }
    } else if (period === 'weekly') {
      // 7 days Monday to Sunday
      const [sy, sm, sd] = startDate.split('-').map(Number);
      const curDate = new Date(sy, sm - 1, sd, 12, 0, 0);

      for (let i = 0; i < 7; i++) {
        const dStr = formatDateString(curDate);
        const dayName = DAY_SHORT[curDate.getDay()];
        const label = `${dayName} ${curDate.getDate()}`;
        const shortLabel = dayName.slice(0, 2);

        const bucketApps = appointments.filter((a) => a.appointmentDate === dStr);
        const bTotal = bucketApps.length;
        const bComp = bucketApps.filter((a) => a.status === 'COMPLETED').length;
        const bConf = bucketApps.filter((a) => a.status === 'CONFIRMED').length;
        const bPend = bucketApps.filter((a) => a.status === 'PENDING').length;
        const bCanc = bucketApps.filter((a) => a.status === 'CANCELLED' || a.status === 'REJECTED').length;
        const bGross = bucketApps.reduce((acc, a) => acc + (Number(a.totalPrice) || 0), 0);
        const bCompVal = bucketApps
          .filter((a) => a.status === 'COMPLETED')
          .reduce((acc, a) => acc + (Number(a.totalPrice) || 0), 0);

        const priced = bucketApps.map((a) => Number(a.totalPrice) || 0).filter((p) => p > 0);
        let candle = null;
        if (priced.length > 0) {
          candle = {
            open: priced[0],
            high: Math.max(...priced),
            low: Math.min(...priced),
            close: priced[priced.length - 1],
            count: priced.length,
            avg: Math.round(priced.reduce((a, b) => a + b, 0) / priced.length)
          };
        }

        timeline.push({
          bucketKey: dStr,
          label,
          shortLabel,
          fullDate: dStr,
          totalBookings: bTotal,
          completedBookings: bComp,
          confirmedBookings: bConf,
          pendingBookings: bPend,
          cancelledBookings: bCanc,
          grossBookingValue: bGross,
          completedValue: bCompVal,
          candle
        });

        curDate.setDate(curDate.getDate() + 1);
      }
    } else if (period === 'monthly') {
      // Days in month
      const [sy, sm] = startDate.split('-').map(Number);
      const daysInMonth = new Date(sy, sm, 0).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        const dStr = `${sy}-${padZero(sm)}-${padZero(day)}`;
        const label = `${MONTH_SHORT[sm - 1]} ${day}`;
        const shortLabel = `${day}`;

        const bucketApps = appointments.filter((a) => a.appointmentDate === dStr);
        const bTotal = bucketApps.length;
        const bComp = bucketApps.filter((a) => a.status === 'COMPLETED').length;
        const bConf = bucketApps.filter((a) => a.status === 'CONFIRMED').length;
        const bPend = bucketApps.filter((a) => a.status === 'PENDING').length;
        const bCanc = bucketApps.filter((a) => a.status === 'CANCELLED' || a.status === 'REJECTED').length;
        const bGross = bucketApps.reduce((acc, a) => acc + (Number(a.totalPrice) || 0), 0);
        const bCompVal = bucketApps
          .filter((a) => a.status === 'COMPLETED')
          .reduce((acc, a) => acc + (Number(a.totalPrice) || 0), 0);

        const priced = bucketApps.map((a) => Number(a.totalPrice) || 0).filter((p) => p > 0);
        let candle = null;
        if (priced.length > 0) {
          candle = {
            open: priced[0],
            high: Math.max(...priced),
            low: Math.min(...priced),
            close: priced[priced.length - 1],
            count: priced.length,
            avg: Math.round(priced.reduce((a, b) => a + b, 0) / priced.length)
          };
        }

        timeline.push({
          bucketKey: dStr,
          label,
          shortLabel,
          fullDate: dStr,
          totalBookings: bTotal,
          completedBookings: bComp,
          confirmedBookings: bConf,
          pendingBookings: bPend,
          cancelledBookings: bCanc,
          grossBookingValue: bGross,
          completedValue: bCompVal,
          candle
        });
      }
    } else {
      // Yearly: 12 months
      const [sy] = startDate.split('-').map(Number);
      for (let m = 1; m <= 12; m++) {
        const mKey = `${sy}-${padZero(m)}`;
        const label = MONTH_SHORT[m - 1];
        const shortLabel = label.slice(0, 1);

        const bucketApps = appointments.filter((a) => a.appointmentDate.startsWith(mKey));
        const bTotal = bucketApps.length;
        const bComp = bucketApps.filter((a) => a.status === 'COMPLETED').length;
        const bConf = bucketApps.filter((a) => a.status === 'CONFIRMED').length;
        const bPend = bucketApps.filter((a) => a.status === 'PENDING').length;
        const bCanc = bucketApps.filter((a) => a.status === 'CANCELLED' || a.status === 'REJECTED').length;
        const bGross = bucketApps.reduce((acc, a) => acc + (Number(a.totalPrice) || 0), 0);
        const bCompVal = bucketApps
          .filter((a) => a.status === 'COMPLETED')
          .reduce((acc, a) => acc + (Number(a.totalPrice) || 0), 0);

        const priced = bucketApps.map((a) => Number(a.totalPrice) || 0).filter((p) => p > 0);
        let candle = null;
        if (priced.length > 0) {
          candle = {
            open: priced[0],
            high: Math.max(...priced),
            low: Math.min(...priced),
            close: priced[priced.length - 1],
            count: priced.length,
            avg: Math.round(priced.reduce((a, b) => a + b, 0) / priced.length)
          };
        }

        timeline.push({
          bucketKey: mKey,
          label,
          shortLabel,
          fullDate: `${MONTH_NAMES[m - 1]} ${sy}`,
          totalBookings: bTotal,
          completedBookings: bComp,
          confirmedBookings: bConf,
          pendingBookings: bPend,
          cancelledBookings: bCanc,
          grossBookingValue: bGross,
          completedValue: bCompVal,
          candle
        });
      }
    }

    // Status Breakdown (consistent with Donut and Pie)
    const statusMeta: { status: AppointmentStatus; label: string; color: string }[] = [
      { status: 'COMPLETED', label: 'Completed', color: '#10B981' },
      { status: 'CONFIRMED', label: 'Confirmed', color: '#6C4CE2' },
      { status: 'PENDING', label: 'Pending', color: '#F59E0B' },
      { status: 'CANCELLED', label: 'Cancelled', color: '#EF4444' },
      { status: 'REJECTED', label: 'Rejected', color: '#8B7CF6' }
    ];

    const statusBreakdown: StatusBreakdownItem[] = statusMeta.map((sm) => {
      const count = statusCounts[sm.status]?.count || 0;
      const val = statusCounts[sm.status]?.value || 0;
      const pct = totalBookings > 0 ? Math.round((count / totalBookings) * 100) : 0;
      return {
        status: sm.status,
        label: sm.label,
        count,
        percentage: pct,
        color: sm.color,
        value: val
      };
    });

    // Service Breakdown
    const serviceBreakdown: ServiceBreakdownItem[] = Object.entries(serviceCounts)
      .map(([name, data]) => ({
        serviceName: name,
        count: data.count,
        revenue: data.revenue,
        percentage: totalBookings > 0 ? Math.round((data.count / totalBookings) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Candlestick processing
    const validCandles = timeline
      .filter((t) => t.candle !== null && t.candle !== undefined)
      .map((t) => ({
        interval: t.label,
        open: t.candle!.open,
        high: t.candle!.high,
        low: t.candle!.low,
        close: t.candle!.close,
        volume: t.candle!.count
      }));

    const hasSufficientCandles = validCandles.length >= 2;
    const candlestick = {
      hasSufficientData: hasSufficientCandles,
      reason: hasSufficientCandles
        ? undefined
        : 'Candlestick OHLC requires at least 2 distinct time intervals with priced booking transactions. The current period has insufficient interval data.',
      data: validCandles
    };

    // Histogram distribution calculation (Distribution of Booking Values)
    let histogramBins: HistogramBin[] = [];
    let hasHistogramData = bookingPrices.length > 0;

    if (hasHistogramData) {
      const minPrice = Math.min(...bookingPrices);
      const maxPrice = Math.max(...bookingPrices);

      if (minPrice === maxPrice) {
        histogramBins = [
          {
            binKey: 'single_bin',
            label: `₹${minPrice}`,
            min: minPrice,
            max: maxPrice,
            count: bookingPrices.length,
            percentage: 100
          }
        ];
      } else {
        // Create 4-5 neat price brackets
        const standardThresholds = [
          { label: '₹0 - ₹300', min: 0, max: 300 },
          { label: '₹301 - ₹600', min: 301, max: 600 },
          { label: '₹601 - ₹1,000', min: 601, max: 1000 },
          { label: '₹1,001 - ₹2,000', min: 1001, max: 2000 },
          { label: '₹2,001+', min: 2001, max: 999999 }
        ];

        // Filter brackets that are within reasonable range of min/max
        const applicableThresholds = standardThresholds.filter(
          (t) => maxPrice >= t.min && minPrice <= t.max
        );

        const binsToUse = applicableThresholds.length >= 2 ? applicableThresholds : [
          { label: `₹${minPrice} - ₹${Math.round((minPrice + maxPrice) / 2)}`, min: minPrice, max: Math.round((minPrice + maxPrice) / 2) },
          { label: `₹${Math.round((minPrice + maxPrice) / 2) + 1} - ₹${maxPrice}`, min: Math.round((minPrice + maxPrice) / 2) + 1, max: maxPrice }
        ];

        histogramBins = binsToUse.map((bin, idx) => {
          const inBin = bookingPrices.filter((p) => p >= bin.min && p <= bin.max);
          const count = inBin.length;
          const percentage = Math.round((count / bookingPrices.length) * 100);
          return {
            binKey: `bin_${idx}`,
            label: bin.label,
            min: bin.min,
            max: bin.max,
            count,
            percentage
          };
        });
      }
    }

    const histogram = {
      hasData: hasHistogramData,
      reason: hasHistogramData
        ? undefined
        : 'No booking value transactions recorded in this period to compute numerical distribution.',
      metric: 'BOOKING_VALUE' as const,
      bins: histogramBins
    };

    return {
      salonId: salonId.toString(),
      salonName,
      period,
      referenceDate,
      startDate,
      endDate,
      periodLabel,
      previousDate,
      nextDate,
      summary: {
        totalBookings,
        completedBookings,
        confirmedBookings,
        pendingBookings,
        cancelledBookings,
        grossBookingValue,
        completedBookingValue,
        confirmedBookingValue,
        recordedRevenue: 0, // In-salon payments; no customer payment records
        recordedRevenueNote: 'Online booking payments not recorded; services settled offline at salon.',
        averageBookingValue
      },
      timeline,
      statusBreakdown,
      serviceBreakdown,
      candlestick,
      histogram
    };
  }
}

export const analyticsService = new AnalyticsService();
