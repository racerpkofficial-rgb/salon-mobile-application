import { Schema, Types, model } from 'mongoose';

export type SalonStatus = 'PENDING_APPROVAL' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED';
export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'PENDING';

export interface ServiceItem {
  id?: string;
  name: string;
  category?: string;
  price: number;
  durationMinutes?: number;
  description?: string;
}

export interface SalonCoordinates {
  latitude: number;
  longitude: number;
}

export interface WorkingHours {
  openTime: string;
  closeTime: string;
  slotIntervalMinutes: number;
  daysOpen: string[];
}

export interface IdentityProof {
  url: string;
  filename: string;
  fileType: string;
  fileSize?: number;
  uploadedAt?: Date;
}

export interface SalonDocument {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  salonName: string;
  description: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state?: string;
  country?: string;
  location?: SalonCoordinates;
  images: string[];
  services: ServiceItem[];
  workingHours?: WorkingHours;
  unavailableDates?: string[];
  identityProof?: IdentityProof;
  status: SalonStatus;
  subscriptionId?: Types.ObjectId;
  subscriptionStatus: SubscriptionStatus;
  rejectionReason?: string;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  rating?: number;
  reviews?: number;
  createdAt: Date;
  updatedAt: Date;
}

const serviceSchema = new Schema<ServiceItem>(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, default: 'General' },
    price: { type: Number, required: true, min: 0 },
    durationMinutes: { type: Number, default: 30, min: 5 },
    description: { type: String, default: '' }
  },
  { _id: true }
);

const schema = new Schema<SalonDocument>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    salonName: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, default: '', trim: true },
    country: { type: String, default: 'India', trim: true },
    location: {
      latitude: { type: Number },
      longitude: { type: Number }
    },
    images: { type: [String], default: [] },
    services: { type: [serviceSchema], default: [] },
    workingHours: {
      openTime: { type: String, default: '09:00' },
      closeTime: { type: String, default: '20:00' },
      slotIntervalMinutes: { type: Number, default: 30 },
      daysOpen: {
        type: [String],
        default: [
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
          'Sunday'
        ]
      }
    },
    unavailableDates: { type: [String], default: [] },
    identityProof: {
      type: {
        url: { type: String },
        filename: { type: String },
        fileType: { type: String },
        fileSize: { type: Number },
        uploadedAt: { type: Date, default: Date.now }
      },
      select: false,
      _id: false
    },
    status: {
      type: String,
      enum: ['PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'SUSPENDED'],
      default: 'PENDING_APPROVAL'
    },
    subscriptionId: { type: Schema.Types.ObjectId, ref: 'Subscription' },
    subscriptionStatus: {
      type: String,
      enum: ['ACTIVE', 'EXPIRED', 'CANCELLED', 'PENDING'],
      default: 'PENDING'
    },
    rejectionReason: { type: String, default: '' },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    rating: { type: Number, default: 0 },
    reviews: { type: Number, default: 0 }
  },
  { timestamps: true }
);

schema.index({ salonName: 'text', city: 'text', address: 'text', description: 'text' });
schema.index({ status: 1, subscriptionStatus: 1 });

export const Salon = model<SalonDocument>('Salon', schema);
