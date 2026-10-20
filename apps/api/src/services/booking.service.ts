import { Types } from 'mongoose';
import { Appointment, AppointmentStatus } from '../models/Appointment.js';
import { SalonDocument } from '../models/Salon.js';
import { Service, ServiceDocument } from '../models/Service.js';

export interface TimeSlot {
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  duration: number; // in minutes
  isAvailable: boolean;
}

export function timeToMinutes(timeStr: string): number {
  const [hours, mins] = timeStr.split(':').map(Number);
  return (hours || 0) * 60 + (mins || 0);
}

export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function calculateEndTime(startTime: string, durationMinutes: number): string {
  const startMins = timeToMinutes(startTime);
  const endMins = startMins + durationMinutes;
  return minutesToTime(endMins);
}

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function intervalsOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number
): boolean {
  return startA < endB && endA > startB;
}

export const bookingService = {
  /**
   * Calculate continuous availability for a specific service duration on a specific date.
   */
  async getAvailableSlots(
    salon: SalonDocument,
    serviceDuration: number,
    dateStr: string
  ): Promise<TimeSlot[]> {
    // 1. Working hours configuration
    const workingHours = salon.workingHours || {
      openTime: '09:00',
      closeTime: '20:00',
      slotIntervalMinutes: 30,
      daysOpen: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    };

    // 2. Check if salon is open on the requested day of the week
    const [y, m, d] = dateStr.split('-').map(Number);
    const targetDate = new Date(y, (m || 1) - 1, d || 1);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const targetDayName = dayNames[targetDate.getDay()];

    const daysOpen = workingHours.daysOpen?.length
      ? workingHours.daysOpen
      : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    if (!daysOpen.includes(targetDayName)) {
      return []; // Salon closed on this day
    }

    // 3. Past date check
    const now = new Date();
    const todayStr = getTodayDateString();
    const isPastDate = dateStr < todayStr;
    if (isPastDate) {
      return [];
    }

    const isToday = dateStr === todayStr;
    const currentMinsToday = now.getHours() * 60 + now.getMinutes() + 15; // 15-minute lead buffer

    // 4. Fetch all active/pending bookings for this salon on this date
    const bookedAppointments = await Appointment.find({
      salonId: salon._id,
      appointmentDate: dateStr,
      status: { $in: ['PENDING', 'CONFIRMED'] }
    })
      .select('startTime endTime status')
      .lean();

    const occupiedIntervals = bookedAppointments.map((app) => ({
      start: timeToMinutes(app.startTime),
      end: timeToMinutes(app.endTime)
    }));

    // 5. Generate continuous slots respecting serviceDuration
    const openMins = timeToMinutes(workingHours.openTime || '09:00');
    const closeMins = timeToMinutes(workingHours.closeTime || '20:00');
    const intervalMins = workingHours.slotIntervalMinutes || 30;

    const slots: TimeSlot[] = [];

    for (let slotStart = openMins; slotStart + serviceDuration <= closeMins; slotStart += intervalMins) {
      const slotEnd = slotStart + serviceDuration;

      // Check if slot starts in the past today
      const isPastTime = isToday && slotStart < currentMinsToday;

      // Check if slot overlaps with ANY occupied booking
      const hasConflict = occupiedIntervals.some((occ) =>
        intervalsOverlap(slotStart, slotEnd, occ.start, occ.end)
      );

      const isAvailable = !isPastTime && !hasConflict;

      slots.push({
        startTime: minutesToTime(slotStart),
        endTime: minutesToTime(slotEnd),
        duration: serviceDuration,
        isAvailable
      });
    }

    return slots;
  },

  /**
   * Check for slot collisions against pending or confirmed bookings.
   */
  async checkForConflict(
    salonId: Types.ObjectId,
    dateStr: string,
    startTime: string,
    endTime: string,
    excludeAppointmentId?: Types.ObjectId
  ): Promise<boolean> {
    const startMins = timeToMinutes(startTime);
    const endMins = timeToMinutes(endTime);

    // Query candidates for that date
    const candidates = await Appointment.find({
      salonId,
      appointmentDate: dateStr,
      status: { $in: ['PENDING', 'CONFIRMED'] },
      ...(excludeAppointmentId ? { _id: { $ne: excludeAppointmentId } } : {})
    })
      .select('startTime endTime')
      .lean();

    for (const cand of candidates) {
      const candStart = timeToMinutes(cand.startTime);
      const candEnd = timeToMinutes(cand.endTime);

      if (intervalsOverlap(startMins, endMins, candStart, candEnd)) {
        return true; // Overlap detected
      }
    }

    return false;
  },

  /**
   * Sync services between salon embedded items and standalone Service documents.
   */
  async syncSalonServices(salon: SalonDocument): Promise<ServiceDocument[]> {
    const services: ServiceDocument[] = [];

    if (!salon.services || !salon.services.length) {
      return await Service.find({ salonId: salon._id, isActive: true });
    }

    for (const s of salon.services) {
      const duration = s.durationMinutes || (s as any).duration || 30;
      const existing = await Service.findOne({ salonId: salon._id, name: s.name });

      if (existing) {
        existing.price = s.price;
        existing.duration = duration;
        existing.description = s.description || '';
        existing.category = s.category || 'General';
        await existing.save();
        if (existing.isActive) {
          services.push(existing);
        }
      } else {
        const created = await Service.create({
          salonId: salon._id,
          name: s.name,
          description: s.description || '',
          price: s.price,
          duration,
          category: s.category || 'General',
          isActive: true
        });
        services.push(created);
      }
    }

    return services;
  }
};
