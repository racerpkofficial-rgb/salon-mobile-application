import { cert, initializeApp } from 'firebase-admin/app';
import { getMessaging, type MulticastMessage } from 'firebase-admin/messaging';
import { Types } from 'mongoose';
import { Notification, NotificationDocument, NotificationType } from '../models/Notification.js';
import { User } from '../models/User.js';

let isFirebaseInitialized = false;

// Initialize Firebase Admin if credentials are provided in environment
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    initializeApp({
      credential: cert(serviceAccount)
    });
    isFirebaseInitialized = true;
    console.log('[FCM] Firebase Admin initialized with service account.');
  } else if (process.env.FIREBASE_PROJECT_ID) {
    initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID
    });
    isFirebaseInitialized = true;
    console.log('[FCM] Firebase Admin initialized with project ID.');
  } else {
    console.log('[FCM] Running in simulated mode (no FIREBASE_SERVICE_ACCOUNT provided). Push notifications will be persisted to MongoDB and logged.');
  }
} catch (error) {
  console.warn('[FCM] Failed to initialize Firebase Admin, running in simulated mode:', error);
}

export interface SendPushOptions {
  recipientId: Types.ObjectId | string;
  senderId?: Types.ObjectId | string;
  salonId?: Types.ObjectId | string;
  appointmentId?: Types.ObjectId | string;
  offerId?: Types.ObjectId | string;
  type: NotificationType;
  title: string;
  body: string;
  targetScreen?: string;
  data?: Record<string, string>;
}

export const fcmService = {
  isInitialized(): boolean {
    return isFirebaseInitialized;
  },

  /**
   * Register device FCM push token for a user.
   */
  async registerToken(userId: Types.ObjectId | string, token: string): Promise<boolean> {
    if (!token || !token.trim()) return false;
    await User.findByIdAndUpdate(userId, {
      $addToSet: { fcmTokens: token.trim() }
    });
    return true;
  },

  /**
   * Unregister device FCM token (e.g. on logout).
   */
  async unregisterToken(userId: Types.ObjectId | string, token: string): Promise<boolean> {
    if (!token) return false;
    await User.findByIdAndUpdate(userId, {
      $pull: { fcmTokens: token.trim() }
    });
    return true;
  },

  /**
   * Send a push notification to a user, persisting it in MongoDB and transmitting via FCM.
   * Includes duplicate prevention and sensitive data stripping.
   */
  async sendNotification(options: SendPushOptions): Promise<NotificationDocument> {
    const {
      recipientId,
      senderId,
      salonId,
      appointmentId,
      offerId,
      type,
      title,
      body,
      data = {}
    } = options;

    const recipientObjId = new Types.ObjectId(recipientId.toString());
    const appointmentObjId = appointmentId ? new Types.ObjectId(appointmentId.toString()) : undefined;
    const salonObjId = salonId ? new Types.ObjectId(salonId.toString()) : undefined;

    // 1. Idempotency & Duplicate Prevention:
    // A. If appointmentId provided, prevent duplicate notifications of same type for the appointment
    if (appointmentObjId) {
      const existing = await Notification.findOne({
        recipientId: recipientObjId,
        type,
        appointmentId: appointmentObjId
      });
      if (existing) {
        console.log(`[FCM Duplicate Prevention] Notification ${type} already exists for appointment ${appointmentId}. Returning existing.`);
        return existing;
      }
    }

    // B. If salon approval or rejection, prevent duplicate notifications within 5 minutes
    if (type === 'SALON_APPROVED' || type === 'SALON_REJECTED') {
      const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
      const existing = await Notification.findOne({
        recipientId: recipientObjId,
        type,
        salonId: salonObjId,
        createdAt: { $gte: fiveMinsAgo }
      });
      if (existing) {
        console.log(`[FCM Duplicate Prevention] Notification ${type} recently recorded for salon ${salonId}. Returning existing.`);
        return existing;
      }
    }

    // C. Check optional idempotencyKey
    if (data?.idempotencyKey) {
      const existing = await Notification.findOne({
        recipientId: recipientObjId,
        'data.idempotencyKey': data.idempotencyKey
      });
      if (existing) {
        return existing;
      }
    }

    // 2. Filter sensitive information from push data payload
    const safeData: Record<string, string> = {};
    for (const [key, val] of Object.entries(data)) {
      const lower = key.toLowerCase();
      if (!lower.includes('password') && !lower.includes('secret') && !lower.includes('token') && !lower.includes('hash')) {
        safeData[key] = String(val);
      }
    }

    const determinedTargetScreen = options.targetScreen || options.data?.targetScreen || options.data?.screen;
    if (determinedTargetScreen) {
      safeData.targetScreen = determinedTargetScreen;
      safeData.screen = determinedTargetScreen;
    }

    // 3. Store notification record in MongoDB so user can view history inside the app
    const notification = await Notification.create({
      recipientId: recipientObjId,
      senderId: senderId ? new Types.ObjectId(senderId.toString()) : undefined,
      salonId: salonObjId,
      appointmentId: appointmentObjId,
      offerId: offerId ? new Types.ObjectId(offerId.toString()) : undefined,
      type,
      title,
      message: body,
      targetScreen: determinedTargetScreen,
      data: safeData,
      isRead: false
    });

    // 4. Fetch user's registered FCM tokens and notification preferences
    const user = await User.findById(recipientId).select('fcmTokens email name notificationPreferences');
    const tokens = user?.fcmTokens || [];

    const prefs = user?.notificationPreferences || { bookingUpdates: true, reminders: true, promotions: true };
    const isBooking = [
      'BOOKING_REQUEST_SENT',
      'BOOKING_ACCEPTED',
      'BOOKING_CONFIRMED',
      'BOOKING_REJECTED',
      'BOOKING_CANCELLED',
      'BOOKING_COMPLETED'
    ].includes(type);
    const isReminder = type === 'APPOINTMENT_REMINDER';
    const isPromo = type === 'OFFER_PUBLISHED';

    if (
      (isBooking && prefs.bookingUpdates === false) ||
      (isReminder && prefs.reminders === false) ||
      (isPromo && prefs.promotions === false)
    ) {
      console.log(`[FCM Preference] Push notification ${type} suppressed for recipient ${user?.email || recipientId} per user preferences.`);
      return notification;
    }

    // 5. Dispatch via Firebase Cloud Messaging if live tokens available
    if (isFirebaseInitialized && tokens.length > 0) {
      try {
        const payload: MulticastMessage = {
          tokens,
          notification: {
            title,
            body
          },
          data: {
            notificationId: notification._id.toString(),
            type,
            ...safeData
          }
        };

        const response = await getMessaging().sendEachForMulticast(payload);
        console.log(`[FCM Live] Sent to ${response.successCount}/${tokens.length} devices for recipient ${user?.email || recipientId}`);
      } catch (fcmErr) {
        console.error('[FCM Live] Error dispatching multicast message (credentials or network):', (fcmErr as any)?.message || fcmErr);
      }
    } else {
      console.log(`[FCM Simulated] Stored in DB for ${user?.name || recipientId}. Title: "${title}" | Message: "${body}"`);
    }

    return notification;
  },

  /**
   * Broadcast push notification to multiple users (e.g. all customers when an offer is published).
   */
  async broadcastNotification(
    recipientIds: (Types.ObjectId | string)[],
    options: Omit<SendPushOptions, 'recipientId'>
  ): Promise<NotificationDocument[]> {
    const results: NotificationDocument[] = [];
    for (const recipientId of recipientIds) {
      const notif = await this.sendNotification({
        ...options,
        recipientId
      });
      results.push(notif);
    }
    return results;
  }
};
