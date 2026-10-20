import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { AuthRequest, requireAuth } from '../middleware/auth.js';
import { Salon } from '../models/Salon.js';
import { Subscription } from '../models/Subscription.js';
import { Payment } from '../models/Payment.js';
import { User } from '../models/User.js';
import { Offer } from '../models/Offer.js';
import { SupportTicket } from '../models/SupportTicket.js';
import { SUBSCRIPTION_PLANS } from '../config/plans.js';
import { fcmService } from '../services/fcm.service.js';
import { emailService } from '../services/email.service.js';

const router = Router();

// Strict backend authorization guard: Only SUPER_ADMIN allowed!
router.use(requireAuth(['SUPER_ADMIN']));

// 1. Dashboard Overview Stats
router.get('/dashboard', async (req: AuthRequest, res, next) => {
  try {
    const [
      pendingSalons,
      activeSalons,
      suspendedSalons,
      totalCustomers,
      activeSubscriptions,
      openTickets,
      totalTickets,
      recentSalons,
      recentCustomers,
      recentPayments
    ] = await Promise.all([
      Salon.countDocuments({ status: 'PENDING_APPROVAL' }),
      Salon.countDocuments({ status: 'ACTIVE' }),
      Salon.countDocuments({ status: 'SUSPENDED' }),
      User.countDocuments({ role: 'CUSTOMER' }),
      Subscription.countDocuments({ status: 'ACTIVE' }),
      SupportTicket.countDocuments({ status: 'OPEN' }),
      SupportTicket.countDocuments(),
      Salon.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('ownerId', 'name email avatar')
        .populate('subscriptionId')
        .lean(),
      User.find({ role: 'CUSTOMER' })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('name email createdAt isActive')
        .lean(),
      Subscription.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('salonId', 'salonName')
        .populate('ownerId', 'name email avatar')
        .lean()
    ]);

    res.json({
      message: 'Admin dashboard access granted',
      user: req.auth,
      stats: {
        pendingSalons,
        activeSalons,
        suspendedSalons,
        totalCustomers,
        activeSubscriptions,
        openTickets,
        totalTickets
      },
      recentRegistrations: {
        salons: recentSalons,
        customers: recentCustomers
      },
      recentPayments
    });
  } catch (error) {
    next(error);
  }
});

// 2. Pending Salons
router.get('/salons/pending', async (_req, res, next) => {
  try {
    const pendingSalons = await Salon.find({ status: 'PENDING_APPROVAL' })
      .populate('ownerId', 'name email avatar')
      .populate('subscriptionId')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ data: pendingSalons });
  } catch (error) {
    next(error);
  }
});

// 3. Active Salons
router.get('/salons/active', async (_req, res, next) => {
  try {
    const activeSalons = await Salon.find({ status: 'ACTIVE' })
      .populate('ownerId', 'name email avatar')
      .populate('subscriptionId')
      .sort({ updatedAt: -1 })
      .lean();

    res.json({ data: activeSalons });
  } catch (error) {
    next(error);
  }
});

// 4. Suspended Salons
router.get('/salons/suspended', async (_req, res, next) => {
  try {
    const suspendedSalons = await Salon.find({ status: 'SUSPENDED' })
      .populate('ownerId', 'name email avatar')
      .populate('subscriptionId')
      .sort({ updatedAt: -1 })
      .lean();

    res.json({ data: suspendedSalons });
  } catch (error) {
    next(error);
  }
});

// 5. Salon Details
router.get('/salons/:id', async (req, res, next) => {
  try {
    const salon = await Salon.findById(req.params.id)
      .populate('ownerId', 'name email avatar createdAt')
      .populate('subscriptionId')
      .lean();

    if (!salon) return res.status(404).json({ message: 'Salon not found' });
    res.json({ data: salon });
  } catch (error) {
    next(error);
  }
});

