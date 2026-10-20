import { useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { PrimaryButton, SecondaryButton } from '../../components/Buttons';
import { Avatar } from '../../components/Avatar';
import { colors, radius } from '../../constants/theme';
import { offerService } from '../../services/offer.service';
import { reviewService } from '../../services/review.service';
import { CustomerOffer, ReviewData, Salon, SalonOffer, Service } from '../../types';
import { formatCoordinates, formatLocation } from '../../utils/location';
import { getBestOfferForService } from '../../utils/offer';


interface SalonDetailsScreenProps {
  salon: Salon;
  isFavorite?: boolean;
  onToggleFavorite?: (salon: Salon) => void;
  onViewServiceList: (salon: Salon) => void;
  onBookService?: (
    salon: Salon,
    service?: Service,
    offer?: CustomerOffer | SalonOffer | null
  ) => void;
  onViewAllReviews?: (salonId: string, salonName: string) => void;
  onBack: () => void;
}

export function SalonDetailsScreen({
  salon,
  isFavorite = false,
  onToggleFavorite,
  onViewServiceList,
  onBookService,
  onViewAllReviews,
  onBack
}: SalonDetailsScreenProps) {
  const KNOWN_STOCK_IMAGES = [
    'https://images.unsplash.com/photo-1560066984-138dadb4c035',
    'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f',
    'https://images.unsplash.com/photo-1562322140-8baeececf3df'
  ];

  const images = (salon.images && salon.images.length > 0 ? salon.images : [salon.image].filter(Boolean) as string[])
    .filter((img): img is string => typeof img === 'string' && img.trim().length > 0)
    .filter((img) => !KNOWN_STOCK_IMAGES.some((stock) => img.includes(stock)))
    .slice(0, 8);

  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const BOILERPLATE_DESCRIPTIONS = [
    'new salon partner onboarding with book my salon',
    'new salon partner onboarding with aurelia',
    'a premier luxury salon dedicated to bespoke hair styling, therapeutic head spa rituals, and rejuvenating wellness experiences'
  ];

  const rawDesc = salon.description?.trim() || '';
  const isBoilerplate = BOILERPLATE_DESCRIPTIONS.some((b) => rawDesc.toLowerCase().startsWith(b) || rawDesc.toLowerCase() === b);
  const hasRealDescription = rawDesc.length > 0 && !isBoilerplate;
  const [liveOffers, setLiveOffers] = useState<SalonOffer[]>([]);
  const [reviewsList, setReviewsList] = useState<ReviewData[]>([]);
  const [reviewsSummary, setReviewsSummary] = useState<{ averageRating: number; totalReviews: number } | null>(null);
  const services = salon.services || [];
  const previewServices = services.slice(0, 4);

  const salonId = (salon.id || salon._id || '').toString();
  const ownerObj = typeof salon.ownerId === 'object' && salon.ownerId !== null ? (salon.ownerId as any) : null;
  const ownerName = ownerObj?.name || 'Verified Salon Partner';
  const ownerAvatar = ownerObj?.avatar || undefined;

  useEffect(() => {
    if (salonId) {
      offerService
        .getSalonOffers(salonId)
        .then((res) => {
          if (res?.data) setLiveOffers(res.data);
        })
        .catch(() => { });

      reviewService
        .getSalonReviews(salonId, 1, 5)
        .then((res) => {
          if (res?.data) setReviewsList(res.data);
          if (res?.summary) setReviewsSummary(res.summary);
        })
        .catch(() => { });
    }
  }, [salonId]);

  const allOffers = [...liveOffers, ...(salon.offers || [])].filter((offer, index, offers) => {
    const offerId = (offer._id || offer.id || '').toString();
    return !offerId || offers.findIndex(
      (candidate) => (candidate._id || candidate.id || '').toString() === offerId
    ) === index;
  });

  return (
    <View style={s.page}>
      {/* Top Floating App Bar */}
      <View style={s.topBar}>
        <Pressable onPress={onBack} style={s.iconButton}>
          <Text style={s.backIcon}>←</Text>
        </Pressable>

        <View style={s.topBarRight}>
          {onToggleFavorite && (
            <Pressable
              onPress={() => onToggleFavorite(salon)}
              style={[s.iconButton, isFavorite && s.iconButtonActive]}
            >
              <Text style={[s.heartIcon, isFavorite && s.heartIconActive]}>
                {isFavorite ? '♥' : '♡'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        {/* Hero Image & Gallery Swiper OR Neutral Placeholder */}
        {images.length === 0 ? (
          <View style={s.noImagesContainer}>
            <Text style={s.noImagesIcon}>📷</Text>
            <Text style={s.noImagesTitle}>Salon photos coming soon</Text>
            <Text style={s.noImagesSubtitle}>The salon owner has not uploaded gallery photos yet.</Text>
          </View>
        ) : (
          <>
            <View style={s.imageContainer}>
              <Image
                source={{ uri: images[activeImageIndex] || images[0] }}
                style={s.heroImage}
              />
              {images.length > 1 && (
                <View style={s.dotsRow}>
                  {images.map((_, idx) => (
                    <Pressable
                      key={idx}
                      onPress={() => setActiveImageIndex(idx)}
                      style={[s.dot, idx === activeImageIndex && s.dotActive]}
                    />
                  ))}
                </View>
              )}
            </View>

            {/* Thumbnail Row */}
            {images.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.thumbRow}
              >
                {images.map((img, i) => (
                  <Pressable
                    key={i}
                    onPress={() => setActiveImageIndex(i)}
                    style={[s.thumbWrap, i === activeImageIndex && s.thumbWrapActive]}
                  >
                    <Image source={{ uri: img }} style={s.thumbImg} />
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </>
        )}

        {/* Salon Headline & Ratings */}
        <View style={s.detailsBody}>
          <View style={s.badgeRow}>
            <View style={s.verifiedPill}>
              <Text style={s.verifiedText}>✓ Super Admin Approved</Text>
            </View>
            <View style={s.statusPill}>
              <Text style={s.statusText}>ACTIVE PARTNER</Text>
            </View>
          </View>

          <Text style={s.salonName}>{salon.name || salon.salonName}</Text>

          {/* Rating, Reviews & Starting Price (Real data only) */}
          <View style={s.ratingRow}>
            {typeof salon.rating === 'number' && salon.rating > 0 ? (
              <>
                <View style={s.ratingBox}>
                  <Text style={s.star}>★</Text>
                  <Text style={s.ratingVal}>{salon.rating}</Text>
                  {Boolean(salon.reviews) && (
                    <Text style={s.reviewsVal}>({salon.reviews} reviews)</Text>
                  )}
                </View>
                {Boolean(salon.startingPrice) && <Text style={s.bullet}>•</Text>}
              </>
            ) : (
              <>
                <View style={s.verifiedPartnerPill}>
                  <Text style={s.verifiedPartnerText}>✦ Atelier Verified Partner</Text>
                </View>
                {Boolean(salon.startingPrice) && <Text style={s.bullet}>•</Text>}
              </>
            )}
            {Boolean(salon.startingPrice) && (
              <Text style={s.startingPrice}>{salon.startingPrice}</Text>
            )}
          </View>

          {/* Distance and Full Address */}
          <View style={s.infoCard}>
            <View style={s.infoLine}>
              <Text style={s.infoIcon}>📍</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.infoTitle}>Location & Distance</Text>
                <Text style={s.infoBody}>
                  {formatLocation(salon.location, salon.city, salon.address)}
                </Text>
                {salon.distance && (
                  <Text style={s.distanceBadge}>
                    {salon.distance === 'Distance unavailable'
                      ? 'Distance unavailable'
                      : salon.distance.includes('approx')
                        ? salon.distance
                        : `Approx ${salon.distance} away`}
                  </Text>
                )}
                {formatCoordinates(salon.coordinates || salon.location) ? (
                  <Text style={s.coordsText}>
                    GPS: {formatCoordinates(salon.coordinates || salon.location)}
                  </Text>
                ) : null}
              </View>
            </View>

            {Boolean(salon.phone?.trim()) && (
              <>
                <View style={s.cardDivider} />
                <View style={s.infoLine}>
                  <Text style={s.infoIcon}>📞</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.infoTitle}>Contact & Inquiries</Text>
                    <Text style={s.infoBody}>{salon.phone?.trim()}</Text>
                  </View>
                </View>
              </>
            )}
          </View>
          
          {/* Verified Salon Host & Owner Profile */}
          <View style={s.ownerCard}>
            <View style={s.ownerCardInner}>
              <Avatar
                uri={ownerAvatar}
                name={ownerName}
                size={48}
                borderColor={colors.gold}
                borderWidth={1.5}
                backgroundColor="#231E18"
                textColor={colors.gold}
              />
              <View style={s.ownerCardTextCol}>
                <View style={s.ownerBadgeRow}>
                  <Text style={s.ownerCategoryLabel}>VERIFIED SALON HOST</Text>
                  <Text style={s.ownerVerifiedTick}>✦</Text>
                </View>
                <Text style={s.ownerNameText}>{ownerName}</Text>
                <Text style={s.ownerRoleSub}>Salon Director • {salon.salonName || salon.name}</Text>
              </View>
            </View>
          </View>

          {/* Active Offers Section */}
          {allOffers.length > 0 && (
            <View style={s.offersCard}>
              <View style={s.offersHeader}>
                <Text style={s.offersIcon}>🔥</Text>
                <Text style={s.offersHeading}>SPECIAL SALON OFFERS & DEALS</Text>
              </View>
              {allOffers.map((off: any, idx) => {
                const discountText =
                  off.discountPercent != null
                    ? `${off.discountPercent}% OFF`
                    : off.discountType === 'PERCENTAGE'
                      ? `${off.discountValue}% OFF`
                      : `₹${off.discountValue} OFF`;

                const validText = off.endDate
                  ? `Valid until ${new Date(off.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                  : off.validUntil || '';

                const offId = (off._id || off.id || '').toString();
                const offerKey = offId
                  ? `salon-details-${salonId}-offer-${offId}`
                  : `salon-details-${salonId}-offer-${idx}`;

                return (
                  <View key={offerKey} style={s.offerItem}>
                    <View style={s.offerTagWrap}>
                      <Text style={s.offerTag}>{discountText}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.offerTitle}>{off.title}</Text>
                      <Text style={s.offerDesc}>{off.description}</Text>
                      {off.code ? (
                        <Text style={s.offerCodeText}>
                          Promo Code: <Text style={s.boldCode}>{off.code}</Text>
                        </Text>
                      ) : validText ? (
                        <Text style={s.offerCodeText}>
                          ⏱ <Text style={s.boldCode}>{validText}</Text>
                        </Text>
                      ) : null}

                      {/* Real Price Breakdown */}
                      {Boolean(off.finalPrice && off.originalPrice) && (
                        <View style={s.offerPriceRow}>
                          <Text style={s.offerFinalPrice}>₹{off.finalPrice}</Text>
                          <Text style={s.offerOriginalPrice}>₹{off.originalPrice}</Text>
                          {Boolean(off.discountAmount) && (
                            <Text style={s.offerSavingsBadge}>Save ₹{off.discountAmount}</Text>
                          )}
                        </View>
                      )}

                      {onBookService && (
                        <Pressable
                          style={s.bookOfferBtn}
                          onPress={() => {
                            const targetSvc = off.applicableService && off.applicableService !== 'ALL'
                              ? services.find(
                                (s) =>
                                  s.id === off.applicableService ||
                                  (s as any)._id === off.applicableService ||
                                  s.name.toLowerCase() === off.applicableService.toLowerCase()
                              )
                              : undefined;
                            onBookService(salon, targetSvc, off);
                          }}
                        >
                          <Text style={s.bookOfferBtnText}>Book with Deal →</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* About Section - Only shown if owner provided actual description */}
          {hasRealDescription && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>ABOUT THIS SALON</Text>
              <Text style={s.description}>{rawDesc}</Text>
            </View>
          )}

          {/* Services Menu Preview */}
          <View style={s.section}>
            <View style={s.servicesHeader}>
              <View>
                <Text style={s.sectionTitle}>SERVICES MENU</Text>
                <Text style={s.serviceCountText}>
                  {services.length} services available
                </Text>
              </View>
              <Pressable onPress={() => onViewServiceList(salon)} style={s.viewAllLink}>
                <Text style={s.viewAllLinkText}>View Full Menu →</Text>
              </Pressable>
            </View>

            {services.length === 0 ? (
              <View style={s.emptyServicesBox}>
                <Text style={s.emptyServicesIcon}>✂️</Text>
                <Text style={s.emptyServicesTitle}>Services not yet added by this salon</Text>
                <Text style={s.emptyServicesText}>
                  This salon has not yet published its treatments or services catalog. Please check back later.
                </Text>
              </View>
            ) : (
              <View style={s.serviceList}>
                {previewServices.map((svc, i) => {
                  const pricing = getBestOfferForService(svc, allOffers);
                  return (
                    <View key={String(svc.id || (svc as any)._id || svc.name || `svc-${i}`)} style={s.serviceCard}>
                      <View style={{ flex: 1 }}>
                        <View style={s.svcTitleRow}>
                          <Text style={s.svcName}>{svc.name}</Text>
                          {svc.category && (
                            <View style={s.categoryTag}>
                              <Text style={s.categoryTagText}>{svc.category}</Text>
                            </View>
                          )}
                        </View>

                        {svc.description ? (
                          <Text style={s.svcDesc} numberOfLines={2}>
                            {svc.description}
                          </Text>
                        ) : null}

                        {pricing.hasDiscount && pricing.appliedOffer ? (
                          <View style={s.offerNoticePill}>
                            <Text style={s.offerNoticeIcon}>🔥</Text>
                            <Text style={s.offerNoticeText} numberOfLines={1}>
                              {pricing.appliedOffer.title}
                            </Text>
                          </View>
                        ) : null}

                        <View style={s.svcMetaRow}>
                          <Text style={s.svcDuration}>
                            ⏱ {svc.durationMinutes ? `${svc.durationMinutes} mins` : svc.duration || '45 mins'}
                          </Text>
                          <Text style={s.bullet}>•</Text>

                          {pricing.hasDiscount ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={s.originalPriceStrikethrough}>₹{pricing.originalPrice}</Text>
                              <Text style={s.discountedPrice}>₹{pricing.finalPrice}</Text>
                              <View style={s.discountBadge}>
                                <Text style={s.discountBadgeText}>{pricing.discountLabel}</Text>
                              </View>
                            </View>
                          ) : (
                            <Text style={s.svcPrice}>₹{svc.price}</Text>
                          )}

                          {onBookService && (
                            <Pressable
                              onPress={() => onBookService(salon, svc, pricing.appliedOffer)}
                              style={s.bookSvcBtn}
                            >
                              <Text style={s.bookSvcBtnText}>Book →</Text>
                            </Pressable>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {services.length > 4 && (
              <View style={{ marginTop: 12 }}>
                <SecondaryButton
                  label={`View All ${services.length} Services`}
                  onPress={() => onViewServiceList(salon)}
                />
              </View>
            )}
          </View>

          {/* Active Booking Guarantee Card */}
          <View style={s.bookingNoticeCard}>
            <View style={s.noticeHeader}>
              <Text style={s.noticeIcon}>📅</Text>
              <Text style={s.noticeTitle}>Continuous Slot Availability Enabled</Text>
            </View>
            <Text style={s.noticeCopy}>
              Book My Salon calculates continuous, real-time available time slots based on your
              selected treatment duration. Confirmed reservations are automatically
              protected against double-booking.
            </Text>
          </View>

          {/* Verified Customer Reviews Section */}
          <View style={s.reviewsSection}>
            <View style={s.reviewsHeader}>
              <View>
                <Text style={s.reviewsEyebrow}>FEEDBACK & RATINGS</Text>
                <Text style={s.reviewsTitle}>Verified Customer Reviews</Text>
              </View>
              {onViewAllReviews ? (
                <Pressable
                  onPress={() => onViewAllReviews(salonId, salon.salonName || salon.name)}
                  style={s.reviewsRatingBadge}
                >
                  <Text style={s.reviewsStar}>★</Text>
                  <Text style={s.reviewsRatingText}>{reviewsSummary?.averageRating || salon.rating || '5.0'}</Text>
                  <Text style={s.reviewsCountText}>({reviewsSummary?.totalReviews ?? salon.reviews ?? reviewsList.length}) View All →</Text>
                </Pressable>
              ) : reviewsSummary && reviewsSummary.totalReviews > 0 ? (
                <View style={s.reviewsRatingBadge}>
                  <Text style={s.reviewsStar}>★</Text>
                  <Text style={s.reviewsRatingText}>{reviewsSummary.averageRating}</Text>
                  <Text style={s.reviewsCountText}>({reviewsSummary.totalReviews})</Text>
                </View>
              ) : null}
            </View>

            {reviewsList.length > 0 ? (
              <View style={s.reviewsList}>
                {reviewsList.map((rev) => {
                  const customerName =
                    typeof rev.customerId === 'object' && rev.customerId?.name
                      ? rev.customerId.name
                      : 'Verified Customer';

                  return (
                    <View key={rev._id} style={s.reviewCard}>
                      <View style={s.reviewCardHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.reviewerName}>{customerName}</Text>
                          <View style={s.reviewStarsRow}>
                            {[1, 2, 3, 4, 5].map((st) => (
                              <Text
                                key={st}
                                style={[
                                  s.reviewStar,
                                  st <= rev.rating ? s.starActive : s.starInactive
                                ]}
                              >
                                ★
                              </Text>
                            ))}
                            <Text style={s.reviewScore}>{rev.rating}.0</Text>
                          </View>
                        </View>
                        <Text style={s.reviewTime}>
                          {new Date(rev.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </Text>
                      </View>

                      <Text style={s.reviewComment}>"{rev.comment}"</Text>

                      {rev.ownerReply && (
                        <View style={s.salonReplyCard}>
                          <Text style={s.salonReplyTitle}>Salon Response 💬</Text>
                          <Text style={s.salonReplyBody}>"{rev.ownerReply}"</Text>
                        </View>
                      )}
                    </View>
                  );
                })}

                {onViewAllReviews && (
                  <Pressable
                    onPress={() => onViewAllReviews(salonId, salon.salonName || salon.name)}
                    style={s.seeAllReviewsFooterBtn}
                  >
                    <Text style={s.seeAllReviewsFooterText}>
                      See all ratings & reviews ({reviewsSummary?.totalReviews ?? salon.reviews ?? reviewsList.length}) →
                    </Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <View style={s.noReviewsBox}>
                <Text style={s.noReviewsIcon}>⭐</Text>
                <Text style={s.noReviewsTitle}>No Reviews Yet</Text>
                <Text style={s.noReviewsText}>
                  Reviews are strictly accepted from verified customers within 48 hours of completing their appointment.
                </Text>
                {onViewAllReviews && (
                  <Pressable
                    onPress={() => onViewAllReviews(salonId, salon.salonName || salon.name)}
                    style={[s.seeAllReviewsFooterBtn, { marginTop: 12 }]}
                  >
                    <Text style={s.seeAllReviewsFooterText}>Explore All Platform Reviews →</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Fixed Bottom Action Bar */}
      <View style={s.bottomBar}>
        <View>
          <Text style={s.bottomLabel}>Starting from</Text>
          <Text style={s.bottomPrice}>{salon.startingPrice || 'From ₹500'}</Text>
        </View>
        <View style={{ width: 190 }}>
          <PrimaryButton
            label="Book Appointment →"
            onPress={() => onBookService?.(salon)}
          />
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  topBar: {
    position: 'absolute',
    top: 40,
    left: 16,
    right: 16,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  iconButtonActive: {
    backgroundColor: '#FEE2E2'
  },
  backIcon: { fontSize: 18, fontWeight: '700', color: colors.ink },
  heartIcon: { fontSize: 18, color: colors.ink },
  heartIconActive: { color: '#DC2626' },
  content: { paddingBottom: 110 },
  noImagesContainer: {
    height: 220,
    backgroundColor: '#F3EFEA',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  noImagesIcon: {
    fontSize: 42,
    marginBottom: 8
  },
  noImagesTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.2,
    marginBottom: 4
  },
  noImagesSubtitle: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center'
  },
  imageContainer: {
    position: 'relative',
    height: 280,
    backgroundColor: '#1E293B'
  },
  heroImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover'
  },
  dotsRow: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)'
  },
  dotActive: {
    width: 18,
    backgroundColor: '#FFFFFF'
  },
  thumbRow: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  thumbWrap: {
    width: 58,
    height: 58,
    borderRadius: radius.sm,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent'
  },
  thumbWrapActive: {
    borderColor: colors.gold
  },
  thumbImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  detailsBody: { padding: 22 },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10
  },
  verifiedPill: {
    backgroundColor: '#ECFDF5',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#6EE7B7'
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065F46'
  },
  statusPill: {
    backgroundColor: colors.goldSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.ink
  },
  salonName: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.5,
    lineHeight: 32
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8
  },
  ratingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  star: { fontSize: 15, color: colors.gold },
  ratingVal: { fontSize: 14, fontWeight: '800', color: colors.ink },
  reviewsVal: { fontSize: 13, color: colors.muted },
  verifiedPartnerPill: {
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3
  },
  verifiedPartnerText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.goldDark,
    letterSpacing: 0.3
  },
  bullet: { color: colors.muted, fontSize: 14 },
  startingPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.goldDark
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    marginVertical: 18,
    borderWidth: 1,
    borderColor: colors.border
  },
  infoLine: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start'
  },
  infoIcon: { fontSize: 20 },
  infoTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: colors.gold,
    marginBottom: 2
  },
  infoBody: {
    fontSize: 13,
    color: colors.ink,
    fontWeight: '600',
    lineHeight: 18
  },
  distanceBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gold,
    marginTop: 3
  },
  coordsText: {
    fontSize: 10,
    color: colors.muted,
    marginTop: 2
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12
  },
  ownerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
    padding: 14,
    marginBottom: 20
  },
  ownerCardInner: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  ownerCardTextCol: {
    marginLeft: 14,
    flex: 1
  },
  ownerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2
  },
  ownerCategoryLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.gold,
    letterSpacing: 0.8
  },
  ownerVerifiedTick: {
    fontSize: 11,
    color: colors.gold,
    fontWeight: '800'
  },
  ownerNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.2
  },
  ownerRoleSub: {
    fontSize: 12,
    color: colors.subtle,
    marginTop: 1
  },
  offersCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FCD34D'
  },
  offersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6
  },
  offersIcon: { fontSize: 16 },
  offersHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
    letterSpacing: 1
  },
  offerItem: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 8
  },
  offerTagWrap: {
    backgroundColor: '#D97706',
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start'
  },
  offerTag: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  offerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink
  },
  offerDesc: {
    fontSize: 11,
    color: colors.muted,
    marginVertical: 3,
    lineHeight: 16
  },
  offerCodeText: {
    fontSize: 11,
    color: '#92400E'
  },
  boldCode: {
    fontWeight: '800',
    color: '#78350F'
  },
  section: {
    marginBottom: 22
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.gold,
    marginBottom: 8
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.ink
  },
  servicesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  serviceCountText: {
    fontSize: 12,
    color: colors.muted
  },
  viewAllLink: {
    paddingVertical: 2
  },
  viewAllLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gold
  },
  serviceList: {
    gap: 10
  },
  serviceCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border
  },
  svcTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  svcName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
    flex: 1
  },
  categoryTag: {
    backgroundColor: colors.goldSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill
  },
  categoryTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.ink
  },
  svcDesc: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 17,
    marginBottom: 8
  },
  svcMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4
  },
  svcDuration: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted
  },
  svcPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.gold
  },
  originalPriceStrikethrough: {
    fontSize: 12,
    color: colors.muted,
    textDecorationLine: 'line-through',
    fontWeight: '600'
  },
  discountedPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.goldDark
  },
  discountBadge: {
    backgroundColor: '#059669',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs
  },
  discountBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  offerNoticePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.goldSoft,
    borderRadius: radius.xs,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginBottom: 6,
    gap: 4
  },
  offerNoticeIcon: {
    fontSize: 10
  },
  offerNoticeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.goldDark,
    flex: 1
  },
  bookOfferBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: colors.ink,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill
  },
  bookOfferBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  bookSvcBtn: {
    marginLeft: 'auto',
    backgroundColor: colors.ink,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill
  },
  bookSvcBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  bookingNoticeCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    marginTop: 10
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6
  },
  noticeIcon: { fontSize: 20 },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink
  },
  noticeCopy: {
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 18
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingBottom: 10
  },
  bottomLabel: {
    fontSize: 11,
    color: colors.muted
  },
  bottomPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink
  },
  emptyServicesBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    alignItems: 'center',
    marginVertical: 8
  },
  emptyServicesIcon: { fontSize: 24, marginBottom: 6 },
  emptyServicesTitle: { fontSize: 14, fontWeight: '700', color: colors.ink, marginBottom: 4 },
  emptyServicesText: { fontSize: 12, color: colors.muted, textAlign: 'center', lineHeight: 18 },
  offerPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6
  },
  offerFinalPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.goldDark
  },
  offerOriginalPrice: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
    textDecorationLine: 'line-through'
  },
  offerSavingsBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  reviewsSection: {
    marginTop: 20,
    marginBottom: 10
  },
  reviewsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12
  },
  reviewsEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.gold,
    marginBottom: 2
  },
  reviewsTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink
  },
  reviewsRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4
  },
  reviewsStar: {
    fontSize: 14,
    color: '#D97706'
  },
  reviewsRatingText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E'
  },
  reviewsCountText: {
    fontSize: 11,
    color: '#B45309',
    fontWeight: '600'
  },
  reviewsList: {
    gap: 12
  },
  reviewCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border
  },
  reviewCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink
  },
  reviewStarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2
  },
  reviewStar: {
    fontSize: 14
  },
  starActive: {
    color: '#F59E0B'
  },
  starInactive: {
    color: '#E5E7EB'
  },
  reviewScore: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink,
    marginLeft: 4
  },
  reviewTime: {
    fontSize: 11,
    color: colors.muted
  },
  reviewComment: {
    fontSize: 13,
    color: colors.ink,
    lineHeight: 18,
    fontStyle: 'italic'
  },
  salonReplyCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: radius.sm,
    padding: 10,
    marginTop: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold
  },
  salonReplyTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 2
  },
  salonReplyBody: {
    fontSize: 12,
    color: '#374151',
    fontStyle: 'italic'
  },
  noReviewsBox: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border
  },
  noReviewsIcon: {
    fontSize: 28,
    marginBottom: 6
  },
  noReviewsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 4
  },
  noReviewsText: {
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 18
  },
  seeAllReviewsFooterBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.goldSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gold,
    marginTop: 10
  },
  seeAllReviewsFooterText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.gold
  }
});
