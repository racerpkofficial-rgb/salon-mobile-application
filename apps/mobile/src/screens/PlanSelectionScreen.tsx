import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { AppHeader } from '../components/AppHeader';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, radius } from '../constants/theme';
import { BillingCycle, PlanDetails, PlanType } from '../types';

interface PlanSelectionScreenProps {
  initialPlan?: PlanType;
  initialCycle?: BillingCycle;
  onBack: () => void;
  onProceedToPayment: (plan: PlanType, billingCycle: BillingCycle) => void;
}

const PLANS: PlanDetails[] = [
  {
    id: 'STARTER',
    name: 'Starter',
    tagline: 'Ideal for independent stylists & solo suites',
    monthlyPrice: 299,
    yearlyPrice: 2999,
    features: [
      '1 Stylist calendar & booking link',
      'Basic sales & revenue overview',
      'Standard Book My Salon mobile discovery',
      'SMS & email appointment notifications',
      'Direct customer cancellation management'
    ],
    popular: false
  },
  {
    id: 'BUSINESS',
    name: 'Business',
    tagline: 'Best for growing salons with expanding staff',
    monthlyPrice: 599,
    yearlyPrice: 5999,
    features: [
      'Up to 5 Stylist calendars & rosters',
      'Advanced client retention & revenue analytics',
      'Priority discovery ranking in city searches',
      'Automated client SMS appointment reminders',
      'Promotions, discount codes & service packages',
      'Custom working hours, shifts & break times'
    ],
    popular: true
  },
  {
    id: 'PREMIUM',
    name: 'Premium',
    tagline: 'Full luxury suite for premier salons & luxury chains',
    monthlyPrice: 999,
    yearlyPrice: 9999,
    features: [
      'Unlimited Stylist calendars & staff seats',
      'Top featured badge on customer discovery',
      'Custom salon branding & luxury verified badge',
      'Automated marketing & re-booking campaigns',
      'Dedicated 24/7 priority partner support manager',
      'Financial export & GST-ready invoicing'
    ],
    popular: false
  }
];

