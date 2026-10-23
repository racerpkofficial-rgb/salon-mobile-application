import { Types } from 'mongoose';
import { Notification, NotificationDocument, NotificationType } from '../models/Notification.js';
import { User } from '../models/User.js';
import { fcmService } from './fcm.service.js';

export interface AdminNotificationOptions {
  eventType?: NotificationType;
  type?: NotificationType;
  title: string;
  message: string;
  relatedRecordId?: Types.ObjectId | string;
  salonId?: Types.ObjectId | string;
  appointmentId?: Types.ObjectId | string;
  targetScreen?: string;
  data?: Record<string, any>;
  idempotencyKey?: string;
}

export const adminNotificationService = {
  /**
   * Dispatches an event notification to all registered SUPER_ADMIN users.
   * Persists in-app notifications in MongoDB (always available offline)
   * and delivers push notifications to registered admin devices if available.
   */
  async notifyAdmins(options: AdminNotificationOptions): Promise<NotificationDocument[]> {
    const eventType = (options.eventType || options.type || 'SYSTEM') as NotificationType;
    const {
      title,
      message,
      relatedRecordId,
      salonId,
      appointmentId,
      targetScreen,
      data = {},
      idempotencyKey
    } = options;

    // Find all super administrators
    const admins = await User.find({ role: 'SUPER_ADMIN', isActive: true }).select('_id name email fcmTokens');
    if (!admins || admins.length === 0) {
      console.warn('[Admin Notification] No active SUPER_ADMIN user found to receive event notification:', eventType);
      return [];
    }

    const createdNotifications: NotificationDocument[] = [];
    const relatedRecordObjId = relatedRecordId ? new Types.ObjectId(relatedRecordId.toString()) : undefined;
    const salonObjId = salonId ? new Types.ObjectId(salonId.toString()) : undefined;
    const appointmentObjId = appointmentId ? new Types.ObjectId(appointmentId.toString()) : undefined;

    for (const admin of admins) {
      // 1. Prevent duplicate notifications if processed repeatedly
      const filterKey = idempotencyKey || `${eventType}:${relatedRecordId || 'none'}`;
      const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);

      const existing = await Notification.findOne({
        recipientId: admin._id,
        type: eventType,
        $or: [
          { 'data.idempotencyKey': filterKey },
          { relatedRecordId: relatedRecordObjId, createdAt: { $gte: fiveMinsAgo } }
        ]
      });

      if (existing) {
        console.log(`[Admin Notification Duplicate Prevention] Event ${eventType} already notified to admin ${admin.email}. Skipping.`);
        createdNotifications.push(existing);
        continue;
      }

      // 2. Persist in MongoDB
      const notification = await Notification.create({
        recipientId: admin._id,
        type: eventType,
        title,
        message,
        relatedRecordId: relatedRecordObjId,
        salonId: salonObjId,
        appointmentId: appointmentObjId,
        targetScreen: targetScreen || 'AdminDashboard',
        data: {
          ...data,
          idempotencyKey: filterKey
        },
        isRead: false
      });

      // 3. Dispatch FCM Push Notification if live tokens exist
      try {
        if (admin.fcmTokens && admin.fcmTokens.length > 0) {
          await fcmService.sendNotification({
            recipientId: admin._id,
            type: eventType,
            title,
            body: message,
            targetScreen: targetScreen || 'AdminDashboard',
            data: {
              notificationId: notification._id.toString(),
              relatedRecordId: relatedRecordId ? relatedRecordId.toString() : '',
              idempotencyKey: filterKey
            }
          });
        }
      } catch (pushErr: any) {
        console.warn(`[Admin Push Notification] Could not deliver push to admin ${admin.email}:`, pushErr?.message || pushErr);
      }

      createdNotifications.push(notification);
    }

    console.info(`[Admin Notification] Event ${eventType} successfully recorded for ${createdNotifications.length} admin(s).`);
    return createdNotifications;
  }
};
