import { CustomerOffer, SalonOffer, Service } from '../types';

export interface CalculatedOfferPricing {
  originalPrice: number;
  discountAmount: number;
  finalPrice: number;
  hasDiscount: boolean;
  discountLabel: string;
  appliedOffer: CustomerOffer | SalonOffer | null;
}

/**
 * Checks if an offer is currently active, valid, and unexpired.
 */
export function isOfferValid(offer: CustomerOffer | SalonOffer | null | undefined): boolean {
  if (!offer) return false;
  if (offer.isActive === false) return false;
  if (offer.status && offer.status !== 'ACTIVE') return false;

  const now = new Date();
  if (offer.endDate) {
    const end = new Date(offer.endDate);
    if (!isNaN(end.getTime()) && end < now) return false;
  }
  if ((offer as any).validUntil) {
    const validUntil = new Date((offer as any).validUntil);
    if (!isNaN(validUntil.getTime()) && validUntil < now) return false;
  }
  if (offer.startDate) {
    const start = new Date(offer.startDate);
    if (!isNaN(start.getTime()) && start > now) return false;
  }

  // Must have a valid positive discount
  const val = offer.discountValue ?? (offer as any).discountPercent;
  if (typeof val !== 'number' || val <= 0) return false;

  return true;
}

/**
 * Checks if an offer is applicable to a specific service.
 */
export function isOfferApplicableToService(
  offer: CustomerOffer | SalonOffer | null | undefined,
  service: Service | null | undefined
): boolean {
  if (!isOfferValid(offer) || !service) return false;

  const appSvc = (offer!.applicableService || '').trim();
  if (!appSvc || appSvc === 'ALL') return true;

  const serviceId = (service.id || (service as any)._id || '').toString().toLowerCase();
  const targetId = appSvc.toLowerCase();
  if (serviceId && serviceId === targetId) return true;

  const serviceName = (service.name || '').trim().toLowerCase();
  if (serviceName && serviceName === targetId) return true;

  return false;
}

/**
 * Calculates pricing for a service given an optional offer.
 */
export function calculateServicePriceWithOffer(
  service: Service | null | undefined,
  offer: CustomerOffer | SalonOffer | null | undefined
): CalculatedOfferPricing {
  const originalPrice = service ? Number(service.price) || 0 : 0;
  if (originalPrice <= 0 || !isOfferApplicableToService(offer, service)) {
    return {
      originalPrice,
      discountAmount: 0,
      finalPrice: originalPrice,
      hasDiscount: false,
      discountLabel: '',
      appliedOffer: null
    };
  }

  const val = offer!.discountValue ?? (offer as any).discountPercent ?? 0;
  let discountAmount = 0;

  if (offer!.discountType === 'FIXED') {
    discountAmount = Math.min(originalPrice, Math.max(0, val));
  } else {
    // Default: PERCENTAGE
    const pct = Math.min(100, Math.max(0, val));
    discountAmount = Math.round((originalPrice * pct) / 100);
  }

  const finalPrice = Math.max(0, originalPrice - discountAmount);
  const discountLabel =
    offer!.discountType === 'FIXED'
      ? `₹${val} OFF`
      : `${val}% OFF`;

  return {
    originalPrice,
    discountAmount,
    finalPrice,
    hasDiscount: discountAmount > 0,
    discountLabel,
    appliedOffer: discountAmount > 0 ? offer! : null
  };
}

/**
 * Finds the best eligible offer for a service from an array of offers.
 * If multiple offers are eligible, chooses the one with the highest discount amount.
 */
export function getBestOfferForService(
  service: Service | null | undefined,
  offers: Array<CustomerOffer | SalonOffer> = []
): CalculatedOfferPricing {
  const originalPrice = service ? Number(service.price) || 0 : 0;
  if (!service || originalPrice <= 0 || !offers || offers.length === 0) {
    return {
      originalPrice,
      discountAmount: 0,
      finalPrice: originalPrice,
      hasDiscount: false,
      discountLabel: '',
      appliedOffer: null
    };
  }

  let bestPricing: CalculatedOfferPricing = {
    originalPrice,
    discountAmount: 0,
    finalPrice: originalPrice,
    hasDiscount: false,
    discountLabel: '',
    appliedOffer: null
  };

  for (const offer of offers) {
    if (isOfferApplicableToService(offer, service)) {
      const pricing = calculateServicePriceWithOffer(service, offer);
      if (pricing.discountAmount > bestPricing.discountAmount) {
        bestPricing = pricing;
      }
    }
  }

  return bestPricing;
}
