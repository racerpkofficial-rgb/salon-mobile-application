import React from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import {
  ArrowLeft,
  Heart,
  Trash2,
  Sparkles,
  MapPin,
  Star
} from 'lucide-react-native';
import { colors, radius, typography } from '../../constants/theme';
import { Salon } from '../../types';
import { formatLocation } from '../../utils/location';
import { dialogService } from '../../services/dialog.service';

interface ProfileFavoritesScreenProps {
  favoriteSalons: Salon[];
  onToggleFavorite: (salon: Salon) => void;
  onSelectSalon: (salon: Salon) => void;
  onBack: () => void;
}

export function ProfileFavoritesScreen({
  favoriteSalons,
  onToggleFavorite,
  onSelectSalon,
  onBack
}: ProfileFavoritesScreenProps) {
  const handleConfirmRemove = (salon: Salon) => {
    const salonName = salon.salonName || salon.name || 'this salon';
    dialogService.showConfirm(
      'Remove from Favourites?',
      `Are you sure you want to remove "${salonName}" from your saved favourites?`,
      () => {
        onToggleFavorite(salon);
        dialogService.showSuccess('Removed', `"${salonName}" has been removed from your favourites.`);
      },
      undefined,
      'Remove',
      'Cancel',
      true
    );
  };

  return (
    <View style={s.page}>
      {/* Header with Back button and Count */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Return to Profile"
            onPress={onBack}
            style={s.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={20} color={colors.espresso} />
          </Pressable>
          <View style={{ marginLeft: 12 }}>
            <Text style={s.eyebrow}>SAVED ATELIERS</Text>
            <Text style={s.title}>My Favourite Salons</Text>
          </View>
        </View>

        <View style={s.countBadge}>
          <Text style={s.countText}>{favoriteSalons.length}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {favoriteSalons.length > 0 ? (
          <>
            <Text style={s.subtitle}>
              Your curated luxury salons for effortless booking, special vouchers, and priority appointments.
            </Text>

            <View style={s.list}>
              {favoriteSalons.map((salon) => {
                const sId = (salon.id || salon._id || '').toString();
                const imgUri = salon.image || (salon.images && salon.images[0]);

                return (
                  <View key={sId} style={s.card}>
                    <Pressable
                      onPress={() => onSelectSalon(salon)}
                      style={s.cardContent}
                    >
                      {imgUri ? (
                        <Image source={{ uri: imgUri }} style={s.thumb} />
                      ) : (
                        <View style={s.thumbPlaceholder}>
                          <Sparkles size={24} color={colors.goldDark} />
                        </View>
                      )}

                      <View style={s.cardDetails}>
                        <Text style={s.salonName} numberOfLines={1}>
                          {salon.salonName || salon.name}
                        </Text>
                        <Text style={s.salonLoc} numberOfLines={1}>
                          📍 {formatLocation(salon.location, salon.city, salon.address, 'Salon')}
                          {salon.distance && ` • ${salon.distance}`}
                        </Text>
                        <View style={s.ratingRow}>
                          <Star size={13} color="#D4AF37" fill="#D4AF37" />
                          <Text style={s.ratingValue}>{salon.rating?.toFixed(1) || '4.8'}</Text>
                          <Text style={s.reviewsCount}>({salon.reviews || 0} reviews)</Text>
                        </View>
                        {Boolean(salon.startingPrice) && (
                          <Text style={s.startingPrice}>{salon.startingPrice}</Text>
                        )}
                      </View>
                    </Pressable>

                    <View style={s.cardActions}>
                      <Pressable
                        onPress={() => onSelectSalon(salon)}
                        style={s.previewBtn}
                      >
                        <Text style={s.previewBtnText}>View Salon Details →</Text>
                      </Pressable>

                      <Pressable
                        onPress={() => handleConfirmRemove(salon)}
                        style={s.removeBtn}
                        accessibilityLabel={`Remove ${salon.salonName || salon.name} from favourites`}
                      >
                        <Trash2 size={16} color="#D9534F" />
                        <Text style={s.removeBtnText}>Remove</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        ) : (
          <View style={s.emptyBox}>
            <Heart size={44} color={colors.subtle} style={{ marginBottom: 12 }} />
            <Text style={s.emptyTitle}>No favourite salons saved yet</Text>
            <Text style={s.emptyCopy}>
              Tap the heart icon on any salon in the Discover or Search screen to add it to your favourites for quick inspection and booking.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.goldDark
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.espresso,
    letterSpacing: -0.4,
    marginTop: 1
  },
  countBadge: {
    backgroundColor: colors.goldLight,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border
  },
  countText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.espresso
  },
  content: {
    padding: 20,
    paddingBottom: 40
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 19,
    marginBottom: 16
  },
  list: {
    gap: 14
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 2,
    shadowColor: colors.espresso,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    backgroundColor: colors.borderLight
  },
  thumbPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    backgroundColor: colors.champagne,
    alignItems: 'center',
    justifyContent: 'center'
  },
  cardDetails: {
    flex: 1,
    marginLeft: 14
  },
  salonName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.espresso
  },
  salonLoc: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4
  },
  ratingValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.espresso
  },
  reviewsCount: {
    fontSize: 11.5,
    color: colors.muted
  },
  startingPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.goldDark,
    marginTop: 2
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight
  },
  previewBtn: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.espresso
  },
  previewBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: '#FFF2F0',
    borderWidth: 1,
    borderColor: '#FFCCC7'
  },
  removeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D9534F',
    marginLeft: 4
  },
  emptyBox: {
    paddingVertical: 60,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 20
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.espresso,
    marginBottom: 6
  },
  emptyCopy: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 19
  }
});
