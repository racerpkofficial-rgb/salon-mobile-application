import mongoose, { Types } from 'mongoose';
import { Appointment } from '../models/Appointment.js';
import { Coupon, CouponDiscountType, CouponDocument, CouponStatus } from '../models/Coupon.js';
import { CouponRedemption } from '../models/CouponRedemption.js';
import { Salon } from '../models/Salon.js';

export interface CreateCouponInput {
  salonId: Types.ObjectId | string;
  code: string;
  title: string;
  description?: string;
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscountAmount?: number;
  minimumBookingAmount?: number;
  applicableServiceIds?: string[];
  startsAt?: Date | string;
  expiresAt: Date | string;
  totalUsageLimit?: number;
  perCustomerUsageLimit?: number;
  status?: CouponStatus;
  createdBy?: Types.ObjectId | string;
}

export interface UpdateCouponInput {
  title?: string;
  description?: string;
  discountType?: CouponDiscountType;
  discountValue?: number;
  maxDiscountAmount?: number;
  minimumBookingAmount?: number;
  applicableServiceIds?: string[];
  startsAt?: Date | string;
  expiresAt?: Date | string;
  totalUsageLimit?: number;
  perCustomerUsageLimit?: number;
  status?: CouponStatus;
}

export interface CouponValidationResult {
  isValid: boolean;
  coupon: CouponDocument;
  originalPrice: number;
  discountAmount: number;
  finalPrice: number;
  savingsMessage: string;
}

export class CouponService {
  /**
   * Normalizes coupon code to trimmed uppercase
   */
  normalizeCode(code: string): string {
    return (code || '').trim().toUpperCase();
  }

  /**
   * Create a new coupon for a salon with strict validation
   */
  async createCoupon(input: CreateCouponInput): Promise<CouponDocument> {
    const code = this.normalizeCode(input.code);
    if (!code || code.length < 2) {
      throw new Error('Coupon code must be at least 2 characters.');
    }
    if (!/^[A-Z0-9_-]+$/.test(code)) {
      throw new Error('Coupon code can only contain alphanumeric characters, hyphens, and underscores.');
    }

    if (!input.title || input.title.trim().length === 0) {
      throw new Error('Coupon title is required.');
    }

    if (input.discountValue <= 0) {
      throw new Error('Discount value must be greater than zero.');
    }

    if (input.discountType === 'PERCENTAGE' && input.discountValue > 100) {
      throw new Error('Percentage discount cannot exceed 100%.');
    }

    const startsAt = input.startsAt ? new Date(input.startsAt) : new Date();
    const expiresAt = new Date(input.expiresAt);

    if (isNaN(expiresAt.getTime())) {
      throw new Error('A valid expiry date is required.');
    }

    if (expiresAt <= startsAt) {
      throw new Error('Expiry date must be after the start date.');
    }

    const salonId = new Types.ObjectId(input.salonId);

    // Verify salon exists
    const salon = await Salon.findById(salonId).lean();
    if (!salon) {
      throw new Error('Salon not found.');
    }

    // Check for existing coupon code within this salon
    const existing = await Coupon.findOne({ salonId, code });
    if (existing) {
      if (existing.status === 'DELETED') {
        // Recycle deleted coupon code
        existing.title = input.title.trim();
        existing.description = input.description?.trim() || '';
        existing.discountType = input.discountType;
        existing.discountValue = input.discountValue;
        existing.maxDiscountAmount = input.maxDiscountAmount;
        existing.minimumBookingAmount = Math.max(0, input.minimumBookingAmount || 0);
        existing.applicableServiceIds = input.applicableServiceIds && input.applicableServiceIds.length > 0 ? input.applicableServiceIds : ['ALL'];
        existing.startsAt = startsAt;
        existing.expiresAt = expiresAt;
        existing.totalUsageLimit = input.totalUsageLimit;
        existing.perCustomerUsageLimit = Math.max(1, input.perCustomerUsageLimit || 1);
        existing.usedCount = 0;
        existing.status = input.status || 'ACTIVE';
        await existing.save();
        return existing;
      }
      throw new Error(`A coupon with code "${code}" already exists for this salon.`);
    }

    const coupon = await Coupon.create({
      salonId,
      code,
      title: input.title.trim(),
      description: input.description?.trim() || '',
      discountType: input.discountType,
      discountValue: input.discountValue,
      maxDiscountAmount: input.maxDiscountAmount,
      minimumBookingAmount: Math.max(0, input.minimumBookingAmount || 0),
      applicableServiceIds: input.applicableServiceIds && input.applicableServiceIds.length > 0 ? input.applicableServiceIds : ['ALL'],
      startsAt,
      expiresAt,
      totalUsageLimit: input.totalUsageLimit,
      perCustomerUsageLimit: Math.max(1, input.perCustomerUsageLimit || 1),
      usedCount: 0,
      status: input.status || 'ACTIVE',
      createdBy: input.createdBy ? new Types.ObjectId(input.createdBy) : undefined
    });

    return coupon;
  }

