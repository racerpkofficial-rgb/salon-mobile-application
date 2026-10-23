import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { AuthRequest, requireAuth } from '../middleware/auth.js';
import { Salon } from '../models/Salon.js';
import { Service } from '../models/Service.js';
import { Appointment } from '../models/Appointment.js';
import { Subscription, PlanType, BillingCycle } from '../models/Subscription.js';
import { Payment } from '../models/Payment.js';
import { SUBSCRIPTION_PLANS, calculatePlanAmount } from '../config/plans.js';
import { fcmService } from '../services/fcm.service.js';
import { razorpayService } from '../services/razorpay.service.js';
import { cloudinaryService } from '../services/cloudinary.service.js';
import { env } from '../config/env.js';
import { isValidCoordinate, geocodeCity, normalizeCityName } from '../utils/location.js';
import { analyticsService, AnalyticsPeriod } from '../services/analytics.service.js';

const router = Router();

// Protect all owner routes with SALON_OWNER role guard
router.use(requireAuth(['SALON_OWNER']));

const salonSchema = z.object({
  salonName: z.string().trim().min(2, 'Salon name must have at least 2 characters').max(100),
  description: z.string().trim().max(1000).optional().default(''),
  phone: z.string().trim().min(8, 'Phone number must have at least 8 digits'),
  email: z.string().trim().email('Valid business email is required'),
  address: z.string().trim().min(5, 'Address must have at least 5 characters'),
  city: z.string().trim().min(2, 'City is required'),
  state: z.string().trim().optional(),
  country: z.string().trim().default('India'),
  location: z
    .object({
      latitude: z.number(),
      longitude: z.number()
    })
    .optional(),
  images: z.array(z.string()).max(8, 'Maximum 8 images allowed').default([]),
  services: z
    .array(
      z.object({
        name: z.string().trim().min(1, 'Service name is required'),
        category: z.string().default('General'),
        price: z.number().min(0, 'Price must be non-negative'),
        durationMinutes: z.number().min(5).default(30),
        description: z.string().default('')
      })
    )
    .default([])
});

const checkoutSchema = z.object({
  plan: z.enum(['STARTER', 'BUSINESS', 'PREMIUM']),
  billingCycle: z.enum(['MONTHLY', 'YEARLY']),
  paymentMethod: z.string().default('UPI_MOCK')
});

const razorpayOrderSchema = z.object({
  plan: z.enum(['STARTER', 'BUSINESS', 'PREMIUM']),
  billingCycle: z.enum(['MONTHLY', 'YEARLY'])
});

const razorpayVerifySchema = z.object({
  razorpayOrderId: z.string().min(1, 'Razorpay order ID is required'),
  razorpayPaymentId: z.string().min(1, 'Razorpay payment ID is required'),
  razorpaySignature: z.string().min(1, 'Razorpay signature is required'),
  plan: z.enum(['STARTER', 'BUSINESS', 'PREMIUM']),
  billingCycle: z.enum(['MONTHLY', 'YEARLY'])
});

// GET /api/v1/owner/profile
router.get('/profile', (req: AuthRequest, res) => {
  res.json({
    message: 'Owner profile accessed successfully',
    user: req.auth
  });
});

