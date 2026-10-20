import { Schema, Types, model } from 'mongoose';

export type EmailEventType =
  | 'CUSTOMER_WELCOME'
  | 'OWNER_WELCOME'
  | 'WELCOME_BACK'
  | 'OWNER_REGISTRATION_RECEIVED'
  | 'OWNER_APPLICATION_APPROVED'
  | 'OWNER_APPLICATION_REJECTED';

export type EmailDeliveryStatus = 'PENDING' | 'SENT' | 'FAILED';

export interface EmailLogDocument {
  _id: Types.ObjectId;
  recipientEmail: string;
  eventType: EmailEventType;
  referenceId: Types.ObjectId;
  idempotencyKey: string;
  subject: string;
  status: EmailDeliveryStatus;
  attempts: number;
  error?: string;
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const emailLogSchema = new Schema<EmailLogDocument>(
  {
    recipientEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true
    },
    eventType: {
      type: String,
      enum: [
        'CUSTOMER_WELCOME',
        'OWNER_WELCOME',
        'WELCOME_BACK',
        'OWNER_REGISTRATION_RECEIVED',
        'OWNER_APPLICATION_APPROVED',
        'OWNER_APPLICATION_REJECTED'
      ],
      required: true,
      index: true
    },
    referenceId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    subject: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ['PENDING', 'SENT', 'FAILED'],
      default: 'PENDING',
      index: true
    },
    attempts: {
      type: Number,
      default: 1
    },
    error: {
      type: String,
      trim: true
    },
    sentAt: {
      type: Date
    }
  },
  { timestamps: true }
);

emailLogSchema.index({ recipientEmail: 1, eventType: 1 });
emailLogSchema.index({ status: 1, createdAt: -1 });

export const EmailLog = model<EmailLogDocument>('EmailLog', emailLogSchema);