export function PlanSelectionScreen({
  initialPlan = 'BUSINESS',
  initialCycle = 'MONTHLY',
  onBack,
  onProceedToPayment
}: PlanSelectionScreenProps) {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(initialCycle);
  const [selectedPlan, setSelectedPlan] = useState<PlanType>(initialPlan);

  const isYearly = billingCycle === 'YEARLY';

  const handleContinue = () => {
    onProceedToPayment(selectedPlan, billingCycle);
  };

  return (
    <View style={s.page}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <AppHeader title="Partner Membership" onBack={onBack} />

        <Text style={s.eyebrow}>SUBSCRIPTION PLANS</Text>
        <Text style={s.title}>Choose how you grow{`\n`}with Book My Salon.</Text>
        <Text style={s.subtitle}>
          Select a flexible plan tailored to your salon’s stage. Upgrade, downgrade or manage anytime.
        </Text>

        {/* Monthly / Yearly Toggle */}
        <View style={s.toggleContainer}>
          <Pressable
            style={[s.toggleOption, !isYearly && s.toggleOptionActive]}
            onPress={() => setBillingCycle('MONTHLY')}
          >
            <Text style={[s.toggleText, !isYearly && s.toggleTextActive]}>Monthly Billing</Text>
          </Pressable>

          <Pressable
            style={[s.toggleOption, isYearly && s.toggleOptionActive]}
            onPress={() => setBillingCycle('YEARLY')}
          >
            <View style={s.yearlyLabelRow}>
              <Text style={[s.toggleText, isYearly && s.toggleTextActive]}>Annual Billing</Text>
              <View style={s.discountBadge}>
                <Text style={s.discountText}>SAVE ~16%</Text>
              </View>
            </View>
          </Pressable>
        </View>

        {/* Plan Comparison Cards */}
        <View style={s.plansList}>
          {PLANS.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice;
            const periodLabel = isYearly ? '/ year' : '/ month';
            const savingsNotice = isYearly
              ? `Save ₹${plan.monthlyPrice * 12 - plan.yearlyPrice} billed annually`
              : 'Flexible monthly billing, cancel anytime';

            return (
              <Pressable
                key={plan.id}
                onPress={() => setSelectedPlan(plan.id)}
                style={[
                  s.planCard,
                  isSelected && s.planCardSelected,
                  plan.popular && s.planCardPopular
                ]}
              >
                {plan.popular && (
                  <View style={s.popularBadge}>
                    <Text style={s.popularBadgeText}>★ MOST POPULAR CHOICE</Text>
                  </View>
                )}

                <View style={s.cardHeader}>
                  <View style={s.titleRow}>
                    <Text style={s.planName}>{plan.name}</Text>
                    <View style={[s.radioCircle, isSelected && s.radioCircleSelected]}>
                      {isSelected && <View style={s.radioInner} />}
                    </View>
                  </View>
                  <Text style={s.planTagline}>{plan.tagline}</Text>
                </View>

                {/* Price Display */}
                <View style={s.priceBox}>
                  <View style={s.priceRow}>
                    <Text style={s.currency}>₹</Text>
                    <Text style={s.priceNumber}>{price}</Text>
                    <Text style={s.period}>{periodLabel}</Text>
                  </View>
                  <Text style={s.savingsText}>{savingsNotice}</Text>
                </View>

                <View style={s.cardDivider} />

                {/* Features Checklist */}
                <View style={s.featuresList}>
                  <Text style={s.featuresTitle}>INCLUDED IN {plan.name.toUpperCase()}:</Text>
                  {plan.features.map((feat, idx) => (
                    <View key={idx} style={s.featureRow}>
                      <Text style={s.checkIcon}>✓</Text>
                      <Text style={s.featureText}>{feat}</Text>
                    </View>
                  ))}
                </View>

                <Pressable
                  onPress={() => setSelectedPlan(plan.id)}
                  style={[s.selectBtn, isSelected && s.selectBtnSelected]}
                >
                  <Text style={[s.selectBtnText, isSelected && s.selectBtnTextSelected]}>
                    {isSelected ? '✓ Plan Selected' : `Select ${plan.name}`}
                  </Text>
                </Pressable>
              </Pressable>
            );
          })}
        </View>

        {/* Bottom Proceed Action */}
        <View style={s.footer}>
          <PrimaryButton
            label={`Proceed to Payment (₹${
              isYearly
                ? PLANS.find((p) => p.id === selectedPlan)?.yearlyPrice
                : PLANS.find((p) => p.id === selectedPlan)?.monthlyPrice
            })`}
            onPress={handleContinue}
          />
          <Text style={s.guaranteeText}>
            🔒 14-Day Money Back Guarantee • Instant activation • No lock-in contracts
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 22, paddingTop: 30, paddingBottom: 40 },
  eyebrow: { color: colors.gold, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginTop: 15 },
  title: { fontSize: 32, lineHeight: 37, letterSpacing: -1, color: colors.ink, fontWeight: '700', marginTop: 8 },
  subtitle: { color: colors.muted, lineHeight: 22, marginTop: 8, fontSize: 14 },

  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: 24
  },
  toggleOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center'
  },
  toggleOptionActive: {
    backgroundColor: colors.ink
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted
  },
  toggleTextActive: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  yearlyLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  discountBadge: {
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  discountText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800'
  },

  plansList: { gap: 20 },
  planCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 22,
    borderWidth: 1.5,
    borderColor: colors.border,
    position: 'relative'
  },
  planCardSelected: {
    borderColor: colors.gold,
    backgroundColor: '#FFFFFF',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 3
  },
  planCardPopular: {
    borderWidth: 2,
    borderColor: colors.gold
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    right: 20,
    backgroundColor: colors.gold,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.pill
  },
  popularBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5
  },

  cardHeader: { marginBottom: 14 },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  planName: { fontSize: 24, fontWeight: '700', color: colors.ink },
  planTagline: { fontSize: 13, color: colors.muted, marginTop: 4, lineHeight: 18 },

  radioCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  radioCircleSelected: {
    borderColor: colors.gold
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.gold
  },

  priceBox: { marginVertical: 8 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline' },
  currency: { fontSize: 20, fontWeight: '700', color: colors.ink },
  priceNumber: { fontSize: 36, fontWeight: '800', color: colors.ink, letterSpacing: -1 },
  period: { fontSize: 15, color: colors.muted, marginLeft: 4, fontWeight: '500' },
  savingsText: { fontSize: 12, color: colors.success, fontWeight: '600', marginTop: 4 },

  cardDivider: { height: 1, backgroundColor: colors.border, marginVertical: 16 },

  featuresList: { marginBottom: 20 },
  featuresTitle: { fontSize: 11, fontWeight: '700', color: colors.gold, letterSpacing: 1, marginBottom: 12 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 9 },
  checkIcon: { color: colors.gold, fontWeight: '800', fontSize: 14, width: 20, marginTop: 1 },
  featureText: { fontSize: 13, color: colors.ink, flex: 1, lineHeight: 19 },

  selectBtn: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background
  },
  selectBtnSelected: {
    backgroundColor: colors.goldSoft,
    borderColor: colors.gold
  },
  selectBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink
  },
  selectBtnTextSelected: {
    color: colors.gold,
    fontWeight: '800'
  },

  footer: { marginTop: 32, paddingBottom: 20 },
  guaranteeText: {
    textAlign: 'center',
    color: colors.muted,
    fontSize: 11,
    marginTop: 14,
    lineHeight: 16
  }
});