// 6. Approve Salon
router.patch('/salons/:id/approve', async (req: AuthRequest, res, next) => {
  try {
    const salon = await Salon.findById(req.params.id);
    if (!salon) return res.status(404).json({ message: 'Salon not found' });

    const isAlreadyApproved = salon.status === 'ACTIVE';
    const decisionTime = isAlreadyApproved && salon.reviewedAt ? salon.reviewedAt : new Date();

    if (!isAlreadyApproved) {
      salon.status = 'ACTIVE';
      if (salon.subscriptionStatus === 'PENDING' || !salon.subscriptionStatus) {
        salon.subscriptionStatus = 'ACTIVE';
      }
      salon.rejectionReason = '';
      if (req.auth?.id) {
        salon.reviewedBy = new Types.ObjectId(req.auth.id);
      }
      salon.reviewedAt = decisionTime;
      await salon.save();

      // Send push notification to Salon Owner: Salon approved
      await fcmService.sendNotification({
        recipientId: salon.ownerId,
        salonId: salon._id,
        type: 'SALON_APPROVED',
        title: 'Salon Approved! 🎉',
        body: `Congratulations! "${salon.salonName}" has been approved and is now active on Book My Salon customer discovery.`,
        data: { screen: 'Dashboard', salonId: salon._id.toString() }
      });
    }

    // Send approval email safely (non-blocking)
    try {
      const owner = await User.findById(salon.ownerId);
      const recipientEmail = owner?.email || salon.email;
      const ownerName = owner?.name || 'Salon Partner';

      await emailService.sendSalonApprovedEmail(
        recipientEmail,
        ownerName,
        salon._id,
        decisionTime
      );
    } catch (emailErr) {
      console.error('[Admin] Failed to send salon approval email:', emailErr);
    }

    res.json({
      message: `Salon '${salon.salonName}' has been approved and is now discoverable.`,
      salon
    });
  } catch (error) {
    next(error);
  }
});

// 7. Reject Salon
const rejectSchema = z.object({
  reason: z
    .string({ required_error: 'Rejection reason is required' })
    .trim()
    .min(1, 'Rejection reason is required')
    .max(1000, 'Rejection reason cannot exceed 1000 characters')
});

router.patch('/salons/:id/reject', async (req: AuthRequest, res, next) => {
  try {
    const data = rejectSchema.parse(req.body);
    const salon = await Salon.findById(req.params.id);
    if (!salon) return res.status(404).json({ message: 'Salon not found' });

    const isAlreadyRejectedWithSameReason =
      salon.status === 'REJECTED' && salon.rejectionReason === data.reason;
    const decisionTime =
      isAlreadyRejectedWithSameReason && salon.reviewedAt
        ? salon.reviewedAt
        : new Date();

    if (!isAlreadyRejectedWithSameReason) {
      salon.status = 'REJECTED';
      salon.rejectionReason = data.reason;
      if (req.auth?.id) {
        salon.reviewedBy = new Types.ObjectId(req.auth.id);
      }
      salon.reviewedAt = decisionTime;
      await salon.save();

      // Send push notification to Salon Owner: Salon rejected
      await fcmService.sendNotification({
        recipientId: salon.ownerId,
        salonId: salon._id,
        type: 'SALON_REJECTED',
        title: 'Salon Registration Notice ⚠️',
        body: `Your salon registration for "${salon.salonName}" was reviewed and requires correction. Reason: ${salon.rejectionReason}`,
        data: { screen: 'Onboarding', salonId: salon._id.toString() }
      });
    }

    // Send rejection email safely (non-blocking)
    try {
      const owner = await User.findById(salon.ownerId);
      const recipientEmail = owner?.email || salon.email;
      const ownerName = owner?.name || 'Salon Partner';

      await emailService.sendSalonRejectedEmail(
        recipientEmail,
        ownerName,
        salon._id,
        data.reason,
        decisionTime
      );
    } catch (emailErr) {
      console.error('[Admin] Failed to send salon rejection email:', emailErr);
    }

    res.json({
      message: `Salon '${salon.salonName}' has been rejected.`,
      salon
    });
  } catch (error) {
    next(error);
  }
});

// 8. Suspend Salon
router.patch('/salons/:id/suspend', async (req, res, next) => {
  try {
    const salon = await Salon.findById(req.params.id);
    if (!salon) return res.status(404).json({ message: 'Salon not found' });

    salon.status = 'SUSPENDED';
    await salon.save();

    res.json({
      message: `Salon '${salon.salonName}' has been suspended from discovery.`,
      salon
    });
  } catch (error) {
    next(error);
  }
});

