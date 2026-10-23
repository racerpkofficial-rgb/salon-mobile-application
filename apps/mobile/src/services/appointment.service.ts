import { request } from '../api/client';
import {
  AppointmentData,
  NotificationItem,
  OwnerAppointmentStats,
  TimeSlot
} from '../types';

export interface AvailabilityResponse {
  date: string;
  serviceDuration: number;
  workingHours: {
    openTime: string;
    closeTime: string;
    slotIntervalMinutes: number;
    daysOpen: string[];
  };
  slots: TimeSlot[];
  availableSlotsCount: number;
}

export const appointmentService = {
  // Public / Customer Availability Check
  getAvailability: (
    salonId: string,
    date: string,
    serviceId?: string,
    duration?: number
  ) => {
    const params = new URLSearchParams({ date });
    if (serviceId) params.append('serviceId', serviceId);
    if (duration) params.append('duration', duration.toString());
    return request<AvailabilityResponse>(`/salons/${salonId}/availability?${params.toString()}`);
  },

  // Customer: Book an appointment
  bookAppointment: (
    token: string,
    body: {
      salonId: string;
      serviceId: string;
      offerId?: string;
      couponCode?: string;
      appointmentDate: string;
      startTime: string;
      customerNote?: string;
    }
  ) =>
    request<{ message: string; appointment: AppointmentData }>('/customer/appointments', {
      method: 'POST',
      body,
      token
    }),

  // Customer: View my appointments
  getCustomerAppointments: (token: string) =>
    request<{ count: number; data: AppointmentData[] }>('/customer/appointments', {
      token
    }),

  // Customer: Cancel an appointment
  cancelAppointment: (token: string, appointmentId: string) =>
    request<{ message: string; appointment: AppointmentData }>(
      `/customer/appointments/${appointmentId}/cancel`,
      {
        method: 'PATCH',
        token
      }
    ),

  // Customer: View notifications
  getCustomerNotifications: (token: string) =>
    request<{ unreadCount: number; count: number; data: NotificationItem[] }>(
      '/customer/notifications',
      { token }
    ),

  // Customer: Mark notification read
  markNotificationRead: (token: string, notificationId: string) =>
    request<{ notification: NotificationItem }>(
      `/customer/notifications/${notificationId}/read`,
      {
        method: 'PATCH',
        token
      }
    ),

  // Owner: Summary Dashboard Stats
  getOwnerAppointmentStats: (token: string) =>
    request<OwnerAppointmentStats>('/owner/appointments/stats', {
      token
    }),

  // Owner: View salon appointments with optional query filtering
  getOwnerAppointments: (
    token: string,
    query?: {
      status?: string;
      date?: string;
      month?: string;
      search?: string;
    }
  ) => {
    const params = new URLSearchParams();
    if (query?.status) params.append('status', query.status);
    if (query?.date) params.append('date', query.date);
    if (query?.month) params.append('month', query.month);
    if (query?.search) params.append('search', query.search);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return request<{ count: number; data: AppointmentData[] }>(
      `/owner/appointments${queryString}`,
      { token }
    );
  },

  // Owner: View single appointment details
  getOwnerAppointmentById: (token: string, appointmentId: string) =>
    request<{ appointment: AppointmentData }>(`/owner/appointments/${appointmentId}`, {
      token
    }),

  // Owner: Accept booking (locks slot & notifies customer)
  acceptAppointment: (token: string, appointmentId: string) =>
    request<{ message: string; appointment: AppointmentData }>(
      `/owner/appointments/${appointmentId}/accept`,
      {
        method: 'PATCH',
        token
      }
    ),

  // Owner: Confirm alias
  confirmAppointment: (token: string, appointmentId: string) =>
    request<{ message: string; appointment: AppointmentData }>(
      `/owner/appointments/${appointmentId}/confirm`,
      {
        method: 'PATCH',
        token
      }
    ),

  // Owner: Reject booking (releases slot & notifies customer)
  rejectAppointment: (token: string, appointmentId: string, rejectionReason?: string) =>
    request<{ message: string; appointment: AppointmentData }>(
      `/owner/appointments/${appointmentId}/reject`,
      {
        method: 'PATCH',
        body: rejectionReason ? { rejectionReason } : {},
        token
      }
    ),

  // Owner: Mark appointment completed
  completeAppointment: (token: string, appointmentId: string) =>
    request<{ message: string; appointment: AppointmentData }>(
      `/owner/appointments/${appointmentId}/complete`,
      {
        method: 'PATCH',
        token
      }
    )
};

