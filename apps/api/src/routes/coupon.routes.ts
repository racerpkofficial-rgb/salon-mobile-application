import { Router } from 'express';
import { z } from 'zod';
import { AuthRequest, requireAuth } from '../middleware/auth.js';
import { Coupon } from '../models/Coupon.js';
import { Salon } from '../models/Salon.js';
import { couponService } from '../services/coupon.service.js';

const router = Router();

const createCouponSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, 'Coupon code must be at least 2 characters')
    .max(30, 'Coupon code cannot exceed 30 characters'),
  title: z
    .string()
    .trim()
    .min(2, 'Title must be at least 2 characters')
    .max(120),
  description: z.string().trim().optional(),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).default('PERCENTAGE'),
  discountValue: z.number().min(1, 'Discount value must be at least 1'),
  maxDiscountAmount: z.number().min(1).optional(),
  minimumBookingAmount: z.number().min(0).default(0),
  applicableServiceIds: z.array(z.string()).default(['ALL']),
  startsAt: z.string().optional(),
  expiresAt: z.string().min(1, 'Expiry date is required'),
  totalUsageLimit: z.number().min(1).optional(),
  perCustomerUsageLimit: z.number().min(1).default(1),
  status: z.enum(['ACTIVE', 'PAUSED']).default('ACTIVE')
});

const updateCouponSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().optional(),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).optional(),
  discountValue: z.number().min(1).optional(),
  maxDiscountAmount: z.number().min(1).nullable().optional(),
  minimumBookingAmount: z.number().min(0).optional(),
  applicableServiceIds: z.array(z.string()).optional(),
  startsAt: z.string().optional(),
  expiresAt: z.string().optional(),
  totalUsageLimit: z.number().min(1).nullable().optional(),
  perCustomerUsageLimit: z.number().min(1).optional(),
  status: z.enum(['ACTIVE', 'PAUSED']).optional()
});

const validateCouponSchema = z.object({
  salonId: z.string().min(1, 'Salon identifier is required'),
  code: z.string().trim().min(1, 'Coupon code is required'),
  servicePrice: z.number().min(0, 'Service price must be non-negative'),
  serviceId: z.string().optional(),
  serviceName: z.string().optional()
});

// ======================================================
// 1. SALON OWNER COUPON MANAGEMENT ENDPOINTS
// ======================================================

