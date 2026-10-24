import { Router } from 'express';
import mongoose, { Types } from 'mongoose';
import { z } from 'zod';
import { AuthRequest, requireAuth } from '../middleware/auth.js';
import { Salon } from '../models/Salon.js';
import { SalonOffer } from '../models/SalonOffer.js';
import { Service } from '../models/Service.js';
import { User } from '../models/User.js';
import { fcmService } from '../services/fcm.service.js';
import { cloudinaryService } from '../services/cloudinary.service.js';
import { getSalonEligibility, isSalonBookable } from '../utils/salon.js';

const router = Router();

const offerSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(120),
  description: z.string().trim().min(5, 'Description must be at least 5 characters'),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).default('PERCENTAGE'),
  discountValue: z.number().min(1, 'Discount value must be greater than 0'),
  applicableService: z.string().default('ALL'),
  startDate: z.string().optional(),
  endDate: z.string().min(1, 'End date is required'),
  image: z.string().optional(),
  isActive: z.boolean().default(true)
});

// Format date nicely (e.g. "10 October")
function formatOfferDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
}

// ==========================================
// 1. Salon Owner Offer Management Endpoints
// ==========================================

// GET /api/v1/owner/offers - List offers for owner's salon
router.get(
  '/owner/offers',
  requireAuth(['SALON_OWNER']),
  async (req: AuthRequest, res, next) => {
    try {
      const salon = await Salon.findOne({ ownerId: req.auth!.id });
      if (!salon) {
        return res.json({ count: 0, data: [] });
      }

      const offers = await SalonOffer.find({ salonId: salon._id })
        .sort({ createdAt: -1 })
        .lean();

      res.json({
        count: offers.length,
        data: offers
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/owner/offers - Create new offer & broadcast push notification
router.post(
  '/owner/offers',
  requireAuth(['SALON_OWNER']),
  async (req: AuthRequest, res, next) => {
    try {
      const salon = await Salon.findOne({ ownerId: req.auth!.id });
      if (!salon) {
        return res.status(404).json({ message: 'Salon not found.' });
      }

      const data = offerSchema.parse(req.body);

      const startDate = data.startDate ? new Date(data.startDate) : new Date();
      const endDate = new Date(data.endDate);

      if (endDate <= startDate) {
        return res.status(400).json({ message: 'End date must be after start date.' });
      }

      // Check applicable service name if specific service was chosen
      let applicableServiceName = 'All Services';
      if (data.applicableService && data.applicableService !== 'ALL') {
        if (mongoose.Types.ObjectId.isValid(data.applicableService)) {
          const serv = await Service.findOne({ _id: data.applicableService, salonId: salon._id });
          if (serv) {
            applicableServiceName = serv.name;
          }
        } else {
          const serv = await Service.findOne({ name: data.applicableService, salonId: salon._id });
          if (serv) {
            applicableServiceName = serv.name;
          } else {
            applicableServiceName = data.applicableService;
          }
        }
      }

      const offer = await SalonOffer.create({
        salonId: salon._id,
        title: data.title,
        description: data.description,
        discountType: data.discountType,
        discountValue: data.discountValue,
        applicableService: data.applicableService,
        startDate,
        endDate,
        image: data.image ? data.image.trim() : undefined,
        isActive: data.isActive
      });

      // CUSTOMER: Receive push notification when a salon publishes an offer
      // Example:
      // "🔥 New Offer from Glow Beauty Salon
      // 20% OFF Hair Services
      // Valid until 10 October."
      if (offer.isActive && salon.status === 'ACTIVE') {
        const discountLabel =
          data.discountType === 'PERCENTAGE'
            ? `${data.discountValue}% OFF`
            : `₹${data.discountValue} OFF`;

        const pushTitle = `🔥 New Offer from ${salon.salonName}`;
        const pushBody = `${discountLabel} ${applicableServiceName}\nValid until ${formatOfferDate(endDate)}.`;

        // Retrieve customers to notify
        const customers = await User.find({
          role: 'CUSTOMER',
          $or: [{ isActive: true }, { isActive: { $exists: false } }]
        }).select('_id');
        const customerIds = customers.map((c) => c._id);

        if (customerIds.length > 0) {
          await fcmService.broadcastNotification(customerIds, {
            type: 'OFFER_PUBLISHED',
            title: pushTitle,
            body: pushBody,
            salonId: salon._id,
            offerId: offer._id,
            senderId: salon.ownerId,
            targetScreen: 'OfferDetails',
            data: {
              screen: 'OfferDetails',
              targetScreen: 'OfferDetails',
              salonId: salon._id.toString(),
              offerId: offer._id.toString(),
              salonName: salon.salonName,
              offerTitle: offer.title
            }
          });
        }
      }

      res.status(201).json({
        message: 'Offer created and published successfully.',
        offer
      });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/v1/owner/offers/:id - Edit existing offer
router.put(
  '/owner/offers/:id',
  requireAuth(['SALON_OWNER']),
  async (req: AuthRequest, res, next) => {
    try {
      const salon = await Salon.findOne({ ownerId: req.auth!.id });
      if (!salon) {
        return res.status(404).json({ message: 'Salon not found.' });
      }

      const offer = await SalonOffer.findOne({ _id: req.params.id, salonId: salon._id });
      if (!offer) {
        return res.status(404).json({ message: 'Offer not found.' });
      }

      const data = offerSchema.parse(req.body);
      const oldImage = offer.image;

      offer.title = data.title;
      offer.description = data.description;
      offer.discountType = data.discountType;
      offer.discountValue = data.discountValue;
      offer.applicableService = data.applicableService;
      if (data.startDate) offer.startDate = new Date(data.startDate);
      offer.endDate = new Date(data.endDate);
      if (data.image !== undefined) offer.image = data.image;
      offer.isActive = data.isActive;

      await offer.save();

      // Safely cleanup previous offer image from Cloudinary if replaced
      if (oldImage && data.image && oldImage !== data.image) {
        cloudinaryService.deleteAsset(oldImage, {
          requiredPrefix: `aurelia-offers/${salon._id}`
        }).catch((err) => console.warn('[Offer Image Cleanup] Non-blocking cleanup warning:', err));
      }

      res.json({
        message: 'Offer updated successfully.',
        offer
      });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/v1/owner/offers/:id/toggle - Activate/Deactivate offer
router.patch(
  '/owner/offers/:id/toggle',
  requireAuth(['SALON_OWNER']),
  async (req: AuthRequest, res, next) => {
    try {
      const salon = await Salon.findOne({ ownerId: req.auth!.id });
      if (!salon) {
        return res.status(404).json({ message: 'Salon not found.' });
      }

      const offer = await SalonOffer.findOne({ _id: req.params.id, salonId: salon._id });
      if (!offer) {
        return res.status(404).json({ message: 'Offer not found.' });
      }

      offer.isActive = !offer.isActive;
      await offer.save();

      res.json({
        message: `Offer is now ${offer.isActive ? 'active' : 'inactive'}.`,
        offer
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/v1/owner/offers/:id - Delete offer
router.delete(
  '/owner/offers/:id',
  requireAuth(['SALON_OWNER']),
  async (req: AuthRequest, res, next) => {
    try {
      const salon = await Salon.findOne({ ownerId: req.auth!.id });
      if (!salon) {
        return res.status(404).json({ message: 'Salon not found.' });
      }

      const deleted = await SalonOffer.findOneAndDelete({ _id: req.params.id, salonId: salon._id });
      if (!deleted) {
        return res.status(404).json({ message: 'Offer not found.' });
      }

      // Safely cleanup offer banner image from Cloudinary after deletion
      if (deleted.image) {
        cloudinaryService.deleteAsset(deleted.image, {
          requiredPrefix: `aurelia-offers/${salon._id}`
        }).catch((err) => console.warn('[Offer Image Cleanup] Non-blocking cleanup warning:', err));
      }

      res.json({ message: 'Offer deleted successfully.' });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/owner/offers/upload - Upload offer banner image
router.post(
  '/owner/offers/upload',
  requireAuth(['SALON_OWNER']),
  async (req: AuthRequest, res, next) => {
    try {
      const salon = await Salon.findOne({ ownerId: req.auth!.id });
      if (!salon) {
        return res.status(404).json({ message: 'Salon not found.' });
      }

      const bodySchema = z.object({
        imageData: z.string().min(1, 'Image data is required'),
        fileType: z.string().optional()
      });

      const { imageData } = bodySchema.parse(req.body);

      // Validate base64 length (approx 5MB binary is ~7.5MB base64)
      if (imageData.length > 7.5 * 1024 * 1024) {
        return res.status(400).json({ message: 'Offer image file size exceeds the 5MB limit.' });
      }

      const uploadRes = await cloudinaryService.uploadImage(imageData, {
        folder: `aurelia-offers/${salon._id}`
      });

      res.json({
        message: 'Offer image uploaded successfully.',
        url: uploadRes.secureUrl || uploadRes.url,
        secureUrl: uploadRes.secureUrl || uploadRes.url,
        publicId: uploadRes.publicId
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==========================================
// 2. Public / Customer Offer Endpoints
// ==========================================

// GET /api/v1/salons/:id/offers - View offers for a specific salon
router.get('/salons/:id/offers', async (req, res, next) => {
  try {
    const salon = await Salon.findById(req.params.id);
    if (!salon) {
      return res.status(404).json({ message: 'Salon not found.' });
    }

    const now = new Date();
    const offers = await SalonOffer.find({
      salonId: salon._id,
      isActive: true,
      status: { $nin: ['EXPIRED', 'INACTIVE', 'DELETED'] },
      startDate: { $lte: now },
      endDate: { $gte: now }
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      count: offers.length,
      data: offers
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/offers/:id or /salons/offers/:id - Public: Get specific offer details with populated salon
router.get(
  ['/offers/:id', '/salons/offers/:id'],
  async (req, res, next) => {
    try {
      const offerId = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) || '';
      if (!offerId || !Types.ObjectId.isValid(offerId)) {
        return res.status(400).json({ message: 'Invalid offer identifier.' });
      }

      const offer = await SalonOffer.findById(offerId)
        .populate('salonId', 'salonName phone address city location images rating reviews status subscriptionStatus services')
        .lean();

      if (!offer) {
        return res.status(404).json({ message: 'Offer not found or no longer available.' });
      }

      const now = new Date();
      const isExpired =
        !offer.isActive ||
        offer.status === 'EXPIRED' ||
        new Date(offer.endDate) < now ||
        (offer.startDate && new Date(offer.startDate) > now);

      const salon = offer.salonId as any;
      const salonEligibility = getSalonEligibility(salon);

      let eligibility: {
        canView: boolean;
        canBook: boolean;
        reason:
          | 'OFFER_EXPIRED'
          | 'SALON_NOT_APPROVED'
          | 'SALON_INACTIVE'
          | 'SUBSCRIPTION_EXPIRED'
          | 'SUBSCRIPTION_CANCELLED'
          | null;
      };

      if (isExpired) {
        eligibility = {
          canView: false,
          canBook: false,
          reason: 'OFFER_EXPIRED'
        };
      } else if (!salonEligibility.canBook) {
        eligibility = {
          canView: false,
          canBook: false,
          reason: salonEligibility.reason as any
        };
      } else {
        eligibility = {
          canView: true,
          canBook: true,
          reason: null
        };
      }

      if (!salon) {
        return res.status(404).json({
          message: 'The salon associated with this offer is currently inactive or not found.'
        });
      }

      // Find applicable service details if specific service is selected
      let serviceDetails = null;
      if (offer.applicableService && offer.applicableService !== 'ALL') {
        serviceDetails = salon.services?.find(
          (s: any) =>
            s._id?.toString() === offer.applicableService ||
            s.id?.toString() === offer.applicableService ||
            s.name === offer.applicableService
        ) || null;
      }

      res.json({
        data: {
          ...offer,
          id: offer._id.toString(),
          isExpired,
          applicableServiceDetails: serviceDetails,
          salon: {
            ...salon,
            id: salon._id?.toString(),
            name: salon.salonName,
            location: salon.city ? `${salon.city} • ${salon.address}` : salon.address,
            coordinates: salon.location
          },
          eligibility
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
