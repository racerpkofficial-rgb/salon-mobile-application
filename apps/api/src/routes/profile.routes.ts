import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest, requireAuth } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { Salon } from '../models/Salon.js';
import { Subscription } from '../models/Subscription.js';
import { Appointment } from '../models/Appointment.js';
import { SupportTicket } from '../models/SupportTicket.js';
import { cloudinaryService } from '../services/cloudinary.service.js';
import { emailService } from '../services/email.service.js';
import { adminNotificationService } from '../services/admin-notification.service.js';
import { AccountDeletionRequest } from '../models/AccountDeletionRequest.js';
import { normalizePhoneNumber } from '../utils/phone.js';
import { isValidCoordinate, normalizeCityName } from '../utils/location.js';
import { publicUser } from './auth.routes.js';

const router = Router();

const notificationPreferencesSchema = z.object({
  bookingUpdates: z.boolean().optional(),
  reminders: z.boolean().optional(),
  promotions: z.boolean().optional()
});

const updateCustomerProfileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80).optional(),
  phone: z.string().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  city: z.string().trim().optional().nullable(),
  searchRadius: z
    .number()
    .int()
    .refine((val) => [5, 10, 25].includes(val), {
      message: 'Search radius must be 5, 10, or 25 km'
    })
    .optional()
    .nullable(),
  avatar: z.string().trim().optional().nullable(),
  notificationPreferences: notificationPreferencesSchema.optional(),
  role: z.any().optional() // explicitly handled to prevent role alteration
});

const updateOwnerProfileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80).optional(),
  phone: z.string().trim().min(1, 'Mobile number is required').optional(),
  salonName: z.string().trim().min(2, 'Salon name must be at least 2 characters').max(100).optional(),
  address: z.string().trim().min(3, 'Address is required').optional(),
  city: z.string().trim().min(2, 'City is required').optional(),
  location: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180)
    })
    .optional(),
  description: z.string().trim().optional().nullable(),
  images: z.array(z.string()).max(8, 'Maximum 8 images allowed').optional(),
  avatar: z.string().trim().optional().nullable(),
  notificationPreferences: notificationPreferencesSchema.optional(),
  role: z.any().optional() // explicitly handled to prevent role alteration
});

