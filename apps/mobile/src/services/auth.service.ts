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
  state?: string;
  country?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  identityProof: IdentityProof;
}

export interface DocumentUploadResponse {
  url: string;
  publicId?: string;
  filename: string;
  fileType: string;
  fileSize?: number;
}

export interface DocumentUploadSignature {
  timestamp: number;
  signature: string;
  apiKey: string;
  cloudName: string;
  folder: string;
  publicId: string;
  resourceType: 'image' | 'raw';
  deliveryType: 'authenticated';
}

interface CloudinaryDocumentUploadResponse {
  public_id: string;
  secure_url: string;
  bytes: number;
}

class CloudinaryUploadError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'CloudinaryUploadError';
  }
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

  uploadDocument: (payload: { filename: string; fileType: string; fileSize: number; fileData: string } | FormData) =>
    request<DocumentUploadResponse>('/auth/upload-document', {
      method: 'POST',
      body: payload,
      timeoutMs: 120000,
      diagnosticLabel: 'identity-document-upload'
    }),

  createDocumentUploadSignature: (payload: {
    filename: string;
    fileType: string;
    fileSize: number;
  }) =>
    request<DocumentUploadSignature>('/auth/upload-document/signature', {
      method: 'POST',
      body: payload,
      diagnosticLabel: 'identity-document-signature'
    }),

  uploadDocumentToCloudinary: async (
    fileUri: string,
    filename: string,
    fileType: string,
    signature: DocumentUploadSignature
  ): Promise<CloudinaryDocumentUploadResponse> => {
    const formData = new FormData();
    formData.append('file', { uri: fileUri, name: filename, type: fileType } as any);
    formData.append('api_key', signature.apiKey);
    formData.append('timestamp', String(signature.timestamp));
    formData.append('signature', signature.signature);
    formData.append('folder', signature.folder);
    formData.append('public_id', signature.publicId);
    formData.append('type', signature.deliveryType);

    const controller = new AbortController();
    const timeoutMs = 120000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = Date.now();
    const uploadUrl = `https://api.cloudinary.com/v1_1/${signature.cloudName}/${signature.resourceType}/upload`;

    try {
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });
      clearTimeout(timer);
      const result = await response.json().catch(() => null);

      const responseDiagnostic = {
        resourceType: signature.resourceType,
        status: response.status,
        elapsedMs: Date.now() - startedAt
      };
      console.info('[Cloudinary] Identity document upload response', responseDiagnostic);
      if (!response.ok) {
        console.warn('[Cloudinary] Identity document upload was rejected', responseDiagnostic);
        throw new CloudinaryUploadError(
          result?.error?.message || `Cloudinary upload failed (${response.status}).`,
          response.status
        );
      }
      const expectedPublicIds = [
        signature.publicId,
        `${signature.folder}/${signature.publicId}`
      ];
      if (
        !expectedPublicIds.includes(result?.public_id) ||
        typeof result?.secure_url !== 'string' ||
        !Number.isFinite(result?.bytes)
      ) {
        throw new CloudinaryUploadError(
          'Cloudinary returned an incomplete upload confirmation.',
          response.status
        );
      }

      return result as CloudinaryDocumentUploadResponse;
    } catch (error: any) {
      clearTimeout(timer);
      if (error instanceof CloudinaryUploadError) {
        throw error;
      }
      const timedOut = error?.name === 'AbortError';
      console.error('[Cloudinary] Identity document upload transport failure', {
        resourceType: signature.resourceType,
        errorName: error?.name || 'UnknownError',
        errorMessage:
          typeof error?.message === 'string'
            ? error.message.replace(/https?:\/\/\S+/gi, '[url]').slice(0, 160)
            : 'No platform error message',
        elapsedMs: Date.now() - startedAt
      });
      throw new Error(
        timedOut
          ? 'Cloudinary upload timed out. Check your connection and try again.'
          : `Cloudinary network request failed (${error?.name || 'unknown error'}). Check your internet connection and try again.`
      );
    }
  },

  confirmDocumentUpload: (payload: {
    publicId: string;
    filename: string;
    fileType: string;
    fileSize: number;
  }) =>
    request<DocumentUploadResponse>('/auth/upload-document/confirm', {
      method: 'POST',
      body: payload,
      timeoutMs: 30000,
      diagnosticLabel: 'identity-document-confirmation'
    }),

  verifyEmailOtp: (email: string, otp: string) =>
    request<AuthResponse>('/auth/verify-email-otp', {
      method: 'POST',
      body: { email, otp }
    }),

  resendEmailOtp: (email: string) =>
    request<{ message: string; cooldownSeconds?: number }>('/auth/resend-email-otp', {
      method: 'POST',
      body: { email }
    }),

  getProfile: (token: string) =>
    request<{ message: string; user: AuthUser; salon?: SalonOwnerData; subscription?: SubscriptionData }>(
      '/profile/me',
      { token }
    ),

  updateProfile: (
    token: string,
    data: Partial<AuthUser> & {
      salonName?: string;
      description?: string;
      images?: string[];
      location?: { latitude: number; longitude: number };
    }
  ) =>
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
    request<{ message: string; url: string; publicId?: string; user?: AuthUser }>('/profile/upload-photo', {
      method: 'POST',
      token,
      body: { image: imageData }
    }),

  deleteAccount: (token: string) =>
    request<{ message: string }>('/profile/account', {
      method: 'DELETE',
      token
    }),

  requestAccountDeletion: (
    token: string,
    payload: { reason: string; feedback?: string }
  ) =>
    request<{ message: string; scheduledDeletionAt: string; gracePeriodDays: number }>(
      '/profile/account-deletion',
      {
        method: 'POST',
        token,
        body: payload
      }
    ),

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