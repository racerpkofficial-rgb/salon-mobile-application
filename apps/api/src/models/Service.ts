import { Schema, Types, model } from 'mongoose';

export interface ServiceDocument {
  _id: Types.ObjectId;
  salonId: Types.ObjectId;
  name: string;
  description: string;
  price: number;
  duration: number; // Duration in minutes (e.g. 30, 45, 60, 90, 120)
  image?: string;
  category?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const serviceSchema = new Schema<ServiceDocument>(
  {
    salonId: { type: Schema.Types.ObjectId, ref: 'Salon', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    price: { type: Number, required: true, min: 0 },
    duration: { type: Number, required: true, min: 5, default: 30 },
    image: { type: String, default: '' },
    category: { type: String, default: 'General' },
    isActive: { type: Boolean, default: true, index: true }
  },
  { timestamps: true }
);

serviceSchema.index({ salonId: 1, isActive: 1 });

export const Service = model<ServiceDocument>('Service', serviceSchema);
