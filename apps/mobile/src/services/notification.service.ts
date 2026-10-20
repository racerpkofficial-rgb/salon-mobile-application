import { request } from '../api/client';
import { NotificationItem } from '../types';

export const notificationService = {
  // Get in-app notification history (stored in MongoDB)
  getNotifications: (token: string) =>
    request<{ unreadCount: number; count: number; data: NotificationItem[] }>(
      '/customer/notifications',
      { token }
    ),

  // Mark single notification as read
  markAsRead: (token: string, notificationId: string) =>
    request<{ notification: NotificationItem }>(
      `/customer/notifications/${notificationId}/read`,
      {
        method: 'PATCH',
        token
      }
    ),

  // Mark all notifications as read
  markAllAsRead: (token: string) =>
    request<{ message: string }>('/customer/notifications/mark-all-read', {
      method: 'PATCH',
      token
    }),

  // Register device FCM push token with backend
  registerFcmToken: (token: string, fcmToken: string) =>
    request<{ message: string }>('/notifications/fcm-token', {
      method: 'POST',
      body: { token: fcmToken },
      token
    }),

  // Unregister device FCM push token with backend
  unregisterFcmToken: (token: string, fcmToken: string) =>
    request<{ message: string }>('/notifications/fcm-token', {
      method: 'DELETE',
      body: { token: fcmToken },
      token
    })
};