// 9. Reactivate Salon
router.patch('/salons/:id/reactivate', async (req, res, next) => {
  try {
    const salon = await Salon.findById(req.params.id);
    if (!salon) return res.status(404).json({ message: 'Salon not found' });

    salon.status = 'ACTIVE';
    if (salon.subscriptionStatus === 'PENDING' || !salon.subscriptionStatus) {
      salon.subscriptionStatus = 'ACTIVE';
    }
    await salon.save();

    res.json({
      message: `Salon '${salon.salonName}' has been reactivated.`,
      salon
    });
  } catch (error) {
    next(error);
  }
});

// 10. Subscription Plans with Subscriber & Revenue Stats
router.get('/subscriptions/plans', async (_req, res, next) => {
  try {
    const planKeys = Object.keys(SUBSCRIPTION_PLANS) as (keyof typeof SUBSCRIPTION_PLANS)[];
    const plansWithStats = await Promise.all(
      planKeys.map(async (key) => {
        const details = SUBSCRIPTION_PLANS[key];
        const activeCount = await Subscription.countDocuments({ plan: key, status: 'ACTIVE' });
        const totalCount = await Subscription.countDocuments({ plan: key });
        const revenueDocs = await Subscription.find({ plan: key }).select('amount').lean();
        const totalRevenue = revenueDocs.reduce((acc, curr) => acc + (curr.amount || 0), 0);

        return {
          ...details,
          activeSubscribers: activeCount,
          totalSubscribers: totalCount,
          totalRevenue
        };
      })
    );

    res.json({ data: plansWithStats });
  } catch (error) {
    next(error);
  }
});

// 11. Payments & Transactions Log
router.get('/payments', async (_req, res, next) => {
  try {
    const paymentRecords = await Payment.find()
      .populate('salonId', 'salonName city')
      .populate('ownerId', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    const subRecords = await Subscription.find()
      .populate('salonId', 'salonName city')
      .populate('ownerId', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    const payments = paymentRecords.length > 0 ? paymentRecords : subRecords;
    const totalVolume = payments.reduce((acc, curr) => acc + (curr.amount || 0), 0);

    res.json({
      totalVolume,
      count: payments.length,
      data: payments
    });
  } catch (error) {
    next(error);
  }
});

// 12. Customers List
router.get('/customers', async (_req, res, next) => {
  try {
    const customers = await User.find({ role: 'CUSTOMER' })
      .select('name email isActive createdAt updatedAt')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      count: customers.length,
      data: customers
    });
  } catch (error) {
    next(error);
  }
});

// 13. Offers Management
const offerSchema = z.object({
  title: z.string().trim().min(2),
  code: z.string().trim().min(3).max(20).toUpperCase(),
  discountPercent: z.number().min(1).max(100),
  description: z.string().trim().min(5),
  validUntil: z.string().or(z.date()).transform((val) => new Date(val))
});

router.get('/offers', async (_req, res, next) => {
  try {
    let offers = await Offer.find().sort({ createdAt: -1 }).lean();
    if (!offers.length) {
      // Seed default promotional offers
      const seeded = await Offer.insertMany([
        {
          title: 'Book My Salon Welcome Ritual',
          code: 'BMS20',
          discountPercent: 20,
          description: '20% off on first salon appointment for new customers',
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          isActive: true
        },
        {
          title: 'Bridal & Glow Festive Treat',
          code: 'GLOW500',
          discountPercent: 25,
          description: 'Special 25% off on hair spa and styling packages',
          validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
          isActive: true
        }
      ]);
      offers = seeded.map((s) => s.toObject());
    }
    res.json({ data: offers });
  } catch (error) {
    next(error);
  }
});

