import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { AuthRequest, requireAuth } from '../middleware/auth.js';
import { Appointment } from '../models/Appointment.js';
import { Notification } from '../models/Notification.js';
import { Salon } from '../models/Salon.js';
import { SalonOffer } from '../models/SalonOffer.js';
import { Service } from '../models/Service.js';
import { Subscription } from '../models/Subscription.js';
import {
  bookingService,
  calculateEndTime,
  getTodayDateString,
  timeToMinutes
} from '../services/booking.service.js';
import { fcmService } from '../services/fcm.service.js';
import { couponService } from '../services/coupon.service.js';
import { isSalonBookable } from '../utils/salon.js';

const router = Router();

const createBookingSchema = z.object({
  salonId: z.string().trim().min(1, 'Salon ID is required'),
  serviceId: z.string().trim().min(1, 'Service ID is required'),
  offerId: z.string().trim().optional(),
  couponCode: z.string().trim().optional(),
  appointmentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Start time must be in HH:mm format'),
  customerNote: z.string().trim().optional()
});

// ==========================================
// 1. Customer Endpoints (requireAuth: CUSTOMER)
// ==========================================

// GET /api/v1/customer/appointments - View customer's bookings
router.get(
  '/customer/appointments',
  requireAuth(['CUSTOMER']),
  async (req: AuthRequest, res, next) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
      const skip = (page - 1) * limit;

      const [total, appointments] = await Promise.all([
        Appointment.countDocuments({ customerId: req.auth!.id }),
        Appointment.find({ customerId: req.auth!.id })
          .populate('salonId', 'salonName city address phone images location')
          .populate('serviceId', 'name price duration description category')
          .populate('offerId', 'title discountType discountValue')
          .sort({ appointmentDate: -1, startTime: -1 })
          .skip(skip)
          .limit(limit)
          .lean()
      ]);

      res.json({
        count: total,
        data: appointments,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/customer/appointments - Book an appointment
router.post(
  ['/customer/appointments', '/appointments'],
  requireAuth(['CUSTOMER']),
  async (req: AuthRequest, res, next) => {
    try {
      const data = createBookingSchema.parse(req.body);

      // 1. Validate salon status and active subscription
      const salon = await Salon.findById(data.salonId);
      if (!salon) {
        return res.status(404).json({ message: 'Salon not found.' });
      }

      if (!isSalonBookable(salon)) {
        return res.status(400).json({
          message:
            'This salon is currently not available for bookings. Salons must be active with valid partner subscription.'
        });
      }

      // Check if subscription has expired
      if (salon.subscriptionId) {
        const subscription = await Subscription.findById(salon.subscriptionId);
        const now = new Date();
        if (subscription && (subscription.status === 'EXPIRED' || (subscription.endDate && new Date(subscription.endDate) < now))) {
          if (subscription.status !== 'EXPIRED') {
            subscription.status = 'EXPIRED';
            await subscription.save();
          }
          salon.subscriptionStatus = 'EXPIRED';
          await salon.save();
          return res.status(400).json({
            message: 'This salon is currently not available for bookings. Salon partner subscription has expired.'
          });
        }
      }

      // 2. Validate service
      const isObjectId = Types.ObjectId.isValid(data.serviceId);
      let service = isObjectId
        ? await Service.findOne({ _id: data.serviceId, salonId: salon._id, isActive: true })
        : await Service.findOne({ salonId: salon._id, name: data.serviceId, isActive: true });

      // Fallback check in salon's embedded services if standalone service not yet synced
      if (!service) {
        await bookingService.syncSalonServices(salon);
        service = isObjectId
          ? await Service.findOne({ _id: data.serviceId, salonId: salon._id, isActive: true })
          : await Service.findOne({ salonId: salon._id, name: data.serviceId, isActive: true });

        if (!service) {
          const embeddedMatch = salon.services?.find(
            (s: any) => s._id?.toString() === data.serviceId || s.id?.toString() === data.serviceId
          );
          if (embeddedMatch) {
            service = await Service.findOne({ salonId: salon._id, name: embeddedMatch.name, isActive: true });
          }
        }
      }

      if (!service) {
        return res.status(404).json({
          message: 'Selected service is no longer offered or active at this salon.'
        });
      }

      // 3. Date validity check (no past dates)
      const now = new Date();
      const todayStr = getTodayDateString();
      if (data.appointmentDate < todayStr) {
        return res.status(400).json({
          message: 'Appointments cannot be booked for past dates.'
        });
      }

      // Check owner blackout / unavailable dates
      if (salon.unavailableDates && salon.unavailableDates.includes(data.appointmentDate)) {
        return res.status(400).json({
          message: 'This salon is marked as closed or unavailable on the selected date.'
        });
      }

      // 4. Calculate end time based on service duration
      const duration = service.duration || 30;
      const endTime = calculateEndTime(data.startTime, duration);

      // 5. Working hours check
      const workingHours = salon.workingHours || {
        openTime: '09:00',
        closeTime: '20:00',
        daysOpen: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      };

      if (workingHours.daysOpen && workingHours.daysOpen.length > 0) {
        const dayOfWeekNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const appointmentDayName = dayOfWeekNames[new Date(`${data.appointmentDate}T12:00:00Z`).getUTCDay()];
        if (!workingHours.daysOpen.includes(appointmentDayName)) {
          return res.status(400).json({
            message: `This salon is closed on ${appointmentDayName}s.`
          });
        }
      }
      const slotStartMins = timeToMinutes(data.startTime);
      const slotEndMins = timeToMinutes(endTime);
      const openMins = timeToMinutes(workingHours.openTime || '09:00');
      const closeMins = timeToMinutes(workingHours.closeTime || '20:00');

      if (slotStartMins < openMins || slotEndMins > closeMins) {
        return res.status(400).json({
          message: `Booking time must be within salon working hours (${workingHours.openTime} - ${workingHours.closeTime}).`
        });
      }

      // 6. Check if slot is in the past today
      if (data.appointmentDate === todayStr) {
        const currentMinsToday = now.getHours() * 60 + now.getMinutes();
        if (slotStartMins < currentMinsToday) {
          return res.status(400).json({
            message: 'Cannot book a time slot in the past.'
          });
        }
      }

      // 7. Atomic double-booking conflict prevention
      const hasConflict = await bookingService.checkForConflict(
        salon._id,
        data.appointmentDate,
        data.startTime,
        endTime
      );

      if (hasConflict) {
        return res.status(409).json({
          message:
            'This time slot is already occupied. Please select an alternate available time.'
        });
      }

      // Validate optional offer if booked via offer
      let validatedOfferId: string | undefined = undefined;
      const originalPrice = Number(service.price) || 0;
      let discountAmount = 0;
      let totalPrice = originalPrice;

      if (data.offerId) {
        if (!Types.ObjectId.isValid(data.offerId)) {
          return res.status(400).json({ message: 'Invalid offer identifier.' });
        }
        const now = new Date();
        const offer = await SalonOffer.findOne({
          _id: data.offerId,
          salonId: salon._id,
          isActive: true,
          status: { $nin: ['EXPIRED', 'INACTIVE', 'DELETED'] },
          startDate: { $lte: now },
          endDate: { $gte: now }
        });
        if (!offer) {
          return res.status(400).json({
            message: 'Applied offer is expired, deactivated, or not valid for this salon.'
          });
        }

        // Verify service applicability if offer is tied to a specific service
        if (offer.applicableService && offer.applicableService !== 'ALL') {
          const embeddedMatch = salon.services?.find(
            (s: any) =>
              s._id?.toString() === offer.applicableService ||
              s.id?.toString() === offer.applicableService ||
              s.name.toLowerCase() === offer.applicableService.toLowerCase()
          );
          const serviceMatch =
            offer.applicableService === service._id.toString() ||
            offer.applicableService.toLowerCase() === service.name.toLowerCase() ||
            (embeddedMatch && embeddedMatch.name.toLowerCase() === service.name.toLowerCase());
          if (!serviceMatch) {
            return res.status(400).json({
              message: 'This promotional offer is not valid for the selected service.'
            });
          }
        }

        if (!offer.discountValue || offer.discountValue <= 0) {
          return res.status(400).json({
            message: 'This offer does not have a valid discount value.'
          });
        }

        validatedOfferId = offer._id.toString();
        if (offer.discountType === 'FIXED') {
          discountAmount = Math.min(originalPrice, Math.max(0, offer.discountValue));
        } else if (offer.discountType === 'PERCENTAGE') {
          const pct = Math.min(100, Math.max(0, offer.discountValue));
          discountAmount = Math.round((originalPrice * pct) / 100);
        } else {
          return res.status(400).json({
            message: 'Unsupported offer discount type.'
          });
        }

        discountAmount = Math.min(originalPrice, Math.max(0, discountAmount));
        totalPrice = Math.max(0, originalPrice - discountAmount);
      }

      // Validate optional coupon code (salon-specific with strict server checks)
      let validatedCoupon: any = null;
      if (data.couponCode) {
        try {
          validatedCoupon = await couponService.validateCouponForBooking({
            salonId: salon._id,
            code: data.couponCode,
            customerId: req.auth!.id,
            servicePrice: originalPrice,
            serviceId: service._id.toString(),
            serviceName: service.name
          });
          discountAmount = validatedCoupon.discountAmount;
          totalPrice = validatedCoupon.finalPrice;
        } catch (couponErr: any) {
          return res.status(400).json({
            message: couponErr.message || 'Invalid or ineligible coupon code.'
          });
        }
      }

      // 8. Create appointment with status PENDING and historical snapshot
      const appointment = await Appointment.create({
        customerId: req.auth!.id,
        salonId: salon._id,
        serviceId: service._id,
        serviceName: service.name,
        serviceDuration: duration,
        offerId: validatedOfferId,
        couponId: validatedCoupon?.coupon?._id,
        couponCode: validatedCoupon?.coupon?.code,
        couponDiscount: validatedCoupon?.discountAmount || 0,
        couponRedeemed: !!validatedCoupon,
        originalPrice,
        discountAmount,
        totalPrice,
        appointmentDate: data.appointmentDate,
        startTime: data.startTime,
        endTime,
        status: 'PENDING',
        customerNote: data.customerNote || ''
      });

      // Atomically record redemption in ledger if coupon applied
      if (validatedCoupon) {
        try {
          await couponService.recordRedemption({
            couponId: validatedCoupon.coupon._id,
            salonId: salon._id,
            customerId: req.auth!.id,
            appointmentId: appointment._id,
            code: validatedCoupon.coupon.code,
            discountAmount: validatedCoupon.discountAmount,
            originalPrice,
            finalPrice: totalPrice
          });
        } catch (redemptionErr: any) {
          // If concurrent redemption exceeded limit, rollback booking
          await Appointment.findByIdAndDelete(appointment._id);
          return res.status(400).json({
            message: redemptionErr.message || 'Coupon usage limit reached during redemption.'
          });
        }
      }

      // Send push notification to Salon Owner: Booking request sent
      const customerName = req.auth!.name || 'A client';
      await fcmService.sendNotification({
        recipientId: salon.ownerId,
        senderId: req.auth!.id,
        salonId: salon._id,
        appointmentId: appointment._id,
        offerId: validatedOfferId,
        type: 'BOOKING_REQUEST_SENT',
        title: 'New Booking Request 📅',
        body: `New appointment request from ${customerName} for ${service.name} on ${data.appointmentDate} at ${data.startTime}.`,
        data: {
          screen: 'BookingDetails',
          appointmentId: appointment._id.toString(),
          salonId: salon._id.toString(),
          offerId: validatedOfferId || ''
        }
      });

      const populated = await Appointment.findById(appointment._id)
        .populate('salonId', 'salonName city address phone images')
        .populate('serviceId', 'name price duration category')
        .lean();

      res.status(201).json({
        message: 'Waiting for salon confirmation.',
        appointment: populated
      });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/v1/customer/appointments/:id/cancel - Customer cancels appointment
router.patch(
  '/customer/appointments/:id/cancel',
  requireAuth(['CUSTOMER']),
  async (req: AuthRequest, res, next) => {
    try {
      const appointment = await Appointment.findOne({
        _id: req.params.id,
        customerId: req.auth!.id
      });

      if (!appointment) {
        return res.status(404).json({ message: 'Appointment not found.' });
      }

      if (appointment.status === 'COMPLETED' || appointment.status === 'CANCELLED') {
        return res.status(400).json({
          message: `Cannot cancel an appointment that is already ${appointment.status.toLowerCase()}.`
        });
      }

      appointment.status = 'CANCELLED';
      await appointment.save();

      // Safely revert coupon redemption if one was applied
      if (appointment.couponId || appointment.couponRedeemed) {
        await couponService.revertRedemption(appointment._id);
      }

      res.json({
        message: 'Appointment cancelled successfully.',
        appointment
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==========================================
// 2. Salon Owner Endpoints (requireAuth: SALON_OWNER)
// ==========================================

// GET /api/v1/owner/appointments/stats - Dashboard summary metrics
router.get(
  '/owner/appointments/stats',
  requireAuth(['SALON_OWNER']),
  async (req: AuthRequest, res, next) => {
    try {
      const salon = await Salon.findOne({ ownerId: req.auth!.id });
      if (!salon) {
        return res.json({
          pendingCount: 0,
          confirmedTodayCount: 0,
          upcomingConfirmedCount: 0,
          completedCount: 0,
          totalRevenue: 0,
          todayAppointmentsCount: 0,
          todayAppointments: []
        });
      }

      const todayStr = getTodayDateString();
      const allAppointments = await Appointment.find({ salonId: salon._id })
        .populate('customerId', 'name phone avatar')
        .populate('serviceId', 'name price duration category')
        .sort({ appointmentDate: 1, startTime: 1 })
        .lean();

      let pendingCount = 0;
      let confirmedTodayCount = 0;
      let upcomingConfirmedCount = 0;
      let completedCount = 0;
      let totalRevenue = 0;
      const todayAppointments: any[] = [];

      for (const app of allAppointments) {
        if (app.status === 'PENDING') {
          pendingCount++;
        } else if (app.status === 'CONFIRMED') {
          if (app.appointmentDate === todayStr) {
            confirmedTodayCount++;
          }
          if (app.appointmentDate >= todayStr) {
            upcomingConfirmedCount++;
          }
        } else if (app.status === 'COMPLETED') {
          completedCount++;
          const price = (app.serviceId as any)?.price || 0;
          totalRevenue += price;
        }

        if (app.appointmentDate === todayStr) {
          todayAppointments.push(app);
        }
      }

      res.json({
        pendingCount,
        confirmedTodayCount,
        upcomingConfirmedCount,
        completedCount,
        totalRevenue,
        todayAppointmentsCount: todayAppointments.length,
        todayAppointments
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/owner/appointments - View incoming appointments with filtering
router.get(
  '/owner/appointments',
  requireAuth(['SALON_OWNER']),
  async (req: AuthRequest, res, next) => {
    try {
      const salon = await Salon.findOne({ ownerId: req.auth!.id });
      if (!salon) {
        return res.json({ count: 0, data: [] });
      }

      const filter: any = { salonId: salon._id };

      // Status filter
      if (req.query.status && typeof req.query.status === 'string') {
        const statuses = req.query.status.split(',').map((s) => s.trim().toUpperCase());
        if (statuses.length === 1) {
          filter.status = statuses[0];
        } else {
          filter.status = { $in: statuses };
        }
      }

      // Date or Month filter
      if (req.query.date && typeof req.query.date === 'string') {
        filter.appointmentDate = req.query.date.trim();
      } else if (req.query.month && typeof req.query.month === 'string') {
        filter.appointmentDate = { $regex: new RegExp(`^${req.query.month.trim()}`) };
      }

      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
      const skip = (page - 1) * limit;

      const appointments = await Appointment.find(filter)
        .populate('customerId', 'name phone avatar')
        .populate('serviceId', 'name price duration category')
        .populate('offerId', 'title discountType discountValue')
        .sort({ appointmentDate: 1, startTime: 1 })
        .lean();

      let result = appointments;
      if (req.query.search && typeof req.query.search === 'string') {
        const term = req.query.search.trim().toLowerCase();
        result = appointments.filter((app: any) => {
          const custName = app.customerId?.name?.toLowerCase() || '';
          const serviceName = app.serviceId?.name?.toLowerCase() || '';
          return (
            custName.includes(term) ||
            serviceName.includes(term)
          );
        });
      }

      const paginatedResult = result.slice(skip, skip + limit);

      res.json({
        count: result.length,
        data: paginatedResult,
        pagination: {
          page,
          limit,
          total: result.length,
          totalPages: Math.ceil(result.length / limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/owner/appointments/:id - Single booking details
router.get(
  '/owner/appointments/:id',
  requireAuth(['SALON_OWNER']),
  async (req: AuthRequest, res, next) => {
    try {
      const salon = await Salon.findOne({ ownerId: req.auth!.id });
      if (!salon) {
        return res.status(404).json({ message: 'Salon not found.' });
      }

      const appointment = await Appointment.findOne({
        _id: req.params.id,
        salonId: salon._id
      })
        .populate('customerId', 'name phone avatar')
        .populate('serviceId', 'name price duration category description')
        .populate('salonId', 'salonName address city phone')
        .populate('offerId', 'title discountType discountValue')
        .lean();

      if (!appointment) {
        return res.status(404).json({ message: 'Appointment not found.' });
      }

      res.json({ appointment });
    } catch (error) {
      next(error);
    }
  }
);

// Shared handler for Accept & Confirm:
// Backend must verify that the booking still has availability before accepting.
const handleAcceptOrConfirm = async (req: AuthRequest, res: any, next: any) => {
  try {
    const salon = await Salon.findOne({ ownerId: req.auth!.id });
    if (!salon) {
      return res.status(404).json({ message: 'Salon not found.' });
    }

    const appointment = await Appointment.findOne({
      _id: req.params.id,
      salonId: salon._id
    })
      .populate('serviceId', 'name price duration')
      .populate('customerId', 'name phone avatar');

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    // Backend must verify that the booking still has availability before accepting
    if (appointment.status !== 'CONFIRMED') {
      const hasConflict = await bookingService.checkForConflict(
        salon._id,
        appointment.appointmentDate,
        appointment.startTime,
        appointment.endTime,
        appointment._id
      );

      if (hasConflict) {
        return res.status(409).json({
          message:
            'Cannot accept booking: This time slot conflicts with another already confirmed booking.'
        });
      }
    }

    appointment.status = 'CONFIRMED';
    await appointment.save();

    const serviceName = (appointment.serviceId as any)?.name || 'Service';

    // Lock the slot & Send customer notification via FCM
    await fcmService.sendNotification({
      recipientId: (appointment.customerId as any)?._id || appointment.customerId,
      senderId: req.auth!.id,
      salonId: salon._id,
      appointmentId: appointment._id,
      type: 'BOOKING_ACCEPTED',
      title: 'Appointment Confirmed! ✨',
      body: `Your appointment for ${serviceName} on ${appointment.appointmentDate} at ${appointment.startTime} at ${salon.salonName} has been confirmed.`,
      data: {
        screen: 'Bookings',
        appointmentId: appointment._id.toString(),
        salonId: salon._id.toString()
      }
    });

    res.json({
      message: 'Appointment confirmed successfully.',
      appointment
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/owner/appointments/:id/accept - Accept booking
router.patch('/owner/appointments/:id/accept', requireAuth(['SALON_OWNER']), handleAcceptOrConfirm);

// PATCH /api/v1/owner/appointments/:id/confirm - Confirm booking
router.patch('/owner/appointments/:id/confirm', requireAuth(['SALON_OWNER']), handleAcceptOrConfirm);

// PATCH /api/v1/owner/appointments/:id/reject - Reject booking
router.patch(
  '/owner/appointments/:id/reject',
  requireAuth(['SALON_OWNER']),
  async (req: AuthRequest, res, next) => {
    try {
      const salon = await Salon.findOne({ ownerId: req.auth!.id });
      if (!salon) {
        return res.status(404).json({ message: 'Salon not found.' });
      }

      const appointment = await Appointment.findOne({
        _id: req.params.id,
        salonId: salon._id
      })
        .populate('serviceId', 'name price duration')
        .populate('customerId', 'name phone avatar');

      if (!appointment) {
        return res.status(404).json({ message: 'Appointment not found.' });
      }

      appointment.status = 'REJECTED';
      await appointment.save();

      // Safely revert coupon redemption if one was applied
      if (appointment.couponId || appointment.couponRedeemed) {
        await couponService.revertRedemption(appointment._id);
      }

      const serviceName = (appointment.serviceId as any)?.name || 'Service';
      const reason = req.body?.rejectionReason ? ` Reason: ${req.body.rejectionReason}` : '';

      // Release slot & Send customer notification via FCM
      await fcmService.sendNotification({
        recipientId: (appointment.customerId as any)?._id || appointment.customerId,
        senderId: req.auth!.id,
        salonId: salon._id,
        appointmentId: appointment._id,
        type: 'BOOKING_REJECTED',
        title: 'Appointment Request Declined',
        body: `Your appointment request for ${serviceName} on ${appointment.appointmentDate} at ${appointment.startTime} was not accepted.${reason} The time slot has been released.`,
        data: {
          screen: 'Bookings',
          appointmentId: appointment._id.toString(),
          salonId: salon._id.toString()
        }
      });

      res.json({
        message: 'Appointment rejected. Slot has been released.',
        appointment
      });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/v1/owner/appointments/:id/complete - Complete appointment
router.patch(
  '/owner/appointments/:id/complete',
  requireAuth(['SALON_OWNER']),
  async (req: AuthRequest, res, next) => {
    try {
      const salon = await Salon.findOne({ ownerId: req.auth!.id });
      if (!salon) {
        return res.status(404).json({ message: 'Salon not found.' });
      }

      const appointment = await Appointment.findOne({
        _id: req.params.id,
        salonId: salon._id
      });

      if (!appointment) {
        return res.status(404).json({ message: 'Appointment not found.' });
      }

      appointment.status = 'COMPLETED';
      if (!appointment.completedAt) {
        appointment.completedAt = new Date();
      }

      const shouldNotify = !appointment.completionNotified;
      if (shouldNotify) {
        appointment.completionNotified = true;
      }

      await appointment.save();

      // Send completion notification with 48h deadline notice (safely without blocking response on failure)
      if (shouldNotify && appointment.completedAt) {
        const deadline = new Date(appointment.completedAt.getTime() + 48 * 60 * 60 * 1000);
        try {
          await fcmService.sendNotification({
            recipientId: appointment.customerId,
            senderId: req.auth!.id,
            salonId: salon._id,
            appointmentId: appointment._id,
            type: 'BOOKING_COMPLETED',
            title: `How was your visit to ${salon.salonName}? ⭐`,
            body: `Your appointment is marked as completed! Rate & review your salon experience within 48 hours (deadline: ${deadline.toUTCString()}).`,
            targetScreen: 'Bookings',
            data: {
              screen: 'Bookings',
              appointmentId: appointment._id.toString(),
              action: 'REVIEW',
              completedAt: appointment.completedAt.toISOString(),
              reviewDeadline: deadline.toISOString(),
              deadline: deadline.toISOString()
            }
          });
        } catch (notifErr) {
          console.warn('[Completion Notification] Failed to dispatch notification:', notifErr);
        }
      }

      res.json({
        message: 'Appointment marked as completed.',
        appointment
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/owner/appointments/:id/remind - Send appointment reminder to customer
router.post(
  '/owner/appointments/:id/remind',
  requireAuth(['SALON_OWNER']),
  async (req: AuthRequest, res, next) => {
    try {
      const salon = await Salon.findOne({ ownerId: req.auth!.id });
      if (!salon) return res.status(404).json({ message: 'Salon not found.' });

      const appointment = await Appointment.findOne({
        _id: req.params.id,
        salonId: salon._id
      }).populate('serviceId', 'name');

      if (!appointment) return res.status(404).json({ message: 'Appointment not found.' });

      const serviceName = (appointment.serviceId as any)?.name || 'Service';

      // Send APPOINTMENT_REMINDER notification to customer
      await fcmService.sendNotification({
        recipientId: (appointment.customerId as any)?._id || appointment.customerId,
        senderId: req.auth!.id,
        salonId: salon._id,
        appointmentId: appointment._id,
        type: 'APPOINTMENT_REMINDER',
        title: 'Upcoming Appointment Reminder ⏰',
        body: `Reminder: Your appointment for ${serviceName} at ${salon.salonName} is scheduled on ${appointment.appointmentDate} at ${appointment.startTime}.`,
        data: {
          screen: 'Bookings',
          appointmentId: appointment._id.toString(),
          salonId: salon._id.toString()
        }
      });

      res.json({ message: 'Appointment reminder sent successfully.' });
    } catch (error) {
      next(error);
    }
  }
);

// ==========================================
// 3. Public Availability & Services Endpoints
// ==========================================

// GET /api/v1/salons/:id/availability - Calculate available time slots
router.get('/salons/:id/availability', async (req, res, next) => {
  try {
    const salon = await Salon.findById(req.params.id);
    if (!salon) {
      return res.status(404).json({ message: 'Salon not found.' });
    }

    if (salon.status !== 'ACTIVE' || salon.subscriptionStatus !== 'ACTIVE') {
      return res.status(400).json({
        message: 'Salon is not active for bookings.'
      });
    }

    // Check if subscription has expired
    if (salon.subscriptionId) {
      const subscription = await Subscription.findById(salon.subscriptionId);
      const now = new Date();
      if (subscription && (subscription.status === 'EXPIRED' || (subscription.endDate && new Date(subscription.endDate) < now))) {
        if (subscription.status !== 'EXPIRED') {
          subscription.status = 'EXPIRED';
          await subscription.save();
        }
        salon.subscriptionStatus = 'EXPIRED';
        await salon.save();
        return res.status(400).json({
          message: 'Salon partner subscription has expired. No availability slots.'
        });
      }
    }

    const dateStr = typeof req.query.date === 'string' ? req.query.date.trim() : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({
        message: 'Valid date in YYYY-MM-DD format is required.'
      });
    }

    let serviceDuration = 30;
    const serviceId = typeof req.query.serviceId === 'string' ? req.query.serviceId.trim() : '';

    if (serviceId) {
      const isObjectId = Types.ObjectId.isValid(serviceId);
      let service = isObjectId
        ? await Service.findOne({ _id: serviceId, salonId: salon._id })
        : await Service.findOne({ name: serviceId, salonId: salon._id });

      if (!service && salon.services?.length) {
        const embedded = salon.services.find(
          (s) =>
            s.id === serviceId ||
            (s as any)._id?.toString() === serviceId ||
            s.name.toLowerCase() === serviceId.toLowerCase()
        );
        if (embedded && embedded.durationMinutes) {
          serviceDuration = embedded.durationMinutes;
        }
      }
      if (service && service.duration) {
        serviceDuration = service.duration;
      }
    } else if (req.query.duration) {
      const parsedDuration = Number(req.query.duration);
      if (!isNaN(parsedDuration) && parsedDuration >= 5) {
        serviceDuration = parsedDuration;
      }
    }

    // Calculate slots respecting duration and occupied intervals
    const slots = await bookingService.getAvailableSlots(
      salon,
      serviceDuration,
      dateStr
    );

    res.json({
      date: dateStr,
      serviceDuration,
      workingHours: salon.workingHours,
      slots,
      availableSlotsCount: slots.filter((s) => s.isAvailable).length
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/salons/:id/services - Get standalone services for a salon
router.get('/salons/:id/services', async (req, res, next) => {
  try {
    const salon = await Salon.findById(req.params.id);
    if (!salon) {
      return res.status(404).json({ message: 'Salon not found.' });
    }

    const totalCount = await Service.countDocuments({ salonId: salon._id });
    if (totalCount === 0 && salon.services?.length) {
      await bookingService.syncSalonServices(salon);
    }

    const services: any[] = await Service.find({ salonId: salon._id, isActive: true });

    res.json({
      count: services.length,
      data: services
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// 4. Customer Notifications Endpoints
// ==========================================

// GET /api/v1/customer/notifications or /notifications - Fetch notifications received by user
router.get(
  ['/customer/notifications', '/notifications'],
  requireAuth(),
  async (req: AuthRequest, res, next) => {
    try {
      const notifications = await Notification.find({ recipientId: req.auth!.id })
        .populate('salonId', 'salonName address city images')
        .populate('offerId')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      const now = new Date();
      let enhancedNotifications = notifications.map((n: any) => {
        let isOfferExpired = false;
        if (n.offerId) {
          const off = n.offerId;
          if (
            !off.isActive ||
            off.status === 'EXPIRED' ||
            (off.endDate && new Date(off.endDate) < now) ||
            (off.startDate && new Date(off.startDate) > now)
          ) {
            isOfferExpired = true;
          }
        }
        return {
          ...n,
          isOfferExpired
        };
      });

      if (req.query.activeOnly === 'true') {
        enhancedNotifications = enhancedNotifications.filter((n) => !n.isOfferExpired);
      }

      const unreadCount = await Notification.countDocuments({
        recipientId: req.auth!.id,
        isRead: false
      });

      res.json({
        unreadCount,
        count: enhancedNotifications.length,
        data: enhancedNotifications
      });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/v1/customer/notifications/:id/read or /notifications/:id/read - Mark notification as read
router.patch(
  ['/customer/notifications/:id/read', '/notifications/:id/read'],
  requireAuth(),
  async (req: AuthRequest, res, next) => {
    try {
      const notification = await Notification.findOneAndUpdate(
        { _id: req.params.id, recipientId: req.auth!.id },
        { isRead: true },
        { new: true }
      );

      if (!notification) {
        return res.status(404).json({ message: 'Notification not found.' });
      }

      res.json({ notification });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/v1/customer/notifications/mark-all-read or /notifications/mark-all-read - Mark all notifications read
router.patch(
  ['/customer/notifications/mark-all-read', '/notifications/mark-all-read'],
  requireAuth(),
  async (req: AuthRequest, res, next) => {
    try {
      await Notification.updateMany(
        { recipientId: req.auth!.id, isRead: false },
        { isRead: true }
      );
      res.json({ message: 'All notifications marked as read.' });
    } catch (error) {
      next(error);
    }
  }
);

// ==========================================
// 5. FCM Device Token Endpoints
// ==========================================

// POST /api/v1/notifications/fcm-token - Register device push token
router.post(
  '/notifications/fcm-token',
  requireAuth(),
  async (req: AuthRequest, res, next) => {
    try {
      const { token } = req.body;
      if (!token) return res.status(400).json({ message: 'Push token is required' });
      await fcmService.registerToken(req.auth!.id, token);
      res.json({ message: 'Push token registered successfully.' });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/v1/notifications/fcm-token - Unregister device push token
router.delete(
  '/notifications/fcm-token',
  requireAuth(),
  async (req: AuthRequest, res, next) => {
    try {
      const { token } = req.body;
      if (token) await fcmService.unregisterToken(req.auth!.id, token);
      res.json({ message: 'Push token unregistered.' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
