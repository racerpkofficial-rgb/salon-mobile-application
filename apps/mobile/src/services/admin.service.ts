import { request } from '../api/client';
import { PlanDetails, SalonOwnerData, SubscriptionData, SupportTicket, TicketStatus } from '../types';

export interface AdminDashboardData {
  message: string;
  stats: {
    pendingSalons: number;
    activeSalons: number;
    suspendedSalons: number;
    totalCustomers: number;
    activeSubscriptions: number;
    openTickets?: number;
    totalTickets?: number;
  };
  recentRegistrations: {
    salons: SalonOwnerData[];
    customers: Array<{ _id: string; name: string; email: string; createdAt: string; isActive: boolean }>;
  };
  recentPayments: SubscriptionData[];
}

export interface AdminOffer {
  _id: string;
  title: string;
  code: string;
  discountPercent: number;
  description: string;
  validUntil: string;
  isActive: boolean;
  createdAt: string;
}

export interface PlanWithStats extends PlanDetails {
  activeSubscribers: number;
  totalSubscribers: number;
  totalRevenue: number;
}

export const adminService = {
  getDashboard: (token: string) =>
    request<AdminDashboardData>('/admin/dashboard', { token }),

  getPendingSalons: (token: string) =>
    request<{ data: SalonOwnerData[] }>('/admin/salons/pending', { token }),

  getActiveSalons: (token: string) =>
    request<{ data: SalonOwnerData[] }>('/admin/salons/active', { token }),

  getSuspendedSalons: (token: string) =>
    request<{ data: SalonOwnerData[] }>('/admin/salons/suspended', { token }),

  getSalonDetails: (token: string, id: string) =>
    request<{ data: SalonOwnerData }>((`/admin/salons/${id}`), { token }),

  approveSalon: (token: string, id: string) =>
    request<{ message: string; salon: SalonOwnerData }>(`/admin/salons/${id}/approve`, {
      method: 'PATCH',
      token
    }),

  rejectSalon: (token: string, id: string, reason: string) =>
    request<{ message: string; salon: SalonOwnerData }>(`/admin/salons/${id}/reject`, {
      method: 'PATCH',
      body: { reason },
      token
    }),

  suspendSalon: (token: string, id: string) =>
    request<{ message: string; salon: SalonOwnerData }>(`/admin/salons/${id}/suspend`, {
      method: 'PATCH',
      token
    }),

  reactivateSalon: (token: string, id: string) =>
    request<{ message: string; salon: SalonOwnerData }>(`/admin/salons/${id}/reactivate`, {
      method: 'PATCH',
      token
    }),

  getSubscriptionPlans: (token: string) =>
    request<{ data: PlanWithStats[] }>('/admin/subscriptions/plans', { token }),

  getPayments: (token: string) =>
    request<{ totalVolume: number; count: number; data: any[] }>('/admin/payments', { token }),

  getCustomers: (token: string) =>
    request<{
      count: number;
      data: Array<{ _id: string; name: string; email: string; isActive: boolean; createdAt: string }>;
    }>('/admin/customers', { token }),

  getOffers: (token: string) =>
    request<{ data: AdminOffer[] }>('/admin/offers', { token }),

  createOffer: (token: string, offer: { title: string; code: string; discountPercent: number; description: string; validUntil: string }) =>
    request<{ message: string; data: AdminOffer }>('/admin/offers', {
      method: 'POST',
      body: offer,
      token
    }),

  toggleOffer: (token: string, id: string) =>
    request<{ message: string; data: AdminOffer }>(`/admin/offers/${id}/toggle`, {
      method: 'PATCH',
      token
    }),

  deleteOffer: (token: string, id: string) =>
    request<{ message: string }>(`/admin/offers/${id}`, {
      method: 'DELETE',
      token
    }),

  getSupportTickets: (
    token: string,
    params?: { page?: number; limit?: number; status?: string; search?: string; category?: string }
  ) => {
    const q = new URLSearchParams();
    if (params?.page) q.append('page', String(params.page));
    if (params?.limit) q.append('limit', String(params.limit));
    if (params?.status) q.append('status', params.status);
    if (params?.search) q.append('search', params.search);
    if (params?.category) q.append('category', params.category);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request<TicketListResponse>(`/admin/tickets${qs}`, { token });
  },

  getSupportTicketDetails: (token: string, id: string) =>
    request<{ ticket: SupportTicket }>(`/admin/tickets/${id}`, { token }),

  updateTicketStatus: (
    token: string,
    id: string,
    body: { status: TicketStatus; adminNotes?: string }
  ) =>
    request<{ message: string; ticket: SupportTicket }>(`/admin/tickets/${id}/status`, {
      method: 'PATCH',
      body,
      token
    })
};

export interface TicketListResponse {
  tickets: SupportTicket[];
  total: number;
  page: number;
  totalPages: number;
  stats: {
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    closed: number;
  };
}
