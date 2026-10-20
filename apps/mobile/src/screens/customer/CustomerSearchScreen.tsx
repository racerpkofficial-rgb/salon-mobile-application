import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { SalonCard } from '../../components/SalonCard';
import { colors, radius } from '../../constants/theme';
import { salonService } from '../../services/salon.service';
import { CustomerOffer, Salon } from '../../types';
import {
  calculateHaversineDistance,
  CustomerLocationState,
  extractCoordinates,
  formatDistance,
  getCitySearchPattern,
  normalizeSalonLocation
} from '../../utils/location';

const CITIES = ['All', 'Bengaluru', 'Tiruchirappalli', 'Chennai', 'Mumbai', 'Delhi', 'Hyderabad'];
const SERVICE_FILTERS = ['All', 'Hair', 'Skin', 'Facial', 'Spa', 'Nails', 'Bridal', 'Color'];

interface CustomerSearchScreenProps {
  salons: Salon[];
  initialQuery?: string;
  initialCity?: string;
  initialCategory?: string;
  onSelectSalon: (salon: Salon) => void;
  onSelectOffer?: (offer: CustomerOffer) => void;
  favorites: string[];
  onToggleFavorite: (salon: Salon) => void;
  onBack: () => void;
  customerLocation?: CustomerLocationState;
  onOpenLocationPicker?: () => void;
}

