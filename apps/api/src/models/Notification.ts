import { Schema, Types, model } from 'mongoose';

export type NotificationType =
  | 'BOOKING_REQUEST_SENT'
  | 'BOOKING_ACCEPTED'
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_REJECTED'
  | 'BOOKING_CANCELLED'
  | 'BOOKING_COMPLETED'
  | 'APPOINTMENT_REMINDER'
  | 'OFFER_PUBLISHED'
  | 'SUBSCRIPTION_STATUS'
  | 'SALON_APPROVED'
  | 'SALON_REJECTED'
  | 'ADMIN_NEW_SALON_REGISTRATION'
  | 'ADMIN_SALON_VERIFICATION_AWAITING'
  | 'ADMIN_REPORT_SUBMITTED'
  | 'ADMIN_SUPPORT_REQUEST'
  | 'ADMIN_ACCOUNT_DELETION_REQUESTED'
  | 'ACCOUNT_DELETION_CANCELLED'
  | 'ACCOUNT_DELETED'
  | 'GENERAL';

export interface NotificationDocument {
  _id: Types.ObjectId;
  recipientId: Types.ObjectId; // User ID
  senderId?: Types.ObjectId; // User ID
  salonId?: Types.ObjectId;
  appointmentId?: Types.ObjectId;
  offerId?: Types.ObjectId;
  relatedRecordId?: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  targetScreen?: string;
  data?: Record<string, any>;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<NotificationDocument>(
  {
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    salonId: {
      type: Schema.Types.ObjectId,
      ref: 'Salon'
    },
    appointmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Appointment'
    },
    offerId: {
      type: Schema.Types.ObjectId,
      ref: 'SalonOffer'
    },
    relatedRecordId: {
      type: Schema.Types.ObjectId
    },
    type: {
      type: String,
      enum: [
        'BOOKING_REQUEST_SENT',
        'BOOKING_ACCEPTED',
        'BOOKING_CONFIRMED',
        'BOOKING_REJECTED',
        'BOOKING_CANCELLED',
        'BOOKING_COMPLETED',
        'APPOINTMENT_REMINDER',
        'OFFER_PUBLISHED',
        'SUBSCRIPTION_STATUS',
        'SALON_APPROVED',
        'SALON_REJECTED',
        'ADMIN_NEW_SALON_REGISTRATION',
        'ADMIN_SALON_VERIFICATION_AWAITING',
        'ADMIN_REPORT_SUBMITTED',
        'ADMIN_SUPPORT_REQUEST',
        'ADMIN_ACCOUNT_DELETION_REQUESTED',
        'ACCOUNT_DELETION_CANCELLED',
        'ACCOUNT_DELETED',
        'GENERAL'
      ],
      default: 'GENERAL'
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    targetScreen: {
      type: String,
      trim: true
    },
    data: {
      type: Schema.Types.Mixed,
      default: {}
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  { timestamps: true }
);

notificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, type: 1, appointmentId: 1 });
notificationSchema.index({ recipientId: 1, type: 1, salonId: 1 });

export const Notification = model<NotificationDocument>('Notification', notificationSchema);
