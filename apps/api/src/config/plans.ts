import { PlanType, BillingCycle } from '../models/Subscription.js';

export interface PlanFeature {
  name: string;
  starter: boolean | string;
  business: boolean | string;
  premium: boolean | string;
}

export interface PlanDetails {
  id: PlanType;
  name: string;
  tagline: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  popular?: boolean;
}

export const SUBSCRIPTION_PLANS: Record<PlanType, PlanDetails> = {
  STARTER: {
    id: 'STARTER',
    name: 'Starter',
    tagline: 'Ideal for independent stylists & boutique salons',
    monthlyPrice: 299,
    yearlyPrice: 2999,
    features: [
      '1 Stylist calendar & bookings',
      'Basic sales & client analytics',
      'Standard Book My Salon mobile catalogue listing',
      'Instant SMS & email appointment alerts',
      'Direct customer booking link'
    ],
    popular: false
  },
  BUSINESS: {
    id: 'BUSINESS',
    name: 'Business',
    tagline: 'Best for growing salons with expanding teams',
    monthlyPrice: 599,
    yearlyPrice: 5999,
    features: [
      'Up to 5 Stylist calendars',
      'Advanced client retention & revenue analytics',
      'Priority discovery ranking in city searches',
      'Automated appointment reminders',
      'Promotions, discount codes & service packages',
      'Custom salon working hours & breaks'
    ],
    popular: true
  },
  PREMIUM: {
    id: 'PREMIUM',
    name: 'Premium',
    tagline: 'Full luxury suite for premier salons & chains',
    monthlyPrice: 999,
    yearlyPrice: 9999,
    features: [
      'Unlimited Stylist calendars & salon branches',
      'Top featured badge on customer home screen',
      'Custom salon branding & luxury verified badge',
      'Automated marketing & re-booking campaigns',
      'Dedicated 24/7 priority partner support',
      'Export accounting & GST financial reports'
    ],
    popular: false
  }
};

export function calculatePlanAmount(plan: PlanType, billingCycle: BillingCycle): number {
  const details = SUBSCRIPTION_PLANS[plan];
  if (!details) throw new Error(`Invalid plan: ${plan}`);
  return billingCycle === 'YEARLY' ? details.yearlyPrice : details.monthlyPrice;
}
