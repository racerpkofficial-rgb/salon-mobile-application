import { request } from '../api/client';
import {
  BillingCycle,
  CustomerOffer,
  PlanDetails,
  PlanType,
  Salon,
  SalonOwnerData,
  Service,
  SubscriptionData,
  WorkingHours
} from '../types';
import { normalizeSalonLocation } from '../utils/location';

export const salonService = {
  // Customer discovery endpoints
  getSalons: async (params?: {
    q?: string;
    city?: string;
    service?: string;
    lat?: number;
    lng?: number;
    radius?: number;
    sortBy?: string;
  }): Promise<{ data: Salon[] }> => {
    const searchParams = new URLSearchParams();
    if (params?.q) searchParams.append('q', params.q);
    if (params?.city && params.city.toLowerCase() !== 'all') searchParams.append('city', params.city);
    if (params?.service && params.service.toLowerCase() !== 'all') searchParams.append('service', params.service);
    if (typeof params?.lat === 'number') searchParams.append('lat', params.lat.toString());
    if (typeof params?.lng === 'number') searchParams.append('lng', params.lng.toString());
    if (typeof params?.radius === 'number' && params.radius > 0) searchParams.append('radius', params.radius.toString());
    if (params?.sortBy) searchParams.append('sortBy', params.sortBy);
    const qs = searchParams.toString();
    const res = await request<{ data: Salon[] }>(qs ? `/salons?${qs}` : '/salons');
    return {
      ...res,
      data: (res.data || []).map((s) => normalizeSalonLocation(s))
    };
  },

  getSalonById: async (id: string, coords?: { lat?: number; lng?: number }): Promise<{ data: Salon }> => {
    const searchParams = new URLSearchParams();
    if (typeof coords?.lat === 'number') searchParams.append('lat', coords.lat.toString());
    if (typeof coords?.lng === 'number') searchParams.append('lng', coords.lng.toString());
    const qs = searchParams.toString();
    const res = await request<{ data: Salon }>(qs ? `/salons/${id}?${qs}` : `/salons/${id}`);
    return {
      ...res,
      data: res.data ? normalizeSalonLocation(res.data) : res.data
    };
  },

  getSalonServices: async (id: string): Promise<{ data: Service[] }> => {
    const res = await request<{ count: number; data: Service[] }>(`/salons/${id}/services`);
    return { data: res.data || [] };
  },

  getActiveOffers: async (): Promise<{ data: CustomerOffer[] }> => {
    const res = await request<{ data: CustomerOffer[] }>('/salons/offers');
    return {
      ...res,
      data: (res.data || []).map((o) => ({
        ...o,
        salon: o.salon ? normalizeSalonLocation(o.salon) : o.salon
      }))
    };
  },

  // Owner endpoints
  getOwnerSalon: (token: string) =>
    request<{ hasSalon: boolean; salon: SalonOwnerData | null; message: string }>('/owner/salon', { token }),

  registerOwnerSalon: (
    token: string,
    data: {
      salonName: string;
      description?: string;
      phone: string;
      email: string;
      address: string;
      city: string;
      location?: { latitude: number; longitude: number };
      images?: string[];
      services?: Array<{ name: string; price: number; durationMinutes?: number; category?: string; description?: string }>;
    }
  ) =>
    request<{ salon: SalonOwnerData; message: string }>('/owner/salon', {
      method: 'POST',
      body: data,
      token
    }),

  uploadSalonImage: (token: string, imageData: string, fileType?: string) =>
    request<{ message?: string; url: string; secureUrl?: string; publicId: string }>('/owner/upload', {
      method: 'POST',
      body: { image: imageData, fileType },
      token
    }),

  getUploadSignature: (token: string, folder?: string) =>
    request<{
      timestamp: number;
      signature: string;
      apiKey: string;
      cloudName: string;
      folder: string;
    }>(folder ? `/owner/upload-signature?folder=${encodeURIComponent(folder)}` : '/owner/upload-signature', {
      token
    }),

  getSalonDocument: (token: string) =>
    request<{
      message: string;
      document: {
        filename: string;
        fileType: string;
        fileSize?: number;
        uploadedAt?: string;
        signedUrl: string;
        expiresInSeconds: number;
      };
    }>('/owner/salon/document', { token }),

  updateSalonImages: (token: string, images: string[]) =>
    request<{ message: string; salon: SalonOwnerData }>('/owner/salon/images', {
      method: 'PATCH',
      body: { images },
      token
    }),

  updateSalonLocation: (
    token: string,
    data: {
      address: string;
      city: string;
      state?: string;
      country?: string;
      location: { latitude: number; longitude: number };
      confirmedPremises: boolean;
    }
  ) =>
    request<{ salon: SalonOwnerData; message: string }>('/owner/salon/location', {
      method: 'PATCH',
      body: data,
      token
    }),

  // Owner services management
  getOwnerServices: (token: string) =>
    request<{ count: number; data: Service[] }>('/owner/services', { token }),

  createOwnerService: (
    token: string,
    body: {
      name: string;
      price: number;
      durationMinutes?: number;
      category?: string;
      description?: string;
      image?: string;
      isActive?: boolean;
    }
  ) =>
    request<{ message: string; service: Service }>('/owner/services', {
      method: 'POST',
      body,
      token
    }),

  updateOwnerService: (
    token: string,
    serviceId: string,
    body: Partial<{
      name: string;
      price: number;
      durationMinutes?: number;
      category?: string;
      description?: string;
      image?: string;
      isActive?: boolean;
    }>
  ) =>
    request<{ message: string; service: Service }>(`/owner/services/${serviceId}`, {
      method: 'PUT',
      body,
      token
    }),

  toggleOwnerService: (token: string, serviceId: string) =>
    request<{ message: string; service: Service }>(`/owner/services/${serviceId}/toggle`, {
      method: 'PATCH',
      token
    }),

  deleteOwnerService: (token: string, serviceId: string) =>
    request<{ message: string }>(`/owner/services/${serviceId}`, {
      method: 'DELETE',
      token
    }),

  getSubscriptionPlans: () =>
    request<{ data: PlanDetails[] }>('/subscriptions/plans'),

  getOwnerSubscriptionStatus: (token: string) =>
    request<{
      salon: { id: string; salonName: string; status: string; subscriptionStatus: string };
      subscription: SubscriptionData | null;
      message: string;
    }>('/owner/subscription/status', { token }),

  createRazorpayOrder: (
    token: string,
    body: {
      plan: PlanType;
      billingCycle: BillingCycle;
    }
  ) =>
    request<{
      orderId: string;
      amount: number;
      amountInRupees: number;
      currency: string;
      keyId: string;
      plan: PlanType;
      billingCycle: BillingCycle;
      salonName: string;
    }>('/owner/subscription/razorpay/order', {
      method: 'POST',
      body,
      token
    }),

  verifyRazorpayPayment: (
    token: string,
    body: {
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
      plan: PlanType;
      billingCycle: BillingCycle;
    }
  ) =>
    request<{
      success: boolean;
      transactionId: string;
      amount: number;
      plan: PlanDetails;
      billingCycle: BillingCycle;
      payment: any;
      subscription: SubscriptionData;
      salon: SalonOwnerData;
      message: string;
    }>('/owner/subscription/razorpay/verify', {
      method: 'POST',
      body,
      token
    }),

  getRazorpayTestSignature: (token: string, orderId: string, paymentId: string) =>
    request<{ signature: string }>('/owner/subscription/razorpay/test-signature', {
      method: 'POST',
      body: { orderId, paymentId },
      token
    }),

  mockCheckout: (
    token: string,
    body: {
      plan: PlanType;
      billingCycle: BillingCycle;
      paymentMethod?: string;
    }
  ) =>
    request<{
      success: boolean;
      transactionId: string;
      amount: number;
      plan: PlanDetails;
      billingCycle: BillingCycle;
      subscription: SubscriptionData;
      salon: SalonOwnerData;
      message: string;
    }>('/owner/subscription/mock-checkout', {
      method: 'POST',
      body,
      token
    }),

  // Admin endpoints
  getPendingSalons: (token: string) =>
    request<{ data: SalonOwnerData[] }>('/admin/salons/pending', { token }),

  approveSalon: (token: string, salonId: string) =>
    request<{ message: string; salon: SalonOwnerData }>(`/admin/salons/${salonId}/approve`, {
      method: 'PATCH',
      token
    }),

  rejectSalon: (token: string, salonId: string, reason: string) =>
    request<{ message: string; salon: SalonOwnerData }>(`/admin/salons/${salonId}/reject`, {
      method: 'PATCH',
      body: { reason },
      token
    }),

  // Owner availability and operating hours
  getSalonAvailability: (token: string) =>
    request<{ workingHours: WorkingHours; unavailableDates: string[] }>('/owner/salon/availability', { token }),

  updateSalonAvailability: (
    token: string,
    body: { workingHours?: WorkingHours; unavailableDates?: string[] }
  ) =>
    request<{ message: string; workingHours: WorkingHours; unavailableDates: string[] }>('/owner/salon/availability', {
      method: 'PATCH',
      token,
      body
    })
};
