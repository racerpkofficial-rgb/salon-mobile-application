import { Schema, Types, model } from 'mongoose';
import { BillingCycle, PlanType } from './Subscription.js';

export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

export interface PaymentDocument {
  salonId: Types.ObjectId;
  ownerId: Types.ObjectId;
  planId: PlanType;
  amount: number;
  billingCycle: BillingCycle;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  status: PaymentStatus;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<PaymentDocument>(
  {
    salonId: { type: Schema.Types.ObjectId, ref: 'Salon', required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    planId: {
      type: String,
      enum: ['STARTER', 'BUSINESS', 'PREMIUM'],
      required: true
    },
    amount: { type: Number, required: true },
    billingCycle: {
      type: String,
      enum: ['MONTHLY', 'YEARLY'],
      required: true
    },
    razorpayOrderId: { type: String, required: true },
    razorpayPaymentId: { type: String },
    status: {
      type: String,
      enum: ['PENDING', 'SUCCESS', 'FAILED'],
      default: 'PENDING'
    }
  },
  { timestamps: true }
);

schema.index({ ownerId: 1 });
schema.index({ salonId: 1 });
schema.index({ razorpayOrderId: 1 });
schema.index({ status: 1 });

export const Payment = model<PaymentDocument>('Payment', schema);
