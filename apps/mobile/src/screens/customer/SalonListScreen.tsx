import { useMemo, useState } from 'react';
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
import {
  calculateHaversineDistance,
  CustomerLocationState,
  extractCoordinates,
  isValidCoordinate,
  normalizeSalonLocation
} from '../../utils/location';

const CITIES = ['All', 'Bengaluru', 'Tiruchirappalli', 'Chennai', 'Mumbai', 'Delhi', 'Hyderabad'];
const CATEGORIES = ['All', 'Hair', 'Skin', 'Spa', 'Nails', 'Bridal'];
type SortOption = 'RECOMMENDED' | 'NEAREST' | 'RATING' | 'PRICE_LOW';

interface SalonListScreenProps {
  salons: Salon[];
  initialCity?: string;
  initialCategory?: string;
  onSelectSalon: (salon: Salon) => void;
  favorites: string[];
  onToggleFavorite: (salon: Salon) => void;
  onBack: () => void;
  customerLocation?: CustomerLocationState;
}

export function SalonListScreen({
  salons,
  initialCity = 'All',
  initialCategory = 'All',
  onSelectSalon,
  favorites,
  onToggleFavorite,
  onBack,
  customerLocation
}: SalonListScreenProps) {
  const [selectedCity, setSelectedCity] = useState(initialCity);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [sortBy, setSortBy] = useState<SortOption>('RECOMMENDED');

  const filteredAndSortedSalons = useMemo(() => {
    let list = salons.map(normalizeSalonLocation).filter((s) => {
      const locStr = typeof s.location === 'string' ? s.location.toLowerCase() : '';
      const matchesCity =
        selectedCity === 'All' ||
        (s.city && s.city.toLowerCase() === selectedCity.toLowerCase()) ||
        (locStr && locStr.includes(selectedCity.toLowerCase()));

      const matchesCat =
        selectedCategory === 'All' ||
        (s.services &&
          s.services.some(
            (svc) =>
              (svc.category &&
                svc.category.toLowerCase().includes(selectedCategory.toLowerCase())) ||
              svc.name.toLowerCase().includes(selectedCategory.toLowerCase())
          ));

      return matchesCity && matchesCat;
    });

    if (sortBy === 'NEAREST') {
      const withDistance = list.map((s) => {
        let km: number | null = null;
        const sCoords = extractCoordinates(s) || s.coordinates;
        if ((s as any).distanceKm !== undefined && (s as any).distanceKm !== null) {
          km = (s as any).distanceKm;
        } else if (
          customerLocation?.coords &&
          isValidCoordinate(customerLocation.coords.latitude, customerLocation.coords.longitude) &&
          isValidCoordinate(sCoords?.latitude, sCoords?.longitude)
        ) {
          km = calculateHaversineDistance(
            customerLocation.coords.latitude,
            customerLocation.coords.longitude,
            sCoords!.latitude,
            sCoords!.longitude
          );
        }
        return { salon: s, km };
      });

      // Valid distances sorted ascending; missing/invalid placed at end
      withDistance.sort((a, b) => {
        if (a.km !== null && b.km !== null) return a.km - b.km;
        if (a.km !== null) return -1;
        if (b.km !== null) return 1;
        return 0;
      });

      list = withDistance.map((item) => item.salon);
    } else if (sortBy === 'RATING') {
      list = [...list].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortBy === 'PRICE_LOW') {
      const getMin = (s: Salon) => {
        if (!s.services?.length) return 500;
        return Math.min(
          ...s.services.map((x) =>
            typeof x.price === 'number' ? x.price : Number(x.price) || 500
          )
        );
      };
      list = [...list].sort((a, b) => getMin(a) - getMin(b));
    }

    return list;
  }, [salons, selectedCity, selectedCategory, sortBy, customerLocation]);

  return (
    <View style={s.page}>
      {/* Top Header */}
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backBtn}>
          <Text style={s.backText}>← Back</Text>
        </Pressable>
        <Text style={s.headerTitle}>All Verified Salons</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Filters & Sorting Bar */}
      <View style={s.filtersContainer}>
        {/* City Filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.pillScroll}
        >
          {CITIES.map((c) => {
            const active = selectedCity === c;
            return (
              <Pressable
                key={c}
                style={[s.pill, active && s.pillActive]}
                onPress={() => setSelectedCity(c)}
              >
                <Text style={[s.pillText, active && s.pillTextActive]}>{c}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Category Filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.pillScroll}
        >
          {CATEGORIES.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <Pressable
                key={cat}
                style={[s.pill, active && s.pillActiveGold]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={[s.pillText, active && s.pillTextActiveGold]}>{cat}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Sort Controls */}
        <View style={s.sortRow}>
          <Text style={s.sortLabel}>Sort by:</Text>
          <Pressable
            style={[s.sortBtn, sortBy === 'RECOMMENDED' && s.sortBtnActive]}
            onPress={() => setSortBy('RECOMMENDED')}
          >
            <Text style={[s.sortBtnText, sortBy === 'RECOMMENDED' && s.sortBtnTextActive]}>
              Featured
            </Text>
          </Pressable>
          <Pressable
            style={[s.sortBtn, sortBy === 'NEAREST' && s.sortBtnActive]}
            onPress={() => setSortBy('NEAREST')}
          >
            <Text style={[s.sortBtnText, sortBy === 'NEAREST' && s.sortBtnTextActive]}>
              Nearest 📍
            </Text>
          </Pressable>
          <Pressable
            style={[s.sortBtn, sortBy === 'RATING' && s.sortBtnActive]}
            onPress={() => setSortBy('RATING')}
          >
            <Text style={[s.sortBtnText, sortBy === 'RATING' && s.sortBtnTextActive]}>
              Top Rated ★
            </Text>
          </Pressable>
          <Pressable
            style={[s.sortBtn, sortBy === 'PRICE_LOW' && s.sortBtnActive]}
            onPress={() => setSortBy('PRICE_LOW')}
          >
            <Text style={[s.sortBtnText, sortBy === 'PRICE_LOW' && s.sortBtnTextActive]}>
              Price: Low
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Directory Count */}
      <View style={s.countRow}>
        <Text style={s.countText}>
          Showing {filteredAndSortedSalons.length} active platform salons
        </Text>
      </View>

      {/* Salons List */}
      <ScrollView
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredAndSortedSalons.map((salon) => {
          const salonId = (salon.id || salon._id || '').toString();
          const isFav = favorites.includes(salonId);
          return (
            <SalonCard
              key={salonId}
              salon={salon}
              onPress={onSelectSalon}
              isFavorite={isFav}
              onToggleFavorite={onToggleFavorite}
            />
          );
        })}

        {filteredAndSortedSalons.length === 0 && (
          <View style={s.emptyBox}>
            <Text style={s.emptyIcon}>🏢</Text>
            <Text style={s.emptyTitle}>No salons found</Text>
            <Text style={s.emptyCopy}>
              Try adjusting your city, category, or sorting filters.
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
    paddingTop: 14,
    paddingBottom: 12,

    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  backBtn: { paddingVertical: 4 },
  backText: { fontSize: 13, fontWeight: '700', color: colors.gold },
  headerTitle: { fontSize: 17, fontWeight: '800', color: colors.ink },
  filtersContainer: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  pillScroll: {
    paddingHorizontal: 20,
    paddingVertical: 4,
    gap: 8
  },
  pill: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  pillActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink
  },
  pillActiveGold: {
    backgroundColor: colors.goldSoft,
    borderColor: colors.gold
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink
  },
  pillTextActive: {
    color: '#FFFFFF'
  },
  pillTextActiveGold: {
    color: colors.ink
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 8
  },
  sortLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.gold,
    letterSpacing: 0.5
  },
  sortBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  sortBtnActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink
  },
  sortBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted
  },
  sortBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  countRow: {
    paddingHorizontal: 20,
    paddingVertical: 10
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40
  },
  emptyBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 24,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: colors.border
  },
  emptyIcon: { fontSize: 32, marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  emptyCopy: { fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: 4 }
});
