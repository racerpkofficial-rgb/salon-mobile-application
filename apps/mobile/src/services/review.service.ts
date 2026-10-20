import { request } from '../api/client';
import { ReviewData, ReviewEligibility } from '../types';

export interface SalonReviewsResponse {
  data: ReviewData[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: {
    averageRating: number;
    totalReviews: number;
    distribution: Record<number, number>;
  };
}

export const reviewService = {
  // Check whether a customer is eligible to review an appointment with 48h deadline status
  getReviewEligibility: (token: string, appointmentId: string) =>
    request<ReviewEligibility>(`/appointments/${appointmentId}/review-eligibility`, {
      token
    }),

  // Submit a customer review with rating and comment (strictly enforced 48h limit)
  submitReview: (
    token: string,
    appointmentId: string,
    body: { rating: number; comment: string; photos?: string[] }
  ) =>
    request<{ message: string; review: ReviewData; salonStats?: { rating: number; reviews: number } }>(
      `/appointments/${appointmentId}/review`,
      {
        method: 'POST',
        body,
        token
      }
    ),

  // Public Reviews: List all reviews or filtered by salon, rating, sortBy, search, page
  getPublicReviews: (params: {
    salonId?: string;
    rating?: number;
    sortBy?: 'newest' | 'oldest' | 'highest' | 'lowest';
    search?: string;
    page?: number;
    limit?: number;
  } = {}) => {
    const queryParts: string[] = [];
    if (params.salonId) queryParts.push(`salonId=${encodeURIComponent(params.salonId)}`);
    if (params.rating) queryParts.push(`rating=${params.rating}`);
    if (params.sortBy) queryParts.push(`sortBy=${encodeURIComponent(params.sortBy)}`);
    if (params.search) queryParts.push(`search=${encodeURIComponent(params.search)}`);
    if (params.page) queryParts.push(`page=${params.page}`);
    if (params.limit) queryParts.push(`limit=${params.limit}`);

    const qs = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
    return request<SalonReviewsResponse>(`/reviews${qs}`);
  },

  // List reviews for a specific salon
  getSalonReviews: (salonId: string, page = 1, limit = 20) =>
    request<SalonReviewsResponse>(`/salons/${salonId}/reviews?page=${page}&limit=${limit}`),

  // Salon Owner: Reply to a customer review
  replyToReview: (token: string, reviewId: string, reply: string) =>
    request<{ message: string; review: ReviewData }>(`/reviews/${reviewId}/reply`, {
      method: 'POST',
      body: { reply },
      token
    })
};
