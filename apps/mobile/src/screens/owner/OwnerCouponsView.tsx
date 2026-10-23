import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { Plus } from 'lucide-react-native';
import { AppHeader } from '../../components/AppHeader';
import { PrimaryButton, SecondaryButton } from '../../components/Buttons';
import { colors, radius, typography } from '../../constants/theme';
import { couponService } from '../../services/coupon.service';
import { dialogService } from '../../services/dialog.service';
import {
  CouponAnalyticsData,
  CouponData,
  CouponDiscountType,
  CreateCouponPayload,
  OwnerCouponSummary,
  SalonOwnerData,
  UpdateCouponPayload
} from '../../types';

interface OwnerCouponsViewProps {
  token: string;
  salon: SalonOwnerData | null;
}

export function OwnerCouponsView({ token, salon }: OwnerCouponsViewProps) {
  const [coupons, setCoupons] = useState<CouponData[]>([]);
  const [summary, setSummary] = useState<OwnerCouponSummary>({
    totalCoupons: 0,
    activeCoupons: 0,
    totalRedemptions: 0,
    totalDiscountsGranted: 0
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'PAUSED' | 'EXPIRED'>('ALL');

  // Create / Edit Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<CouponData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Form Fields
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<CouponDiscountType>('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState('');
  const [maxDiscountAmount, setMaxDiscountAmount] = useState('');
  const [minimumBookingAmount, setMinimumBookingAmount] = useState('');
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(['ALL']);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  );
  const [totalUsageLimit, setTotalUsageLimit] = useState('');
  const [perCustomerLimit, setPerCustomerLimit] = useState('1');
  const [status, setStatus] = useState<'ACTIVE' | 'PAUSED'>('ACTIVE');

  // Analytics Modal State
  const [analyticsVisible, setAnalyticsVisible] = useState(false);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<CouponAnalyticsData | null>(null);

  const loadCoupons = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await couponService.getOwnerCoupons(token);
      setCoupons(res.coupons || []);
      if (res.summary) {
        setSummary(res.summary);
      }
    } catch (e: any) {
      dialogService.showError('Error', e.message || 'Failed to load salon coupons.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadCoupons();
  }, [loadCoupons]);

  const openCreateModal = () => {
    setEditingCoupon(null);
    setCode('');
    setTitle('');
    setDescription('');
    setDiscountType('PERCENTAGE');
    setDiscountValue('');
    setMaxDiscountAmount('');
    setMinimumBookingAmount('0');
    setSelectedServiceIds(['ALL']);
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate(new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);
    setTotalUsageLimit('');
    setPerCustomerLimit('1');
    setStatus('ACTIVE');
    setModalVisible(true);
  };

  const openEditModal = (coupon: CouponData) => {
    setEditingCoupon(coupon);
    setCode(coupon.code);
    setTitle(coupon.title);
    setDescription(coupon.description || '');
    setDiscountType(coupon.discountType);
    setDiscountValue(String(coupon.discountValue));
    setMaxDiscountAmount(coupon.maxDiscountAmount ? String(coupon.maxDiscountAmount) : '');
    setMinimumBookingAmount(String(coupon.minimumBookingAmount || 0));
    setSelectedServiceIds(coupon.applicableServiceIds && coupon.applicableServiceIds.length > 0 ? coupon.applicableServiceIds : ['ALL']);
    setStartDate(coupon.startsAt ? new Date(coupon.startsAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    setEndDate(coupon.expiresAt ? new Date(coupon.expiresAt).toISOString().split('T')[0] : '');
    setTotalUsageLimit(coupon.totalUsageLimit ? String(coupon.totalUsageLimit) : '');
    setPerCustomerLimit(String(coupon.perCustomerUsageLimit || 1));
    setStatus(coupon.status === 'PAUSED' ? 'PAUSED' : 'ACTIVE');
    setModalVisible(true);
  };

  const openAnalytics = async (coupon: CouponData) => {
    setAnalyticsVisible(true);
    setLoadingAnalytics(true);
    try {
      const data = await couponService.getCouponAnalytics(token, coupon._id);
      setAnalyticsData(data);
    } catch (e: any) {
      dialogService.showError('Analytics Error', e.message || 'Could not load coupon statistics.');
      setAnalyticsVisible(false);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const handleToggleStatus = async (coupon: CouponData) => {
    const isPaused = coupon.status === 'PAUSED';
    const newStatus = isPaused ? 'ACTIVE' : 'PAUSED';
    setTogglingId(coupon._id);

    try {
      await couponService.setCouponStatus(token, coupon._id, newStatus);
      setCoupons((prev) =>
        prev.map((c) => (c._id === coupon._id ? { ...c, status: newStatus, effectiveStatus: newStatus } : c))
      );
      dialogService.showSuccess(
        isPaused ? 'Coupon Activated' : 'Coupon Paused',
        `Coupon ${coupon.code} is now ${newStatus.toLowerCase()}.`
      );
    } catch (e: any) {
      dialogService.showError('Update Failed', e.message || 'Failed to change coupon status.');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = (coupon: CouponData) => {
    dialogService.confirm(
      'Delete Coupon',
      `Are you sure you want to delete coupon "${coupon.code}"? If this coupon has past booking redemptions, it will be safely retired to protect historical data.`,
      async () => {
        try {
          const res = await couponService.deleteCoupon(token, coupon._id);
          setCoupons((prev) => prev.filter((c) => c._id !== coupon._id));
          dialogService.showSuccess('Coupon Removed', res.message || 'Coupon deleted successfully.');
          void loadCoupons();
        } catch (e: any) {
          dialogService.showError('Delete Failed', e.message || 'Could not delete coupon.');
        }
      }
    );
  };

  const handleSaveCoupon = async () => {
    const trimmedCode = code.trim().toUpperCase();
    const trimmedTitle = title.trim();

    if (!trimmedCode || trimmedCode.length < 2) {
      dialogService.showWarning('Validation', 'Please enter a valid coupon code (at least 2 characters).');
      return;
    }

    if (!trimmedTitle) {
      dialogService.showWarning('Validation', 'Coupon title is required.');
      return;
    }

    const valNum = Number(discountValue);
    if (isNaN(valNum) || valNum <= 0) {
      dialogService.showWarning('Validation', 'Please provide a valid positive discount value.');
      return;
    }

    if (discountType === 'PERCENTAGE' && valNum > 100) {
      dialogService.showWarning('Validation', 'Percentage discount cannot exceed 100%.');
      return;
    }

    if (!endDate) {
      dialogService.showWarning('Validation', 'Please select a valid expiry date.');
      return;
    }

    if (new Date(endDate) <= new Date(startDate)) {
      dialogService.showWarning('Validation', 'Expiry date must be after the start date.');
      return;
    }

    const maxCapNum = maxDiscountAmount ? Number(maxDiscountAmount) : undefined;
    const minBookingNum = minimumBookingAmount ? Number(minimumBookingAmount) : 0;
    const totalLimitNum = totalUsageLimit ? Number(totalUsageLimit) : undefined;
    const perCustLimitNum = perCustomerLimit ? Math.max(1, Number(perCustomerLimit)) : 1;

    setSubmitting(true);
    try {
      if (editingCoupon) {
        const payload: UpdateCouponPayload = {
          title: trimmedTitle,
          description: description.trim() || undefined,
          discountType,
          discountValue: valNum,
          maxDiscountAmount: discountType === 'PERCENTAGE' ? (maxCapNum ?? null) : null,
          minimumBookingAmount: minBookingNum,
          applicableServiceIds: selectedServiceIds,
          startsAt: startDate ? `${startDate}T00:00:00.000Z` : undefined,
          expiresAt: `${endDate}T23:59:59.999Z`,
          totalUsageLimit: totalLimitNum ?? null,
          perCustomerUsageLimit: perCustLimitNum,
          status
        };

        const res = await couponService.updateCoupon(token, editingCoupon._id, payload);
        dialogService.showSuccess('Coupon Updated', res.message || 'Coupon details updated successfully.');
      } else {
        const payload: CreateCouponPayload = {
          code: trimmedCode,
          title: trimmedTitle,
          description: description.trim() || undefined,
          discountType,
          discountValue: valNum,
          maxDiscountAmount: discountType === 'PERCENTAGE' ? maxCapNum : undefined,
          minimumBookingAmount: minBookingNum,
          applicableServiceIds: selectedServiceIds,
          startsAt: startDate ? `${startDate}T00:00:00.000Z` : undefined,
          expiresAt: `${endDate}T23:59:59.999Z`,
          totalUsageLimit: totalLimitNum,
          perCustomerUsageLimit: perCustLimitNum,
          status
        };

        const res = await couponService.createCoupon(token, payload);
        dialogService.showSuccess('Coupon Created', res.message || `Coupon ${trimmedCode} created successfully!`);
      }

      setModalVisible(false);
      void loadCoupons();
    } catch (e: any) {
      dialogService.showError('Operation Failed', e.message || 'Could not save coupon.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCoupons = coupons.filter((c) => {
    const isExpired = new Date() > new Date(c.expiresAt);
    if (filter === 'ACTIVE') return c.status === 'ACTIVE' && !isExpired;
    if (filter === 'PAUSED') return c.status === 'PAUSED';
    if (filter === 'EXPIRED') return isExpired;
    return true;
  });

  return (
    <View style={s.container}>
      <AppHeader
        title="Coupons"
        subtitle={salon?.salonName || 'Manage your salon coupons'}
        rightElement={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create coupon"
            onPress={openCreateModal}
            style={s.createBtn}
          >
            <Plus size={15} color="#FFFFFF" strokeWidth={2.5} />
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Dashboard Statistics Overview */}
        <View style={s.statsCard}>
          <Text style={s.statsTitle}>Coupon Performance</Text>
          <View style={s.statsGrid}>
            <View style={s.statBox}>
              <Text style={s.statNum}>{summary.totalCoupons}</Text>
              <Text style={s.statLabel}>Total Coupons</Text>
            </View>
            <View style={s.statBox}>
              <Text style={[s.statNum, { color: colors.gold }]}>{summary.activeCoupons}</Text>
              <Text style={s.statLabel}>Active</Text>
            </View>
            <View style={s.statBox}>
              <Text style={[s.statNum, { color: '#2563EB' }]}>{summary.totalRedemptions}</Text>
              <Text style={s.statLabel}>Redemptions</Text>
            </View>
            <View style={s.statBox}>
              <Text style={[s.statNum, { color: '#059669' }]}>
                ₹{summary.totalDiscountsGranted.toLocaleString('en-IN')}
              </Text>
              <Text style={s.statLabel}>Total Savings</Text>
            </View>
          </View>
        </View>

        {/* Filter Pills */}
        <View style={s.filterRow}>
          {(['ALL', 'ACTIVE', 'PAUSED', 'EXPIRED'] as const).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setFilter(tab)}
              style={[s.filterPill, filter === tab && s.filterPillActive]}
            >
              <Text style={[s.filterPillText, filter === tab && s.filterPillTextActive]}>
                {tab}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Coupon Cards List */}
        {loading ? (
          <View style={s.centerWrap}>
            <ActivityIndicator size="large" color={colors.gold} />
            <Text style={s.loadingText}>Loading your salon coupons...</Text>
          </View>
        ) : filteredCoupons.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyIcon}>🎟️</Text>
            <Text style={s.emptyTitle}>No Coupons Found</Text>
            <Text style={s.emptyBody}>
              {filter === 'ALL'
                ? 'You have not created any promo codes yet. Offer targeted discounts to boost booking volume!'
                : `No coupons matching filter "${filter}" found.`}
            </Text>
            <View style={{ marginTop: 14 }}>
              <PrimaryButton label="+ Create First Coupon" onPress={openCreateModal} />
            </View>
          </View>
        ) : (
          filteredCoupons.map((coupon) => {
            const isPaused = coupon.status === 'PAUSED';
            const isExpired = new Date() > new Date(coupon.expiresAt);
            const isToggling = togglingId === coupon._id;

            return (
              <View
                key={coupon._id}
                style={[
                  s.couponCard,
                  isPaused && s.couponCardPaused,
                  isExpired && s.couponCardExpired
                ]}
              >
                {/* Top Code & Status */}
                <View style={s.cardHeaderRow}>
                  <View style={s.codeTag}>
                    <Text style={s.codeTagText}>{coupon.code}</Text>
                  </View>
                  <View style={[
                    s.statusBadge,
                    isExpired
                      ? s.statusBadgeExpired
                      : isPaused
                      ? s.statusBadgePaused
                      : s.statusBadgeActive
                  ]}>
                    <Text style={[
                      s.statusBadgeText,
                      isExpired
                        ? s.statusTextExpired
                        : isPaused
                        ? s.statusTextPaused
                        : s.statusTextActive
                    ]}>
                      {isExpired ? 'EXPIRED' : isPaused ? 'PAUSED' : 'ACTIVE'}
                    </Text>
                  </View>
                </View>

                {/* Title & Discount Highlight */}
                <Text style={s.couponTitle}>{coupon.title}</Text>
                {Boolean(coupon.description) && (
                  <Text style={s.couponDesc}>{coupon.description}</Text>
                )}

                <View style={s.discountHighlightRow}>
                  <Text style={s.discountHighlightText}>
                    {coupon.discountType === 'PERCENTAGE'
                      ? `${coupon.discountValue}% OFF`
                      : `₹${coupon.discountValue} FLAT OFF`}
                    {coupon.discountType === 'PERCENTAGE' && coupon.maxDiscountAmount
                      ? ` (Up to ₹${coupon.maxDiscountAmount})`
                      : ''}
                  </Text>
                </View>

                {/* Details Grid */}
                <View style={s.detailsGrid}>
                  <Text style={s.detailItem}>
                    💰 Min Booking:{' '}
                    <Text style={s.detailVal}>
                      {coupon.minimumBookingAmount ? `₹${coupon.minimumBookingAmount}` : 'None'}
                    </Text>
                  </Text>
                  <Text style={s.detailItem}>
                    📅 Valid until:{' '}
                    <Text style={s.detailVal}>
                      {new Date(coupon.expiresAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </Text>
                  </Text>
                  <Text style={s.detailItem}>
                    👥 Uses Limit:{' '}
                    <Text style={s.detailVal}>
                      {coupon.usedCount} / {coupon.totalUsageLimit ?? '∞'}
                    </Text>
                  </Text>
                  <Text style={s.detailItem}>
                    👤 Per Customer:{' '}
                    <Text style={s.detailVal}>{coupon.perCustomerUsageLimit} time(s)</Text>
                  </Text>
                </View>

                {/* Actions row */}
                <View style={s.cardActions}>
                  <Pressable
                    style={s.actionBtnSecondary}
                    onPress={() => openAnalytics(coupon)}
                  >
                    <Text style={s.actionBtnSecondaryText}>📊 Stats</Text>
                  </Pressable>

                  {!isExpired && (
                    <Pressable
                      disabled={isToggling}
                      style={[
                        s.actionBtnSecondary,
                        isPaused ? s.activateBtn : s.pauseBtn
                      ]}
                      onPress={() => handleToggleStatus(coupon)}
                    >
                      <Text style={[
                        s.actionBtnSecondaryText,
                        isPaused ? s.activateBtnText : s.pauseBtnText
                      ]}>
                        {isPaused ? '▶ Resume' : '⏸ Pause'}
                      </Text>
                    </Pressable>
                  )}

                  <Pressable
                    style={s.actionBtnSecondary}
                    onPress={() => openEditModal(coupon)}
                  >
                    <Text style={s.actionBtnSecondaryText}>✏️ Edit</Text>
                  </Pressable>

                  <Pressable
                    style={[s.actionBtnSecondary, s.deleteBtn]}
                    onPress={() => handleDelete(coupon)}
                  >
                    <Text style={s.deleteBtnText}>🗑 Delete</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* CREATE / EDIT MODAL */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContainer}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>
                {editingCoupon ? `Edit Coupon ${editingCoupon.code}` : 'Create New Coupon'}
              </Text>
              <Pressable onPress={() => setModalVisible(false)} style={s.closeBtn}>
                <Text style={s.closeBtnText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={s.modalContent} showsVerticalScrollIndicator={false}>
              {/* Coupon Code */}
              <Text style={s.inputLabel}>Coupon Code *</Text>
              <TextInput
                style={[s.input, editingCoupon && s.inputDisabled]}
                placeholder="e.g. WELCOME10, FESTIVE50"
                placeholderTextColor={colors.muted}
                value={code}
                onChangeText={(t) => setCode(t.toUpperCase().replace(/\s+/g, ''))}
                editable={!editingCoupon}
                autoCapitalize="characters"
              />
              <Text style={s.fieldHint}>
                Letters and numbers only. Codes are unique to your salon.
              </Text>

              {/* Title & Description */}
              <Text style={s.inputLabel}>Title *</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. New Client Welcome Offer"
                placeholderTextColor={colors.muted}
                value={title}
                onChangeText={setTitle}
              />

              <Text style={s.inputLabel}>Description (Optional)</Text>
              <TextInput
                style={[s.input, s.inputMulti]}
                placeholder="Short terms or conditions"
                placeholderTextColor={colors.muted}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={2}
              />

              {/* Discount Type */}
              <Text style={s.inputLabel}>Discount Type *</Text>
              <View style={s.radioRow}>
                <Pressable
                  onPress={() => setDiscountType('PERCENTAGE')}
                  style={[s.radioOption, discountType === 'PERCENTAGE' && s.radioOptionActive]}
                >
                  <Text style={[s.radioText, discountType === 'PERCENTAGE' && s.radioTextActive]}>
                    Percentage (%)
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setDiscountType('FIXED')}
                  style={[s.radioOption, discountType === 'FIXED' && s.radioOptionActive]}
                >
                  <Text style={[s.radioText, discountType === 'FIXED' && s.radioTextActive]}>
                    Fixed Amount (₹)
                  </Text>
                </Pressable>
              </View>

              {/* Discount Value & Max Cap */}
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.inputLabel}>
                    {discountType === 'PERCENTAGE' ? 'Discount (%) *' : 'Discount (₹) *'}
                  </Text>
                  <TextInput
                    style={s.input}
                    placeholder={discountType === 'PERCENTAGE' ? 'e.g. 20' : 'e.g. 200'}
                    placeholderTextColor={colors.muted}
                    value={discountValue}
                    onChangeText={setDiscountValue}
                    keyboardType="numeric"
                  />
                </View>

                {discountType === 'PERCENTAGE' && (
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={s.inputLabel}>Max Cap (₹)</Text>
                    <TextInput
                      style={s.input}
                      placeholder="e.g. 500"
                      placeholderTextColor={colors.muted}
                      value={maxDiscountAmount}
                      onChangeText={setMaxDiscountAmount}
                      keyboardType="numeric"
                    />
                  </View>
                )}
              </View>

              {/* Minimum Booking Amount */}
              <Text style={s.inputLabel}>Minimum Booking Amount (₹)</Text>
              <TextInput
                style={s.input}
                placeholder="0 for no minimum"
                placeholderTextColor={colors.muted}
                value={minimumBookingAmount}
                onChangeText={setMinimumBookingAmount}
                keyboardType="numeric"
              />

              {/* Dates */}
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.inputLabel}>Start Date</Text>
                  <TextInput
                    style={s.input}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.muted}
                    value={startDate}
                    onChangeText={setStartDate}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={s.inputLabel}>Expiry Date *</Text>
                  <TextInput
                    style={s.input}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.muted}
                    value={endDate}
                    onChangeText={setEndDate}
                  />
                </View>
              </View>

              {/* Expiry Quick Buttons */}
              <View style={s.quickDatesRow}>
                <Pressable
                  onPress={() => setEndDate(new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0])}
                  style={s.quickDateBtn}
                >
                  <Text style={s.quickDateText}>+7 Days</Text>
                </Pressable>
                <Pressable
                  onPress={() => setEndDate(new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0])}
                  style={s.quickDateBtn}
                >
                  <Text style={s.quickDateText}>+14 Days</Text>
                </Pressable>
                <Pressable
                  onPress={() => setEndDate(new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0])}
                  style={s.quickDateBtn}
                >
                  <Text style={s.quickDateText}>+30 Days</Text>
                </Pressable>
                <Pressable
                  onPress={() => setEndDate(new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0])}
                  style={s.quickDateBtn}
                >
                  <Text style={s.quickDateText}>+60 Days</Text>
                </Pressable>
              </View>

              {/* Limits */}
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.inputLabel}>Total Uses Limit</Text>
                  <TextInput
                    style={s.input}
                    placeholder="e.g. 100 (Blank = ∞)"
                    placeholderTextColor={colors.muted}
                    value={totalUsageLimit}
                    onChangeText={setTotalUsageLimit}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={s.inputLabel}>Per Client Limit</Text>
                  <TextInput
                    style={s.input}
                    placeholder="e.g. 1"
                    placeholderTextColor={colors.muted}
                    value={perCustomerLimit}
                    onChangeText={setPerCustomerLimit}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Status Radio */}
              <Text style={s.inputLabel}>Initial Status</Text>
              <View style={s.radioRow}>
                <Pressable
                  onPress={() => setStatus('ACTIVE')}
                  style={[s.radioOption, status === 'ACTIVE' && s.radioOptionActive]}
                >
                  <Text style={[s.radioText, status === 'ACTIVE' && s.radioTextActive]}>
                    Active (Live)
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setStatus('PAUSED')}
                  style={[s.radioOption, status === 'PAUSED' && s.radioOptionActive]}
                >
                  <Text style={[s.radioText, status === 'PAUSED' && s.radioTextActive]}>
                    Paused (Draft)
                  </Text>
                </Pressable>
              </View>

              <View style={{ height: 16 }} />
              <PrimaryButton
                label={submitting ? 'Saving...' : editingCoupon ? 'Update Coupon' : 'Create Coupon'}
                onPress={handleSaveCoupon}
                disabled={submitting}
              />
              <View style={{ height: 10 }} />
              <SecondaryButton
                label="Cancel"
                onPress={() => setModalVisible(false)}
                disabled={submitting}
              />
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ANALYTICS MODAL */}
      <Modal visible={analyticsVisible} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContainer}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>
                {analyticsData?.coupon?.code ? `Coupon Analytics: ${analyticsData.coupon.code}` : 'Coupon Analytics'}
              </Text>
              <Pressable onPress={() => setAnalyticsVisible(false)} style={s.closeBtn}>
                <Text style={s.closeBtnText}>✕</Text>
              </Pressable>
            </View>

            {loadingAnalytics ? (
              <View style={[s.centerWrap, { padding: 40 }]}>
                <ActivityIndicator size="large" color={colors.gold} />
                <Text style={s.loadingText}>Fetching redemption metrics...</Text>
              </View>
            ) : analyticsData ? (
              <ScrollView contentContainerStyle={s.modalContent} showsVerticalScrollIndicator={false}>
                <Text style={s.analyticsCouponTitle}>{analyticsData.coupon.title}</Text>
                <Text style={s.analyticsCouponDesc}>{analyticsData.coupon.description || 'No description provided'}</Text>

                <View style={s.analyticsGrid}>
                  <View style={s.analyticsCard}>
                    <Text style={s.analyticsNum}>{analyticsData.metrics.totalRedemptions}</Text>
                    <Text style={s.analyticsLabel}>Total Bookings</Text>
                  </View>
                  <View style={s.analyticsCard}>
                    <Text style={[s.analyticsNum, { color: '#059669' }]}>
                      ₹{analyticsData.metrics.totalDiscountGranted.toLocaleString('en-IN')}
                    </Text>
                    <Text style={s.analyticsLabel}>Total Savings Given</Text>
                  </View>
                  <View style={s.analyticsCard}>
                    <Text style={[s.analyticsNum, { color: '#2563EB' }]}>
                      ₹{analyticsData.metrics.grossBookingsValue.toLocaleString('en-IN')}
                    </Text>
                    <Text style={s.analyticsLabel}>Gross Booking Value</Text>
                  </View>
                  <View style={s.analyticsCard}>
                    <Text style={s.analyticsNum}>
                      {analyticsData.metrics.remainingUses ?? 'Unlimited'}
                    </Text>
                    <Text style={s.analyticsLabel}>Remaining Uses</Text>
                  </View>
                </View>

                <Text style={s.subSectionTitle}>Recent Redemptions</Text>
                {analyticsData.recentRedemptions.length === 0 ? (
                  <View style={s.emptyRedemptions}>
                    <Text style={s.emptyRedemptionsText}>No bookings have redeemed this coupon yet.</Text>
                  </View>
                ) : (
                  analyticsData.recentRedemptions.map((r) => (
                    <View key={r.id} style={s.redemptionRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.redemptionDate}>
                          {new Date(r.date).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </Text>
                        <Text style={s.redemptionAppt}>Booking #{r.appointmentId.slice(-6)}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={s.redemptionDiscount}>-₹{r.discountAmount}</Text>
                        <Text style={s.redemptionFinal}>Paid: ₹{r.finalPrice}</Text>
                      </View>
                    </View>
                  ))
                )}

                <View style={{ height: 20 }} />
                <SecondaryButton label="Close" onPress={() => setAnalyticsVisible(false)} />
                <View style={{ height: 20 }} />
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  createBtn: {
    backgroundColor: colors.gold,
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill
  },
  content: {
    padding: 16,
    paddingBottom: 40
  },
  statsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    elevation: 2,
    shadowColor: colors.espresso,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4
  },
  statsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.espresso,
    marginBottom: 12
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  statBox: {
    flex: 1,
    alignItems: 'center'
  },
  statNum: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.espresso
  },
  statLabel: {
    fontSize: 10,
    color: colors.muted,
    marginTop: 4,
    textAlign: 'center'
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16
  },
  filterPill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  filterPillActive: {
    backgroundColor: colors.espresso,
    borderColor: colors.espresso
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted
  },
  filterPillTextActive: {
    color: colors.gold,
    fontWeight: '700'
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
  couponCardPaused: {
    borderColor: '#F59E0B',
    borderLeftWidth: 4
  },
  couponCardExpired: {
    opacity: 0.75,
    borderColor: '#9CA3AF'
  },
  cardHeaderRow: {
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
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill
  },
  statusBadgeActive: {
    backgroundColor: '#DEF7EC'
  },
  statusBadgePaused: {
    backgroundColor: '#FEF3C7'
  },
  statusBadgeExpired: {
    backgroundColor: '#F3F4F6'
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800'
  },
  statusTextActive: {
    color: '#03543F'
  },
  statusTextPaused: {
    color: '#92400E'
  },
  statusTextExpired: {
    color: '#6B7280'
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
  discountHighlightRow: {
    marginTop: 8,
    marginBottom: 10
  },
  discountHighlightText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.gold
  },
  detailsGrid: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: 10,
    gap: 4,
    marginBottom: 12
  },
  detailItem: {
    fontSize: 12,
    color: colors.muted
  },
  detailVal: {
    fontWeight: '600',
    color: colors.ink
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
    marginTop: 4
  },
  actionBtnSecondary: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border
  },
  actionBtnSecondaryText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.espresso
  },
  activateBtn: {
    borderColor: '#059669',
    backgroundColor: '#DEF7EC'
  },
  activateBtnText: {
    color: '#059669'
  },
  pauseBtn: {
    borderColor: '#D97706',
    backgroundColor: '#FEF3C7'
  },
  pauseBtnText: {
    color: '#D97706'
  },
  deleteBtn: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2'
  },
  deleteBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626'
  },
  centerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  modalContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '90%'
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: colors.border
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.espresso
  },
  closeBtn: {
    padding: 6
  },
  closeBtnText: {
    fontSize: 18,
    color: colors.muted
  },
  modalContent: {
    padding: 16
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.espresso,
    marginTop: 10,
    marginBottom: 4
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.ink
  },
  inputDisabled: {
    backgroundColor: '#F3F4F6',
    color: '#9CA3AF'
  },
  inputMulti: {
    minHeight: 56,
    textAlignVertical: 'top'
  },
  fieldHint: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2
  },
  row: {
    flexDirection: 'row'
  },
  radioRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4
  },
  radioOption: {
    flex: 1,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: colors.background
  },
  radioOptionActive: {
    backgroundColor: colors.espresso,
    borderColor: colors.espresso
  },
  radioText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted
  },
  radioTextActive: {
    color: colors.gold,
    fontWeight: '700'
  },
  quickDatesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8
  },
  quickDateBtn: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 4,
    alignItems: 'center'
  },
  quickDateText: {
    fontSize: 11,
    color: colors.espresso,
    fontWeight: '600'
  },
  analyticsCouponTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.espresso
  },
  analyticsCouponDesc: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
    marginBottom: 16
  },
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18
  },
  analyticsCard: {
    width: '48%',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    alignItems: 'center'
  },
  analyticsNum: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.espresso
  },
  analyticsLabel: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 4,
    textAlign: 'center'
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.espresso,
    marginBottom: 8
  },
  emptyRedemptions: {
    padding: 16,
    alignItems: 'center'
  },
  emptyRedemptionsText: {
    fontSize: 12,
    color: colors.muted
  },
  redemptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: colors.border
  },
  redemptionDate: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink
  },
  redemptionAppt: {
    fontSize: 11,
    color: colors.muted
  },
  redemptionDiscount: {
    fontSize: 12,
    fontWeight: '800',
    color: '#059669'
  },
  redemptionFinal: {
    fontSize: 11,
    color: colors.muted
  }
});
