import React from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, typography } from '../constants/theme';
import { Salon } from '../types';
import { formatLocation } from '../utils/location';

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
  const imageUrl =
    salon.image ||
    salon.images?.[0] ||
    'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80';

  const previewServices = (salon.services || []).slice(0, 3);
  const offer = salon.offers?.[0];
  const displayLocation = formatLocation(salon.location, salon.city, salon.address);
  const hasRealRating = typeof salon.rating === 'number' && salon.rating > 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Salon: ${salon.name || salon.salonName}`}
      style={({ pressed }) => [s.card, pressed && s.cardPressed]}
      onPress={() => onPress?.(salon)}
    >
      {/* Hero Image Section */}
      <ImageBackground
        source={{ uri: imageUrl }}
        style={s.imageBackground}
        imageStyle={s.imageInner}
      >
        <View style={s.topRow}>
          {hasRealRating ? (
            <View style={s.ratingBadge}>
              <Text style={s.starIcon}>★</Text>
              <Text style={s.ratingScore}>{salon.rating}</Text>
              {Boolean(salon.reviews) && (
                <Text style={s.reviewCount}>({salon.reviews})</Text>
              )}
            </View>
          ) : (
            <View style={s.partnerBadge}>
              <Text style={s.partnerBadgeText}>Atelier Partner</Text>
            </View>
          )}

          <View style={s.topActions}>
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

        {/* Footer Pills over Image */}
        <View style={s.imageFooter}>
          {Boolean(salon.startingPrice) && (
            <View style={s.pricePill}>
              <Text style={s.pricePillText}>{salon.startingPrice}</Text>
            </View>
          )}
          {Boolean(salon.distance) && (
            <View style={s.distancePill}>
              <Text style={s.distancePillText}>📍 {salon.distance}</Text>
            </View>
          )}
        </View>
      </ImageBackground>

      {/* Card Body */}
      <View style={s.body}>
        <View style={s.titleRow}>
          <Text style={s.name} numberOfLines={1}>
            {salon.name || salon.salonName}
          </Text>
        </View>

        <Text style={s.locationText} numberOfLines={1}>
          📍 {displayLocation}
        </Text>

        {/* Services Chips */}
        {previewServices.length > 0 && (
          <View style={s.servicesRow}>
            {previewServices.map((svc, i) => (
              <View key={svc.id || svc.name || i} style={s.serviceChip}>
                <Text style={s.serviceChipText} numberOfLines={1}>
                  {svc.name}
                </Text>
              </View>
            ))}
            {(salon.services?.length || 0) > 3 && (
              <View style={s.moreServicesChip}>
                <Text style={s.moreServicesText}>
                  +{(salon.services?.length || 0) - 3} more
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Promotional Offer Banner if present */}
        {offer && (
          <View style={s.offerBanner}>
            <Text style={s.offerIcon}>🏷️</Text>
            <Text style={s.offerText} numberOfLines={1}>
              {offer.discountPercent}% OFF with code{' '}
              <Text style={s.offerCode}>{offer.code}</Text>
            </Text>
          </View>
        )}

        {/* Action Row */}
        <View style={s.actionRow}>
          <Text style={s.actionText}>View Services & Availability</Text>
          <Text style={s.actionArrow}>→</Text>
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
    padding: 12
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