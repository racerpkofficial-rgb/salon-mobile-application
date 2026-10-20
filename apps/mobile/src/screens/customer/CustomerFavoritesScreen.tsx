import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { SalonCard } from '../../components/SalonCard';
import { colors, radius } from '../../constants/theme';
import { Salon } from '../../types';

interface CustomerFavoritesScreenProps {
  favoriteSalons: Salon[];
  onSelectSalon: (salon: Salon) => void;
  onToggleFavorite: (salon: Salon) => void;
  onExplore: () => void;
}

export function CustomerFavoritesScreen({
  favoriteSalons,
  onSelectSalon,
  onToggleFavorite,
  onExplore
}: CustomerFavoritesScreenProps) {
  return (
    <View style={s.page}>
      {/* Top Header */}
      <View style={s.header}>
        <View>
          <Text style={s.eyebrow}>SAVED PLACES</Text>
          <Text style={s.title}>Your Favorites</Text>
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
              Keep track of your preferred verified salons for quick booking and special offers.
            </Text>
            <View style={s.list}>
              {favoriteSalons.map((salon) => {
                const salonId = (salon.id || salon._id || '').toString();
                return (
                  <SalonCard
                    key={salonId}
                    salon={salon}
                    onPress={onSelectSalon}
                    isFavorite={true}
                    onToggleFavorite={onToggleFavorite}
                  />
                );
              })}
            </View>
          </>
        ) : (
          <View style={s.emptyCard}>
            <Text style={s.emptyHeart}>♡</Text>
            <Text style={s.emptyTitle}>No saved salons yet</Text>
            <Text style={s.emptyCopy}>
              Tap the heart icon on any salon in the discovery feed or search results to
              save it here for effortless access.
            </Text>
            <Pressable onPress={onExplore} style={s.exploreBtn}>
              <Text style={s.exploreBtnText}>Discover Luxury Salons →</Text>
            </Pressable>
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
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 16,

    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: colors.gold
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.5,
    marginTop: 2
  },
  countBadge: {
    backgroundColor: colors.goldSoft,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.gold
  },
  countText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink
  },
  content: {
    padding: 22,
    paddingBottom: 40
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 19,
    marginBottom: 16
  },
  list: {
    gap: 12
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 32,
    alignItems: 'center',
    marginTop: 40,
    borderWidth: 1,
    borderColor: colors.border
  },
  emptyHeart: {
    fontSize: 44,
    color: colors.muted,
    marginBottom: 12
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink
  },
  emptyCopy: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20
  },
  exploreBtn: {
    marginTop: 20,
    backgroundColor: colors.ink,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: radius.pill
  },
  exploreBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF'
  }
});
