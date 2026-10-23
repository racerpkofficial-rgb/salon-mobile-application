export type UserRole = 'CUSTOMER' | 'SALON_OWNER' | 'SUPER_ADMIN';

export type RouteName =
  | 'SPLASH'
  | 'ROLE_SELECTION'
  | 'LOGIN'
  | 'CUSTOMER_REGISTER'
  | 'OWNER_REGISTER'
  | 'FORGOT_PASSWORD'
  | 'VERIFY_OTP'
  | 'RESET_PASSWORD';

export type BookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'COMPLETED';

export type AppointmentStatus = BookingStatus;

export type SalonStatus = 'PENDING_APPROVAL' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED';

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export type SupportTicket = {
  _id: string;
  ticketId: string;
  userId: string | { _id: string; name: string; email: string; phone?: string; role?: string };
  userRole: UserRole;
  userName: string;
  userEmail: string;
  contactEmail?: string;
  category: string;
  subject: string;
  description: string;
  status: TicketStatus;
  adminNotes?: string;
  resolvedAt?: string;
  resolvedBy?: { _id: string; name: string; email: string } | string;
  createdAt: string;
  updatedAt: string;
};

export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'PENDING';

export type PlanType = 'STARTER' | 'BUSINESS' | 'PREMIUM';

export type BillingCycle = 'MONTHLY' | 'YEARLY';

export type IdentityProof = {
  url: string;
  filename: string;
  fileType: string;
  fileSize?: number;
  uploadedAt?: string;
};

export type NotificationPreferences = {
  bookingUpdates: boolean;
  reminders: boolean;
  promotions: boolean;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  searchRadius?: number;
  avatar?: string;
  role: UserRole;
  authProvider?: 'LOCAL' | 'GOOGLE';
  hasCustomPassword?: boolean;
  isEmailVerified?: boolean;
  isPendingDeletion?: boolean;
  scheduledDeletionAt?: string;
  notificationPreferences?: NotificationPreferences;
};

export type AuthResponse = {
  token: string;
  user: AuthUser;
  salon?: SalonOwnerData;
  needsOnboarding?: boolean;
  requiresVerification?: boolean;
  message?: string;
};

export type GoogleAuthResponse = {
  token?: string;
  user?: AuthUser;
  salon?: SalonOwnerData;
  needsOnboarding?: boolean;
  code?: string;
  message?: string;
  email?: string;
  name?: string;
};

export type Service = {
  _id?: string;
  id?: string;
  salonId?: string;
  name: string;
  category?: string;
  price: number | string;
  duration?: string | number;
  durationMinutes?: number;
  description?: string;
  image?: string;
  isActive?: boolean;
};

export type SalonCoordinates = {
  latitude: number;
  longitude: number;
};

export type CustomerOffer = {
  _id?: string;
  id?: string;
  salonId?: any;
  title: string;
  code?: string;
  discountType?: DiscountType;
  discountValue?: number;
  discountPercent?: number;
  discountLabel?: string;
  description: string;
  applicableService?: string;
  startDate?: string;
  endDate?: string;
  validUntil?: string;
  image?: string;
  isActive?: boolean;
  status?: string;
  terms?: string;
  originalPrice?: number;
  discountAmount?: number;
  finalPrice?: number;
  applicableServiceName?: string;
  salonName?: string;
  salonAddress?: string;
  salonCity?: string;
  salonImage?: string;
  salon?: Salon;
  eligibility?: { canView: boolean; canBook: boolean; reason: string | null };
};

export type Salon = {
  id?: string;
  _id?: string;
  ownerId?: string | { _id?: string; name?: string; avatar?: string; email?: string } | any;
  salonName?: string;
  name: string;
  location: string;
  coordinates?: SalonCoordinates;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  description?: string;
  rating?: number | null;
  reviews?: number;
  averageRating?: number | null;
  reviewCount?: number;
  startingPrice: string;
  distance?: string;
  distanceKm?: number | null;
  image?: string;
  images?: string[];
  services?: Service[];
  status?: SalonStatus;
  subscriptionId?: any;
  subscriptionStatus?: SubscriptionStatus;
  rejectionReason?: string;
  offers?: CustomerOffer[];
  workingHours?: WorkingHours;
  unavailableDates?: string[];
};

export type WorkingHours = {
  openTime: string;
  closeTime: string;
  slotIntervalMinutes: number;
  daysOpen: string[];
};

