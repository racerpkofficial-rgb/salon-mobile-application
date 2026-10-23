import { Types } from 'mongoose';
import { AppointmentDocument } from '../models/Appointment.js';
import { Review, ReviewDocument } from '../models/Review.js';
import { Salon } from '../models/Salon.js';

export const REVIEW_WINDOW_HOURS = 48;
export const REVIEW_WINDOW_MS = REVIEW_WINDOW_HOURS * 60 * 60 * 1000; // 172,800,000 ms

export interface ReviewEligibilityResult {
  canReview: boolean;
  completedAt?: string;
  reviewDeadline?: string;
  remainingTimeMs: number;
  alreadyReviewed: boolean;
  reason?: string;
}

/**
 * Calculates review deadline strictly in UTC milliseconds from completion timestamp.
 */
export function calculateReviewDeadline(completedAt: Date): Date {
  return new Date(completedAt.getTime() + REVIEW_WINDOW_MS);
}

/**
 * Evaluates review eligibility for an appointment against server-authoritative time.
 * Strictly adheres to the boundary rule:
 * Submissions accepted strictly when serverNow < deadline.
 * At serverNow >= deadline (including exactly 48h), submission is rejected.
 */
export function checkReviewEligibility(
  appointment: Pick<AppointmentDocument, 'status' | 'completedAt' | 'isReviewSubmitted'>,
  serverNow: Date = new Date(),
  existingReview?: ReviewDocument | null
): ReviewEligibilityResult {
  if (appointment.status !== 'COMPLETED') {
    return {
      canReview: false,
      alreadyReviewed: false,
      remainingTimeMs: 0,
      reason: 'Booking is not completed yet.'
    };
  }

  if (appointment.isReviewSubmitted || Boolean(existingReview)) {
    const deadline = appointment.completedAt
      ? calculateReviewDeadline(appointment.completedAt)
      : undefined;
    return {
      canReview: false,
      alreadyReviewed: true,
      completedAt: appointment.completedAt ? appointment.completedAt.toISOString() : undefined,
      reviewDeadline: deadline ? deadline.toISOString() : undefined,
      remainingTimeMs: 0,
      reason: 'A review has already been submitted for this booking.'
    };
  }

  if (!appointment.completedAt) {
    return {
      canReview: false,
      alreadyReviewed: false,
      remainingTimeMs: 0,
      reason: 'Booking completion timestamp is unavailable. Legacy bookings cannot be reviewed.'
    };
  }

  const deadline = calculateReviewDeadline(appointment.completedAt);
  const remainingTimeMs = deadline.getTime() - serverNow.getTime();

  // Strict boundary rule: server time strictly earlier than deadline
  if (serverNow.getTime() >= deadline.getTime()) {
    return {
      canReview: false,
      alreadyReviewed: false,
      completedAt: appointment.completedAt.toISOString(),
      reviewDeadline: deadline.toISOString(),
      remainingTimeMs: 0,
      reason: 'The 48-hour review period has expired.'
    };
  }

  return {
    canReview: true,
    alreadyReviewed: false,
    completedAt: appointment.completedAt.toISOString(),
    reviewDeadline: deadline.toISOString(),
    remainingTimeMs,
    reason: undefined
  };
}

/**
 * Recalculates average rating and review count for a salon and persists to the Salon document.
 */
export async function recalculateSalonRating(
  salonId: Types.ObjectId | string
): Promise<{ rating: number; reviews: number }> {
  const reviews = await Review.find({ salonId });

  if (reviews.length === 0) {
    await Salon.findByIdAndUpdate(salonId, {
      $set: { rating: 0, reviews: 0 }
    });
    return { rating: 0, reviews: 0 };
  }

  const totalReviews = reviews.length;
  const sumRatings = reviews.reduce((sum, r) => sum + r.rating, 0);
  const avgRating = Number((sumRatings / totalReviews).toFixed(1));

  await Salon.findByIdAndUpdate(salonId, {
    $set: {
      rating: avgRating,
      reviews: totalReviews
    }
  });

  return { rating: avgRating, reviews: totalReviews };
}

/**
 * Iterates through all salons in the database and synchronizes their rating and review count
 * with the actual Review documents. Ensures data integrity across legacy records.
 */
export async function syncAllSalonRatings(): Promise<{ syncedCount: number }> {
  const salons = await Salon.find({}, '_id').lean();
  let count = 0;
  for (const s of salons) {
    await recalculateSalonRating(s._id);
    count++;
  }
  return { syncedCount: count };
}
