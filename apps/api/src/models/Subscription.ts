import { Schema, Types, model } from 'mongoose';
import { SubscriptionStatus } from './Salon.js';

export type PlanType = 'STARTER' | 'BUSINESS' | 'PREMIUM';
export type BillingCycle = 'MONTHLY' | 'YEARLY';

export interface SubscriptionDocument {
  salonId: Types.ObjectId;
  ownerId: Types.ObjectId;
  plan: PlanType;
  billingCycle: BillingCycle;
  amount: number;
  currency: string;
  status: SubscriptionStatus;
  paymentMethod: string;
  transactionId: string;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<SubscriptionDocument>(
  {
    salonId: { type: Schema.Types.ObjectId, ref: 'Salon', required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    plan: {
      type: String,
      enum: ['STARTER', 'BUSINESS', 'PREMIUM'],
      required: true
    },
    billingCycle: {
      type: String,
      enum: ['MONTHLY', 'YEARLY'],
      required: true
    },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    status: {
      type: String,
      enum: ['ACTIVE', 'EXPIRED', 'CANCELLED', 'PENDING'],
      default: 'PENDING'
    },
    paymentMethod: { type: String, default: 'UPI_MOCK' },
    transactionId: { type: String, required: true },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, required: true }
  },
  { timestamps: true }
);

schema.index({ ownerId: 1 });
schema.index({ salonId: 1 });
schema.index({ status: 1 });

export const Subscription = model<SubscriptionDocument>('Subscription', schema);