export type PlanDetails = {
  id: PlanType;
  name: string;
  tagline: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  popular?: boolean;
};

export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

export type PaymentData = {
  _id?: string;
  salonId: string;
  ownerId: string;
  planId: PlanType;
  amount: number;
  billingCycle: BillingCycle;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  status: PaymentStatus;
  createdAt: string;
  updatedAt?: string;
};

export type SubscriptionData = {
  _id?: string;
  salonId: string;
  ownerId: string;
  plan: PlanType;
  billingCycle: BillingCycle;
  amount: number;
  currency: string;
  status: SubscriptionStatus;
  paymentMethod: string;
  transactionId: string;
  startDate: string;
  endDate: string;
};

export type SalonOwnerData = {
  _id?: string;
  id?: string;
  ownerId: string;
  salonName: string;
  description?: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  location: SalonCoordinates;
  images?: string[];
  services: Service[];
  status: SalonStatus;
  subscriptionId?: SubscriptionData | string;
  subscriptionStatus: SubscriptionStatus;
  rejectionReason?: string;
  workingHours?: WorkingHours;
  unavailableDates?: string[];
  rating?: number;
  reviews?: number;
  identityProof?: IdentityProof;
  createdAt?: string;
  updatedAt?: string;
};

export type TimeSlot = {
  startTime: string;
  endTime: string;
  duration: number;
  isAvailable: boolean;
};

