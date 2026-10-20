import { Schema, Types, model } from 'mongoose';

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export interface SupportTicketDocument {
  _id: Types.ObjectId;
  ticketId: string;
  userId: Types.ObjectId;
  userRole: 'CUSTOMER' | 'SALON_OWNER' | 'SUPER_ADMIN';
  userName: string;
  userEmail: string;
  contactEmail?: string;
  category: string;
  subject: string;
  description: string;
  status: TicketStatus;
  adminNotes?: string;
  resolvedAt?: Date;
  resolvedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<SupportTicketDocument>(
  {
    ticketId: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userRole: {
      type: String,
      enum: ['CUSTOMER', 'SALON_OWNER', 'SUPER_ADMIN'],
      required: true
    },
    userName: { type: String, required: true },
    userEmail: { type: String, required: true },
    contactEmail: { type: String },
    category: { type: String, required: true, index: true },
    subject: { type: String, required: true },
    description: { type: String, required: true },
    status: {
      type: String,
      enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
      default: 'OPEN',
      index: true
    },
    adminNotes: { type: String },
    resolvedAt: { type: Date },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

schema.index({ createdAt: -1 });
schema.index({ status: 1, createdAt: -1 });

export const SupportTicket = model<SupportTicketDocument>('SupportTicket', schema);