// GET /api/v1/profile/me - Authenticated user profile and salon data
router.get('/profile/me', requireAuth(), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.auth!.id).lean();
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let salon = null;
    let subscription = null;

    if (user.role === 'SALON_OWNER') {
      salon = await Salon.findOne({ ownerId: user._id })
        .select('-identityProof')
        .lean();

      if (salon?.subscriptionId) {
        subscription = await Subscription.findById(salon.subscriptionId).lean();
      }
    }

    return res.json({
      message: 'Profile retrieved successfully',
      user: publicUser(user),
      salon,
      subscription
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/v1/profile/me - Update authenticated user profile
router.put('/profile/me', requireAuth(), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.auth!.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Role cannot be changed via profile update
    if (req.body.role && req.body.role !== user.role) {
      return res.status(403).json({ message: 'Role modification is not permitted' });
    }

    if (user.role === 'CUSTOMER') {
      const data = updateCustomerProfileSchema.parse(req.body);
      if (data.name) user.name = data.name;

      if (data.phone !== undefined) {
        if (data.phone) {
          user.phone = normalizePhoneNumber(data.phone);
        } else {
          user.phone = undefined;
        }
      }

      if (data.address !== undefined) {
        user.address = data.address || undefined;
      }

      if (data.city !== undefined) {
        user.city = data.city || undefined;
      }

      if (data.searchRadius !== undefined) {
        user.searchRadius = data.searchRadius || 10;
      }

      if (data.avatar !== undefined) {
        user.avatar = data.avatar || undefined;
      }

      if (data.notificationPreferences) {
        user.notificationPreferences = {
          bookingUpdates: data.notificationPreferences.bookingUpdates ?? user.notificationPreferences?.bookingUpdates ?? true,
          reminders: data.notificationPreferences.reminders ?? user.notificationPreferences?.reminders ?? true,
          promotions: data.notificationPreferences.promotions ?? user.notificationPreferences?.promotions ?? true
        };
      }

      await user.save();
      return res.json({
        message: 'Profile updated successfully',
        user: publicUser(user)
      });
    }

    if (user.role === 'SALON_OWNER') {
      const data = updateOwnerProfileSchema.parse(req.body);

      let normalizedPhone = user.phone;
      if (data.phone) {
        normalizedPhone = normalizePhoneNumber(data.phone);
        user.phone = normalizedPhone;
      }

      if (data.name) {
        user.name = data.name;
      }

      if (data.avatar !== undefined) {
        user.avatar = data.avatar || undefined;
      }

      if (data.notificationPreferences) {
        user.notificationPreferences = {
          bookingUpdates: data.notificationPreferences.bookingUpdates ?? user.notificationPreferences?.bookingUpdates ?? true,
          reminders: data.notificationPreferences.reminders ?? user.notificationPreferences?.reminders ?? true,
          promotions: data.notificationPreferences.promotions ?? user.notificationPreferences?.promotions ?? true
        };
      }

      await user.save();

      // Find and update owner's salon (strict authorization: only salon owned by this user)
      let salon = await Salon.findOne({ ownerId: user._id });
      if (salon) {
        if (data.salonName) salon.salonName = data.salonName;
        if (normalizedPhone) salon.phone = normalizedPhone;
        if (data.address) salon.address = data.address;
        if (data.city) salon.city = normalizeCityName(data.city);
        if (data.location && isValidCoordinate(data.location.latitude, data.location.longitude)) {
          salon.location = {
            latitude: data.location.latitude,
            longitude: data.location.longitude
          };
          salon.locationPoint = {
            type: 'Point',
            coordinates: [data.location.longitude, data.location.latitude]
          };
        }
        if (data.description !== undefined) salon.description = data.description || '';
        if (Array.isArray(data.images)) salon.images = data.images.slice(0, 8);
        await salon.save();
      }

      const freshSalon = salon
        ? await Salon.findById(salon._id).select('-identityProof').lean()
        : null;

      return res.json({
        message: 'Profile and salon updated successfully',
        user: publicUser(user),
        salon: freshSalon
      });
    }

    // Super Admin update
    if (req.body.name) {
      user.name = req.body.name.trim();
      await user.save();
    }

    return res.json({
      message: 'Profile updated successfully',
      user: publicUser(user)
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/profile/notifications - Update notification preferences
router.patch('/profile/notifications', requireAuth(), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const prefs = notificationPreferencesSchema.parse(req.body);
    const user = await User.findById(req.auth!.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.notificationPreferences = {
      bookingUpdates: prefs.bookingUpdates ?? user.notificationPreferences?.bookingUpdates ?? true,
      reminders: prefs.reminders ?? user.notificationPreferences?.reminders ?? true,
      promotions: prefs.promotions ?? user.notificationPreferences?.promotions ?? true
    };

    await user.save();

    return res.json({
      message: 'Notification preferences updated successfully',
      notificationPreferences: user.notificationPreferences
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/profile/upload-photo - Upload profile avatar (Customer or Owner)
router.post('/profile/upload-photo', requireAuth(), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const rawImage = req.body.image || req.body.imageData;
    if (!rawImage || typeof rawImage !== 'string' || !rawImage.trim()) {
      return res.status(400).json({ message: 'Image data is required' });
    }

    if (rawImage.length > 7 * 1024 * 1024) {
      return res.status(400).json({ message: 'Image exceeds 5MB size limit' });
    }

    const uploaded = await cloudinaryService.uploadImage(rawImage, {
      folder: `aurelia-profiles/${req.auth!.id}`
    });

    const user = await User.findById(req.auth!.id);
    if (user) {
      user.avatar = uploaded.secureUrl || uploaded.url;
      await user.save();
    }

    return res.json({
      message: 'Profile photo uploaded successfully',
      url: uploaded.secureUrl || uploaded.url,
      user: user ? publicUser(user) : null
    });
  } catch (error) {
    next(error);
  }
});

const accountDeletionSchema = z.object({
  reason: z.string().trim().min(2, 'Please select or provide a reason for account deletion').max(300).default('User requested self-service account deletion'),
  feedback: z.string().trim().max(1000).optional()
});

// Shared deletion request handler (supports both POST /profile/account-deletion and DELETE /profile/account)
async function handleAccountDeletionRequest(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.auth!.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Admins cannot delete own account via self-service
    if (user.role === 'SUPER_ADMIN') {
      return res.status(403).json({
        message: 'Administrator accounts cannot be deleted via mobile self-service.'
      });
    }

    const parseResult = accountDeletionSchema.safeParse(req.body || {});
    const reason = parseResult.success && parseResult.data.reason ? parseResult.data.reason : 'User requested self-service account deletion';
    const feedback = parseResult.success ? parseResult.data.feedback : undefined;

    const todayStr = new Date().toISOString().split('T')[0];

    if (user.role === 'CUSTOMER') {
      // Check for active upcoming appointments
      const activeBookingsCount = await Appointment.countDocuments({
        customerId: user._id,
        status: { $in: ['PENDING', 'CONFIRMED'] },
        appointmentDate: { $gte: todayStr }
      });

      if (activeBookingsCount > 0) {
        return res.status(400).json({
          message: `Cannot delete account: You have ${activeBookingsCount} active upcoming appointment(s). Please cancel or complete them first.`
        });
      }
    } else if (user.role === 'SALON_OWNER') {
      const salon = await Salon.findOne({ ownerId: user._id });
      if (salon) {
        const activeBookingsCount = await Appointment.countDocuments({
          salonId: salon._id,
          status: { $in: ['PENDING', 'CONFIRMED'] },
          appointmentDate: { $gte: todayStr }
        });

        if (activeBookingsCount > 0) {
          return res.status(400).json({
            message: `Cannot delete salon partner account: Your salon has ${activeBookingsCount} active upcoming booking(s). Please resolve or cancel them first.`
          });
        }

        if (salon.subscriptionId) {
          await Subscription.findByIdAndUpdate(salon.subscriptionId, { status: 'CANCELLED' });
        }

        salon.status = 'SUSPENDED';
        salon.subscriptionStatus = 'CANCELLED';
        await salon.save();
      }
    }

    // 30-day grace period
    const scheduledDeletionAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Record deletion request
    await AccountDeletionRequest.create({
      userId: user._id,
      role: user.role,
      email: user.email,
      reason,
      feedback,
      requestedAt: new Date(),
      scheduledDeletionAt,
      status: 'PENDING'
    });

    // Mark user as pending deletion and deactivate active sessions
    user.isPendingDeletion = true;
    user.scheduledDeletionAt = scheduledDeletionAt;
    user.deletionReason = reason;
    user.deletionFeedback = feedback;
    user.isActive = false; // Revoke current active session
    user.fcmTokens = []; // Clear push tokens
    await user.save();

    // Send confirmation email
    try {
      await emailService.sendAccountDeletionScheduledEmail(user.email, user.name, scheduledDeletionAt);
    } catch (emailErr) {
      console.warn('[Account Deletion] Could not dispatch scheduled deletion email:', emailErr);
    }

    // Notify Super Admin
    try {
      await adminNotificationService.notifyAdmins({
        eventType: 'ADMIN_ACCOUNT_DELETION_REQUESTED',
        title: 'Account Deletion Requested',
        message: `${user.name} (${user.email}, ${user.role}) has requested account deletion. Scheduled for ${scheduledDeletionAt.toISOString().split('T')[0]}.`,
        relatedRecordId: user._id,
        data: {
          scheduledDeletionAt: scheduledDeletionAt.toISOString(),
          reason
        }
      });
    } catch (notifErr) {
      console.warn('[Account Deletion] Could not notify admins of deletion request:', notifErr);
    }

    return res.status(200).json({
      message: 'Your account deletion request has been scheduled. You have a 30-day grace period. Logging in within 30 days will cancel the deletion request.',
      scheduledDeletionAt: scheduledDeletionAt.toISOString(),
      gracePeriodDays: 30
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/v1/profile/account-deletion - Schedule account deletion with 30-day grace period
router.post('/profile/account-deletion', requireAuth(), handleAccountDeletionRequest);

// DELETE /api/v1/profile/account - Delete or deactivate user account safely (backward compatible alias)
router.delete('/profile/account', requireAuth(), handleAccountDeletionRequest);

// POST /api/v1/profile/report-problem - Report a problem to platform support
const reportProblemSchema = z.object({
  category: z.string().trim().min(2, 'Please select a problem category'),
  subject: z.string().trim().optional(),
  description: z.string().trim().min(10, 'Please describe the problem with at least 10 characters'),
  contactEmail: z.string().trim().email().optional().nullable()
});

router.post('/profile/report-problem', requireAuth(), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = reportProblemSchema.parse(req.body);
    const ticketId = `BMS-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

    const user = await User.findById(req.auth!.id).select('name email').lean();

    const ticket = await SupportTicket.create({
      ticketId,
      userId: req.auth!.id,
      userRole: req.auth!.role,
      userName: user?.name || req.auth!.name || 'Platform User',
      userEmail: user?.email || req.auth!.email,
      contactEmail: data.contactEmail?.trim() || user?.email || req.auth!.email,
      category: data.category,
      subject: data.subject?.trim() || `${data.category}`,
      description: data.description,
      status: 'OPEN'
    });

    console.log(`[Support Ticket Created] ID: ${ticket.ticketId}, User: ${req.auth!.id}, Role: ${req.auth!.role}, Category: ${data.category}`);

    try {
      await adminNotificationService.notifyAdmins({
        eventType: 'ADMIN_REPORT_SUBMITTED',
        title: 'New Problem Report / Support Ticket',
        message: `Report [${ticket.category}] filed by ${ticket.userName} (${ticket.userEmail}).`,
        relatedRecordId: ticket._id,
        targetScreen: 'AdminTickets',
        data: { ticketId: ticket.ticketId, category: ticket.category }
      });
    } catch (notifErr) {
      console.warn('[Support Ticket] Could not notify admins of report:', notifErr);
    }

    return res.status(201).json({
      message: 'Your report has been received. Our support team will review it within 24 hours.',
      ticketId: ticket.ticketId,
      category: ticket.category
    });
  } catch (error) {
    next(error);
  }
});

// Legacy / Role-based Profile endpoints
router.get('/customer/profile', requireAuth(['CUSTOMER']), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.auth!.id).lean();
    return res.json({
      message: 'Customer profile accessed successfully',
      user: user ? publicUser(user) : req.auth
    });
  } catch (error) {
    next(error);
  }
});

router.get('/owner/profile', requireAuth(['SALON_OWNER']), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.auth!.id).lean();
    const salon = await Salon.findOne({ ownerId: req.auth!.id }).select('-identityProof').lean();
    return res.json({
      message: 'Owner profile accessed successfully',
      user: user ? publicUser(user) : req.auth,
      salon
    });
  } catch (error) {
    next(error);
  }
});

router.get('/admin/profile', requireAuth(['SUPER_ADMIN']), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.auth!.id).lean();
    return res.json({
      message: 'Admin profile accessed successfully',
      user: user ? publicUser(user) : req.auth
    });
  } catch (error) {
    next(error);
  }
});

export default router;