  /**
   * Update an existing coupon
   */
  async updateCoupon(
    couponId: Types.ObjectId | string,
    salonId: Types.ObjectId | string,
    input: UpdateCouponInput
  ): Promise<CouponDocument> {
    const coupon = await Coupon.findOne({ _id: couponId, salonId });
    if (!coupon || coupon.status === 'DELETED') {
      throw new Error('Coupon not found or has been deleted.');
    }

    if (input.title !== undefined) {
      if (!input.title.trim()) throw new Error('Title cannot be empty.');
      coupon.title = input.title.trim();
    }

    if (input.description !== undefined) {
      coupon.description = input.description.trim();
    }

    if (input.discountType !== undefined) {
      coupon.discountType = input.discountType;
    }

    if (input.discountValue !== undefined) {
      if (input.discountValue <= 0) throw new Error('Discount value must be greater than zero.');
      if (coupon.discountType === 'PERCENTAGE' && input.discountValue > 100) {
        throw new Error('Percentage discount cannot exceed 100%.');
      }
      coupon.discountValue = input.discountValue;
    }

    if (input.maxDiscountAmount !== undefined) {
      coupon.maxDiscountAmount = input.maxDiscountAmount > 0 ? input.maxDiscountAmount : undefined;
    }

    if (input.minimumBookingAmount !== undefined) {
      coupon.minimumBookingAmount = Math.max(0, input.minimumBookingAmount);
    }

    if (input.applicableServiceIds !== undefined) {
      coupon.applicableServiceIds = input.applicableServiceIds.length > 0 ? input.applicableServiceIds : ['ALL'];
    }

    if (input.startsAt !== undefined) {
      coupon.startsAt = new Date(input.startsAt);
    }

    if (input.expiresAt !== undefined) {
      const exp = new Date(input.expiresAt);
      if (exp <= coupon.startsAt) {
        throw new Error('Expiry date must be after the start date.');
      }
      coupon.expiresAt = exp;
    }

    if (input.totalUsageLimit !== undefined) {
      coupon.totalUsageLimit = input.totalUsageLimit > 0 ? input.totalUsageLimit : undefined;
    }

    if (input.perCustomerUsageLimit !== undefined) {
      coupon.perCustomerUsageLimit = Math.max(1, input.perCustomerUsageLimit);
    }

    if (input.status !== undefined) {
      coupon.status = input.status;
    }

    await coupon.save();
    return coupon;
  }

  /**
   * Toggle activate/pause coupon status
   */
  async setCouponStatus(
    couponId: Types.ObjectId | string,
    salonId: Types.ObjectId | string,
    newStatus: 'ACTIVE' | 'PAUSED'
  ): Promise<CouponDocument> {
    const coupon = await Coupon.findOne({ _id: couponId, salonId });
    if (!coupon || coupon.status === 'DELETED') {
      throw new Error('Coupon not found.');
    }

    if (newStatus === 'ACTIVE') {
      // Check if already expired
      if (new Date() > new Date(coupon.expiresAt)) {
        throw new Error('Cannot activate an expired coupon. Please extend the expiry date first.');
      }
    }

    coupon.status = newStatus;
    await coupon.save();
    return coupon;
  }

