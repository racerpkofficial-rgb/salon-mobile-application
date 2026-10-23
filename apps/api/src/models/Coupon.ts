import { Schema, Types, model } from 'mongoose';

export type CouponDiscountType = 'PERCENTAGE' | 'FIXED';
export type CouponStatus = 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'DELETED';

export interface CouponDocument {
  _id: Types.ObjectId;
  salonId: Types.ObjectId;
  code: string;
  title: string;
  description?: string;
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscountAmount?: number;
  minimumBookingAmount: number;
  applicableServiceIds: string[]; // ['ALL'] or specific service ObjectIds as strings
  startsAt: Date;
  expiresAt: Date;
  totalUsageLimit?: number;
  perCustomerUsageLimit: number;
  usedCount: number;
  status: CouponStatus;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const couponSchema = new Schema<CouponDocument>(
  {
    salonId: {
      type: Schema.Types.ObjectId,
      ref: 'Salon',
      required: true,
      index: true
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      minlength: 2,
      maxlength: 30
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500
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
    maxDiscountAmount: {
      type: Number,
      min: 1
    },
    minimumBookingAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    applicableServiceIds: {
      type: [String],
      default: ['ALL']
    },
    startsAt: {
      type: Date,
      default: Date.now,
      required: true
    },
    expiresAt: {
      type: Date,
      required: true
    },
    totalUsageLimit: {
      type: Number,
      min: 1
    },
    perCustomerUsageLimit: {
      type: Number,
      default: 1,
      min: 1
    },
    usedCount: {
      type: Number,
      default: 0,
      min: 0
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'PAUSED', 'EXPIRED', 'DELETED'],
      default: 'ACTIVE',
      required: true,
      index: true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

// Compound unique index ensuring coupon code is unique within a salon
couponSchema.index({ salonId: 1, code: 1 }, { unique: true });

// Lookup index for active coupons within date window
couponSchema.index({ salonId: 1, status: 1, startsAt: 1, expiresAt: 1 });

export const Coupon = model<CouponDocument>('Coupon', couponSchema);
