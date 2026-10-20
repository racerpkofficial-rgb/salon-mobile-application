import { Schema, Types, model } from 'mongoose';

export interface PasswordResetDocument {
  userId: Types.ObjectId;
  email: string;
  role: string;
  otpHash: string;
  expiresAt: Date;
  attempts: number;
  maxAttempts: number;
  lastResendAt: Date;
  resetTokenHash?: string;
  resetTokenExpiresAt?: Date;
  consumed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<PasswordResetDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    role: { type: String, required: true },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    lastResendAt: { type: Date, default: Date.now },
    resetTokenHash: { type: String, select: false },
    resetTokenExpiresAt: { type: Date },
    consumed: { type: Boolean, default: false }
  },
  { timestamps: true }
);

// TTL index to automatically purge records 24 hours after expiration
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });

export const PasswordReset = model<PasswordResetDocument>('PasswordReset', schema);