  /**
   * Safely delete coupon
   */
  async deleteCoupon(
    couponId: Types.ObjectId | string,
    salonId: Types.ObjectId | string
  ): Promise<{ message: string }> {
    const coupon = await Coupon.findOne({ _id: couponId, salonId });
    if (!coupon || coupon.status === 'DELETED') {
      throw new Error('Coupon not found.');
    }

    // Check if redemptions exist in ledger
    const redemptionsCount = await CouponRedemption.countDocuments({
      couponId: coupon._id,
      status: 'APPLIED'
    });

    if (redemptionsCount > 0) {
      // Soft-delete to preserve booking history integrity
      coupon.status = 'DELETED';
      await coupon.save();
      return { message: 'Coupon has active booking records and was safely retired.' };
    } else {
      // Hard delete if never redeemed
      await Coupon.deleteOne({ _id: coupon._id });
      return { message: 'Coupon deleted successfully.' };
    }
  }

  /**
   * List all coupons for an owner's salon with detailed statistics
   */
  async getOwnerCoupons(salonId: Types.ObjectId | string) {
    const coupons = await Coupon.find({
      salonId,
      status: { $ne: 'DELETED' }
    })
      .sort({ createdAt: -1 })
      .lean();

    const now = new Date();

    // Enrich each coupon with reliable ledger stats
    const enriched = await Promise.all(
      coupons.map(async (c) => {
        const isExpired = now > new Date(c.expiresAt);
        const effectiveStatus: CouponStatus = isExpired && c.status === 'ACTIVE' ? 'EXPIRED' : c.status;

        const redemptions = await CouponRedemption.find({
          couponId: c._id,
          status: 'APPLIED'
        }).lean();

        const totalDiscountGranted = redemptions.reduce((acc, r) => acc + (r.discountAmount || 0), 0);
        const remainingUses = typeof c.totalUsageLimit === 'number'
          ? Math.max(0, c.totalUsageLimit - c.usedCount)
          : null;

        return {
          ...c,
          id: c._id.toString(),
          effectiveStatus,
          isExpired,
          totalRedemptions: c.usedCount,
          totalDiscountGranted,
          remainingUses
        };
      })
    );

    // Summary statistics for owner overview
    const totalCoupons = enriched.length;
    const activeCoupons = enriched.filter((c) => c.effectiveStatus === 'ACTIVE').length;
    const totalRedemptions = enriched.reduce((acc, c) => acc + c.totalRedemptions, 0);
    const totalDiscountsGranted = enriched.reduce((acc, c) => acc + c.totalDiscountGranted, 0);

    return {
      summary: {
        totalCoupons,
        activeCoupons,
        totalRedemptions,
        totalDiscountsGranted
      },
      coupons: enriched
    };
  }

  /**
   * Get single coupon analytics for salon owner
   */
  async getCouponAnalytics(couponId: Types.ObjectId | string, salonId: Types.ObjectId | string) {
    const coupon = await Coupon.findOne({ _id: couponId, salonId }).lean();
    if (!coupon || coupon.status === 'DELETED') {
      throw new Error('Coupon not found.');
    }

    const redemptions = await CouponRedemption.find({
      couponId: coupon._id,
      status: 'APPLIED'
    })
      .populate('customerId', 'name phone')
      .populate('appointmentId', 'appointmentDate startTime serviceName status')
      .sort({ createdAt: -1 })
      .lean();

    const totalSavings = redemptions.reduce((sum, r) => sum + (r.discountAmount || 0), 0);
    const remainingUses = typeof coupon.totalUsageLimit === 'number'
      ? Math.max(0, coupon.totalUsageLimit - coupon.usedCount)
      : null;

    return {
      coupon: {
        ...coupon,
        id: coupon._id.toString()
      },
      stats: {
        totalRedemptions: coupon.usedCount,
        remainingUses,
        totalSavings,
        bookingCount: redemptions.length
      },
      recentRedemptions: redemptions.map((r: any) => ({
        id: r._id.toString(),
        appointmentDate: r.appointmentId?.appointmentDate || 'N/A',
        serviceName: r.appointmentId?.serviceName || 'General Service',
        discountAmount: r.discountAmount,
        finalPrice: r.finalPrice,
        createdAt: r.createdAt
      }))
    };
  }