export type AppointmentData = {
  _id: string;
  id?: string;
  customerId: any;
  salonId: any;
  serviceId: any;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  customerNote?: string;
  rejectionReason?: string;
  serviceName?: string;
  serviceDuration?: number;
  originalPrice?: number;
  discountAmount?: number;
  totalPrice?: number;
  couponId?: string;
  couponCode?: string;
  couponDiscount?: number;
  couponRedeemed?: boolean;
  completedAt?: string;
  isReviewSubmitted?: boolean;
  reviewDeadline?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ReviewData = {
  _id: string;
  appointmentId:
  | {
    _id: string;
    serviceName?: string;
    appointmentDate?: string;
  }
  | string;
  salonId:
  | {
    _id: string;
    salonName: string;
    rating?: number;
    reviews?: number;
    city?: string;
    address?: string;
    ownerId?: string;
  }
  | string;
  customerId:
  | {
    _id: string;
    name: string;
  }
  | string;
  rating: number;
  comment: string;
  photos?: string[];
  ownerReply?: string;
  ownerRepliedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type ReviewEligibility = {
  canReview: boolean;
  completedAt?: string;
  reviewDeadline?: string;
  remainingTimeMs: number;
  alreadyReviewed: boolean;
  reason?: string;
  review?: ReviewData | null;
};

export type OwnerAppointmentStats = {
  pendingCount: number;
  confirmedTodayCount: number;
  upcomingConfirmedCount: number;
  completedCount: number;
  totalRevenue: number;
  todayAppointmentsCount: number;
  todayAppointments: AppointmentData[];
};

export type DiscountType = 'PERCENTAGE' | 'FIXED';

export type SalonOffer = {
  _id: string;
  id?: string;
  salonId: any;
  title: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  applicableService: string;
  startDate?: string;
  endDate: string;
  image?: string;
  isActive: boolean;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type NotificationType =
  | 'BOOKING_REQUEST_SENT'
  | 'BOOKING_ACCEPTED'
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_REJECTED'
  | 'BOOKING_CANCELLED'
  | 'APPOINTMENT_REMINDER'
  | 'OFFER_PUBLISHED'
  | 'SUBSCRIPTION_STATUS'
  | 'SALON_APPROVED'
  | 'SALON_REJECTED'
  | 'GENERAL';

export type NotificationItem = {
  _id: string;
  id?: string;
  recipientId: string;
  senderId?: string;
  salonId?: any;
  appointmentId?: string;
  offerId?: any;
  targetScreen?: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  isOfferExpired?: boolean;
  data?: Record<string, any>;
  createdAt: string;
};

export type OwnerScreenView =
  | 'DASHBOARD'
  | 'BOOKINGS'
  | 'PROFILE'
  | 'PENDING_REQUESTS'
  | 'BOOKING_DETAILS'
  | 'CONFIRMED_BOOKINGS'
  | 'CALENDAR'
  | 'APPOINTMENT_HISTORY'
  | 'OFFERS'
  | 'SERVICES'
  | 'ONBOARDING'
  | 'PLANS'
  | 'PAYMENT'
  | 'SUBSCRIPTION_STATUS'
  | 'REVIEWS'
  | 'ANALYTICS';

export type AnalyticsPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type AnalyticsChartType =
  | 'LINE'
  | 'STACKED_BAR'
  | 'DONUT'
  | 'PIE'
  | 'AREA'
  | 'CANDLESTICK'
  | 'HISTOGRAM';

export type AnalyticsMetric =
  | 'TOTAL_BOOKINGS'
  | 'GROSS_VALUE'
  | 'COMPLETED_BOOKINGS'
  | 'CANCELLED_BOOKINGS';

export interface AnalyticsTimelineBucket {
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
  candle?: {
    open: number;
    high: number;
    low: number;
    close: number;
    count: number;
    avg: number;
  } | null;
}

export interface AnalyticsStatusBreakdownItem {
  status: BookingStatus;
  label: string;
  count: number;
  percentage: number;
  color: string;
  value: number;
}

export interface AnalyticsServiceBreakdownItem {
  serviceName: string;
  count: number;
  revenue: number;
  percentage: number;
}

export interface AnalyticsHistogramBin {
  binKey: string;
  label: string;
  min: number;
  max: number;
  count: number;
  percentage: number;
}

export interface OwnerAnalyticsData {
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
  timeline: AnalyticsTimelineBucket[];
  statusBreakdown: AnalyticsStatusBreakdownItem[];
  serviceBreakdown: AnalyticsServiceBreakdownItem[];
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
    bins: AnalyticsHistogramBin[];
  };
}

export type CouponDiscountType = 'PERCENTAGE' | 'FIXED';
export type CouponStatus = 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'DELETED';

export interface CouponData {
  _id: string;
  id?: string;
  salonId: string | any;
  code: string;
  title: string;
  description?: string;
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscountAmount?: number;
  minimumBookingAmount: number;
  applicableServiceIds: string[];
  startsAt: string;
  expiresAt: string;
  totalUsageLimit?: number;
  perCustomerUsageLimit: number;
  usedCount: number;
  status: CouponStatus;
  effectiveStatus?: CouponStatus;
  formattedDiscount?: string;
  remainingUses?: number | null;
  totalDiscountGranted?: number;
  activeRedemptionsCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface OwnerCouponSummary {
  totalCoupons: number;
  activeCoupons: number;
  totalRedemptions: number;
  totalDiscountsGranted: number;
}

export interface OwnerCouponsResponse {
  summary: OwnerCouponSummary;
  coupons: CouponData[];
}

export interface CouponAnalyticsData {
  coupon: CouponData;
  metrics: {
    totalRedemptions: number;
    totalDiscountGranted: number;
    grossBookingsValue: number;
    netBookingsValue: number;
    remainingUses: number | null;
    isExhausted: boolean;
    isExpired: boolean;
  };
  recentRedemptions: {
    id: string;
    appointmentId: string;
    date: string;
    discountAmount: number;
    originalPrice: number;
    finalPrice: number;
    status: string;
  }[];
}

export interface ValidateCouponResult {
  valid: boolean;
  couponId?: string;
  code?: string;
  title?: string;
  discountType?: CouponDiscountType;
  discountValue?: number;
  originalPrice?: number;
  discountAmount?: number;
  finalPrice?: number;
  savingsMessage?: string;
  message?: string;
}

export interface CreateCouponPayload {
  code: string;
  title: string;
  description?: string;
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscountAmount?: number;
  minimumBookingAmount?: number;
  applicableServiceIds?: string[];
  startsAt?: string;
  expiresAt: string;
  totalUsageLimit?: number;
  perCustomerUsageLimit?: number;
  status?: 'ACTIVE' | 'PAUSED';
}

export interface UpdateCouponPayload {
  title?: string;
  description?: string;
  discountType?: CouponDiscountType;
  discountValue?: number;
  maxDiscountAmount?: number | null;
  minimumBookingAmount?: number;
  applicableServiceIds?: string[];
  startsAt?: string;
  expiresAt?: string;
  totalUsageLimit?: number | null;
  perCustomerUsageLimit?: number;
  status?: 'ACTIVE' | 'PAUSED';
}