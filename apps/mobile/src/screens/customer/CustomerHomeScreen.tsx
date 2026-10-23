import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { SalonCard } from '../../components/SalonCard';
import { SearchBar } from '../../components/SearchBar';
import { Avatar } from '../../components/Avatar';
import { colors, radius } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { salonService } from '../../services/salon.service';
import { CustomerOffer, Salon } from '../../types';
import { CustomerLocationState, getCitySearchPattern, normalizeSalonLocation } from '../../utils/location';


const CATEGORIES = [
  { id: 'All', label: 'All', icon: '✨' },
  { id: 'Hair', label: 'Hair', icon: '💇' },
  { id: 'Skin', label: 'Skin & Facial', icon: '💆' },
  { id: 'Spa', label: 'Spa & Rituals', icon: '🌿' },
  { id: 'Nails', label: 'Nails', icon: '💅' },
  { id: 'Bridal', label: 'Bridal', icon: '👑' }
];

interface CustomerHomeScreenProps {
  salons: Salon[];
  offers: CustomerOffer[];
  selectedCity?: string;
  onSelectCity?: (city: string) => void;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  onOpenSearch: (initialQuery?: string) => void;
  onSelectSalon: (salon: Salon) => void;
  onViewAllSalons: () => void;
  favorites: string[];
  onToggleFavorite: (salon: Salon) => void;
  onOpenProfile: () => void;
  onSelectOffer?: (offer: CustomerOffer) => void;
  unreadNotificationsCount?: number;
  onOpenNotifications?: () => void;
  customerLocation?: CustomerLocationState;
  onOpenLocationPicker?: () => void;
  onOpenReviews?: () => void;
  selectedRadius?: number | null;
  onSelectRadius?: (radius: number | null) => void;
}

