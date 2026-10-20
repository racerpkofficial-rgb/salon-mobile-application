import { Schema, Types, model } from 'mongoose';

export interface ReviewDocument {
  _id: Types.ObjectId;
  appointmentId: Types.ObjectId;
  bookingId?: Types.ObjectId; // Backward compatibility alias
  salonId: Types.ObjectId;
  customerId: Types.ObjectId;
  rating: number; // 1 to 5
  comment: string;
  photos?: string[];
  ownerReply?: string;
  ownerRepliedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<ReviewDocument>(
  {
    appointmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Appointment',
      required: true
    },
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Appointment'
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
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: 'Rating must be an integer between 1 and 5'
      }
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: [1000, 'Review comment cannot exceed 1000 characters']
    },
    photos: {
      type: [String],
      default: []
    },
    ownerReply: {
      type: String,
      trim: true,
      maxlength: [1000, 'Owner reply cannot exceed 1000 characters'],
      default: undefined
    },
    ownerRepliedAt: {
      type: Date,
      default: undefined
    }
  },
  { timestamps: true }
);

// Guarantee 1 review per booking at DB level via unique index
reviewSchema.index({ appointmentId: 1 }, { unique: true });
reviewSchema.index({ salonId: 1, createdAt: -1 });
reviewSchema.index({ customerId: 1, createdAt: -1 });

export const Review = model<ReviewDocument>('Review', reviewSchema);