// GET /api/v1/owner/coupons - List all coupons for owner's salon with statistics
router.get(
  '/owner/coupons',
  requireAuth(['SALON_OWNER']),
  async (req: AuthRequest, res, next) => {
    try {
      const salon = await Salon.findOne({ ownerId: req.auth!.id });
      if (!salon) {
        return res.json({
          summary: {
            totalCoupons: 0,
            activeCoupons: 0,
            totalRedemptions: 0,
            totalDiscountsGranted: 0
          },
          coupons: []
        });
      }

      const result = await couponService.getOwnerCoupons(salon._id);
      return res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/owner/coupons - Create coupon for owner's salon
router.post(
  '/owner/coupons',
  requireAuth(['SALON_OWNER']),
  async (req: AuthRequest, res, next) => {
    try {
      const salon = await Salon.findOne({ ownerId: req.auth!.id });
      if (!salon) {
        return res.status(404).json({ message: 'No registered salon found for this account.' });
      }

      const data = createCouponSchema.parse(req.body);

      const coupon = await couponService.createCoupon({
        ...data,
        salonId: salon._id,
        createdBy: req.auth!.id
      });

      return res.status(201).json({
        message: `Coupon "${coupon.code}" created successfully.`,
        coupon
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message || 'Invalid coupon details.' });
      }
      return res.status(400).json({ message: error.message || 'Failed to create coupon.' });
    }
  }
);

// GET /api/v1/owner/coupons/:id - Get single coupon
router.get(
  '/owner/coupons/:id',
  requireAuth(['SALON_OWNER']),
  async (req: AuthRequest, res, next) => {
    try {
      const salon = await Salon.findOne({ ownerId: req.auth!.id });
      if (!salon) {
        return res.status(404).json({ message: 'Salon not found.' });
      }

      const coupon = await Coupon.findOne({
        _id: req.params.id,
        salonId: salon._id,
        status: { $ne: 'DELETED' }
      }).lean();

      if (!coupon) {
        return res.status(404).json({ message: 'Coupon not found.' });
      }

      return res.json({ coupon });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/v1/owner/coupons/:id - Update coupon
router.put(
  '/owner/coupons/:id',
  requireAuth(['SALON_OWNER']),
  async (req: AuthRequest, res, next) => {
    try {
      const salon = await Salon.findOne({ ownerId: req.auth!.id });
      if (!salon) {
        return res.status(404).json({ message: 'Salon not found.' });
      }

      const data = updateCouponSchema.parse(req.body);
      const couponId = String(req.params.id);
      const updated = await couponService.updateCoupon(couponId, salon._id, {
        ...data,
        maxDiscountAmount: data.maxDiscountAmount === null ? undefined : data.maxDiscountAmount,
        totalUsageLimit: data.totalUsageLimit === null ? undefined : data.totalUsageLimit
      });

      return res.json({
        message: 'Coupon updated successfully.',
        coupon: updated
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message || 'Invalid update parameters.' });
      }
      return res.status(400).json({ message: error.message || 'Failed to update coupon.' });
    }
  }
);

// PATCH /api/v1/owner/coupons/:id/status - Toggle active/paused
router.patch(
  '/owner/coupons/:id/status',
  requireAuth(['SALON_OWNER']),
  async (req: AuthRequest, res, next) => {
    try {
      const salon = await Salon.findOne({ ownerId: req.auth!.id });
      if (!salon) {
        return res.status(404).json({ message: 'Salon not found.' });
      }

      const { status } = req.body;
      if (status !== 'ACTIVE' && status !== 'PAUSED') {
        return res.status(400).json({ message: 'Status must be either ACTIVE or PAUSED.' });
      }

      const couponId = String(req.params.id);
      const updated = await couponService.setCouponStatus(couponId, salon._id, status);
      return res.json({
        message: `Coupon status changed to ${status}.`,
        coupon: updated
      });
    } catch (error: any) {
      return res.status(400).json({ message: error.message || 'Failed to toggle status.' });
    }
  }
);

// DELETE /api/v1/owner/coupons/:id - Safely delete coupon
router.delete(
  '/owner/coupons/:id',
  requireAuth(['SALON_OWNER']),
  async (req: AuthRequest, res, next) => {
    try {
      const salon = await Salon.findOne({ ownerId: req.auth!.id });
      if (!salon) {
        return res.status(404).json({ message: 'Salon not found.' });
      }

      const couponId = String(req.params.id);
      const result = await couponService.deleteCoupon(couponId, salon._id);
      return res.json(result);
    } catch (error: any) {
      return res.status(400).json({ message: error.message || 'Failed to delete coupon.' });
    }
  }
);

// GET /api/v1/owner/coupons/:id/analytics - Detailed coupon usage stats
router.get(
  '/owner/coupons/:id/analytics',
  requireAuth(['SALON_OWNER']),
  async (req: AuthRequest, res, next) => {
    try {
      const salon = await Salon.findOne({ ownerId: req.auth!.id });
      if (!salon) {
        return res.status(404).json({ message: 'Salon not found.' });
      }

      const couponId = String(req.params.id);
      const result = await couponService.getCouponAnalytics(couponId, salon._id);
      return res.json(result);
    } catch (error: any) {
      return res.status(400).json({ message: error.message || 'Failed to fetch analytics.' });
    }
  }
);

// ======================================================
// 2. CUSTOMER & PUBLIC COUPON ENDPOINTS
// ======================================================

// GET /api/v1/salons/:salonId/coupons - List eligible coupons for a specific salon
router.get('/salons/:salonId/coupons', async (req, res, next) => {
  try {
    const salonId = String(req.params.salonId);
    const serviceId = typeof req.query.serviceId === 'string' ? req.query.serviceId : undefined;

    const coupons = await couponService.getEligibleCouponsForSalon(salonId, serviceId);
    return res.json({
      count: coupons.length,
      data: coupons
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/customer/coupons/validate - Validate coupon code for booking checkout
router.post(
  '/customer/coupons/validate',
  requireAuth(['CUSTOMER']),
  async (req: AuthRequest, res) => {
    try {
      const data = validateCouponSchema.parse(req.body);

      const result = await couponService.validateCouponForBooking({
        salonId: data.salonId,
        customerId: req.auth!.id,
        code: data.code,
        servicePrice: data.servicePrice,
        serviceId: data.serviceId,
        serviceName: data.serviceName
      });

      return res.json({
        valid: true,
        couponId: result.coupon._id.toString(),
        code: result.coupon.code,
        title: result.coupon.title,
        discountType: result.coupon.discountType,
        discountValue: result.coupon.discountValue,
        originalPrice: result.originalPrice,
        discountAmount: result.discountAmount,
        finalPrice: result.finalPrice,
        savingsMessage: result.savingsMessage
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ valid: false, message: error.errors[0]?.message });
      }
      return res.status(400).json({ valid: false, message: error.message });
    }
  }
);

// GET /api/v1/customer/coupons/explore - Discover all active salon coupons across salons
router.get('/customer/coupons/explore', async (_req, res, next) => {
  try {
    const now = new Date();
    const activeCoupons = await Coupon.find({
      status: 'ACTIVE',
      startsAt: { $lte: now },
      expiresAt: { $gte: now }
    })
      .populate('salonId', 'salonName city address images location status')
      .sort({ createdAt: -1 })
      .lean();

    // Group by active approved salons only
    const groupedMap = new Map<string, { salon: any; coupons: any[] }>();

    for (const c of activeCoupons) {
      const s = c.salonId as any;
      if (!s || s.status !== 'ACTIVE') continue;

      const sId = s._id.toString();
      if (!groupedMap.has(sId)) {
        groupedMap.set(sId, {
          salon: {
            id: sId,
            salonName: s.salonName,
            city: s.city,
            address: s.address,
            images: s.images
          },
          coupons: []
        });
      }

      groupedMap.get(sId)!.coupons.push({
        id: c._id.toString(),
        code: c.code,
        title: c.title,
        description: c.description,
        discountType: c.discountType,
        discountValue: c.discountValue,
        maxDiscountAmount: c.maxDiscountAmount,
        minimumBookingAmount: c.minimumBookingAmount,
        applicableServiceIds: c.applicableServiceIds,
        expiresAt: c.expiresAt,
        formattedDiscount: c.discountType === 'PERCENTAGE'
          ? `${c.discountValue}% OFF${c.maxDiscountAmount ? ` (Up to ₹${c.maxDiscountAmount})` : ''}`
          : `₹${c.discountValue} FLAT OFF`
      });
    }

    return res.json({
      data: Array.from(groupedMap.values())
    });
  } catch (error) {
    next(error);
  }
});

export default router;
