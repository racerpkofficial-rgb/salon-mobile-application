import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { AuthRequest, requireAuth } from '../middleware/auth.js';
import { Appointment } from '../models/Appointment.js';
import { Review } from '../models/Review.js';
import { Salon } from '../models/Salon.js';
import {
  calculateReviewDeadline,
  checkReviewEligibility,
  recalculateSalonRating
} from '../services/review.service.js';

const router = Router();

const submitReviewSchema = z.object({
  rating: z
    .number()
    .int('Rating must be an integer')
    .min(1, 'Rating must be at least 1')
    .max(5, 'Rating cannot exceed 5'),
  comment: z
    .string()
    .trim()
    .min(1, 'Review comment is required')
    .max(1000, 'Review comment cannot exceed 1000 characters'),
  photos: z.array(z.string().trim()).max(5, 'Maximum 5 photos allowed').optional().default([])
});

const submitReviewWithAppIdSchema = submitReviewSchema.extend({
  appointmentId: z.string().trim().min(1, 'Appointment ID is required')
});

const ownerReplySchema = z.object({
  reply: z
    .string()
    .trim()
    .min(1, 'Reply message is required')
    .max(1000, 'Reply cannot exceed 1000 characters')
});

// =========================================================================
// 1. GET /api/v1/appointments/:id/review-eligibility
// Exposes review eligibility, deadline, remaining time, and review data
// =========================================================================
router.get(
  '/appointments/:id/review-eligibility',
  requireAuth(['CUSTOMER']),
  async (req: AuthRequest, res, next) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!id || !Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid appointment ID format.' });
      }

      const appointment = await Appointment.findById(id);
      if (!appointment) {
        return res.status(404).json({ message: 'Appointment not found.' });
      }

      // Customer ownership validation
      if (appointment.customerId.toString() !== req.auth!.id) {
        return res.status(403).json({
          message: 'Forbidden: You can only check review eligibility for your own booking.'
        });
      }

      const existingReview = await Review.findOne({ appointmentId: appointment._id }).lean();
      const serverNow = new Date();
      const eligibility = checkReviewEligibility(appointment, serverNow, existingReview);

      res.json({
        ...eligibility,
        review: existingReview || null
      });
    } catch (error) {
      next(error);
    }
  }
);

// =========================================================================
// 2. POST /api/v1/appointments/:id/review
// Submit customer rating & review with strict 48-hour deadline validation
// =========================================================================
router.post(
  '/appointments/:id/review',
  requireAuth(['CUSTOMER']),
  async (req: AuthRequest, res, next) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!id || !Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid appointment ID format.' });
      }

      // Parse and validate submission payload (rejects client-supplied timestamps)
      const parsed = submitReviewSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: parsed.error.issues.map((i) => i.message).join(', ')
        });
      }

      const appointment = await Appointment.findById(id);
      if (!appointment) {
        return res.status(404).json({ message: 'Appointment not found.' });
      }

      // 1. Ownership check: Only booking owner can submit review
      if (appointment.customerId.toString() !== req.auth!.id) {
        return res.status(403).json({
          message: 'Forbidden: You can only review your own booking.'
        });
      }

      // 2. Status check: Booking must be COMPLETED
      if (appointment.status !== 'COMPLETED') {
        return res.status(400).json({
          message: 'Booking is not completed yet. Reviews can only be submitted for completed bookings.'
        });
      }

      // 3. Completed timestamp check: Legacy bookings without reliable completion timestamp cannot be reviewed
      if (!appointment.completedAt) {
        return res.status(400).json({
          message:
            'Booking completion timestamp is unavailable. Legacy bookings cannot be reviewed.'
        });
      }

      // 4. Strict 48-Hour Deadline boundary rule:
      // Review is accepted when server time is strictly earlier than deadline (< deadline).
      // At serverNow >= deadline (including exactly 48h), submission is rejected.
      const serverNow = new Date();
      const deadline = calculateReviewDeadline(appointment.completedAt);

      if (serverNow.getTime() >= deadline.getTime()) {
        return res.status(400).json({
          message: `The 48-hour review period has expired. Deadline was ${deadline.toISOString()}.`,
          completedAt: appointment.completedAt.toISOString(),
          reviewDeadline: deadline.toISOString(),
          canReview: false
        });
      }

      // 5. Duplicate check at application layer
      if (appointment.isReviewSubmitted) {
        return res.status(409).json({
          message: 'A review for this booking has already been submitted.'
        });
      }

      const existingReview = await Review.findOne({ appointmentId: appointment._id });
      if (existingReview) {
        return res.status(409).json({
          message: 'A review for this booking has already been submitted.'
        });
      }

      // 6. DB Creation with concurrency protection against duplicate key errors
      try {
        const review = await Review.create({
          appointmentId: appointment._id,
          bookingId: appointment._id,
          salonId: appointment.salonId,
          customerId: req.auth!.id,
          rating: parsed.data.rating,
          comment: parsed.data.comment,
          photos: parsed.data.photos || []
        });

        // Mark appointment as reviewed
        appointment.isReviewSubmitted = true;
        appointment.reviewId = review._id;
        await appointment.save();

        // Recalculate salon ratings atomically
        const salonStats = await recalculateSalonRating(appointment.salonId);

        return res.status(201).json({
          message: 'Review submitted successfully.',
          data: review,
          review,
          salonStats
        });
      } catch (dbErr: any) {
        if (dbErr.code === 11000) {
          return res.status(409).json({
            message: 'A review for this booking has already been submitted.'
          });
        }
        throw dbErr;
      }
    } catch (error) {
      next(error);
    }
  }
);