export const CustomerHomeScreen = React.memo(function CustomerHomeScreen({
  salons,
  offers,
  selectedCity,
  onSelectCity,
  selectedCategory,
  onSelectCategory,
  onOpenSearch,
  onSelectSalon,
  onViewAllSalons,
  favorites,
  onToggleFavorite,
  onOpenProfile,
  onSelectOffer,
  unreadNotificationsCount = 0,
  onOpenNotifications,
  customerLocation,
  onOpenLocationPicker,
  onOpenReviews,
  selectedRadius,
  onSelectRadius
}: CustomerHomeScreenProps) {
  const { user } = useAuth();
  const [localSearch, setLocalSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [hasCompletedSearch, setHasCompletedSearch] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [apiSearchResults, setApiSearchResults] = useState<Salon[]>([]);
  const searchReqId = useRef(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep references to location and user to avoid recreating executeSearch or re-triggering debounce
  const customerLocationRef = useRef(customerLocation);
  customerLocationRef.current = customerLocation;
  const userRef = useRef(user);
  userRef.current = user;

  // Authoritative API search execution with stable callback reference
  const executeSearch = useCallback(
    async (queryText: string) => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }

      const trimmed = queryText.trim();
      if (!trimmed) {
        searchReqId.current++;
        setIsSearching(false);
        setHasCompletedSearch(false);
        setSearchError(null);
        setApiSearchResults([]);
        return;
      }

      setIsSearching(true);
      setSearchError(null);
      const reqId = ++searchReqId.current;

      try {
        const curLoc = customerLocationRef.current;
        const curUser = userRef.current;
        const lat = curLoc?.coords?.latitude;
        const lng = curLoc?.coords?.longitude;
        const city = curLoc?.isGps
          ? undefined
          : curLoc?.city &&
            curLoc.city.toLowerCase() !== 'all' &&
            curLoc.city.toLowerCase() !== 'all cities'
            ? curLoc.city
            : undefined;
        const radius =
          selectedRadius !== undefined && selectedRadius !== null
            ? selectedRadius
            : curUser?.searchRadius;

        const res = await salonService.getSalons({
          q: trimmed,
          lat,
          lng,
          city,
          radius
        });

        if (reqId === searchReqId.current) {
          setApiSearchResults((res.data || []).map(normalizeSalonLocation));
          setHasCompletedSearch(true);
          setIsSearching(false);
          setSearchError(null);
        }
      } catch (err: any) {
        if (reqId === searchReqId.current) {
          setSearchError(
            err?.message || 'Unable to connect to Book My Salon. Please check your network and try again.'
          );
          setHasCompletedSearch(true);
          setIsSearching(false);
        }
      }
    },
    []
  );

  // Debounced search trigger (300ms)
  useEffect(() => {
    const trimmed = localSearch.trim();
    if (!trimmed) {
      searchReqId.current++;
      setIsSearching(false);
      setHasCompletedSearch(false);
      setSearchError(null);
      setApiSearchResults([]);
      return;
    }

    setIsSearching(true);
    setHasCompletedSearch(false);
    setSearchError(null);

    debounceTimer.current = setTimeout(() => {
      void executeSearch(localSearch);
    }, 300);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
    };
  }, [localSearch, executeSearch]);

  const handleClearSearch = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    searchReqId.current++;
    setLocalSearch('');
    setApiSearchResults([]);
    setIsSearching(false);
    setHasCompletedSearch(false);
    setSearchError(null);
    // Note: Do not dismiss keyboard on clear so user can immediately type a new query
  }, []);

  const handleSubmitSearch = useCallback(() => {
    Keyboard.dismiss();
    void executeSearch(localSearch);
  }, [localSearch, executeSearch]);

  // Immediate in-memory search on available salons for instant responsive feedback
  const localMatchingSalons = useMemo(() => {
    const q = localSearch.trim().toLowerCase();
    if (!q) return [];
    const cityPattern = getCitySearchPattern(q);
    const isCityQuery = cityPattern.includes('|');

    return salons.filter((s) => {
      const nameMatch = (s.name || s.salonName || '').toLowerCase().includes(q);
      const cityMatch =
        (s.city || '').toLowerCase().includes(q) ||
        (isCityQuery && (s.city || '').toLowerCase().match(new RegExp(cityPattern, 'i')));
      const locationStr = typeof s.location === 'string' ? s.location.toLowerCase() : '';
      const addressMatch =
        (s.address || '').toLowerCase().includes(q) ||
        locationStr.includes(q);
      const serviceMatch = (s.services || []).some(
        (svc) =>
          svc.name.toLowerCase().includes(q) ||
          (svc.category && svc.category.toLowerCase().includes(q))
      );
      const offerMatch = (s.offers || []).some(
        (off) =>
          (off.title && off.title.toLowerCase().includes(q)) ||
          (off.description && off.description.toLowerCase().includes(q)) ||
          (off.applicableService && off.applicableService.toLowerCase().includes(q))
      );
      return nameMatch || cityMatch || addressMatch || serviceMatch || offerMatch;
    });
  }, [salons, localSearch]);

  // Authoritative combined search results (deduplicated by salon ID)
  const combinedSearchResults = useMemo(() => {
    if (!localSearch.trim()) return [];
    const map = new Map<string, Salon>();

    // 1. Authoritative API results take primary precedence
    for (const s of apiSearchResults) {
      const sId = (s.id || s._id || '').toString();
      if (sId) {
        map.set(sId, s);
      }
    }

    // 2. Local verified database matches supplement instant response
    for (const s of localMatchingSalons) {
      const sId = (s.id || s._id || '').toString();
      if (sId && !map.has(sId)) {
        map.set(sId, s);
      }
    }

    return Array.from(map.values());
  }, [localMatchingSalons, apiSearchResults, localSearch]);

  // Active location derived directly from customer location (single source of truth)
  const activeCity = useMemo(() => {
    if (customerLocation?.city && customerLocation.city.trim().length > 0) {
      return customerLocation.city.trim();
    }
    if (selectedCity && selectedCity.trim().length > 0) {
      return selectedCity.trim();
    }
    return 'All';
  }, [customerLocation?.city, selectedCity]);

  // Deduplicate exclusive offers and prioritize offers matching active location
  const uniqueOffers = useMemo(() => {
    const seen = new Set<string>();
    const list = (offers || []).filter((off, idx) => {
      const key = (off._id || off.id || `off-${idx}`).toString();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const cityLower = activeCity.toLowerCase();
    if (!cityLower || cityLower === 'all' || cityLower === 'all cities') {
      return list;
    }

    const isTrichy = cityLower === 'tiruchirappalli' || cityLower === 'trichy';
    return [...list].sort((a, b) => {
      const aCity = (a.salonCity || a.salon?.city || '').toLowerCase();
      const bCity = (b.salonCity || b.salon?.city || '').toLowerCase();
      const aMatches = isTrichy
        ? aCity.includes('trichy') || aCity.includes('tiruchirappalli')
        : aCity.includes(cityLower);
      const bMatches = isTrichy
        ? bCity.includes('trichy') || bCity.includes('tiruchirappalli')
        : bCity.includes(cityLower);

      if (aMatches && !bMatches) return -1;
      if (!aMatches && bMatches) return 1;
      return 0;
    });
  }, [offers, activeCity]);

  // Filter salons by active location and category
  const filteredSalons = useMemo(() => {
    const isAll =
      !activeCity ||
      activeCity.toLowerCase() === 'all' ||
      activeCity.toLowerCase() === 'all cities' ||
      (customerLocation?.isGps && (!customerLocation.city || customerLocation.city.toLowerCase() === 'all'));

    const isTrichy =
      activeCity.toLowerCase() === 'tiruchirappalli' || activeCity.toLowerCase() === 'trichy';

    return salons.filter((s) => {
      const locStr = typeof s.location === 'string' ? s.location.toLowerCase() : '';
      const sCity = (s.city || '').toLowerCase();

      const matchesCity =
        isAll ||
        (isTrichy
          ? sCity === 'tiruchirappalli' ||
          sCity === 'trichy' ||
          locStr.includes('trichy') ||
          locStr.includes('tiruchirappalli')
          : sCity.includes(activeCity.toLowerCase()) ||
          locStr.includes(activeCity.toLowerCase()));

      const matchesCategory =
        selectedCategory === 'All' ||
        (s.services &&
          s.services.some(
            (svc) =>
              (svc.category &&
                svc.category.toLowerCase().includes(selectedCategory.toLowerCase())) ||
              svc.name.toLowerCase().includes(selectedCategory.toLowerCase())
          ));

      const radiusLimit =
        selectedRadius !== undefined && selectedRadius !== null
          ? selectedRadius
          : user?.searchRadius;

      const withinRadius =
        !radiusLimit || !customerLocation?.coords
          ? true
          : (typeof s.distanceKm === 'number' && s.distanceKm <= radiusLimit);

      return matchesCity && matchesCategory && withinRadius;
    });
  }, [salons, activeCity, selectedCategory, customerLocation?.isGps, customerLocation?.city, customerLocation?.coords, user?.searchRadius, selectedRadius]);

  return (
    <ScrollView
      style={s.page}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Top Header Bar */}
      <View style={s.topBar}>
        <View>
          <Text style={s.eyebrow}>BOOK MY SALON PARTNERS</Text>
          <Text style={s.greeting}>Good day, {user?.name || 'Guest'}</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {onOpenNotifications && (
            <Pressable onPress={onOpenNotifications} style={s.bellBtn}>
              <Text style={s.bellIcon}>🔔</Text>
              {(unreadNotificationsCount || 0) > 0 && (
                <View style={s.bellBadge}>
                  <Text style={s.bellBadgeText}>
                    {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                  </Text>
                </View>
              )}
            </Pressable>
          )}

          {onOpenReviews && (
            <Pressable
              onPress={onOpenReviews}
              style={s.bellBtn}
              accessibilityLabel="Ratings & Reviews"
            >
              <Text style={s.bellIcon}>⭐</Text>
            </Pressable>
          )}

          <Pressable
            onPress={onOpenProfile}
            style={s.profileAvatarWrap}
            accessibilityRole="button"
            accessibilityLabel="Open Profile"
          >
            <Avatar
              uri={user?.avatar}
              name={user?.name || 'Customer'}
              size={38}
              borderColor={colors.gold}
              borderWidth={1.5}
              backgroundColor={colors.goldSoft}
              textColor={colors.ink}
            />
          </Pressable>
        </View>
      </View>

      {/* Location Bar Pill */}
      {customerLocation && (
        <View style={s.locationBarWrap}>
          <Pressable
            style={s.locationPill}
            onPress={onOpenLocationPicker}
            accessibilityRole="button"
            accessibilityLabel="Select customer location"
          >
            <Text style={s.locationPin}>{customerLocation.isGps ? '🎯' : '📍'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.locationSub}>YOUR LOCATION</Text>
              <Text style={s.locationMain} numberOfLines={1}>
                {customerLocation.label}
              </Text>
            </View>
            <View style={s.locationChangeBadge}>
              <Text style={s.locationChangeBadgeText}>Change ▾</Text>
            </View>
          </Pressable>
        </View>
      )}

      {/* 5 km / 10 km Radius Filter Pills */}
      <View style={s.radiusFilterRow}>
        <Text style={s.radiusFilterLabel}>DISTANCE RADIUS:</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.radiusPillsScroll}
        >
          {[
            { id: null, label: 'All Distances' },
            { id: 5, label: 'Within 5 km' },
            { id: 10, label: 'Within 10 km' }
          ].map((item) => {
            const isSelected = (selectedRadius ?? null) === item.id;
            return (
              <Pressable
                key={item.label}
                style={[s.radiusPill, isSelected && s.radiusPillActive]}
                onPress={() => {
                  if (item.id !== null && !customerLocation?.coords) {
                    onOpenLocationPicker?.();
                  } else {
                    onSelectRadius?.(item.id);
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel={`Filter salons ${item.label}`}
              >
                <Text style={[s.radiusPillText, isSelected && s.radiusPillTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <Text style={s.heroTitle}>Find your signature{`\n`}beauty experience.</Text>

      {/* Interactive Search Bar */}
      <View style={s.searchWrap}>
        <SearchBar
          value={localSearch}
          onChangeText={setLocalSearch}
          placeholder="Search salons, services, or locations..."
          onClear={handleClearSearch}
          onSubmitEditing={handleSubmitSearch}
        />
        {localSearch.length > 0 && (
          <View style={s.searchActionsRow}>
            <Pressable
              style={s.clearSearchBtn}
              onPress={handleClearSearch}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Text style={s.clearSearchText}>✕ Clear Search</Text>
            </Pressable>
            {isSearching && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <ActivityIndicator size="small" color={colors.gold} />
                <Text style={{ fontSize: 11, color: colors.gold, fontWeight: '600' }}>Searching...</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {localSearch.trim().length > 0 ? (
        /* Live Search Results inside Discover */
        <View style={s.searchResultsContainer}>
          <View style={s.sectionRow}>
            <View>
              <Text style={s.sectionTitle}>Search Results</Text>
              <Text style={s.resultsMeta}>
                {isSearching
                  ? 'Searching verified ateliers...'
                  : `${combinedSearchResults.length} result${combinedSearchResults.length === 1 ? '' : 's'} found for "${localSearch.trim()}"`}
              </Text>
            </View>
            <Pressable onPress={handleClearSearch} style={s.viewAllBtn}>
              <Text style={s.viewAllText}>Reset Filter</Text>
            </Pressable>
          </View>

          {isSearching && (
            <View style={s.searchLoadingRow}>
              <ActivityIndicator size="small" color={colors.gold} />
              <Text style={s.searchLoadingText}>Searching salons, services & offers...</Text>
            </View>
          )}

          {!isSearching && searchError && (
            <View style={s.searchErrorBox}>
              <Text style={s.searchErrorIcon}>⚠️</Text>
              <Text style={s.searchErrorTitle}>Search Temporarily Unavailable</Text>
              <Text style={s.searchErrorCopy}>{searchError}</Text>
              <Pressable
                style={s.retryBtn}
                onPress={() => executeSearch(localSearch)}
                accessibilityRole="button"
                accessibilityLabel="Retry search"
              >
                <Text style={s.retryBtnText}>🔄 Retry Search</Text>
              </Pressable>
            </View>
          )}

          <View style={s.salonsList}>
            {combinedSearchResults.map((salon) => {
              const salonId = (salon.id || salon._id || '').toString();
              const isFav = favorites.includes(salonId);
              return (
                <View key={salonId}>
                  <SalonCard
                    salon={salon}
                    onPress={onSelectSalon}
                    isFavorite={isFav}
                    onToggleFavorite={onToggleFavorite}
                  />
                  {salon.offers && salon.offers.length > 0 && (
                    <View style={s.cardOffersRow}>
                      {salon.offers
                        .filter((off, idx, arr) => {
                          const oid = (off._id || off.id || '').toString();
                          return (
                            !oid ||
                            arr.findIndex((c) => (c._id || c.id || '').toString() === oid) === idx
                          );
                        })
                        .map((off, idx) => {
                          const offId = (off._id || off.id || '').toString();
                          const key = offId
                            ? `home-salon-${salonId}-offer-${offId}`
                            : `home-salon-${salonId}-offer-${idx}`;

                          return (
                            <Pressable
                              key={key}
                              style={s.offerSnippetBadge}
                              onPress={() => onSelectOffer?.(off)}
                            >
                              <Text style={s.offerSnippetText}>
                                🏷️ {off.title} ({off.discountLabel || (off.discountType === 'FIXED' ? `₹${off.discountValue} OFF` : `${off.discountValue}% OFF`)})
                              </Text>
                            </Pressable>
                          );
                        })}
                    </View>
                  )}
                </View>
              );
            })}

            {!isSearching && !searchError && hasCompletedSearch && combinedSearchResults.length === 0 && (
              <View style={s.emptyBox}>
                <Text style={s.emptyIcon}>🔍</Text>
                <Text style={s.emptyTitle}>No salons or rituals found</Text>
                <Text style={s.emptyCopy}>
                  We couldn't find any verified salons matching "{localSearch.trim()}". Try searching for a city (e.g. Trichy), service (e.g. Haircut), or salon name.
                </Text>
                <Pressable onPress={handleClearSearch} style={s.resetBtn}>
                  <Text style={s.resetBtnText}>Clear Search & Return to Discover</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      ) : (
        /* Regular Discover Screen Sections */
        <>
          {/* Promotional Offers & Vouchers Carousel */}
          {uniqueOffers.length > 0 && (
            <View style={s.offersSection}>
              <View style={s.sectionRow}>
                <Text style={s.sectionSubtitle}>EXCLUSIVE OFFERS</Text>
                <Text style={s.offerTag}>LIMITED TIME</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.offersScroll}
              >
                {uniqueOffers.map((off, idx) => {
                  const discountText =
                    off.discountLabel ||
                    (off.discountType === 'FIXED'
                      ? `₹${off.discountValue} OFF`
                      : `${off.discountValue || off.discountPercent || 20}% OFF`);

                  const validityText = off.endDate || off.validUntil
                    ? `Valid until ${new Date(off.endDate || off.validUntil!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                    : 'Limited time';

                  return (
                    <Pressable
                      key={`home-exclusive-offer-${off._id || off.id || idx}`}
                      style={s.offerCard}
                      onPress={() => onSelectOffer?.(off)}
                    >
                      <View style={s.offerHeader}>
                        <Text style={s.offerBadge}>{discountText}</Text>
                        {off.salonName ? (
                          <Text style={s.offerSalonName} numberOfLines={1}>
                            {off.salonName}
                          </Text>
                        ) : null}
                      </View>
                      <Text style={s.offerTitle} numberOfLines={1}>
                        {off.title}
                      </Text>
                      <Text style={s.offerDesc} numberOfLines={2}>
                        {off.description}
                      </Text>

                      {/* Real Pricing Breakdown */}
                      {Boolean(off.finalPrice && off.originalPrice) && (
                        <View style={s.offerPricingRow}>
                          <Text style={s.offerFinalPrice}>₹{off.finalPrice}</Text>
                          <Text style={s.offerOriginalPrice}>₹{off.originalPrice}</Text>
                          {Boolean(off.discountAmount) && (
                            <Text style={s.offerSavingsBadge}>Save ₹{off.discountAmount}</Text>
                          )}
                        </View>
                      )}

                      <View style={s.offerFooterRow}>
                        <Text style={s.offerValidity}>{validityText}</Text>
                        <Text style={s.viewOfferCta}>View Offer →</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Service Category Filters */}
          <View style={s.sectionHeader}>
            <Text style={s.sectionSubtitle}>EXPLORE BY SERVICE</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.categoryScroll}
          >
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  style={[s.catPill, isSelected && s.catPillActive]}
                  onPress={() => onSelectCategory(cat.id)}
                >
                  <Text style={s.catIcon}>{cat.icon}</Text>
                  <Text style={[s.catText, isSelected && s.catTextActive]}>
                    {cat.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Salons Showcase Section */}
          <View style={s.sectionRow}>
            <View>
              <Text style={s.sectionTitle}>
                {selectedCategory === 'All' ? 'Verified Salons' : `${selectedCategory} Salons`}
              </Text>
              <Text style={s.resultsMeta}>
                {filteredSalons.length} active{' '}
                {customerLocation?.coords && user?.searchRadius
                  ? `within ${user.searchRadius} km`
                  : activeCity && activeCity.toLowerCase() !== 'all' && activeCity.toLowerCase() !== 'all cities'
                    ? `in ${activeCity}`
                    : customerLocation?.isGps
                      ? 'nearby'
                      : 'destinations'}
              </Text>
            </View>

            <Pressable onPress={onViewAllSalons} style={s.viewAllBtn}>
              <Text style={s.viewAllText}>View All ({salons.length}) →</Text>
            </Pressable>
          </View>

          {/* Salon Cards List */}
          <View style={s.salonsList}>
            {filteredSalons.slice(0, 6).map((salon) => {
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

            {filteredSalons.length === 0 && (
              <View style={s.emptyBox}>
                <Text style={s.emptyIcon}>🔍</Text>
                <Text style={s.emptyTitle}>No salons found</Text>
                <Text style={s.emptyCopy}>
                  {user?.searchRadius && customerLocation?.coords
                    ? `No verified salons found within ${user.searchRadius} km. Try increasing your search radius in your Profile or changing location.`
                    : `No verified salons match "${activeCity}" and category "${selectedCategory}". Try changing your location or category filter.`}
                </Text>
                <Pressable
                  onPress={() => {
                    onSelectCategory('All');
                    onOpenLocationPicker?.();
                  }}
                  style={s.resetBtn}
                >
                  <Text style={s.resetBtnText}>Change Location or Category</Text>
                </Pressable>
              </View>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
});

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 16, paddingBottom: 30 },
  topBar: {

    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '800',
    color: colors.gold
  },
  greeting: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
    marginTop: 2
  },
  profileAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.gold
  },
  profileAvatarWrap: {
    borderRadius: 19,
    overflow: 'hidden'
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink
  },
  heroTitle: {
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -1,
    color: colors.ink,
    fontWeight: '800',
    marginTop: 10
  },
  searchWrap: {
    marginTop: 18,
    marginBottom: 10
  },
  searchActionBtn: {
    alignSelf: 'flex-end',
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 4
  },
  searchActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gold
  },
  sectionHeader: {
    marginTop: 16,
    marginBottom: 8
  },
  sectionSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.gold
  },
  offersSection: {
    marginTop: 20
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 10
  },
  offerTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D97706',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill
  },
  offersScroll: {
    gap: 12,
    paddingVertical: 4
  },
  offerCard: {
    width: 250,
    backgroundColor: colors.espresso,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.gold
  },
  offerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  offerBadge: {
    backgroundColor: colors.goldDark,
    color: '#FFFCF7',
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill
  },
  offerSalonName: {
    color: colors.champagne,
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
    marginLeft: 8
  },
  offerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFCF7',
    marginBottom: 4
  },
  offerDesc: {
    fontSize: 11,
    color: colors.champagne,
    lineHeight: 16,
    marginBottom: 8
  },
  offerPricingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8
  },
  offerFinalPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFD700'
  },
  offerOriginalPrice: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    textDecorationLine: 'line-through'
  },
  offerSavingsBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#34D399',
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  offerFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4
  },
  offerValidity: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.goldLight
  },
  viewOfferCta: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  categoryScroll: {
    gap: 8,
    paddingVertical: 4
  },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 13,
    paddingVertical: 8,
    gap: 6
  },
  catPillActive: {
    backgroundColor: colors.goldSoft,
    borderColor: colors.gold
  },
  catIcon: {
    fontSize: 14
  },
  catText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink
  },
  catTextActive: {
    color: colors.ink
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink
  },
  resultsMeta: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2
  },
  viewAllBtn: {
    paddingVertical: 4
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gold
  },
  salonsList: {
    marginTop: 10
  },
  emptyBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
    marginTop: 10
  },
  emptyIcon: {
    fontSize: 28,
    marginBottom: 8
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink
  },
  emptyCopy: {
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18
  },
  resetBtn: {
    marginTop: 14,
    backgroundColor: colors.goldSoft,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.pill
  },
  resetBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative'
  },
  bellIcon: {
    fontSize: 18
  },
  bellBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#EF4444',
    borderRadius: radius.pill,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1.5,
    borderColor: '#FFFFFF'
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800'
  },
  locationBarWrap: {
    marginTop: 14,
    marginBottom: 6
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F3EA',
    borderWidth: 1,
    borderColor: '#E8DFD0',
    borderRadius: radius.md || 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 10
  },
  locationPin: {
    fontSize: 18
  },
  locationSub: {
    fontSize: 9,
    fontWeight: '700',
    color: '#B08D57',
    letterSpacing: 1
  },
  locationMain: {
    fontSize: 13,
    fontWeight: '700',
    color: '#30231F',
    marginTop: 1
  },
  locationChangeBadge: {
    backgroundColor: '#EFE5D5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill
  },
  locationChangeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#30231F'
  },
  radiusFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 8,
    gap: 8
  },
  radiusFilterLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.gold,
    letterSpacing: 1
  },
  radiusPillsScroll: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    paddingVertical: 2
  },
  radiusPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.borderLight
  },
  radiusPillActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold
  },
  radiusPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.ink
  },
  radiusPillTextActive: {
    color: '#000000',
    fontWeight: '800'
  },
  searchActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: 4
  },
  clearSearchBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    backgroundColor: '#F3EDE2'
  },
  clearSearchText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted
  },
  searchResultsContainer: {
    marginTop: 8,
    marginBottom: 24
  },
  searchLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 4
  },
  searchLoadingText: {
    fontSize: 12,
    color: colors.gold,
    fontWeight: '600'
  },
  cardOffersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: -8,
    marginBottom: 12,
    paddingHorizontal: 4
  },
  offerSnippetBadge: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  offerSnippetText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E'
  },
  searchErrorBox: {
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: radius.md,
    padding: 16,
    alignItems: 'center',
    marginVertical: 12
  },
  searchErrorIcon: {
    fontSize: 24,
    marginBottom: 6
  },
  searchErrorTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#991B1B'
  },
  searchErrorCopy: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12
  },
  retryBtn: {
    backgroundColor: '#2A1810',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radius.pill
  },
  retryBtnText: {
    color: '#FDFBF7',
    fontSize: 13,
    fontWeight: '700'
  }
});
