import { Schema, Types, model } from 'mongoose';

export type AppointmentStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'COMPLETED';

export interface AppointmentDocument {
  _id: Types.ObjectId;
  customerId: Types.ObjectId;
  salonId: Types.ObjectId;
  serviceId: Types.ObjectId;
  offerId?: Types.ObjectId;
  appointmentDate: string; // ISO format "YYYY-MM-DD"
  startTime: string; // "HH:mm" (e.g. "10:00")
  endTime: string; // "HH:mm" (e.g. "10:30")
  status: AppointmentStatus;
  serviceName?: string;
  serviceDuration?: number;
  originalPrice?: number;
  discountAmount?: number;
  totalPrice?: number;
  customerNote?: string;
  rejectionReason?: string;
  completedAt?: Date;
  isReviewSubmitted?: boolean;
  reviewId?: Types.ObjectId;
  completionNotified?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const appointmentSchema = new Schema<AppointmentDocument>(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    salonId: {
      type: Schema.Types.ObjectId,
      ref: 'Salon',
      required: true,
      index: true
    },
    serviceId: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      required: true
    },
    offerId: {
      type: Schema.Types.ObjectId,
      ref: 'SalonOffer'
    },
    appointmentDate: {
      type: String,
      required: true,
      index: true
    },
    startTime: {
      type: String,
      required: true
    },
    endTime: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'COMPLETED'],
      default: 'PENDING',
      index: true
    },
    customerNote: {
      type: String,
      default: '',
      trim: true
    },
    serviceName: {
      type: String,
      default: '',
      trim: true
    },
    serviceDuration: {
      type: Number,
      default: 30
    },
    originalPrice: {
      type: Number,
      default: 0
    },
    discountAmount: {
      type: Number,
      default: 0
    },
    totalPrice: {
      type: Number,
      default: 0
    },
    completedAt: {
      type: Date,
      default: null,
      index: true
    },
    isReviewSubmitted: {
      type: Boolean,
      default: false,
      index: true
    },
    reviewId: {
      type: Schema.Types.ObjectId,
      ref: 'Review'
    },
    completionNotified: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

// Compound index to optimize slot occupancy checks and prevent race conditions
appointmentSchema.index({ salonId: 1, appointmentDate: 1, status: 1 });
appointmentSchema.index({ customerId: 1, createdAt: -1 });

export const Appointment = model<AppointmentDocument>('Appointment', appointmentSchema);
