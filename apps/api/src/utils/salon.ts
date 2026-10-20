import { SalonDocument } from '../models/Salon.js';

export interface SalonEligibilityResult {
  canView: boolean;
  canBook: boolean;
  reason:
    | 'SALON_NOT_APPROVED'
    | 'SALON_INACTIVE'
    | 'SUBSCRIPTION_EXPIRED'
    | 'SUBSCRIPTION_CANCELLED'
    | null;
}

/**
 * Single source of truth for whether a salon is publicly visible and bookable.
 * Unified across Super Admin, Customer Discover, Search, Offers, and Booking.
 */
export function getSalonEligibility(salon: Partial<SalonDocument> | null | undefined): SalonEligibilityResult {
  if (!salon) {
    return { canView: false, canBook: false, reason: 'SALON_INACTIVE' };
  }

  if (salon.status === 'PENDING_APPROVAL') {
    return { canView: false, canBook: false, reason: 'SALON_NOT_APPROVED' };
  }

  if (salon.status === 'REJECTED' || salon.status === 'SUSPENDED') {
    return { canView: false, canBook: false, reason: 'SALON_INACTIVE' };
  }

  if (salon.status !== 'ACTIVE') {
    return { canView: false, canBook: false, reason: 'SALON_INACTIVE' };
  }

  if (salon.subscriptionStatus === 'EXPIRED') {
    return { canView: false, canBook: false, reason: 'SUBSCRIPTION_EXPIRED' };
  }

  if (salon.subscriptionStatus === 'CANCELLED') {
    return { canView: false, canBook: false, reason: 'SUBSCRIPTION_CANCELLED' };
  }

  // Active approved salon with valid subscription
  return { canView: true, canBook: true, reason: null };
}

export function isSalonBookable(salon: Partial<SalonDocument> | null | undefined): boolean {
  const result = getSalonEligibility(salon);
  return result.canBook;
}

/**
 * MongoDB query filter for publicly bookable salons in Discover and Search
 */
export function getBookableSalonFilter(): Record<string, any> {
  return {
    status: 'ACTIVE',
    subscriptionStatus: { $nin: ['EXPIRED', 'CANCELLED'] }
  };
}

export const KNOWN_STOCK_IMAGES = [
  'https://images.unsplash.com/photo-1560066984-138dadb4c035',
  'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f',
  'https://images.unsplash.com/photo-1562322140-8baeececf3df'
];

export function isLegacyStockImage(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return KNOWN_STOCK_IMAGES.some((stock) => url.includes(stock));
}

export function sanitizeSalonImages(images?: string[]): string[] {
  if (!images || !Array.isArray(images)) return [];
  return images
    .filter((img) => typeof img === 'string' && img.trim().length > 0)
    .filter((img) => !isLegacyStockImage(img))
    .slice(0, 8);
}

const BOILERPLATE_DESCRIPTIONS = [
  'new salon partner onboarding with book my salon',
  'new salon partner onboarding with aurelia',
  'a premier luxury salon dedicated to bespoke hair styling, therapeutic head spa rituals, and rejuvenating wellness experiences'
];

export function isLegacyBoilerplateDescription(desc?: string): boolean {
  if (!desc || typeof desc !== 'string') return true;
  const lower = desc.trim().toLowerCase();
  if (lower.length === 0) return true;
  return BOILERPLATE_DESCRIPTIONS.some((b) => lower.startsWith(b) || lower === b);
}

export function sanitizeSalonDescription(desc?: string): string {
  if (!desc || typeof desc !== 'string') return '';
  if (isLegacyBoilerplateDescription(desc)) return '';
  return desc.trim();
}