// =========================================================================
// 3. POST /api/v1/reviews (Alias allowing appointmentId in body)
// =========================================================================
router.post(
  '/reviews',
  requireAuth(['CUSTOMER']),
  async (req: AuthRequest, res, next) => {
    try {
      const parsed = submitReviewWithAppIdSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: parsed.error.issues.map((i) => i.message).join(', ')
        });
      }

      const appointmentId = parsed.data.appointmentId;
      if (!Types.ObjectId.isValid(appointmentId)) {
        return res.status(400).json({ message: 'Invalid appointment ID format.' });
      }

      const appointment = await Appointment.findById(appointmentId);
      if (!appointment) {
        return res.status(404).json({ message: 'Appointment not found.' });
      }

      if (appointment.customerId.toString() !== req.auth!.id) {
        return res.status(403).json({
          message: 'Forbidden: You can only review your own booking.'
        });
      }

      if (appointment.status !== 'COMPLETED') {
        return res.status(400).json({
          message: 'Booking is not completed yet. Reviews can only be submitted for completed bookings.'
        });
      }

      if (!appointment.completedAt) {
        return res.status(400).json({
          message:
            'Booking completion timestamp is unavailable. Legacy bookings cannot be reviewed.'
        });
      }

      const serverNow = new Date();
      const deadline = calculateReviewDeadline(appointment.completedAt);

      if (serverNow.getTime() >= deadline.getTime()) {
        return res.status(400).json({
          message: `The 48-hour review period has expired. Deadline was ${deadline.toISOString()}.`,
          completedAt: appointment.completedAt.toISOString(),
          reviewDeadline: deadline.toISOString(),
          canReview: false
        });
      }

      if (appointment.isReviewSubmitted) {
        return res.status(409).json({
          message: 'A review for this booking has already been submitted.'
        });
      }

      const existingReview = await Review.findOne({ appointmentId: appointment._id });
      if (existingReview) {
        return res.status(409).json({
          message: 'A review for this booking has already been submitted.'
        });
      }

      try {
        const review = await Review.create({
          appointmentId: appointment._id,
          bookingId: appointment._id,
          salonId: appointment.salonId,
          customerId: req.auth!.id,
          rating: parsed.data.rating,
          comment: parsed.data.comment,
          photos: parsed.data.photos || []
        });

        appointment.isReviewSubmitted = true;
        appointment.reviewId = review._id;
        await appointment.save();

        const salonStats = await recalculateSalonRating(appointment.salonId);

        return res.status(201).json({
          message: 'Review submitted successfully.',
          data: review,
          review,
          salonStats
        });
      } catch (dbErr: any) {
        if (dbErr.code === 11000) {
          return res.status(409).json({
            message: 'A review for this booking has already been submitted.'
          });
        }
        throw dbErr;
      }
    } catch (error) {
      next(error);
    }
  }
);

// =========================================================================
// 4. Reject Review Updates (PUT / PATCH)
// Requirement 3: After submission, review is permanently read-only for customer
// =========================================================================
const rejectReviewEdit = (_req: AuthRequest, res: any) => {
  return res.status(403).json({
    message: 'Reviews cannot be modified once submitted. Reviews are permanently read-only.'
  });
};

router.put('/reviews/:id', requireAuth(['CUSTOMER', 'SALON_OWNER']), rejectReviewEdit);
router.patch('/reviews/:id', requireAuth(['CUSTOMER', 'SALON_OWNER']), rejectReviewEdit);
router.patch('/appointments/:id/review', requireAuth(['CUSTOMER', 'SALON_OWNER']), rejectReviewEdit);

// =========================================================================
// 5. Reject Review Deletion
// Requirement 3: Salon owners and customers must not delete customer reviews
// =========================================================================
router.delete(
  '/reviews/:id',
  requireAuth(['CUSTOMER', 'SALON_OWNER']),
  async (_req: AuthRequest, res) => {
    return res.status(403).json({
      message: 'Submitted customer reviews cannot be deleted.'
    });
  }
);

