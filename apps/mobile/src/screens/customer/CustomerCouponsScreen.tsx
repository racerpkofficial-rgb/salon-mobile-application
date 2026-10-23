import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { PrimaryButton, SecondaryButton } from '../../components/Buttons';
import { colors, radius, typography } from '../../constants/theme';
import { couponService, ExploreSalonCouponGroup } from '../../services/coupon.service';
import { dialogService } from '../../services/dialog.service';
import { CouponData, Salon } from '../../types';

interface CustomerCouponsScreenProps {
  selectedSalon?: Salon | null;
  onSelectSalon?: (salon: Salon) => void;
  onApplyCouponToBooking?: (coupon: CouponData, salon: Salon) => void;
  onBack?: () => void;
}

export function CustomerCouponsScreen({
  selectedSalon,
  onSelectSalon,
  onApplyCouponToBooking,
  onBack
}: CustomerCouponsScreenProps) {
  const [salonCoupons, setSalonCoupons] = useState<CouponData[]>([]);
  const [exploreGroups, setExploreGroups] = useState<ExploreSalonCouponGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (selectedSalon) {
        const salonId = (selectedSalon.id || selectedSalon._id || '').toString();
        const res = await couponService.getSalonCoupons(salonId);
        setSalonCoupons(res.coupons || []);
      } else {
        const res = await couponService.getExploreCoupons();
        setExploreGroups(res.data || []);
      }
    } catch (e: any) {
      dialogService.showError('Error', e.message || 'Failed to load eligible coupons.');
    } finally {
      setLoading(false);
    }
  }, [selectedSalon]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCopyCode = async (code: string) => {
    await Clipboard.setStringAsync(code);
    setCopiedCode(code);
    dialogService.showSuccess('Code Copied', `Coupon code "${code}" copied to clipboard! Paste it during checkout.`);
    setTimeout(() => {
      setCopiedCode((prev) => (prev === code ? null : prev));
    }, 3000);
  };

  const filteredExplore = exploreGroups.filter((group) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const salonMatch = group.salon.salonName?.toLowerCase().includes(q) || group.salon.city?.toLowerCase().includes(q);
    const couponMatch = group.coupons.some((c) => c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q));
    return salonMatch || couponMatch;
  });

  return (
    <View style={s.container}>
      {/* Top Header */}
      <View style={s.header}>
        {Boolean(onBack) ? (
          <Pressable onPress={onBack} style={s.backBtn}>
            <Text style={s.backText}>← Back</Text>
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
        <Text style={s.headerTitle}>
          {selectedSalon ? `Deals: ${selectedSalon.salonName || selectedSalon.name}` : 'Exclusive Coupons'}
        </Text>
        <Pressable onPress={loadData} style={s.refreshBtn}>
          <Text style={s.refreshText}>↻</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Banner */}
        <View style={s.bannerCard}>
          <Text style={s.bannerIcon}>🎟️</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.bannerTitle}>
              {selectedSalon
                ? `Salon-Specific Coupons & Savings`
                : 'Verified Salon Promo Codes'}
            </Text>
            <Text style={s.bannerBody}>
              {selectedSalon
                ? 'Apply these verified codes during checkout to save instantly on your appointment.'
                : 'Browse discounts from premier salons. Each coupon is verified and exclusive to its issuing salon.'}
            </Text>
          </View>
        </View>

        {/* Global Search Bar if exploring all salons */}
        {!selectedSalon && (
          <View style={s.searchWrap}>
            <TextInput
              style={s.searchInput}
              placeholder="Search salon or coupon code (e.g. WELCOME)"
              placeholderTextColor={colors.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        )}

        {loading ? (
          <View style={s.centerWrap}>
            <ActivityIndicator size="large" color={colors.gold} />
            <Text style={s.loadingText}>Loading verified coupons...</Text>
          </View>
        ) : selectedSalon ? (
          /* Single Salon Coupons List */
          salonCoupons.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyIcon}>🏷️</Text>
              <Text style={s.emptyTitle}>No Coupons Available</Text>
              <Text style={s.emptyBody}>
                This salon currently does not have active promo codes. Check their seasonal offers or check back soon!
              </Text>
            </View>
          ) : (
            salonCoupons.map((coupon) => (
              <View key={coupon._id} style={s.couponCard}>
                <View style={s.cardTopRow}>
                  <View style={s.codeTag}>
                    <Text style={s.codeTagText}>{coupon.code}</Text>
                  </View>
                  <Pressable
                    style={[s.copyBtn, copiedCode === coupon.code && s.copyBtnSuccess]}
                    onPress={() => handleCopyCode(coupon.code)}
                  >
                    <Text style={[s.copyBtnText, copiedCode === coupon.code && s.copyBtnSuccessText]}>
                      {copiedCode === coupon.code ? '✓ Copied' : 'Copy Code'}
                    </Text>
                  </Pressable>
                </View>

                <Text style={s.couponTitle}>{coupon.title}</Text>
                {Boolean(coupon.description) && (
                  <Text style={s.couponDesc}>{coupon.description}</Text>
                )}

                <View style={s.discountBadgeRow}>
                  <Text style={s.discountBadgeText}>
                    {coupon.discountType === 'PERCENTAGE'
                      ? `${coupon.discountValue}% OFF`
                      : `₹${coupon.discountValue} FLAT OFF`}
                    {coupon.discountType === 'PERCENTAGE' && coupon.maxDiscountAmount
                      ? ` (Up to ₹${coupon.maxDiscountAmount})`
                      : ''}
                  </Text>
                </View>

                <View style={s.termsBox}>
                  {coupon.minimumBookingAmount > 0 && (
                    <Text style={s.termItem}>• Min. booking amount: ₹{coupon.minimumBookingAmount}</Text>
                  )}
                  <Text style={s.termItem}>
                    • Valid until:{' '}
                    {new Date(coupon.expiresAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </Text>
                  <Text style={s.termItem}>• Valid exclusively at {selectedSalon.salonName || selectedSalon.name}</Text>
                </View>

                {Boolean(onApplyCouponToBooking) && (
                  <View style={{ marginTop: 12 }}>
                    <PrimaryButton
                      label={`Apply & Book at ₹${coupon.discountValue} ${coupon.discountType === 'PERCENTAGE' ? '% Discount' : 'Off'}`}
                      onPress={() => onApplyCouponToBooking!(coupon, selectedSalon)}
                    />
                  </View>
                )}
              </View>
            ))
          )
        ) : (
          /* Explore All Salons Grouped Coupons */
          filteredExplore.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyIcon}>🔍</Text>
              <Text style={s.emptyTitle}>No Active Coupons Found</Text>
              <Text style={s.emptyBody}>
                {searchQuery
                  ? `No salons or coupons matching "${searchQuery}".`
                  : 'There are currently no active promotional coupons available. Discover top salons on the home tab!'}
              </Text>
            </View>
          ) : (
            filteredExplore.map((group) => (
              <View key={group.salon.id} style={s.salonGroupCard}>
                <View style={s.salonGroupHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.salonGroupName}>{group.salon.salonName}</Text>
                    <Text style={s.salonGroupLocation}>📍 {group.salon.city || group.salon.address}</Text>
                  </View>
                  {Boolean(onSelectSalon) && (
                    <Pressable
                      style={s.viewSalonBtn}
                      onPress={() => onSelectSalon!(group.salon as any)}
                    >
                      <Text style={s.viewSalonBtnText}>View Salon →</Text>
                    </Pressable>
                  )}
                </View>

                <View style={s.groupCouponsList}>
                  {group.coupons.map((coupon) => (
                    <View key={coupon.id || coupon.code} style={s.groupCouponItem}>
                      <View style={{ flex: 1 }}>
                        <View style={s.codeRow}>
                          <View style={s.codeMiniTag}>
                            <Text style={s.codeMiniTagText}>{coupon.code}</Text>
                          </View>
                          <Text style={s.miniDiscountText}>
                            {coupon.discountType === 'PERCENTAGE'
                              ? `${coupon.discountValue}% OFF`
                              : `₹${coupon.discountValue} OFF`}
                          </Text>
                        </View>
                        <Text style={s.groupCouponTitle}>{coupon.title}</Text>
                        <Text style={s.groupCouponExpiry}>
                          Expires: {new Date(coupon.expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          {coupon.minimumBookingAmount ? ` • Min ₹${coupon.minimumBookingAmount}` : ''}
                        </Text>
                      </View>

                      <Pressable
                        style={[s.copyBtnSmall, copiedCode === coupon.code && s.copyBtnSuccess]}
                        onPress={() => handleCopyCode(coupon.code)}
                      >
                        <Text style={[s.copyBtnSmallText, copiedCode === coupon.code && s.copyBtnSuccessText]}>
                          {copiedCode === coupon.code ? '✓' : 'Copy'}
                        </Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            ))
          )
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8
  },
  backText: {
    color: colors.gold,
    fontWeight: '700',
    fontSize: 14
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.espresso
  },
  refreshBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  refreshText: {
    fontSize: 18,
    color: colors.espresso,
    fontWeight: '800'
  },
  content: {
    padding: 16,
    paddingBottom: 40
  },
  bannerCard: {
    flexDirection: 'row',
    backgroundColor: '#FAF5EE',
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 16,
    alignItems: 'center'
  },
  bannerIcon: {
    fontSize: 28,
    marginRight: 12
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.espresso
  },
  bannerBody: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
    lineHeight: 16
  },
  searchWrap: {
    marginBottom: 16
  },
  searchInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.ink
  },
  centerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: colors.muted
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 10
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 8
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.espresso
  },
  emptyBody: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 4
  },
  couponCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
    elevation: 2,
    shadowColor: colors.espresso,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 5
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  codeTag: {
    backgroundColor: '#FAF5EE',
    borderWidth: 1.5,
    borderColor: colors.gold,
    borderStyle: 'dashed',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.md
  },
  codeTagText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.espresso,
    letterSpacing: 1.2
  },
  copyBtn: {
    backgroundColor: colors.espresso,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.md
  },
  copyBtnSuccess: {
    backgroundColor: '#059669'
  },
  copyBtnText: {
    color: colors.gold,
    fontWeight: '700',
    fontSize: 12
  },
  copyBtnSuccessText: {
    color: '#FFFFFF'
  },
  couponTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.espresso,
    marginTop: 4
  },
  couponDesc: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2
  },
  discountBadgeRow: {
    marginVertical: 8
  },
  discountBadgeText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.gold
  },
  termsBox: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: 10,
    gap: 3,
    marginTop: 4
  },
  termItem: {
    fontSize: 11,
    color: colors.muted
  },
  salonGroupCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 14,
    elevation: 2,
    shadowColor: colors.espresso,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 5
  },
  salonGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderColor: colors.border,
    marginBottom: 10
  },
  salonGroupName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.espresso
  },
  salonGroupLocation: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2
  },
  viewSalonBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8
  },
  viewSalonBtnText: {
    fontSize: 12,
    color: colors.gold,
    fontWeight: '700'
  },
  groupCouponsList: {
    gap: 10
  },
  groupCouponItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2
  },
  codeMiniTag: {
    borderWidth: 1,
    borderColor: colors.gold,
    borderStyle: 'dashed',
    backgroundColor: '#FAF5EE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs
  },
  codeMiniTagText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.espresso,
    letterSpacing: 0.8
  },
  miniDiscountText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gold
  },
  groupCouponTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink
  },
  groupCouponExpiry: {
    fontSize: 10,
    color: colors.muted,
    marginTop: 2
  },
  copyBtnSmall: {
    backgroundColor: colors.espresso,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
    marginLeft: 8
  },
  copyBtnSmallText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gold
  }
});