// GET /api/v1/owner/salon - Fetch owner's salon and subscription
router.get('/salon', async (req: AuthRequest, res, next) => {
  try {
    const salon = await Salon.findOne({ ownerId: req.auth!.id }).populate('subscriptionId').lean();
    if (!salon) {
      return res.json({
        hasSalon: false,
        salon: null,
        message: 'No salon registered yet for this account.'
      });
    }

    return res.json({
      hasSalon: true,
      salon,
      message:
        salon.status === 'PENDING_APPROVAL'
          ? 'Your salon registration is under review.'
          : salon.status === 'ACTIVE'
          ? 'Your salon is active and discoverable.'
          : `Your salon status is ${salon.status}.`
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/owner/salon - Register / Onboard salon
router.post('/salon', async (req: AuthRequest, res, next) => {
  try {
    const data = salonSchema.parse(req.body);
    const existing = await Salon.findOne({ ownerId: req.auth!.id });

    const canonicalCity = normalizeCityName(data.city);
    // Coordinate determination & validation
    let coords = data.location;
    if (coords) {
      if (!isValidCoordinate(coords.latitude, coords.longitude)) {
        return res
          .status(400)
          .json({ message: 'Invalid latitude (-90 to 90) or longitude (-180 to 180) coordinates' });
      }
    } else {
      const geo = geocodeCity(canonicalCity || data.city);
      if (geo) {
        coords = geo;
      }
    }

    const canonicalState =
      data.state ||
      (canonicalCity === 'Tiruchirappalli' || canonicalCity === 'Chennai' || canonicalCity === 'Coimbatore' || canonicalCity === 'Madurai' || canonicalCity === 'Salem'
        ? 'Tamil Nadu'
        : canonicalCity === 'Bengaluru' || canonicalCity === 'Mysuru'
        ? 'Karnataka'
        : '');

    if (existing) {
      // Update existing salon
      existing.salonName = data.salonName;
      existing.description = (data.description || '').trim();
      existing.phone = data.phone;
      existing.email = data.email.toLowerCase();
      existing.address = data.address;
      existing.city = canonicalCity;
      if (canonicalState) existing.state = canonicalState;
      if (data.country !== undefined) existing.country = data.country;
      if (coords) existing.location = coords;
      if (Array.isArray(data.images)) existing.images = data.images.slice(0, 8);
      if (data.services.length) existing.services = data.services;
      // Strictly maintain PENDING_APPROVAL unless already reviewed
      if (existing.status !== 'ACTIVE') {
        existing.status = 'PENDING_APPROVAL';
      }
      await existing.save();

      return res.json({
        salon: existing,
        message: 'Your salon registration is under review.'
      });
    }

    // Only save real images provided by owner (max 8)
    const salonImages = (data.images || []).slice(0, 8);

    // Do not inject invented services if owner has not provided them
    const defaultServices = data.services.length ? data.services : [];

    const salon = await Salon.create({
      ownerId: req.auth!.id,
      salonName: data.salonName,
      description: (data.description || '').trim(),
      phone: data.phone,
      email: data.email.toLowerCase(),
      address: data.address,
      city: canonicalCity,
      state: canonicalState,
      country: data.country || 'India',
      location: coords,
      images: salonImages,
      services: defaultServices,
      status: 'PENDING_APPROVAL',
      subscriptionStatus: 'PENDING'
    });

    return res.status(201).json({
      salon,
      message: 'Your salon registration is under review.'
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/owner/subscription/status - Fetch current subscription details
router.get('/subscription/status', async (req: AuthRequest, res, next) => {
  try {
    const salon = await Salon.findOne({ ownerId: req.auth!.id });
    if (!salon) {
      return res.status(404).json({ message: 'Please register your salon details first.' });
    }

    const subscription = salon.subscriptionId
      ? await Subscription.findById(salon.subscriptionId).lean()
      : await Subscription.findOne({ ownerId: req.auth!.id }).sort({ createdAt: -1 }).lean();

    return res.json({
      salon: {
        id: salon._id,
        salonName: salon.salonName,
        status: salon.status,
        subscriptionStatus: salon.subscriptionStatus
      },
      subscription: subscription || null,
      message:
        salon.status === 'PENDING_APPROVAL'
          ? 'Your salon registration is under review.'
          : `Salon status: ${salon.status}`
    });
  } catch (error) {
    next(error);
  }
});

// ========================================================
// RAZORPAY SUBSCRIPTION PAYMENT FLOW
// ========================================================

// POST /api/v1/owner/subscription/razorpay/order - Create Razorpay order on backend
router.post('/subscription/razorpay/order', async (req: AuthRequest, res, next) => {
  try {
    const data = razorpayOrderSchema.parse(req.body);
    const amount = razorpayService.getPlanAmount(data.plan, data.billingCycle);

    let salon = await Salon.findOne({ ownerId: req.auth!.id });
    if (!salon) {
      const ownerCity = normalizeCityName(req.auth!.city);
      const ownerCoords = ownerCity ? geocodeCity(ownerCity) : undefined;
      salon = await Salon.create({
        ownerId: req.auth!.id,
        salonName: `${req.auth!.name}'s Salon`,
        description: '',
        phone: req.auth!.phone || '+91 99999 00000',
        email: req.auth!.email,
        address: req.auth!.address || 'Commercial Center',
        city: ownerCity || '',
        location: ownerCoords,
        images: [],
        services: [
          { name: 'Standard Hair & Grooming', category: 'General', price: 500, durationMinutes: 30, description: 'Basic service' }
        ],
        status: 'PENDING_APPROVAL',
        subscriptionStatus: 'PENDING'
      });
    }

    const receipt = `rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const order = await razorpayService.createOrder({
      amount,
      receipt,
      notes: {
        salonId: salon._id.toString(),
        ownerId: req.auth!.id,
        plan: data.plan,
        billingCycle: data.billingCycle
      }
    });

    // Create initial Payment record in MongoDB with status PENDING
    await Payment.create({
      salonId: salon._id,
      ownerId: req.auth!.id,
      planId: data.plan,
      amount,
      billingCycle: data.billingCycle,
      razorpayOrderId: order.id,
      status: 'PENDING'
    });

    // Send order details & public Key ID to client. NEVER expose secret key!
    return res.status(200).json({
      orderId: order.id,
      amount: order.amount, // in paise
      amountInRupees: amount,
      currency: order.currency,
      keyId: env.RAZORPAY_KEY_ID,
      plan: data.plan,
      billingCycle: data.billingCycle,
      salonName: salon.salonName
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/owner/subscription/razorpay/verify - Verify signature and activate subscription
router.post('/subscription/razorpay/verify', async (req: AuthRequest, res, next) => {
  try {
    const data = razorpayVerifySchema.parse(req.body);
    const amount = razorpayService.getPlanAmount(data.plan, data.billingCycle);

    // 1. Verify payment signature on backend using Razorpay secret
    const isValidSignature = razorpayService.verifyPaymentSignature({
      razorpayOrderId: data.razorpayOrderId,
      razorpayPaymentId: data.razorpayPaymentId,
      razorpaySignature: data.razorpaySignature
    });

    if (!isValidSignature) {
      await Payment.findOneAndUpdate(
        { razorpayOrderId: data.razorpayOrderId },
        {
          razorpayPaymentId: data.razorpayPaymentId,
          status: 'FAILED'
        }
      );
      return res.status(400).json({
        message: 'Payment verification failed: Invalid Razorpay signature.'
      });
    }

    let salon = await Salon.findOne({ ownerId: req.auth!.id });
    if (!salon) {
      return res.status(404).json({ message: 'Salon not found.' });
    }

    // 2. Update Payment record to SUCCESS
    const payment = await Payment.findOneAndUpdate(
      { razorpayOrderId: data.razorpayOrderId },
      {
        salonId: salon._id,
        ownerId: req.auth!.id,
        planId: data.plan,
        amount,
        billingCycle: data.billingCycle,
        razorpayPaymentId: data.razorpayPaymentId,
        status: 'SUCCESS'
      },
      { upsert: true, new: true }
    );

    // 3. Track subscription start date and expiry date
    const startDate = new Date();
    const endDate = new Date(startDate);
    if (data.billingCycle === 'YEARLY') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    // 4. Activate subscription only after successful verification
    const subscription = await Subscription.create({
      salonId: salon._id,
      ownerId: req.auth!.id,
      plan: data.plan,
      billingCycle: data.billingCycle,
      amount,
      currency: 'INR',
      status: 'ACTIVE',
      paymentMethod: 'RAZORPAY',
      transactionId: data.razorpayPaymentId,
      startDate,
      endDate
    });

    salon.subscriptionId = subscription._id;
    salon.subscriptionStatus = 'ACTIVE';
    // If not approved, keep PENDING_APPROVAL
    if (!salon.status || salon.status === 'REJECTED') {
      salon.status = 'PENDING_APPROVAL';
    }
    await salon.save();

    // 5. Send subscription status notification
    await fcmService.sendNotification({
      recipientId: req.auth!.id,
      salonId: salon._id,
      type: 'SUBSCRIPTION_STATUS',
      title: 'Partner Subscription Active 💎',
      body: `Your ${data.plan} plan (${data.billingCycle.toLowerCase()}) subscription has been verified and is now ACTIVE via Razorpay. Valid until ${endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
      data: {
        screen: 'SubscriptionStatus',
        plan: data.plan,
        paymentId: data.razorpayPaymentId
      }
    });

    return res.status(200).json({
      success: true,
      transactionId: data.razorpayPaymentId,
      amount,
      plan: SUBSCRIPTION_PLANS[data.plan],
      billingCycle: data.billingCycle,
      payment,
      subscription,
      salon,
      message: salon.status === 'PENDING_APPROVAL'
        ? 'Your salon registration is under review.'
        : 'Subscription activated successfully.'
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/owner/subscription/razorpay/test-signature - Sandbox test signature generation
router.post('/subscription/razorpay/test-signature', (req: AuthRequest, res) => {
  const { orderId, paymentId } = req.body;
  if (!orderId || !paymentId) {
    return res.status(400).json({ message: 'Both orderId and paymentId are required' });
  }
  const signature = razorpayService.generateSignature(orderId, paymentId);
  res.json({ signature });
});

// POST /api/v1/owner/subscription/mock-checkout - Process mock payment & activate subscription
router.post('/subscription/mock-checkout', async (req: AuthRequest, res, next) => {
  try {
    const data = checkoutSchema.parse(req.body);
    const amount = calculatePlanAmount(data.plan, data.billingCycle);

    let salon = await Salon.findOne({ ownerId: req.auth!.id });
    if (!salon) {
      // Auto-create provisional salon shell if owner went to subscription first
      const ownerCity = normalizeCityName(req.auth!.city);
      const ownerCoords = ownerCity ? geocodeCity(ownerCity) : undefined;
      salon = await Salon.create({
        ownerId: req.auth!.id,
        salonName: `${req.auth!.name}'s Salon`,
        description: '',
        phone: req.auth!.phone || '+91 99999 00000',
        email: req.auth!.email,
        address: req.auth!.address || 'Commercial Center',
        city: ownerCity || '',
        location: ownerCoords,
        images: [],
        services: [
          { name: 'Standard Hair & Grooming', category: 'General', price: 500, durationMinutes: 30, description: 'Basic service' }
        ],
        status: 'PENDING_APPROVAL',
        subscriptionStatus: 'PENDING'
      });
    }

    // Calculate dates
    const startDate = new Date();
    const endDate = new Date(startDate);
    if (data.billingCycle === 'YEARLY') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    const transactionId = `TXN_MOCK_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

    // Store Payment record in MongoDB
    const payment = await Payment.create({
      salonId: salon._id,
      ownerId: req.auth!.id,
      planId: data.plan,
      amount,
      billingCycle: data.billingCycle,
      razorpayOrderId: `order_mock_${Date.now()}`,
      razorpayPaymentId: transactionId,
      status: 'SUCCESS'
    });

    const subscription = await Subscription.create({
      salonId: salon._id,
      ownerId: req.auth!.id,
      plan: data.plan,
      billingCycle: data.billingCycle,
      amount,
      currency: 'INR',
      status: 'ACTIVE',
      paymentMethod: data.paymentMethod,
      transactionId,
      startDate,
      endDate
    });

    // Update salon: subscription becomes ACTIVE, but status MUST REMAIN PENDING_APPROVAL!
    salon.subscriptionId = subscription._id;
    salon.subscriptionStatus = 'ACTIVE';
    // Do not make salon active or discoverable until SUPER_ADMIN approves!
    salon.status = 'PENDING_APPROVAL';
    await salon.save();

    // Send push notification to Salon Owner: Subscription status
    await fcmService.sendNotification({
      recipientId: req.auth!.id,
      salonId: salon._id,
      type: 'SUBSCRIPTION_STATUS',
      title: 'Partner Subscription Active 💎',
      body: `Your ${data.plan} plan (${data.billingCycle.toLowerCase()}) subscription is now ACTIVE. Your salon is eligible for customer discovery upon approval.`,
      data: { screen: 'SubscriptionStatus', plan: data.plan }
    });

    return res.status(200).json({
      success: true,
      transactionId,
      amount,
      plan: SUBSCRIPTION_PLANS[data.plan],
      billingCycle: data.billingCycle,
      payment,
      subscription,
      salon,
      message: 'Your salon registration is under review.'
    });
  } catch (error) {
    next(error);
  }
});

// Cloudinary Image Upload with validation (max 5MB, JPEG/PNG/WebP)
const uploadSchema = z.object({
  image: z.string().optional(),
  imageData: z.string().optional(),
  fileType: z.string().optional(),
  folder: z.string().optional()
});

const handleOwnerUpload = async (req: AuthRequest, res: any, next: any) => {
  try {
    const data = uploadSchema.parse(req.body);
    const rawImage = data.image || data.imageData;
    if (!rawImage || typeof rawImage !== 'string' || !rawImage.trim()) {
      return res.status(400).json({ message: 'Image data is required' });
    }

    // Validate size (max 5MB binary, roughly 7MB in base64)
    if (rawImage.length > 7 * 1024 * 1024) {
      return res.status(400).json({ message: 'Image file size exceeds the 5MB limit.' });
    }

    const result = await cloudinaryService.uploadImage(rawImage, {
      folder: data.folder || `aurelia-salons/${req.auth!.id}`
    });
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

router.post('/upload', handleOwnerUpload);
router.post('/images/upload', handleOwnerUpload);

// PATCH /api/v1/owner/salon/images - Directly manage uploaded images (0-8 photos)
const salonImagesSchema = z.object({
  images: z.array(z.string()).max(8, 'Maximum 8 images allowed')
});

router.patch('/salon/images', async (req: AuthRequest, res, next) => {
  try {
    const salon = await Salon.findOne({ ownerId: req.auth!.id });
    if (!salon) {
      return res.status(404).json({ message: 'Salon not found for this partner account.' });
    }

    const { images } = salonImagesSchema.parse(req.body);
    salon.images = images.slice(0, 8);
    await salon.save();

    return res.json({
      message: 'Salon photos updated successfully.',
      salon
    });
  } catch (error) {
    next(error);
  }
});

router.get('/upload-signature', (req: AuthRequest, res, next) => {
  try {
    const folder = (req.query.folder as string) || `aurelia-salons/${req.auth!.id}`;
    const signatureData = cloudinaryService.generateUploadSignature(folder);
    return res.status(200).json(signatureData);
  } catch (error) {
    next(error);
  }
});

// ==========================================
// SALON-SPECIFIC SERVICES CRUD (OWNER PORTAL)
// ==========================================

const ownerServiceSchema = z.object({
  name: z.string().trim().min(2, 'Service name must have at least 2 characters'),
  description: z.string().trim().default(''),
  price: z.coerce.number().min(0, 'Price must be non-negative'),
  durationMinutes: z.coerce.number().min(5, 'Duration must be at least 5 minutes').default(30),
  duration: z.coerce.number().optional(),
  category: z.string().trim().default('General'),
  image: z.string().optional(),
  isActive: z.boolean().default(true)
});

const updateOwnerServiceSchema = ownerServiceSchema.partial();

// GET /api/v1/owner/services - List owner salon's services
router.get('/services', async (req: AuthRequest, res, next) => {
  try {
    const salon = await Salon.findOne({ ownerId: req.auth!.id });
    if (!salon) {
      return res.status(404).json({ message: 'Salon not found for this partner account.' });
    }

    let services = await Service.find({ salonId: salon._id }).sort({ createdAt: -1 }).lean();
    if (!services.length && salon.services?.length) {
      // Sync from embedded services if standalone not created yet
      for (const s of salon.services) {
        const duration = s.durationMinutes || (s as any).duration || 30;
        const created = await Service.create({
          salonId: salon._id,
          name: s.name,
          description: s.description || '',
          price: s.price,
          duration,
          category: s.category || 'General',
          isActive: true
        });
        services.push(created.toObject() as any);
      }
    }

    const formatted = services.map((s) => ({
      ...s,
      id: (s as any)._id?.toString() || (s as any).id,
      _id: (s as any)._id?.toString() || (s as any).id,
      durationMinutes: (s as any).duration || (s as any).durationMinutes || 30
    }));

    return res.json({
      count: formatted.length,
      data: formatted
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/owner/services - Create new service
router.post('/services', async (req: AuthRequest, res, next) => {
  try {
    const salon = await Salon.findOne({ ownerId: req.auth!.id });
    if (!salon) {
      return res.status(404).json({ message: 'Salon not found for this partner account.' });
    }

    const data = ownerServiceSchema.parse(req.body);
    const duration = data.durationMinutes ?? data.duration ?? 30;

    const service = await Service.create({
      salonId: salon._id,
      name: data.name,
      description: data.description,
      price: data.price,
      duration,
      category: data.category,
      image: data.image || '',
      isActive: data.isActive
    });

    // Also update embedded salon.services
    if (!salon.services) salon.services = [];
    salon.services.push({
      _id: service._id,
      id: service._id.toString(),
      name: service.name,
      description: service.description,
      price: service.price,
      durationMinutes: service.duration,
      category: service.category
    } as any);
    await salon.save();

    const serviceObj = {
      ...service.toObject(),
      id: service._id.toString(),
      _id: service._id.toString(),
      durationMinutes: service.duration
    };

    return res.status(201).json({
      message: 'Service created successfully.',
      service: serviceObj
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/v1/owner/services/:id - Update existing service
router.put('/services/:id', async (req: AuthRequest, res, next) => {
  try {
    const salon = await Salon.findOne({ ownerId: req.auth!.id });
    if (!salon) {
      return res.status(404).json({ message: 'Salon not found.' });
    }

    const serviceId = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) || '';
    if (!serviceId || !Types.ObjectId.isValid(serviceId)) {
      return res.status(400).json({ message: 'Invalid service ID.' });
    }

    const data = updateOwnerServiceSchema.parse(req.body);

    const service = await Service.findOne({ _id: serviceId, salonId: salon._id });
    if (!service) {
      return res.status(404).json({ message: 'Service not found.' });
    }

    const oldName = service.name;

    if (data.name !== undefined) service.name = data.name;
    if (data.description !== undefined) service.description = data.description;
    if (data.price !== undefined) service.price = data.price;
    const dur = data.durationMinutes ?? data.duration;
    if (dur !== undefined) service.duration = dur;
    if (data.category !== undefined) service.category = data.category;
    if (data.image !== undefined) service.image = data.image;
    if (data.isActive !== undefined) service.isActive = data.isActive;
    await service.save();

    // Sync in embedded salon.services
    if (salon.services?.length) {
      const idx = salon.services.findIndex(
        (s: any) => s._id?.toString() === serviceId || s.id?.toString() === serviceId || s.name === oldName
      );
      if (idx !== -1) {
        salon.services[idx].name = service.name;
        salon.services[idx].price = service.price;
        salon.services[idx].durationMinutes = service.duration;
        salon.services[idx].description = service.description;
        salon.services[idx].category = service.category;
        await salon.save();
      }
    }

    const serviceObj = {
      ...service.toObject(),
      id: service._id.toString(),
      _id: service._id.toString(),
      durationMinutes: service.duration
    };

    return res.json({
      message: 'Service updated successfully.',
      service: serviceObj
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/owner/services/:id/toggle - Toggle active/inactive
router.patch('/services/:id/toggle', async (req: AuthRequest, res, next) => {
  try {
    const salon = await Salon.findOne({ ownerId: req.auth!.id });
    if (!salon) {
      return res.status(404).json({ message: 'Salon not found.' });
    }

    const serviceId = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) || '';
    if (!serviceId || !Types.ObjectId.isValid(serviceId)) {
      return res.status(400).json({ message: 'Invalid service ID.' });
    }

    const service = await Service.findOne({ _id: serviceId, salonId: salon._id });
    if (!service) {
      return res.status(404).json({ message: 'Service not found.' });
    }

    service.isActive = !service.isActive;
    await service.save();

    const serviceObj = {
      ...service.toObject(),
      id: service._id.toString(),
      _id: service._id.toString(),
      durationMinutes: service.duration
    };

    return res.json({
      message: `Service ${service.isActive ? 'activated' : 'deactivated'} successfully.`,
      service: serviceObj
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/owner/services/:id - Delete service
router.delete('/services/:id', async (req: AuthRequest, res, next) => {
  try {
    const salon = await Salon.findOne({ ownerId: req.auth!.id });
    if (!salon) {
      return res.status(404).json({ message: 'Salon not found.' });
    }

    const serviceId = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) || '';
    if (!serviceId || !Types.ObjectId.isValid(serviceId)) {
      return res.status(400).json({ message: 'Invalid service ID.' });
    }

    const service = await Service.findOne({ _id: serviceId, salonId: salon._id });
    if (!service) {
      return res.status(404).json({ message: 'Service not found.' });
    }

    // Ensure existing appointment history and bookings are not accidentally broken
    const activeBookingsCount = await Appointment.countDocuments({
      salonId: salon._id,
      serviceId: service._id,
      status: { $in: ['PENDING', 'CONFIRMED'] }
    });
    if (activeBookingsCount > 0) {
      return res.status(400).json({
        message: `Cannot delete service with ${activeBookingsCount} active booking(s). Please deactivate the service instead, or resolve existing bookings first.`
      });
    }

    await Service.deleteOne({ _id: serviceId, salonId: salon._id });

    // Remove from embedded salon.services
    if (salon.services?.length) {
      salon.services = salon.services.filter(
        (s: any) => s._id?.toString() !== serviceId && s.id?.toString() !== serviceId && s.name !== service.name
      );
      await salon.save();
    }

    return res.json({ message: 'Service removed successfully.' });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// SALON OPERATING AVAILABILITY & BLACKOUT DATES
// ==========================================

const salonAvailabilitySchema = z.object({
  workingHours: z
    .object({
      openTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid open time (HH:mm)'),
      closeTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid close time (HH:mm)'),
      slotIntervalMinutes: z.number().min(15).max(120).default(30),
      daysOpen: z.array(z.string()).min(1, 'At least one operating day must be selected')
    })
    .optional(),
  unavailableDates: z
    .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'))
    .optional()
});

// GET /api/v1/owner/salon/availability - Fetch working hours & unavailable dates
router.get('/salon/availability', async (req: AuthRequest, res, next) => {
  try {
    const salon = await Salon.findOne({ ownerId: req.auth!.id });
    if (!salon) {
      return res.status(404).json({ message: 'Salon not found.' });
    }

    return res.json({
      workingHours: salon.workingHours || {
        openTime: '09:00',
        closeTime: '20:00',
        slotIntervalMinutes: 30,
        daysOpen: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      },
      unavailableDates: salon.unavailableDates || []
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/owner/salon/availability - Update operating hours and blackout dates
router.patch('/salon/availability', async (req: AuthRequest, res, next) => {
  try {
    const salon = await Salon.findOne({ ownerId: req.auth!.id });
    if (!salon) {
      return res.status(404).json({ message: 'Salon not found.' });
    }

    const data = salonAvailabilitySchema.parse(req.body);

    if (data.workingHours) {
      salon.workingHours = data.workingHours;
    }

    if (data.unavailableDates !== undefined) {
      salon.unavailableDates = data.unavailableDates;
    }

    await salon.save();

    return res.json({
      message: 'Salon operating availability and blackout dates updated successfully.',
      workingHours: salon.workingHours,
      unavailableDates: salon.unavailableDates
    });
  } catch (error) {
    next(error);
  }
});
// GET /api/v1/owner/analytics - Fetch salon performance analytics
router.get('/analytics', async (req: AuthRequest, res, next) => {
  try {
    const salon = await Salon.findOne({ ownerId: req.auth!.id });
    if (!salon) {
      return res.status(404).json({
        message: 'No registered salon found for this account.',
        hasSalon: false
      });
    }

    const rawPeriod = (req.query.period as string) || 'weekly';
    const validPeriods: AnalyticsPeriod[] = ['daily', 'weekly', 'monthly', 'yearly'];
    const period: AnalyticsPeriod = validPeriods.includes(rawPeriod.toLowerCase() as AnalyticsPeriod)
      ? (rawPeriod.toLowerCase() as AnalyticsPeriod)
      : 'weekly';

    const date = typeof req.query.date === 'string' ? req.query.date.trim() : undefined;

    const result = await analyticsService.getSalonAnalytics(salon._id, period, date);
    return res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
