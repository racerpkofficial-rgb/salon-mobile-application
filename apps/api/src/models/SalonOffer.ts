import { Schema, Types, model } from 'mongoose';

export type DiscountType = 'PERCENTAGE' | 'FIXED';
export type OfferStatus = 'ACTIVE' | 'EXPIRED' | 'INACTIVE' | 'DELETED';

export interface SalonOfferDocument {
  _id: Types.ObjectId;
  salonId: Types.ObjectId;
  title: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  applicableService: string; // Service ObjectId string or 'ALL'
  startDate: Date;
  endDate: Date;
  image?: string;
  isActive: boolean;
  status: OfferStatus;
  createdAt: Date;
  updatedAt: Date;
}

const salonOfferSchema = new Schema<SalonOfferDocument>(
  {
    salonId: {
      type: Schema.Types.ObjectId,
      ref: 'Salon',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    discountType: {
      type: String,
      enum: ['PERCENTAGE', 'FIXED'],
      default: 'PERCENTAGE',
      required: true
    },
    discountValue: {
      type: Number,
      required: true,
      min: 1
    },
    applicableService: {
      type: String,
      default: 'ALL'
    },
    startDate: {
      type: Date,
      default: Date.now,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    image: {
      type: String,
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'EXPIRED', 'INACTIVE', 'DELETED'],
      default: 'ACTIVE',
      index: true
    }
  },
  { timestamps: true }
);

salonOfferSchema.index({ salonId: 1, isActive: 1 });
salonOfferSchema.index({ startDate: 1, endDate: 1 });

export const SalonOffer = model<SalonOfferDocument>('SalonOffer', salonOfferSchema);