  /**
   * List eligible coupons for customers for a specific salon
   */
  async getEligibleCouponsForSalon(salonId: Types.ObjectId | string, serviceId?: string) {
    const now = new Date();
    const coupons = await Coupon.find({
      salonId,
      status: 'ACTIVE',
      startsAt: { $lte: now },
      expiresAt: { $gte: now }
    })
      .sort({ discountValue: -1 })
      .lean();

    return coupons
      .filter((c) => {
        // Usage limit check
        if (typeof c.totalUsageLimit === 'number' && c.usedCount >= c.totalUsageLimit) {
          return false;
        }
        // Service eligibility filter if requested
        if (serviceId && c.applicableServiceIds && !c.applicableServiceIds.includes('ALL')) {
          const match = c.applicableServiceIds.some(
            (id) => id === serviceId || id.toLowerCase() === serviceId.toLowerCase()
          );
          if (!match) return false;
        }
        return true;
      })
      .map((c) => ({
        id: c._id.toString(),
        salonId: c.salonId.toString(),
        code: c.code,
        title: c.title,
        description: c.description,
        discountType: c.discountType,
        discountValue: c.discountValue,
        maxDiscountAmount: c.maxDiscountAmount,
        minimumBookingAmount: c.minimumBookingAmount,
        applicableServiceIds: c.applicableServiceIds,
        startsAt: c.startsAt,
        expiresAt: c.expiresAt,
        remainingUses: typeof c.totalUsageLimit === 'number' ? Math.max(0, c.totalUsageLimit - c.usedCount) : null,
        formattedDiscount: c.discountType === 'PERCENTAGE'
          ? `${c.discountValue}% OFF${c.maxDiscountAmount ? ` (Up to ₹${c.maxDiscountAmount})` : ''}`
          : `₹${c.discountValue} FLAT OFF`
      }));
  }

  /**
   * Validate and compute discount for a booking checkout
   */
  async validateCouponForBooking(params: {
    salonId: Types.ObjectId | string;
    customerId: Types.ObjectId | string;
    code: string;
    servicePrice: number;
    serviceId?: string;
    serviceName?: string;
  }): Promise<CouponValidationResult> {
    const code = this.normalizeCode(params.code);
    if (!code) {
      throw new Error('Please enter a coupon code.');
    }

    const salonId = new Types.ObjectId(params.salonId);
    const customerId = new Types.ObjectId(params.customerId);

    // 1. Find coupon strictly scoped to this salon
    const coupon = await Coupon.findOne({ salonId, code });
    if (!coupon || coupon.status === 'DELETED') {
      throw new Error(`Coupon "${code}" is invalid for this salon.`);
    }

    // 2. Status verification
    if (coupon.status === 'PAUSED') {
      throw new Error(`Coupon "${code}" is currently paused and cannot be applied.`);
    }
    if (coupon.status === 'EXPIRED') {
      throw new Error(`Coupon "${code}" has expired.`);
    }

    // 3. Date validity
    const now = new Date();
    if (now < new Date(coupon.startsAt)) {
      throw new Error(`Coupon "${code}" is not yet active.`);
    }
    if (now > new Date(coupon.expiresAt)) {
      coupon.status = 'EXPIRED';
      await coupon.save();
      throw new Error(`Coupon "${code}" has expired.`);
    }

    // 4. Minimum booking amount check
    const originalPrice = Math.max(0, Number(params.servicePrice) || 0);
    if (coupon.minimumBookingAmount > 0 && originalPrice < coupon.minimumBookingAmount) {
      throw new Error(
        `Minimum booking amount of ₹${coupon.minimumBookingAmount.toLocaleString('en-IN')} required to apply coupon "${code}".`
      );
    }

    // 5. Applicable service check
    if (
      coupon.applicableServiceIds &&
      coupon.applicableServiceIds.length > 0 &&
      !coupon.applicableServiceIds.includes('ALL')
    ) {
      const matchId = params.serviceId && coupon.applicableServiceIds.includes(params.serviceId);
      const matchName =
        params.serviceName &&
        coupon.applicableServiceIds.some((s) => s.toLowerCase() === params.serviceName?.toLowerCase());
      if (!matchId && !matchName) {
        throw new Error(`Coupon "${code}" is not valid for the selected service.`);
      }
    }

    // 6. Total usage limit check
    if (typeof coupon.totalUsageLimit === 'number' && coupon.usedCount >= coupon.totalUsageLimit) {
      throw new Error(`Coupon "${code}" has reached its maximum total redemption limit.`);
    }

    // 7. Per-customer usage limit check
    const customerUsesCount = await CouponRedemption.countDocuments({
      couponId: coupon._id,
      customerId,
      status: 'APPLIED'
    });

    if (customerUsesCount >= coupon.perCustomerUsageLimit) {
      throw new Error(
        `You have already used coupon "${code}" the maximum allowed number of times (${coupon.perCustomerUsageLimit}).`
      );
    }

    // 8. Calculate discount amount
    let rawDiscount = 0;
    if (coupon.discountType === 'PERCENTAGE') {
      rawDiscount = Math.round((originalPrice * coupon.discountValue) / 100);
      if (typeof coupon.maxDiscountAmount === 'number' && coupon.maxDiscountAmount > 0) {
        rawDiscount = Math.min(rawDiscount, coupon.maxDiscountAmount);
      }
    } else {
      rawDiscount = coupon.discountValue;
    }

    // Bound discount so price never drops below 0
    const discountAmount = Math.min(originalPrice, Math.max(0, rawDiscount));
    const finalPrice = Math.max(0, originalPrice - discountAmount);

    const savingsMessage =
      discountAmount > 0
        ? `Coupon applied! You save ₹${discountAmount.toLocaleString('en-IN')}`
        : 'Coupon applied.';

    return {
      isValid: true,
      coupon,
      originalPrice,
      discountAmount,
      finalPrice,
      savingsMessage
    };
  }

