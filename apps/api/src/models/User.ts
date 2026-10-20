import { Schema, model } from 'mongoose';
import { Role, roles } from '../types/auth.js';

export interface UserDocument {
  name: string;
  email: string;
  passwordHash: string;
  phone?: string;
  address?: string;
  city?: string;
  searchRadius?: number;
  role: Role;
  fcmTokens?: string[];
  isActive: boolean;
  authProvider?: 'LOCAL' | 'GOOGLE';
  hasCustomPassword?: boolean;
  avatar?: string;
  notificationPreferences?: {
    bookingUpdates: boolean;
    reminders: boolean;
    promotions: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<UserDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    searchRadius: { type: Number, enum: [5, 10, 25], default: 10 },
    avatar: { type: String, trim: true },
    notificationPreferences: {
      bookingUpdates: { type: Boolean, default: true },
      reminders: { type: Boolean, default: true },
      promotions: { type: Boolean, default: true }
    },
    role: { type: String, enum: roles, required: true },
    fcmTokens: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    authProvider: { type: String, enum: ['LOCAL', 'GOOGLE'], default: 'LOCAL' },
    hasCustomPassword: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const User = model<UserDocument>('User', schema);