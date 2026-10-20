import { request } from '../api/client';
import { AuthResponse, AuthUser, GoogleAuthResponse, IdentityProof, SalonOwnerData, SubscriptionData, UserRole } from '../types';

export interface CustomerRegistrationPayload {
  name: string;
  email: string;
  password: string;
  confirmPassword?: string;
  phone?: string;
}

export interface SalonOwnerRegistrationPayload {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword?: string;
  salonName: string;
  address: string;
  city: string;
  identityProof: IdentityProof;
}

export interface DocumentUploadResponse {
  url: string;
  filename: string;
  fileType: string;
  fileSize?: number;
}

export const authService = {

  login: (email: string, password: string, expectedRole?: UserRole) => {
    const endpoint =
      expectedRole === 'CUSTOMER'
        ? '/auth/customer/login'
        : expectedRole === 'SALON_OWNER'
          ? '/auth/salon-owner/login'
          : '/auth/login';
    return request<AuthResponse>(endpoint, {
      method: 'POST',
      body: { email, password, expectedRole }
    });
  },

  googleLogin: (idToken: string, role?: UserRole) =>
    request<GoogleAuthResponse>('/auth/google', {
      method: 'POST',
      body: { idToken, role }
    }),

  registerCustomer: (data: CustomerRegistrationPayload) =>
    request<AuthResponse>('/auth/register/customer', { method: 'POST', body: data }),

  registerOwner: (data: SalonOwnerRegistrationPayload) =>
    request<AuthResponse>('/auth/register/salon-owner', { method: 'POST', body: data }),

  uploadDocument: (payload: { filename: string; fileType: string; fileSize?: number; fileData?: string }) =>
    request<DocumentUploadResponse>('/auth/upload-document', { method: 'POST', body: payload }),

  getProfile: (token: string) =>
    request<{ message: string; user: AuthUser; salon?: SalonOwnerData; subscription?: SubscriptionData }>(
      '/profile/me',
      { token }
    ),

  updateProfile: (token: string, data: Partial<AuthUser> & { salonName?: string; description?: string; images?: string[] }) =>
    request<{ message: string; user: AuthUser; salon?: SalonOwnerData }>('/profile/me', {
      method: 'PUT',
      token,
      body: data
    }),

  logout: (token: string) => request<void>('/auth/logout', { method: 'POST', token }),

  getCustomerProfile: (token: string) =>
    request<{ message: string; user: AuthUser }>('/customer/profile', { token }),

  getOwnerProfile: (token: string) =>
    request<{ message: string; user: AuthUser; salon?: SalonOwnerData }>('/owner/profile', { token }),

  getAdminDashboard: (token: string) =>
    request<{ message: string; user: AuthUser }>('/admin/dashboard', { token }),

  getAdminProfile: (token: string) =>
    request<{ message: string; user: AuthUser }>('/admin/profile', { token }),

  forgotPassword: (email: string, role: UserRole) =>
    request<{ message: string; email: string }>('/auth/forgot-password', {
      method: 'POST',
      body: { email, role }
    }),

  verifyResetOtp: (email: string, otp: string, role: UserRole) =>
    request<{ message: string; resetToken: string }>('/auth/verify-reset-otp', {
      method: 'POST',
      body: { email, otp, role }
    }),

  resetPassword: (resetToken: string, newPassword: string, confirmPassword?: string) =>
    request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: { resetToken, newPassword, confirmPassword }
    }),

  changePassword: (
    token: string,
    payload: { currentPassword?: string; otp?: string; newPassword: string; confirmPassword?: string }
  ) =>
    request<{ message: string }>('/auth/change-password', {
      method: 'PUT',
      token,
      body: payload
    }),

  requestSetupPasswordOtp: (token: string) =>
    request<{ message: string }>('/auth/request-setup-password-otp', {
      method: 'POST',
      token
    }),

  updateNotificationPreferences: (
    token: string,
    preferences: Partial<{ bookingUpdates: boolean; reminders: boolean; promotions: boolean }>
  ) =>
    request<{ message: string; notificationPreferences: { bookingUpdates: boolean; reminders: boolean; promotions: boolean } }>(
      '/profile/notifications',
      {
        method: 'PATCH',
        token,
        body: preferences
      }
    ),

  uploadProfilePhoto: (token: string, imageData: string) =>
    request<{ message: string; url: string; user?: AuthUser }>('/profile/upload-photo', {
      method: 'POST',
      token,
      body: { image: imageData }
    }),

  deleteAccount: (token: string) =>
    request<{ message: string }>('/profile/account', {
      method: 'DELETE',
      token
    }),

  reportProblem: (
    token: string,
    payload: { category: string; description: string; contactEmail?: string; subject?: string }
  ) =>
    request<{ message: string; ticketId: string; category: string }>('/profile/report-problem', {
      method: 'POST',
      token,
      body: payload
    })
};