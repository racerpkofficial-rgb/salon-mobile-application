import { Schema, Types, model } from 'mongoose';
import { Role } from '../types/auth.js';

export type DeletionRequestStatus = 'PENDING' | 'CANCELLED' | 'COMPLETED';

export interface AccountDeletionRequestDocument {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  role: Role;
  email: string;
  reason: string;
  feedback?: string;
  requestedAt: Date;
  scheduledDeletionAt: Date;
  status: DeletionRequestStatus;
  cancelledAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const accountDeletionRequestSchema = new Schema<AccountDeletionRequestDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    role: {
      type: String,
      enum: ['CUSTOMER', 'SALON_OWNER'],
      required: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    reason: {
      type: String,
      required: true,
      trim: true
    },
    feedback: {
      type: String,
      trim: true
    },
    requestedAt: {
      type: Date,
      default: Date.now,
      required: true
    },
    scheduledDeletionAt: {
      type: Date,
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['PENDING', 'CANCELLED', 'COMPLETED'],
      default: 'PENDING',
      index: true
    },
    cancelledAt: {
      type: Date
    },
    completedAt: {
      type: Date
    }
  },
  { timestamps: true }
);

accountDeletionRequestSchema.index({ status: 1, scheduledDeletionAt: 1 });
accountDeletionRequestSchema.index({ userId: 1, status: 1 });

export const AccountDeletionRequest = model<AccountDeletionRequestDocument>(
  'AccountDeletionRequest',
  accountDeletionRequestSchema
);
