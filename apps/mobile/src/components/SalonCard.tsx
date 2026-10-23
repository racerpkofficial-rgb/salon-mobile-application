import React, { useState } from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { Sparkles, Image as ImageIcon } from 'lucide-react-native';
import { colors, radius, typography } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { Salon } from '../types';
import { formatLocation } from '../utils/location';

const KNOWN_STOCK_IMAGES = [
  'images.unsplash.com/photo-1560066984-138dadb4c035',
  'images.unsplash.com/photo-1521590832167-7bcbfaa6381f',
  'images.unsplash.com/photo-1562322140-8baeececf3df'
];

export function isLegacyStockImage(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return KNOWN_STOCK_IMAGES.some((stock) => url.includes(stock));
}

interface SalonCardProps {
  salon: Salon;
  onPress?: (salon: Salon) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (salon: Salon) => void;
}

export function SalonCard({
  salon,
  onPress,
  isFavorite = false,
  onToggleFavorite
}: SalonCardProps) {
  const { colors, isDark } = useTheme();

  // Collect actual uploaded photos: salon.images first, then salon.image
  const rawList = [
    ...(Array.isArray(salon.images) ? salon.images : []),
    salon.image
  ];

  const validImages = rawList
    .filter((img): img is string => typeof img === 'string' && img.trim().length > 0)
    .filter((img) => !isLegacyStockImage(img));

  const [imageError, setImageError] = useState(false);
  const [activeImgIndex, setActiveImgIndex] = useState(0);

  const currentImageUrl = (!imageError && validImages.length > 0)
    ? validImages[activeImgIndex] || validImages[0]
    : null;

  const previewServices = (salon.services || []).slice(0, 3);
  const offer = salon.offers?.[0];
  const displayLocation = formatLocation(salon.location, salon.city, salon.address);
  const reviewCount = typeof salon.reviews === 'number' && salon.reviews > 0 ? salon.reviews : 0;
  const hasRealRating = reviewCount > 0 && typeof salon.rating === 'number' && salon.rating > 0;

  const handleNextPhoto = (e: any) => {
    if (validImages.length > 1) {
      e.stopPropagation?.();
      setActiveImgIndex((prev) => (prev + 1) % validImages.length);
    }
  };

  const renderHeroContent = () => (
    <>
      <View style={s.topRow}>
        {hasRealRating ? (
          <View style={[s.ratingBadge, { backgroundColor: isDark ? 'rgba(27, 23, 20, 0.95)' : 'rgba(255, 255, 255, 0.95)', borderColor: colors.border }]}>
            <Text style={s.starIcon}>★</Text>
            <Text style={[s.ratingScore, { color: isDark ? '#F8F4EE' : colors.espresso }]}>{Number(salon.rating).toFixed(1)}</Text>
            <Text style={[s.reviewCount, { color: colors.muted }]}>({reviewCount})</Text>
          </View>
        ) : (
          <View style={[s.partnerBadge, { backgroundColor: isDark ? 'rgba(27, 23, 20, 0.95)' : 'rgba(255, 255, 255, 0.95)', borderColor: colors.border }]}>
            <Text style={[s.partnerBadgeText, { color: colors.muted }]}>No reviews yet (0)</Text>
          </View>
        )}

        <View style={s.topActions}>
          {validImages.length > 1 && (
            <Pressable
              onPress={handleNextPhoto}
              style={s.photoCountBadge}
              hitSlop={6}
            >
              <Text style={s.photoCountText}>📷 {activeImgIndex + 1}/{validImages.length}</Text>
            </Pressable>
          )}

          <View style={s.verifiedBadge}>
            <Text style={s.verifiedText}>✓ Verified</Text>
          </View>

          {onToggleFavorite && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isFavorite ? 'Remove from saved' : 'Save salon'}
              onPress={(e) => {
                e.stopPropagation?.();
                onToggleFavorite(salon);
              }}
              hitSlop={10}
              style={[s.favButton, isFavorite && s.favButtonActive]}
            >
              <Text style={[s.favIcon, isFavorite && s.favIconActive]}>
                {isFavorite ? '♥' : '♡'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Footer Pills over Image or Placeholder */}
      <View style={s.imageFooter}>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          {Boolean(salon.startingPrice) && (
            <View style={s.pricePill}>
              <Text style={s.pricePillText}>{salon.startingPrice}</Text>
            </View>
          )}
          {Boolean(salon.distance && salon.distance !== 'Distance unavailable') && (
            <View style={s.distancePill}>
              <Text style={s.distancePillText}>📍 {salon.distance}</Text>
            </View>
          )}
        </View>

        {validImages.length > 1 && (
          <View style={s.dotsRow}>
            {validImages.map((_, i) => (
              <View
                key={i}
                style={[s.dotIndicator, i === activeImgIndex && s.dotIndicatorActive]}
              />
            ))}
          </View>
        )}
      </View>
    </>
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Salon: ${salon.name || salon.salonName}`}
      style={({ pressed }) => [
        s.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && s.cardPressed
      ]}
      onPress={() => onPress?.(salon)}
    >
      {/* Hero Section: Real Image OR Neutral Placeholder */}
      {currentImageUrl ? (
        <ImageBackground
          source={{ uri: currentImageUrl }}
          style={s.imageBackground}
          imageStyle={s.imageInner}
          onError={() => setImageError(true)}
        >
          {renderHeroContent()}
        </ImageBackground>
      ) : (
        <View style={[s.imageBackground, s.placeholderBackground, { backgroundColor: isDark ? '#26201B' : '#F5EFE6' }]}>
          <View style={s.placeholderCenter}>
            <View style={[s.placeholderIconBox, { backgroundColor: isDark ? '#332B25' : '#FFFFFF' }]}>
              <Sparkles size={20} color={colors.gold} />
            </View>
            <Text style={[s.placeholderName, { color: colors.ink }]} numberOfLines={1}>
              {salon.name || salon.salonName}
            </Text>
            <Text style={[s.placeholderMeta, { color: colors.muted }]}>
              Verified Salon Partner • Photos coming soon
            </Text>
          </View>
          {renderHeroContent()}
        </View>
      )}

      {/* Card Body */}
      <View style={[s.body, { backgroundColor: colors.surface }]}>
        <View style={s.titleRow}>
          <Text style={[s.name, { color: colors.ink }]} numberOfLines={1}>
            {salon.name || salon.salonName}
          </Text>
        </View>

        <Text style={[s.locationText, { color: colors.muted }]} numberOfLines={1}>
          📍 {displayLocation}
        </Text>

        {/* Services Chips */}
        {previewServices.length > 0 && (
          <View style={s.servicesRow}>
            {previewServices.map((svc, i) => (
              <View
                key={svc.id || svc.name || i}
                style={[
                  s.serviceChip,
                  {
                    backgroundColor: isDark ? '#26201B' : '#FAF6F0',
                    borderColor: colors.border
                  }
                ]}
              >
                <Text
                  style={[s.serviceChipText, { color: isDark ? '#F5E4B8' : colors.espresso }]}
                  numberOfLines={1}
                >
                  {svc.name}
                </Text>
              </View>
            ))}
            {(salon.services?.length || 0) > 3 && (
              <View
                style={[
                  s.moreServicesChip,
                  {
                    backgroundColor: isDark ? '#2B2319' : '#F6EFE6',
                    borderColor: colors.border
                  }
                ]}
              >
                <Text style={[s.moreServicesText, { color: colors.gold }]}>
                  +{(salon.services?.length || 0) - 3} more
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Promotional Offer Banner if present */}
        {offer && (
          <View style={[s.offerBanner, { backgroundColor: isDark ? '#2D2013' : '#FDF6EB', borderColor: isDark ? '#543818' : '#F0DEC2' }]}>
            <Text style={s.offerIcon}>🏷️</Text>
            <Text style={[s.offerText, { color: isDark ? '#F5E4B8' : '#8A5D1E' }]} numberOfLines={1}>
              {offer.discountPercent}% OFF with code{' '}
              <Text style={[s.offerCode, { color: isDark ? '#F8F4EE' : '#5A3C10' }]}>{offer.code}</Text>
            </Text>
          </View>
        )}

        {/* Action Row */}
        <View style={[s.actionRow, { borderTopColor: colors.border }]}>
          <Text style={[s.actionText, { color: colors.gold }]}>View Services & Availability</Text>
          <Text style={[s.actionArrow, { color: colors.gold }]}>→</Text>
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: colors.espresso,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2
  },
  cardPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.99 }]
  },
  imageBackground: {
    height: 180,
    justifyContent: 'space-between',
    padding: 12,
    position: 'relative',
    overflow: 'hidden'
  },
  placeholderBackground: {
    backgroundColor: '#FAF5EE',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  placeholderCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20
  },
  placeholderIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.espresso,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2
  },
  placeholderName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.espresso,
    textAlign: 'center',
    marginBottom: 2
  },
  placeholderMeta: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '500',
    textAlign: 'center'
  },
  photoCountBadge: {
    backgroundColor: 'rgba(48, 35, 31, 0.82)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill
  },
  photoCountText: {
    color: '#FFFCF7',
    fontSize: 10,
    fontWeight: '700'
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  dotIndicator: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.5)'
  },
  dotIndicatorActive: {
    width: 14,
    backgroundColor: colors.gold,
    borderRadius: 3
  },
  imageInner: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border
  },
  starIcon: {
    fontSize: 12,
    color: colors.gold,
    marginRight: 4
  },
  ratingScore: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.espresso
  },
  reviewCount: {
    fontSize: 11,
    color: colors.muted,
    marginLeft: 3
  },
  partnerBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border
  },
  partnerBadgeText: {
    ...typography.brandOverline,
    color: colors.espresso,
    fontSize: 9
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  verifiedBadge: {
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: colors.successBorder,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.success
  },
  favButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border
  },
  favButtonActive: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerBorder
  },
  favIcon: {
    fontSize: 16,
    color: colors.espresso
  },
  favIconActive: {
    color: colors.danger
  },
  imageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  pricePill: {
    backgroundColor: 'rgba(48, 35, 31, 0.88)',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  pricePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFCF7'
  },
  distancePill: {
    backgroundColor: 'rgba(48, 35, 31, 0.88)',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  distancePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.champagne
  },
  body: {
    padding: 16
  },
  titleRow: {
    marginBottom: 4
  },
  name: {
    ...typography.title,
    color: colors.espresso
  },
  locationText: {
    ...typography.bodySmall,
    color: colors.muted,
    marginBottom: 12
  },
  servicesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12
  },
  serviceChip: {
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  serviceChipText: {
    ...typography.caption,
    color: colors.espresso
  },
  moreServicesChip: {
    backgroundColor: colors.champagne,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  moreServicesText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.espresso
  },
  offerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.goldLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12
  },
  offerIcon: {
    fontSize: 12,
    marginRight: 6
  },
  offerText: {
    ...typography.caption,
    color: colors.espresso,
    flex: 1
  },
  offerCode: {
    fontWeight: '700',
    color: colors.goldDark
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight
  },
  actionText: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.espresso
  },
  actionArrow: {
    fontSize: 15,
    color: colors.gold
  }
});