// =========================================================================
// 6. POST & PATCH /api/v1/reviews/:id/reply
// Salon owner response to a customer review (create or edit)
// =========================================================================
const handleOwnerReply = async (req: AuthRequest, res: any, next: any) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id || !Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid review ID format.' });
    }

    const parsed = ownerReplySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: parsed.error.issues.map((i) => i.message).join(', ')
      });
    }

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found.' });
    }

    // Verify salon ownership on server side
    const salon = await Salon.findOne({ _id: review.salonId, ownerId: req.auth!.id });
    if (!salon) {
      return res.status(403).json({
        message: 'Forbidden: You can only reply to reviews for your own salon.'
      });
    }

    // Update owner reply without altering customer rating or review text
    review.ownerReply = parsed.data.reply;
    review.ownerRepliedAt = new Date();
    await review.save();

    // Return populated review
    const populated = await Review.findById(review._id)
      .populate('customerId', 'name avatar')
      .populate('salonId', 'salonName rating reviews city address ownerId')
      .populate('appointmentId', 'serviceName appointmentDate')
      .lean();

    const resultReview = populated || review;
    res.json({
      message: 'Reply submitted successfully.',
      data: resultReview,
      review: resultReview
    });
  } catch (error) {
    next(error);
  }
};

router.post('/reviews/:id/reply', requireAuth(['SALON_OWNER']), handleOwnerReply);
router.patch('/reviews/:id/reply', requireAuth(['SALON_OWNER']), handleOwnerReply);

// =========================================================================
// 7. GET /api/v1/salons/:id/reviews
// List reviews for a salon with pagination, populated metadata, and rating breakdown
// =========================================================================
router.get('/salons/:id/reviews', async (req, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id || !Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid salon ID format.' });
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [total, reviews, allReviews] = await Promise.all([
      Review.countDocuments({ salonId: id }),
      Review.find({ salonId: id })
        .populate('customerId', 'name avatar')
        .populate('salonId', 'salonName rating reviews city address ownerId')
        .populate('appointmentId', 'serviceName appointmentDate')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Review.find({ salonId: id }).select('rating').lean()
    ]);

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;
    for (const r of allReviews) {
      if (r.rating >= 1 && r.rating <= 5) {
        distribution[r.rating] = (distribution[r.rating] || 0) + 1;
        sum += r.rating;
      }
    }

    const averageRating = total > 0 ? Number((sum / total).toFixed(1)) : 0;

    res.json({
      data: reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      summary: {
        averageRating,
        totalReviews: total,
        distribution
      }
    });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 8. GET /api/v1/reviews
// Dedicated public ratings and reviews API with filters, search, and pagination
// Accessible to all users (customers, owners, public)
// =========================================================================
router.get('/reviews', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};

    // 1. Salon Filter
    if (req.query.salonId !== undefined) {
      const salonIdStr = String(req.query.salonId).trim();
      if (salonIdStr && Types.ObjectId.isValid(salonIdStr)) {
        filter.salonId = new Types.ObjectId(salonIdStr);
      } else {
        // Safe isolation: do NOT fall back to all salons when salonId is provided but invalid/empty
        filter.salonId = new Types.ObjectId();
      }
    }

    // 2. Star Rating Filter (1 to 5)
    if (req.query.rating) {
      const ratingNum = parseInt(String(req.query.rating), 10);
      if (ratingNum >= 1 && ratingNum <= 5) {
        filter.rating = ratingNum;
      }
    }

    // 3. Search Filter (by comment text)
    if (req.query.search) {
      const searchStr = String(req.query.search).trim();
      if (searchStr.length > 0) {
        const escaped = searchStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filter.$or = [
          { comment: { $regex: escaped, $options: 'i' } }
        ];
      }
    }

    // 4. Sort Order
    let sortOptions: Record<string, any> = { createdAt: -1 };
    const sortBy = String(req.query.sortBy || 'newest').toLowerCase();
    if (sortBy === 'oldest') {
      sortOptions = { createdAt: 1 };
    } else if (sortBy === 'highest') {
      sortOptions = { rating: -1, createdAt: -1 };
    } else if (sortBy === 'lowest') {
      sortOptions = { rating: 1, createdAt: -1 };
    }

    const [total, reviews, allRatingDocs] = await Promise.all([
      Review.countDocuments(filter),
      Review.find(filter)
        .populate('customerId', 'name avatar')
        .populate('salonId', 'salonName rating reviews city address ownerId')
        .populate('appointmentId', 'serviceName appointmentDate')
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean(),
      Review.find(filter.salonId ? { salonId: filter.salonId } : {}).select('rating').lean()
    ]);

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;
    const totalRated = allRatingDocs.length;
    for (const r of allRatingDocs) {
      if (r.rating >= 1 && r.rating <= 5) {
        distribution[r.rating] = (distribution[r.rating] || 0) + 1;
        sum += r.rating;
      }
    }
    const averageRating = totalRated > 0 ? Number((sum / totalRated).toFixed(1)) : 0;

    res.json({
      data: reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      summary: {
        averageRating,
        totalReviews: totalRated,
        distribution
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
