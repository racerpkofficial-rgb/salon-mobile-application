import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { colors, radius } from '../../constants/theme';
import { offerService } from '../../services/offer.service';
import { CustomerOffer, Salon, SalonOffer, Service } from '../../types';
import { formatLocation } from '../../utils/location';
import { getBestOfferForService } from '../../utils/offer';

interface ServiceListScreenProps {
  salon: Salon;
  onBack: () => void;
  onBookService?: (
    salon: Salon,
    service?: Service,
    offer?: CustomerOffer | SalonOffer | null
  ) => void;
}

const STANDARD_CATEGORIES = ['All', 'Hair', 'Skin', 'Facial', 'Spa', 'Nails'];

export function ServiceListScreen({
  salon,
  onBack,
  onBookService
}: ServiceListScreenProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [salonOffers, setSalonOffers] = useState<Array<CustomerOffer | SalonOffer>>(
    salon.offers || []
  );

  const services = salon.services || [];
  const salonId = (salon.id || salon._id || '').toString();

  // Load real active offers if not provided in salon
  useEffect(() => {
    if (salonId) {
      offerService
        .getSalonOffers(salonId)
        .then((res) => {
          if (res?.data && res.data.length > 0) {
            setSalonOffers((prev) => {
              const merged = [...(res.data as Array<CustomerOffer | SalonOffer>), ...prev];
              return merged.filter((item, index, self) => {
                const id = (item._id || item.id || '').toString();
                return (
                  !id ||
                  self.findIndex((c) => (c._id || c.id || '').toString() === id) === index
                );
              });
            });
          }
        })
        .catch(() => { });
    }
  }, [salonId]);

  // Extract unique categories from salon services combined with standard categories
  const categories = useMemo(() => {
    const list = [...STANDARD_CATEGORIES];
    services.forEach((s) => {
      const cat = s.category?.trim();
      if (cat && !list.some((c) => c.toLowerCase() === cat.toLowerCase())) {
        list.push(cat);
      }
    });
    return list;
  }, [services]);

  // Filtered services
  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        (s.description && s.description.toLowerCase().includes(q));

      const matchCat =
        selectedCategory === 'All' ||
        (s.category && s.category.toLowerCase() === selectedCategory.toLowerCase()) ||
        s.name.toLowerCase().includes(selectedCategory.toLowerCase()) ||
        (s.description && s.description.toLowerCase().includes(selectedCategory.toLowerCase()));

      return matchSearch && matchCat;
    });
  }, [services, search, selectedCategory]);

  return (
    <View style={s.page}>
      {/* Top Header */}
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backBtn}>
          <Text style={s.backText}>← Salon Details</Text>
        </Pressable>
        <Text style={s.headerTitle}>Services Menu</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Salon Context Bar */}
      <View style={s.salonBar}>
        <Text style={s.salonName} numberOfLines={1}>
          {salon.name || salon.salonName}
        </Text>
        <Text style={s.salonLocation} numberOfLines={1}>
          📍 {formatLocation(salon.location, salon.city, salon.address)}
        </Text>
      </View>

      {/* Search Input */}
      <View style={s.searchWrap}>
        <View style={s.searchBar}>
          <Text style={s.searchIcon}>🔍</Text>
          <TextInput
            style={s.input}
            value={search}
            onChangeText={setSearch}
            placeholder="Search treatments or styling services..."
            placeholderTextColor={colors.muted}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <Text style={s.clearText}>✕</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Category Tabs - Compact Horizontal Pill Chips */}
      <View style={s.catBarWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.catRow}
          style={s.catScrollView}
        >
          {categories.map((c) => {
            const active = selectedCategory.toLowerCase() === c.toLowerCase();
            return (
              <Pressable
                key={c}
                style={[s.catChip, active && s.catChipActive]}
                onPress={() => setSelectedCategory(c)}
              >
                <Text style={[s.catText, active && s.catTextActive]}>{c}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Count Meta */}
      <View style={s.metaRow}>
        <Text style={s.metaText}>
          {filteredServices.length} {filteredServices.length === 1 ? 'treatment' : 'treatments'} listed
        </Text>
      </View>

      {/* Services List */}
      <ScrollView
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredServices.map((service, index) => {
          const duration = service.durationMinutes
            ? `${service.durationMinutes} mins`
            : service.duration || '45 mins';

          const pricing = getBestOfferForService(service, salonOffers);

          return (
            <View key={service.id || (service as any)._id || index} style={s.serviceCard}>
              <View style={s.serviceHeader}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={s.serviceName}>{service.name}</Text>
                  {service.category ? (
                    <View style={s.categoryPill}>
                      <Text style={s.categoryText}>{service.category}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Price Display with Offer Calculation */}
                <View style={s.priceBox}>
                  {pricing.hasDiscount ? (
                    <>
                      <View style={s.discountBadge}>
                        <Text style={s.discountBadgeText}>{pricing.discountLabel}</Text>
                      </View>
                      <View style={s.priceComparisonRow}>
                        <Text style={s.originalPriceStrikethrough}>
                          ₹{pricing.originalPrice}
                        </Text>
                        <Text style={s.discountedPrice}>₹{pricing.finalPrice}</Text>
                      </View>
                    </>
                  ) : (
                    <Text style={s.servicePrice}>₹{service.price}</Text>
                  )}
                  <Text style={s.serviceDuration}>⏱ {duration}</Text>
                </View>
              </View>

              {/* Offer Banner Tag */}
              {pricing.hasDiscount && pricing.appliedOffer ? (
                <View style={s.offerNoticePill}>
                  <Text style={s.offerNoticeIcon}>🔥</Text>
                  <Text style={s.offerNoticeText} numberOfLines={1}>
                    {pricing.appliedOffer.title}
                  </Text>
                </View>
              ) : null}

              {service.description ? (
                <Text style={s.serviceDesc}>{service.description}</Text>
              ) : null}

              {/* Footer with Book Button */}
              <View style={s.cardFooter}>
                <View style={s.verifiedIconRow}>
                  <Text style={s.verifiedBullet}>✓</Text>
                  <Text style={s.verifiedNote}>Book My Salon Verified Guarantee</Text>
                </View>

                {onBookService ? (
                  <Pressable
                    style={s.bookBtn}
                    onPress={() => onBookService(salon, service, pricing.appliedOffer)}
                  >
                    <Text style={s.bookBtnText}>Book →</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })}

        {services.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyIcon}>✂️</Text>
            <Text style={s.emptyTitle}>Services not yet added by this salon</Text>
            <Text style={s.emptyCopy}>
              This salon has not yet published its treatments or services catalog. Please check back later.
            </Text>
          </View>
        ) : filteredServices.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyIcon}>💆</Text>
            <Text style={s.emptyTitle}>No matching services found</Text>
            <Text style={s.emptyCopy}>
              Try searching with another keyword or pick "All" categories.
            </Text>
          </View>
        ) : null}
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
  salonBar: {
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  salonName: { fontSize: 16, fontWeight: '800', color: colors.ink },
  salonLocation: { fontSize: 12, color: colors.muted, marginTop: 2 },
  searchWrap: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 6
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    height: 44
  },
  searchIcon: { fontSize: 15, marginRight: 8 },
  input: {
    flex: 1,
    fontSize: 13,
    color: colors.ink,
    fontWeight: '500'
  },
  clearText: {
    fontSize: 14,
    color: colors.muted,
    paddingHorizontal: 4
  },

  // Category Tabs - Natural Content Height Pill Chips
  catBarWrap: {
    paddingVertical: 8,
    backgroundColor: colors.surfaceWarm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  catScrollView: {
    flexGrow: 0
  },
  catRow: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  catChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
    alignSelf: 'center'
  },
  catChipActive: {
    backgroundColor: colors.espresso,
    borderColor: colors.espresso
  },
  catText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink
  },
  catTextActive: {
    color: '#FFFCF7'
  },

  metaRow: {
    paddingHorizontal: 20,
    paddingVertical: 8
  },
  metaText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 12
  },
  serviceCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
    lineHeight: 21
  },
  categoryPill: {
    backgroundColor: colors.goldSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
    marginTop: 6
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.ink
  },
  priceBox: {
    alignItems: 'flex-end'
  },
  servicePrice: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.gold
  },
  priceComparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  originalPriceStrikethrough: {
    fontSize: 13,
    color: colors.muted,
    textDecorationLine: 'line-through',
    fontWeight: '600'
  },
  discountedPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.goldDark
  },
  discountBadge: {
    backgroundColor: '#059669',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.xs,
    marginBottom: 3
  },
  discountBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  serviceDuration: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
    marginTop: 3
  },
  offerNoticePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.goldSoft,
    borderRadius: radius.xs,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 8,
    gap: 4
  },
  offerNoticeIcon: {
    fontSize: 12
  },
  offerNoticeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.goldDark,
    flex: 1
  },
  serviceDesc: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 18,
    marginTop: 8
  },
  cardFooter: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  verifiedIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1
  },
  verifiedBullet: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669'
  },
  verifiedNote: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '600'
  },
  bookBtn: {
    backgroundColor: colors.ink,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill
  },
  bookBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF'
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