  /**
   * Record coupon redemption atomically when booking is created/confirmed
   */
  async recordRedemption(params: {
    couponId: Types.ObjectId | string;
    salonId: Types.ObjectId | string;
    customerId: Types.ObjectId | string;
    appointmentId: Types.ObjectId | string;
    code: string;
    discountAmount: number;
    originalPrice: number;
    finalPrice: number;
  }) {
    const couponId = new Types.ObjectId(params.couponId);
    const appointmentId = new Types.ObjectId(params.appointmentId);

    // Atomically increment usage only if totalUsageLimit is not violated
    const updatedCoupon = await Coupon.findOneAndUpdate(
      {
        _id: couponId,
        $or: [
          { totalUsageLimit: null },
          { totalUsageLimit: { $exists: false } },
          { $expr: { $lt: ['$usedCount', '$totalUsageLimit'] } }
        ]
      },
      { $inc: { usedCount: 1 } },
      { new: true }
    );

    if (!updatedCoupon) {
      throw new Error('Coupon usage limit reached during concurrent redemption.');
    }

    // Create redemption ledger entry
    const redemption = await CouponRedemption.create({
      couponId,
      salonId: new Types.ObjectId(params.salonId),
      customerId: new Types.ObjectId(params.customerId),
      appointmentId,
      code: this.normalizeCode(params.code),
      discountAmount: params.discountAmount,
      originalPrice: params.originalPrice,
      finalPrice: params.finalPrice,
      status: 'APPLIED'
    });

    return redemption;
  }

  /**
   * Revert coupon redemption atomically upon booking cancellation
   */
  async revertRedemption(appointmentId: Types.ObjectId | string): Promise<boolean> {
    const apptId = new Types.ObjectId(appointmentId);

    // Find and update status to REVERTED atomically (prevents multiple reverts)
    const redemption = await CouponRedemption.findOneAndUpdate(
      {
        appointmentId: apptId,
        status: 'APPLIED'
      },
      {
        status: 'REVERTED',
        revertedAt: new Date()
      },
      { new: true }
    );

    if (!redemption) {
      // Either no coupon was used, or already reverted
      return false;
    }

    // Decrement used count safely
    await Coupon.updateOne(
      { _id: redemption.couponId, usedCount: { $gt: 0 } },
      { $inc: { usedCount: -1 } }
    );

    return true;
  }
}

export const couponService = new CouponService();
