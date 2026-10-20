import { Schema, Types, model } from 'mongoose';

export interface OfferDocument {
  title: string;
  code: string;
  discountPercent: number;
  description: string;
  validUntil: Date;
  isActive: boolean;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<OfferDocument>(
  {
    title: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    discountPercent: { type: Number, required: true, min: 1, max: 100 },
    description: { type: String, required: true, trim: true },
    validUntil: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

schema.index({ isActive: 1 });

export const Offer = model<OfferDocument>('Offer', schema);
