import { request } from '../api/client';
import { CustomerOffer, DiscountType, SalonOffer } from '../types';
import { normalizeSalonLocation } from '../utils/location';

export interface CreateOfferPayload {
  title: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  applicableService?: string;
  startDate?: string;
  endDate: string;
  image?: string;
  isActive?: boolean;
}

export const offerService = {
  // Owner: Get all offers for their salon
  getOwnerOffers: (token: string) =>
    request<{ count: number; data: SalonOffer[] }>('/owner/offers', { token }),

  // Owner: Create offer (which broadcasts push notifications)
  createOffer: (token: string, body: CreateOfferPayload) =>
    request<{ message: string; offer: SalonOffer }>('/owner/offers', {
      method: 'POST',
      body,
      token
    }),

  // Owner: Edit offer
  updateOffer: (token: string, offerId: string, body: Partial<CreateOfferPayload>) =>
    request<{ message: string; offer: SalonOffer }>(`/owner/offers/${offerId}`, {
      method: 'PUT',
      body,
      token
    }),

  // Owner: Toggle active/inactive
  toggleOffer: (token: string, offerId: string) =>
    request<{ message: string; offer: SalonOffer }>(`/owner/offers/${offerId}/toggle`, {
      method: 'PATCH',
      token
    }),

  // Owner: Delete offer
  deleteOffer: (token: string, offerId: string) =>
    request<{ message: string }>(`/owner/offers/${offerId}`, {
      method: 'DELETE',
      token
    }),

  // Customer / Public: Get active offers for a specific salon
  getSalonOffers: (salonId: string) =>
    request<{ count: number; data: SalonOffer[] }>(`/salons/${salonId}/offers`),

  // Owner: Upload offer image
  uploadOfferImage: (token: string, imageData: string, fileType?: string) =>
    request<{ message: string; url: string; publicId: string }>('/owner/offers/upload', {
      method: 'POST',
      body: { imageData, fileType },
      token
    }),

  // Customer: Get single offer details with populated salon
  getOfferDetails: async (offerId: string): Promise<{
    data: CustomerOffer & {
      isExpired?: boolean;
      applicableServiceDetails?: any;
    };
  }> => {
    const res = await request<{
      data: CustomerOffer & {
        isExpired?: boolean;
        applicableServiceDetails?: any;
      };
    }>(`/offers/${offerId}`);
    return {
      ...res,
      data: {
        ...res.data,
        salon: res.data?.salon ? normalizeSalonLocation(res.data.salon) : res.data?.salon
      }
    };
  }
};

