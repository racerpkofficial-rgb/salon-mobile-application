import { request } from '../api/client';
import {
  CouponAnalyticsData,
  CouponData,
  CreateCouponPayload,
  OwnerCouponsResponse,
  UpdateCouponPayload,
  ValidateCouponResult
} from '../types';

export interface ExploreSalonCouponGroup {
  salon: {
    id: string;
    salonName: string;
    city: string;
    address: string;
    images?: string[];
  };
  coupons: CouponData[];
}

export const couponService = {
  // Owner: Get all coupons for owner's salon with dashboard summary
  getOwnerCoupons: (token: string) =>
    request<OwnerCouponsResponse>('/owner/coupons', { token }),

  // Owner: Get single coupon
  getOwnerCouponById: (token: string, couponId: string) =>
    request<{ coupon: CouponData }>(`/owner/coupons/${couponId}`, { token }),

  // Owner: Create a new coupon
  createCoupon: (token: string, body: CreateCouponPayload) =>
    request<{ message: string; coupon: CouponData }>('/owner/coupons', {
      method: 'POST',
      body,
      token
    }),

  // Owner: Update an existing coupon
  updateCoupon: (token: string, couponId: string, body: UpdateCouponPayload) =>
    request<{ message: string; coupon: CouponData }>(`/owner/coupons/${couponId}`, {
      method: 'PUT',
      body,
      token
    }),

  // Owner: Activate or pause coupon
  setCouponStatus: (token: string, couponId: string, status: 'ACTIVE' | 'PAUSED') =>
    request<{ message: string; coupon: CouponData }>(`/owner/coupons/${couponId}/status`, {
      method: 'PATCH',
      body: { status },
      token
    }),

  // Owner: Safely delete coupon
  deleteCoupon: (token: string, couponId: string) =>
    request<{ message: string }>(`/owner/coupons/${couponId}`, {
      method: 'DELETE',
      token
    }),

  // Owner: Get usage statistics and analytics for coupon
  getCouponAnalytics: (token: string, couponId: string) =>
    request<CouponAnalyticsData>(`/owner/coupons/${couponId}/analytics`, { token }),

  // Customer / Public: Get eligible coupons for a specific salon
  getSalonCoupons: (salonId: string, serviceId?: string) => {
    const query = serviceId ? `?serviceId=${encodeURIComponent(serviceId)}` : '';
    return request<{ count: number; coupons: CouponData[] }>(`/salons/${salonId}/coupons${query}`);
  },

  // Customer: Validate coupon code during booking
  validateCoupon: (
    token: string,
    body: {
      salonId: string;
      code: string;
      servicePrice: number;
      serviceId?: string;
      serviceName?: string;
    }
  ) =>
    request<ValidateCouponResult>('/customer/coupons/validate', {
      method: 'POST',
      body,
      token
    }),

  // Customer: Explore available coupons across active salons
  getExploreCoupons: () =>
    request<{ data: ExploreSalonCouponGroup[] }>('/customer/coupons/explore')
};