router.post('/offers', async (req: AuthRequest, res, next) => {
  try {
    const data = offerSchema.parse(req.body);
    const existing = await Offer.findOne({ code: data.code });
    if (existing) {
      return res.status(409).json({ message: `Offer code '${data.code}' already exists.` });
    }

    const offer = await Offer.create({
      ...data,
      createdBy: req.auth!.id
    });

    res.status(201).json({
      message: 'Offer created successfully',
      data: offer
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/offers/:id/toggle', async (req, res, next) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) return res.status(404).json({ message: 'Offer not found' });

    offer.isActive = !offer.isActive;
    await offer.save();

    res.json({
      message: `Offer '${offer.code}' is now ${offer.isActive ? 'active' : 'inactive'}.`,
      data: offer
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/offers/:id', async (req, res, next) => {
  try {
    const deleted = await Offer.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Offer not found' });

    res.json({ message: 'Offer deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// 12. Support Tickets Management
const ticketStatusEnum = z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']);

// GET /api/v1/admin/tickets - List support tickets with pagination and search
router.get('/tickets', async (req: AuthRequest, res, next) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '10'), 10) || 10));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};

    const statusParam = req.query.status as string;
    if (statusParam && statusParam !== 'ALL') {
      const parsedStatus = ticketStatusEnum.safeParse(statusParam);
      if (parsedStatus.success) {
        filter.status = parsedStatus.data;
      }
    }

    const categoryParam = req.query.category as string;
    if (categoryParam && categoryParam !== 'ALL') {
      filter.category = categoryParam;
    }

    const searchParam = (req.query.search as string)?.trim();
    if (searchParam) {
      const regex = new RegExp(searchParam.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { ticketId: regex },
        { subject: regex },
        { description: regex },
        { userName: regex },
        { userEmail: regex },
        { contactEmail: regex },
        { category: regex }
      ];
    }

    const [tickets, total, openCount, inProgressCount, resolvedCount, closedCount, totalAll] = await Promise.all([
      SupportTicket.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('resolvedBy', 'name email')
        .lean(),
      SupportTicket.countDocuments(filter),
      SupportTicket.countDocuments({ status: 'OPEN' }),
      SupportTicket.countDocuments({ status: 'IN_PROGRESS' }),
      SupportTicket.countDocuments({ status: 'RESOLVED' }),
      SupportTicket.countDocuments({ status: 'CLOSED' }),
      SupportTicket.countDocuments()
    ]);

    res.json({
      tickets,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
      stats: {
        total: totalAll,
        open: openCount,
        inProgress: inProgressCount,
        resolved: resolvedCount,
        closed: closedCount
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/admin/tickets/:id - Get ticket details
router.get('/tickets/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = String(req.params.id);
    let ticket;
    if (id.startsWith('BMS-')) {
      ticket = await SupportTicket.findOne({ ticketId: id })
        .populate('userId', 'name email phone role')
        .populate('resolvedBy', 'name email')
        .lean();
    } else {
      ticket = await SupportTicket.findById(id)
        .populate('userId', 'name email phone role')
        .populate('resolvedBy', 'name email')
        .lean();
    }

    if (!ticket) {
      return res.status(404).json({ message: 'Support ticket not found' });
    }

    res.json({ ticket });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/admin/tickets/:id/status - Update ticket status and notes
const updateTicketStatusSchema = z.object({
  status: ticketStatusEnum,
  adminNotes: z.string().trim().optional()
});

router.patch('/tickets/:id/status', async (req: AuthRequest, res, next) => {
  try {
    const id = String(req.params.id);
    const body = updateTicketStatusSchema.parse(req.body);

    const ticket = id.startsWith('BMS-')
      ? await SupportTicket.findOne({ ticketId: id })
      : await SupportTicket.findById(id);

    if (!ticket) {
      return res.status(404).json({ message: 'Support ticket not found' });
    }

    ticket.status = body.status;
    if (body.adminNotes !== undefined) {
      ticket.adminNotes = body.adminNotes;
    }

    if (body.status === 'RESOLVED' || body.status === 'CLOSED') {
      ticket.resolvedAt = new Date();
      ticket.resolvedBy = req.auth!.id as any;
    } else {
      ticket.resolvedAt = undefined;
      ticket.resolvedBy = undefined;
    }

    await ticket.save();

    const populatedTicket = await SupportTicket.findById(ticket._id)
      .populate('userId', 'name email phone role')
      .populate('resolvedBy', 'name email')
      .lean();

    res.json({
      message: `Support ticket status updated to ${body.status}`,
      ticket: populatedTicket
    });
  } catch (error) {
    next(error);
  }
});

export default router;
