import { Schema, Types, model } from 'mongoose';

export type RedemptionStatus = 'APPLIED' | 'REVERTED';

export interface CouponRedemptionDocument {
  _id: Types.ObjectId;
  couponId: Types.ObjectId;
  salonId: Types.ObjectId;
  customerId: Types.ObjectId;
  appointmentId: Types.ObjectId;
  code: string;
  discountAmount: number;
  originalPrice: number;
  finalPrice: number;
  status: RedemptionStatus;
  revertedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const couponRedemptionSchema = new Schema<CouponRedemptionDocument>(
  {
    couponId: {
      type: Schema.Types.ObjectId,
      ref: 'Coupon',
      required: true,
      index: true
    },
    salonId: {
      type: Schema.Types.ObjectId,
      ref: 'Salon',
      required: true,
      index: true
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    appointmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Appointment',
      required: true,
      unique: true // Exactly one active coupon redemption per booking
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },
    discountAmount: {
      type: Number,
      required: true,
      min: 0
    },
    originalPrice: {
      type: Number,
      required: true,
      min: 0
    },
    finalPrice: {
      type: Number,
      required: true,
      min: 0
    },
    status: {
      type: String,
      enum: ['APPLIED', 'REVERTED'],
      default: 'APPLIED',
      required: true,
      index: true
    },
    revertedAt: {
      type: Date
    }
  },
  { timestamps: true }
);

couponRedemptionSchema.index({ customerId: 1, couponId: 1, status: 1 });
couponRedemptionSchema.index({ salonId: 1, createdAt: -1 });

export const CouponRedemption = model<CouponRedemptionDocument>(
  'CouponRedemption',
  couponRedemptionSchema
);
