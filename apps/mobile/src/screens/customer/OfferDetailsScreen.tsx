import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { PrimaryButton, SecondaryButton } from '../../components/Buttons';
import { colors, radius, typography } from '../../constants/theme';
import { offerService } from '../../services/offer.service';
import { CustomerOffer, Salon, Service } from '../../types';
import { formatLocation, normalizeSalonLocation } from '../../utils/location';


interface OfferDetailsScreenProps {
  offerId?: string;
  initialOffer?: CustomerOffer | null;
  allSalons?: Salon[];
  onBookOffer: (salon: Salon, offer: CustomerOffer, service?: Service) => void;
  onBack: () => void;
}

export function OfferDetailsScreen({
  offerId,
  initialOffer,
  allSalons = [],
  onBookOffer,
  onBack
}: OfferDetailsScreenProps) {
  const [offer, setOffer] = useState<CustomerOffer | null>(initialOffer || null);
  const [loading, setLoading] = useState<boolean>(!initialOffer && Boolean(offerId));
  const [error, setError] = useState<string | null>(null);

  const effectiveOfferId = offerId || initialOffer?._id || initialOffer?.id;

  useEffect(() => {
    let isMounted = true;
    if (!effectiveOfferId) {
      if (!initialOffer) {
        setError('No offer identifier provided.');
      }
      return;
    }

    const fetchDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await offerService.getOfferDetails(effectiveOfferId.toString());
        if (isMounted && res.data) {
          setOffer(res.data);
        }
      } catch (err) {
        if (isMounted) {
          // If we already have initialOffer, we keep it; otherwise set error
          if (!initialOffer) {
            setError(
              err instanceof Error
                ? err.message
                : 'This promotion offer is no longer available or has expired.'
            );
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void fetchDetails();

    return () => {
      isMounted = false;
    };
  }, [effectiveOfferId]);

  // Resolve associated salon
  const resolvedSalon: Salon | null = useMemo(() => {
    let raw: any = null;
    if (offer?.salon) raw = offer.salon;
    else {
      const sId = (offer?.salonId?._id || offer?.salonId || '').toString();
      if (sId && allSalons.length > 0) {
        const match = allSalons.find((s) => (s.id || s._id || '').toString() === sId);
        if (match) raw = match;
      }
    }
    if (raw) return normalizeSalonLocation(raw) as Salon;

    // Fallback construct from offer metadata
    if (offer?.salonName) {
      const sId = (offer?.salonId?._id || offer?.salonId || 'unknown').toString();
      return normalizeSalonLocation({
        id: sId,
        _id: sId,
        name: offer.salonName,
        salonName: offer.salonName,
        location: offer.salonCity ? `${offer.salonCity} • ${offer.salonAddress || ''}` : offer.salonAddress || 'Partner Salon',
        address: offer.salonAddress,
        city: offer.salonCity,
        image: offer.salonImage || '',
        startingPrice: 'From ₹500',
        status: 'ACTIVE',
        subscriptionStatus: 'ACTIVE'
      }) as Salon;
    }
    return null;
  }, [offer, allSalons]);

  // Resolve targeted service if any
  const targetedService: Service | null = useMemo(() => {
    if (!offer || !resolvedSalon || !resolvedSalon.services) return null;
    if (!offer.applicableService || offer.applicableService === 'ALL') return null;

    return (
      resolvedSalon.services.find(
        (svc) =>
          svc.id === offer.applicableService ||
          (svc as any)._id === offer.applicableService ||
          svc.name.toLowerCase() === offer.applicableService?.toLowerCase()
      ) || null
    );
  }, [offer, resolvedSalon]);

  // Compute pricing
  const pricing = useMemo(() => {
    if (!targetedService) return null;
    const original = Number(targetedService.price) || 0;
    if (original <= 0) return null;

    let discount = 0;
    if (offer?.discountType === 'FIXED') {
      discount = offer.discountValue || 0;
    } else {
      const pct = offer?.discountValue ?? offer?.discountPercent ?? 0;
      discount = Math.round((original * pct) / 100);
    }

    const discountedPrice = Math.max(0, original - discount);
    return {
      original,
      discount,
      discountedPrice
    };
  }, [targetedService, offer]);

  // Format dates
  const startDateStr = offer?.startDate
    ? new Date(offer.startDate).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })
    : null;

  const endDateStr = offer?.endDate || offer?.validUntil
    ? new Date(offer.endDate || offer.validUntil!).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })
    : 'Limited time';

  const isExpired = Boolean(
    (offer as any)?.isExpired ||
    offer?.eligibility?.reason === 'OFFER_EXPIRED' ||
    (offer?.endDate && new Date(offer.endDate) < new Date()) ||
    (offer?.validUntil && new Date(offer.validUntil) < new Date()) ||
    offer?.isActive === false
  );

  const canBook = Boolean(
    !isExpired &&
    (offer?.eligibility ? offer.eligibility.canBook : true)
  );

  const discountBadgeText =
    offer?.discountType === 'FIXED'
      ? `₹${offer.discountValue} OFF`
      : `${offer?.discountValue || offer?.discountPercent || 20}% OFF`;

  const handleBookNow = () => {
    if (!resolvedSalon || !offer) return;
    onBookOffer(resolvedSalon, offer, targetedService || undefined);
  };

  return (
    <View style={s.page}>
      {/* Header Bar */}
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backBtn}>
          <Text style={s.backText}>← Back</Text>
        </Pressable>
        <Text style={s.headerTitle}>Offer Details</Text>
        <View style={{ width: 50 }} />
      </View>

      {loading ? (
        <View style={s.centerWrap}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={s.loadingText}>Loading promotional offer...</Text>
        </View>
      ) : error || !offer ? (
        <View style={s.errorWrap}>
          <Text style={s.errorIcon}>⚠️</Text>
          <Text style={s.errorTitle}>Offer Not Available</Text>
          <Text style={s.errorBody}>
            {error || 'This promotion is no longer active, has expired, or the salon is unavailable.'}
          </Text>
          <View style={{ marginTop: 20 }}>
            <PrimaryButton label="Explore Active Salons" onPress={onBack} />
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          {/* Offer Banner Image or Luxury Fallback Placeholder */}
          {offer.image ? (
            <View style={s.imageBox}>
              <Image source={{ uri: offer.image }} style={s.offerImage} resizeMode="cover" />
            </View>
          ) : (
            <View style={s.fallbackImageBox}>
              <Text style={s.fallbackPattern}>✦  ✦  ✦</Text>
              <Text style={s.fallbackInsignia}>BOOK MY SALON EXCLUSIVE</Text>
              <Text style={s.fallbackSub}>EXCLUSIVE SALON PRIVILEGE</Text>
            </View>
          )}

          {/* Expired Callout Banner */}
          {isExpired && (
            <View style={s.expiredBanner}>
              <Text style={s.expiredBannerIcon}>⏳</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.expiredBannerTitle}>This offer has expired</Text>
                <Text style={s.expiredBannerText}>
                  This promotion has concluded and is no longer available for booking.
                </Text>
              </View>
            </View>
          )}

          {/* Offer Badge & Validity */}
          <View style={s.badgeRow}>
            <View style={s.discountBadge}>
              <Text style={s.discountBadgeText}>🔥 {discountBadgeText}</Text>
            </View>
            <View style={[s.validityPill, isExpired ? s.validityPillExpired : s.validityPillActive]}>
              <Text style={[s.validityPillText, isExpired ? s.validityTextExpired : s.validityTextActive]}>
                {isExpired ? 'EXPIRED' : `Valid until ${endDateStr}`}
              </Text>
            </View>
          </View>

          {/* Title & Description */}
          <Text style={s.title}>{offer.title}</Text>
          <Text style={s.description}>{offer.description}</Text>

          {/* Targeted Service & Price Breakdown Card */}
          {pricing && targetedService ? (
            <View style={s.pricingCard}>
              <Text style={s.cardEyebrow}>APPLICABLE TREATMENT</Text>
              <Text style={s.serviceName}>{targetedService.name}</Text>
              {Boolean(targetedService.durationMinutes) && (
                <Text style={s.serviceDuration}>{targetedService.durationMinutes} mins</Text>
              )}

              <View style={s.priceDivider} />

              <View style={s.priceRow}>
                <Text style={s.priceLabel}>Standard Price</Text>
                <Text style={s.originalPrice}>₹{pricing.original}</Text>
              </View>

              <View style={s.priceRow}>
                <Text style={s.priceLabel}>Offer Discount</Text>
                <Text style={s.discountSavings}>-₹{pricing.discount}</Text>
              </View>

              <View style={[s.priceRow, { marginTop: 6 }]}>
                <Text style={s.finalPriceLabel}>Exclusive Price</Text>
                <Text style={s.finalPrice}>₹{pricing.discountedPrice}</Text>
              </View>
            </View>
          ) : (
            <View style={s.serviceScopeCard}>
              <Text style={s.serviceScopeIcon}>✦</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.serviceScopeTitle}>Applicable Treatment Scope</Text>
                <Text style={s.serviceScopeBody}>
                  {offer.applicableService && offer.applicableService !== 'ALL'
                    ? `Applicable on service: "${offer.applicableService}".`
                    : 'Valid across all haircut, hair styling, skin ritual, and spa services.'}
                </Text>
              </View>
            </View>
          )}

          {/* Salon Details Card */}
          {resolvedSalon && (
            <View style={s.salonCard}>
              <Text style={s.cardEyebrow}>PARTNER SALON</Text>
              <View style={s.salonRow}>
                {resolvedSalon.image ? (
                  <Image source={{ uri: resolvedSalon.image }} style={s.salonThumb} />
                ) : (
                  <View style={s.salonThumbFallback}>
                    <Text style={{ fontSize: 18 }}>✂️</Text>
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.salonName}>{resolvedSalon.name || resolvedSalon.salonName}</Text>
                  <Text style={s.salonLocation}>
                    📍 {formatLocation(resolvedSalon.location, resolvedSalon.city, resolvedSalon.address, 'Verified Salon')}
                  </Text>
                  {Boolean(resolvedSalon.phone) && (
                    <Text style={s.salonPhone}>📞 {resolvedSalon.phone}</Text>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* Terms & Conditions */}
          <View style={s.termsCard}>
            <Text style={s.cardEyebrow}>TERMS & CONDITIONS</Text>
            <View style={s.bulletItem}>
              <Text style={s.bulletDot}>•</Text>
              <Text style={s.bulletText}>Offer discount applies directly when booking via Book My Salon.</Text>
            </View>
            <View style={s.bulletItem}>
              <Text style={s.bulletDot}>•</Text>
              <Text style={s.bulletText}>Subject to salon confirmation and time slot availability.</Text>
            </View>
            {Boolean(startDateStr) && (
              <View style={s.bulletItem}>
                <Text style={s.bulletDot}>•</Text>
                <Text style={s.bulletText}>Valid from {startDateStr} to {endDateStr}.</Text>
              </View>
            )}
            <View style={s.bulletItem}>
              <Text style={s.bulletDot}>•</Text>
              <Text style={s.bulletText}>Cannot be combined with other promotional codes.</Text>
            </View>
          </View>

          {/* Book Now Button */}
          <View style={s.ctaWrap}>
            {isExpired ? (
              <SecondaryButton label="This offer has expired" disabled onPress={() => {}} />
            ) : !canBook ? (
              <SecondaryButton
                label={
                  offer?.eligibility?.reason === 'SALON_NOT_APPROVED'
                    ? 'Salon Awaiting Approval'
                    : 'Salon Unavailable'
                }
                disabled
                onPress={() => {}}
              />
            ) : (
              <PrimaryButton
                label={pricing ? `Book Now for ₹${pricing.discountedPrice}` : 'Book Now with Offer →'}
                onPress={handleBookNow}
              />
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  backBtn: { paddingVertical: 6, paddingRight: 8 },
  backText: { color: colors.gold, fontSize: 13, fontWeight: '700' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: colors.ink },

  centerWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { color: colors.muted, marginTop: 12, fontSize: 13 },

  errorWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  errorIcon: { fontSize: 44, marginBottom: 12 },
  errorTitle: { fontSize: 18, fontWeight: '800', color: colors.ink, marginBottom: 6 },
  errorBody: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 8
  },

  content: { padding: 20, paddingBottom: 40 },

  imageBox: {
    width: '100%',
    height: 190,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginBottom: 16
  },
  offerImage: { width: '100%', height: '100%' },

  fallbackImageBox: {
    width: '100%',
    height: 160,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1.5,
    borderColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    padding: 16
  },
  fallbackPattern: { color: colors.gold, fontSize: 14, letterSpacing: 4, marginBottom: 6 },
  fallbackInsignia: { color: colors.goldDark, fontSize: 14, fontWeight: '800', letterSpacing: 2 },
  fallbackSub: { color: colors.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1, marginTop: 4 },

  badgeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  discountBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#FDE68A'
  },
  discountBadgeText: { color: '#B45309', fontSize: 13, fontWeight: '800' },

  validityPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  validityPillActive: { backgroundColor: '#ECFDF5' },
  validityPillExpired: { backgroundColor: '#FEF2F2' },
  validityPillText: { fontSize: 11, fontWeight: '700' },
  validityTextActive: { color: '#047857' },
  validityTextExpired: { color: '#B91C1C' },

  title: { fontSize: 22, fontWeight: '800', color: colors.ink, marginBottom: 8, lineHeight: 28 },
  description: { fontSize: 14, color: colors.muted, lineHeight: 21, marginBottom: 18 },

  pricingCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16
  },
  cardEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.gold,
    letterSpacing: 0.8,
    marginBottom: 6
  },
  serviceName: { fontSize: 16, fontWeight: '800', color: colors.ink },
  serviceDuration: { fontSize: 12, color: colors.muted, marginTop: 2 },
  priceDivider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  priceLabel: { fontSize: 13, color: colors.muted },
  originalPrice: { fontSize: 13, color: colors.muted, textDecorationLine: 'line-through' },
  discountSavings: { fontSize: 13, color: colors.gold, fontWeight: '700' },
  finalPriceLabel: { fontSize: 15, fontWeight: '800', color: colors.ink },
  finalPrice: { fontSize: 18, fontWeight: '800', color: colors.ink },

  serviceScopeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.goldSoft
  },
  serviceScopeIcon: { fontSize: 18, color: colors.gold, marginRight: 10 },
  serviceScopeTitle: { fontSize: 13, fontWeight: '700', color: colors.ink },
  serviceScopeBody: { fontSize: 12, color: colors.muted, marginTop: 2, lineHeight: 17 },

  salonCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16
  },
  salonRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  salonThumb: { width: 50, height: 50, borderRadius: radius.sm, backgroundColor: '#E5E7EB' },
  salonThumbFallback: {
    width: 50,
    height: 50,
    borderRadius: radius.sm,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center'
  },
  salonName: { fontSize: 15, fontWeight: '800', color: colors.ink },
  salonLocation: { fontSize: 12, color: colors.muted, marginTop: 2 },
  salonPhone: { fontSize: 11, color: colors.gold, marginTop: 3 },

  termsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 20
  },
  bulletItem: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 6 },
  bulletDot: { fontSize: 12, color: colors.gold, marginRight: 8, lineHeight: 18 },
  bulletText: { flex: 1, fontSize: 12, color: colors.muted, lineHeight: 18 },

  ctaWrap: { marginTop: 6, marginBottom: 20 },
  expiredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#F87171',
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 16,
    gap: 12
  },
  expiredBannerIcon: { fontSize: 22 },
  expiredBannerTitle: { fontSize: 14, fontWeight: '800', color: '#991B1B' },
  expiredBannerText: { fontSize: 12, color: '#7F1D1D', marginTop: 2 }
});