export function CustomerSearchScreen({
  salons,
  initialQuery = '',
  initialCity = 'All',
  initialCategory = 'All',
  onSelectSalon,
  onSelectOffer,
  favorites,
  onToggleFavorite,
  onBack,
  customerLocation,
  onOpenLocationPicker
}: CustomerSearchScreenProps) {
  const [query, setQuery] = useState(initialQuery);
  const [selectedCity, setSelectedCity] = useState(initialCity);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);

  const [apiResults, setApiResults] = useState<Salon[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchReqId = useRef(0);

  // Debounced API search with stale request cancellation
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed && selectedCity === 'All' && selectedCategory === 'All') {
      setApiResults([]);
      setIsSearching(false);
      return;
    }

    const currentReq = ++searchReqId.current;
    setIsSearching(true);

    const timer = setTimeout(async () => {
      try {
        const res = await salonService.getSalons({
          q: trimmed || undefined,
          city: selectedCity !== 'All' ? selectedCity : undefined,
          service: selectedCategory !== 'All' ? selectedCategory : undefined,
          lat: customerLocation?.coords?.latitude,
          lng: customerLocation?.coords?.longitude
        });

        if (currentReq === searchReqId.current && res?.data) {
          setApiResults((res.data || []).map(normalizeSalonLocation));
        }
      } catch {
        // quiet fallback
      } finally {
        if (currentReq === searchReqId.current) {
          setIsSearching(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [query, selectedCity, selectedCategory, customerLocation?.coords?.latitude, customerLocation?.coords?.longitude]);

  // Compute filtered search results merging in-memory & API results
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();

    // 1. In-memory filter on current salons prop
    const localMatches = salons.filter((salon) => {
      const nameMatch = !q || (salon.name || salon.salonName || '').toLowerCase().includes(q);
      const cityPattern = getCitySearchPattern(q);
      const cityTextMatch =
        !q ||
        (salon.city || '').toLowerCase().includes(q) ||
        (cityPattern && new RegExp(cityPattern, 'i').test(salon.city || ''));
      const addressMatch =
        !q ||
        (salon.address || '').toLowerCase().includes(q) ||
        (cityPattern && new RegExp(cityPattern, 'i').test(salon.address || ''));
      const descMatch = !q || (salon.description || '').toLowerCase().includes(q);
      const serviceTextMatch =
        !q ||
        (salon.services || []).some(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            (s.category && s.category.toLowerCase().includes(q))
        );

      const offerMatch =
        !q ||
        (salon.offers || []).some(
          (o) =>
            (o.title && o.title.toLowerCase().includes(q)) ||
            (o.description && o.description.toLowerCase().includes(q)) ||
            (o.applicableService && o.applicableService.toLowerCase().includes(q)) ||
            (o.code && o.code.toLowerCase().includes(q))
        );

      const matchesSearch =
        nameMatch || cityTextMatch || addressMatch || descMatch || serviceTextMatch || offerMatch;

      // City filter match
      const selectedCityPattern = selectedCity !== 'All' ? getCitySearchPattern(selectedCity) : '';
      const locStr = typeof salon.location === 'string' ? salon.location.toLowerCase() : '';
      const matchesCity =
        selectedCity === 'All' ||
        (salon.city && salon.city.toLowerCase() === selectedCity.toLowerCase()) ||
        (selectedCityPattern && new RegExp(selectedCityPattern, 'i').test(salon.city || '')) ||
        (locStr && locStr.includes(selectedCity.toLowerCase()));

      // Service filter match
      const matchesService =
        selectedCategory === 'All' ||
        (salon.services || []).some(
          (s) =>
            (s.category &&
              s.category.toLowerCase().includes(selectedCategory.toLowerCase())) ||
            s.name.toLowerCase().includes(selectedCategory.toLowerCase())
        );

      return matchesSearch && matchesCity && matchesService;
    });

    // 2. Merge API results avoiding duplicate salons
    const combined = [...localMatches];
    for (const apiSalon of apiResults) {
      const apiId = (apiSalon.id || apiSalon._id || '').toString();
      if (!combined.some((s) => (s.id || s._id || '').toString() === apiId)) {
        combined.push(apiSalon);
      }
    }

    // 3. Enrich distances and sort nearest-first if location coordinates available
    const enriched = combined.map((raw) => {
      const s = normalizeSalonLocation(raw);
      const sCoords = extractCoordinates(s) || s.coordinates;

      let distance = s.distance || 'Distance unavailable';
      let distanceKm: number | null = typeof s.distanceKm === 'number' ? s.distanceKm : null;

      if (
        customerLocation?.coords &&
        sCoords?.latitude &&
        sCoords?.longitude
      ) {
        distanceKm = calculateHaversineDistance(
          customerLocation.coords.latitude,
          customerLocation.coords.longitude,
          sCoords.latitude,
          sCoords.longitude
        );
        distance = formatDistance(distanceKm);
      }

      return {
        ...s,
        coordinates: sCoords,
        distance,
        distanceKm
      };
    });

    if (customerLocation?.coords) {
      enriched.sort((a, b) => {
        if (typeof a.distanceKm === 'number' && typeof b.distanceKm === 'number') {
          return a.distanceKm - b.distanceKm;
        }
        if (typeof a.distanceKm === 'number') return -1;
        if (typeof b.distanceKm === 'number') return 1;
        return 0;
      });
    }

    return enriched;
  }, [salons, apiResults, query, selectedCity, selectedCategory, customerLocation?.coords]);

  return (
    <View style={s.page}>
      {/* Top Search Header */}
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backBtn}>
          <Text style={s.backText}>← Back</Text>
        </Pressable>
        <Text style={s.headerTitle}>Search Salons</Text>
        {customerLocation && (
          <Pressable onPress={onOpenLocationPicker} style={s.locationChip}>
            <Text style={s.locationChipText} numberOfLines={1}>
              📍 {customerLocation.city || (customerLocation.isGps ? 'GPS' : 'Location')}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Search Input Bar */}
      <View style={s.searchContainer}>
        <View style={s.searchBar}>
          <Text style={s.searchIcon}>🔍</Text>
          <TextInput
            style={s.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Search salon, Trichy, haircut, service..."
            placeholderTextColor={colors.muted}
            autoFocus={false}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={10}>
              <Text style={s.clearIcon}>✕</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Filter Chips Bar */}
      <View style={s.filtersWrap}>
        {/* City Filter Row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filterRow}
        >
          <Text style={s.filterLabel}>City:</Text>
          {CITIES.map((city) => {
            const active = selectedCity === city;
            return (
              <Pressable
                key={city}
                style={[s.chip, active && s.chipActive]}
                onPress={() => setSelectedCity(city)}
              >
                <Text style={[s.chipText, active && s.chipTextActive]}>{city}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Service Category Row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filterRow}
        >
          <Text style={s.filterLabel}>Service:</Text>
          {SERVICE_FILTERS.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <Pressable
                key={cat}
                style={[s.chip, active && s.chipActiveGold]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={[s.chipText, active && s.chipTextActiveGold]}>
                  {cat}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Results Count Meta */}
      <View style={s.metaRow}>
        <Text style={s.countText}>
          {results.length} verified {results.length === 1 ? 'salon' : 'salons'} found
        </Text>
        {(query.length > 0 || selectedCity !== 'All' || selectedCategory !== 'All') && (
          <Pressable
            onPress={() => {
              setQuery('');
              setSelectedCity('All');
              setSelectedCategory('All');
            }}
          >
            <Text style={s.resetText}>Clear Filters</Text>
          </Pressable>
        )}
      </View>

      {/* Subtle Searching Indicator */}
      {isSearching && (
        <View style={s.searchingRow}>
          <ActivityIndicator size="small" color={colors.gold} />
          <Text style={s.searchingText}>Searching verified salons & services...</Text>
        </View>
      )}

      {/* Salons List */}
      <ScrollView
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
      >
        {results.map((salon) => {
          const salonId = (salon.id || salon._id || '').toString();
          const isFav = favorites.includes(salonId);
          const activeOffers = salon.offers || [];

          return (
            <View key={salonId} style={s.cardWrapper}>
              <SalonCard
                salon={salon}
                onPress={onSelectSalon}
                isFavorite={isFav}
                onToggleFavorite={onToggleFavorite}
              />
              {activeOffers.length > 0 && (
                <View style={s.attachedOffersBox}>
                  {activeOffers
                    .filter((off, idx, arr) => {
                      const oid = (off._id || off.id || off.code || '').toString();
                      return (
                        !oid ||
                        arr.findIndex((c) => (c._id || c.id || c.code || '').toString() === oid) ===
                          idx
                      );
                    })
                    .map((off, idx) => {
                      const offId = (off._id || off.id || off.code || '').toString();
                      const key = offId
                        ? `search-salon-${salonId}-offer-${offId}`
                        : `search-salon-${salonId}-offer-${idx}`;
                      const discountText =
                        off.discountLabel ||
                        (off.discountType === 'FIXED'
                          ? `₹${off.discountValue} OFF`
                          : `${off.discountValue || off.discountPercent || 20}% OFF`);

                      return (
                        <Pressable
                          key={key}
                          style={s.offerSnippetRow}
                          onPress={() =>
                            onSelectOffer?.({
                              ...off,
                              salonId: salon._id || salon.id,
                              salonName: salon.name || salon.salonName,
                              salon
                            })
                          }
                        >
                          <View style={s.offerTagBadge}>
                            <Text style={s.offerTagText}>🔥 {discountText}</Text>
                          </View>
                          <Text style={s.offerSnippetTitle} numberOfLines={1}>
                            {off.title}
                          </Text>
                          <Text style={s.viewOfferArrow}>View Offer →</Text>
                        </Pressable>
                      );
                    })}
                </View>
              )}
            </View>
          );
        })}

        {results.length === 0 && (
          <View style={s.emptyState}>
            <Text style={s.emptyIcon}>📍</Text>
            <Text style={s.emptyTitle}>No matching salons</Text>
            <Text style={s.emptyCopy}>
              We couldn't find any verified salons matching your search. Try changing the
              city or service filter.
            </Text>
            <Pressable
              style={s.resetFiltersBtn}
              onPress={() => {
                setQuery('');
                setSelectedCity('All');
                setSelectedCategory('All');
              }}
            >
              <Text style={s.resetFiltersText}>Reset Search & Filters</Text>
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
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,

    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  backBtn: { paddingVertical: 4 },
  backText: { fontSize: 13, fontWeight: '700', color: colors.gold },
  headerTitle: { fontSize: 17, fontWeight: '800', color: colors.ink },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    height: 48
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.ink,
    fontWeight: '500'
  },
  clearIcon: {
    fontSize: 14,
    color: colors.muted,
    paddingHorizontal: 4
  },
  filtersWrap: {
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 4,
    gap: 8
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.gold,
    letterSpacing: 0.5,
    marginRight: 4
  },
  chip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5
  },
  chipActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink
  },
  chipActiveGold: {
    backgroundColor: colors.goldSoft,
    borderColor: colors.gold
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink
  },
  chipTextActive: {
    color: '#FFFFFF'
  },
  chipTextActiveGold: {
    color: colors.ink
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted
  },
  resetText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gold
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40
  },
  emptyState: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 28,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: colors.border
  },
  emptyIcon: { fontSize: 32, marginBottom: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: colors.ink },
  emptyCopy: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19
  },
  resetFiltersBtn: {
    marginTop: 16,
    backgroundColor: colors.goldSoft,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: radius.pill
  },
  resetFiltersText: { fontSize: 12, fontWeight: '700', color: colors.ink },
  cardWrapper: {
    marginBottom: 16
  },
  attachedOffersBox: {
    marginTop: -8,
    backgroundColor: colors.surfaceWarm,
    borderBottomLeftRadius: radius.md,
    borderBottomRightRadius: radius.md,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.goldSoft,
    padding: 10,
    gap: 6
  },
  offerSnippetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border
  },
  offerTagBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    marginRight: 8
  },
  offerTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400E'
  },
  offerSnippetTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink
  },
  viewOfferArrow: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.goldDark,
    marginLeft: 6
  },
  locationChip: {
    backgroundColor: '#F8F3EA',
    borderWidth: 1,
    borderColor: '#E8DFD0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill
  },
  locationChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#30231F'
  },
  searchingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    backgroundColor: '#FDFBF7'
  },
  searchingText: {
    fontSize: 12,
    color: colors.gold,
    fontWeight: '600'
  }
});
