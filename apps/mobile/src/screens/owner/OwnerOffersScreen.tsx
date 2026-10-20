import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { PrimaryButton, SecondaryButton } from '../../components/Buttons';
import { colors, radius } from '../../constants/theme';
import { dialogService } from '../../services/dialog.service';
import { CreateOfferPayload, offerService } from '../../services/offer.service';
import { DiscountType, SalonOffer, SalonOwnerData } from '../../types';

interface OwnerOffersScreenProps {
  token: string;
  salon: SalonOwnerData | null;
  onBack: () => void;
}

export function OwnerOffersScreen({ token, salon, onBack }: OwnerOffersScreenProps) {
  const [offers, setOffers] = useState<SalonOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingOffer, setEditingOffer] = useState<SalonOffer | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<DiscountType>('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState('');
  const [applicableService, setApplicableService] = useState('ALL');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
  );
  const [imageUrl, setImageUrl] = useState('');
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const loadOffers = async () => {
    setLoading(true);
    try {
      const res = await offerService.getOwnerOffers(token);
      setOffers(res.data || []);
    } catch (e) {
      dialogService.showError('Error', e instanceof Error ? e.message : 'Failed to load offers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOffers();
  }, [token]);

  const handlePickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        dialogService.showWarning(
          'Permission Required',
          'Gallery access is needed to select a promotional banner image.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
        base64: true
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];

      // Validate file size (max 5MB)
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        dialogService.showWarning('File Too Large', 'Please select an image smaller than 5MB.');
        return;
      }

      // Validate mime type if available
      if (asset.mimeType) {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
        if (!allowed.includes(asset.mimeType.toLowerCase())) {
          dialogService.showWarning('Invalid Format', 'Supported formats: JPEG, PNG, WebP.');
          return;
        }
      }

      setLocalImageUri(asset.uri);
      setUploadingImage(true);

      const mime = asset.mimeType || 'image/jpeg';
      const base64Data = asset.base64
        ? `data:${mime};base64,${asset.base64}`
        : asset.uri;

      try {
        const uploadRes = await offerService.uploadOfferImage(token, base64Data, mime);
        setImageUrl(uploadRes.url);
      } catch (err) {
        dialogService.showError(
          'Upload Notice',
          err instanceof Error ? err.message : 'Could not upload image. Please try again.'
        );
        setLocalImageUri(null);
        setImageUrl('');
      } finally {
        setUploadingImage(false);
      }
    } catch (e) {
      dialogService.showError('Image Picker Error', e instanceof Error ? e.message : 'Failed to select image.');
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = () => {
    setLocalImageUri(null);
    setImageUrl('');
  };

  const openCreateModal = () => {
    setEditingOffer(null);
    setTitle('');
    setDescription('');
    setDiscountType('PERCENTAGE');
    setDiscountValue('20');
    setApplicableService('ALL');
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate(new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]);
    setImageUrl('');
    setLocalImageUri(null);
    setIsActive(true);
    setModalVisible(true);
  };

  const openEditModal = (offer: SalonOffer) => {
    setEditingOffer(offer);
    setTitle(offer.title);
    setDescription(offer.description);
    setDiscountType(offer.discountType);
    setDiscountValue(offer.discountValue.toString());
    setApplicableService(offer.applicableService || 'ALL');
    setStartDate(
      offer.startDate ? offer.startDate.split('T')[0] : new Date().toISOString().split('T')[0]
    );
    setEndDate(offer.endDate ? offer.endDate.split('T')[0] : '');
    setImageUrl(offer.image || '');
    setLocalImageUri(offer.image || null);
    setIsActive(offer.isActive);
    setModalVisible(true);
  };

  const handleSaveOffer = async () => {
    if (uploadingImage) {
      dialogService.showInfo('Upload in Progress', 'Please wait for your banner image to finish uploading.');
      return;
    }
    if (!title.trim() || !description.trim() || !discountValue || !endDate) {
      dialogService.showError('Validation Error', 'Please fill in all required fields (title, description, discount, end date).');
      return;
    }

    const val = parseFloat(discountValue);
    if (isNaN(val) || val <= 0) {
      dialogService.showError('Invalid Discount', 'Please enter a valid positive discount amount.');
      return;
    }

    if (discountType === 'PERCENTAGE' && val > 100) {
      dialogService.showError('Invalid Percentage', 'Discount percentage cannot exceed 100%.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: CreateOfferPayload = {
        title: title.trim(),
        description: description.trim(),
        discountType,
        discountValue: val,
        applicableService,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        image: imageUrl.trim() || undefined,
        isActive
      };

      if (editingOffer) {
        await offerService.updateOffer(token, editingOffer._id, payload);
        dialogService.showSuccess('Offer Updated', 'Your offer has been saved successfully.');
      } else {
        await offerService.createOffer(token, payload);
        dialogService.showSuccess(
          '🔥 Offer Published!',
          `Your offer has been published. If active, push notifications were broadcast to all registered customers!`
        );
      }

      setModalVisible(false);
      await loadOffers();
    } catch (e) {
      dialogService.showError('Save Failed', e instanceof Error ? e.message : 'Could not save offer.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (offer: SalonOffer) => {
    setTogglingId(offer._id);
    try {
      const res = await offerService.toggleOffer(token, offer._id);
      setOffers((prev) =>
        prev.map((o) => (o._id === offer._id ? { ...o, isActive: res.offer.isActive } : o))
      );
    } catch (e) {
      dialogService.showError('Toggle Error', e instanceof Error ? e.message : 'Failed to update offer status.');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = (offer: SalonOffer) => {
    dialogService.showConfirm(
      'Delete Offer',
      `Are you sure you want to delete "${offer.title}"? This cannot be undone.`,
      {
        confirmText: 'Delete',
        cancelText: 'Cancel',
        isDestructive: true,
        onConfirm: async () => {
          try {
            await offerService.deleteOffer(token, offer._id);
            setOffers((prev) => prev.filter((o) => o._id !== offer._id));
            dialogService.showSuccess('Offer Deleted', 'The offer has been removed.');
          } catch (e) {
            dialogService.showError('Delete Failed', e instanceof Error ? e.message : 'Could not delete offer.');
          }
        }
      }
    );
  };

  const filteredOffers = offers.filter((o) => {
    if (filter === 'ACTIVE') return o.isActive;
    if (filter === 'INACTIVE') return !o.isActive;
    return true;
  });

  return (
    <View style={s.page}>
      {/* Top Header */}
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backBtn}>
          <Text style={s.backText}>← Back</Text>
        </Pressable>
        <Text style={s.headerTitle}>Offers & Promotions</Text>
        <Pressable onPress={openCreateModal} style={s.createBtn}>
          <Text style={s.createBtnText}>+ New Offer</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Banner */}
        <View style={s.bannerCard}>
          <View style={s.bannerRow}>
            <Text style={s.bannerIcon}>🔥</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.bannerTitle}>Promote Your Salon</Text>
              <Text style={s.bannerBody}>
                Publish offers with discounts on services. Active offers trigger instant push notifications to customers!
              </Text>
            </View>
          </View>
        </View>

        {/* Filter Pills */}
        <View style={s.filterRow}>
          {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setFilter(tab)}
              style={[s.filterPill, filter === tab && s.filterPillActive]}
            >
              <Text style={[s.filterPillText, filter === tab && s.filterPillTextActive]}>
                {tab === 'ALL' ? `All (${offers.length})` : tab === 'ACTIVE' ? `Active (${offers.filter((o) => o.isActive).length})` : `Inactive (${offers.filter((o) => !o.isActive).length})`}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Offer Cards List */}
        {loading ? (
          <View style={s.centerWrap}>
            <ActivityIndicator size="large" color={colors.gold} />
            <Text style={s.loadingText}>Loading your promotional offers...</Text>
          </View>
        ) : filteredOffers.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyIcon}>🏷️</Text>
            <Text style={s.emptyTitle}>No Offers Found</Text>
            <Text style={s.emptyBody}>
              {filter === 'ALL'
                ? 'You have not created any promotional offers yet. Tap "+ New Offer" to attract more clients.'
                : `No ${filter.toLowerCase()} offers currently found.`}
            </Text>
            <View style={{ marginTop: 14 }}>
              <PrimaryButton label="+ Create First Offer" onPress={openCreateModal} />
            </View>
          </View>
        ) : (
          filteredOffers.map((offer, index) => {
            const isToggling = togglingId === offer._id;
            const endStr = offer.endDate ? new Date(offer.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Ongoing';
            const serviceName =
              offer.applicableService === 'ALL'
                ? 'All Services'
                : salon?.services?.find((s) => s.id === offer.applicableService || (s as any)._id === offer.applicableService)?.name || 'Specific Service';

            return (
              <View key={`${offer._id}-${index}`} style={[s.offerCard, !offer.isActive && s.offerCardInactive]}>
                {offer.image ? (
                  <Image source={{ uri: offer.image }} style={s.cardBannerImage} resizeMode="cover" />
                ) : null}
                <View style={s.cardTopRow}>
                  <View style={s.discountBadge}>
                    <Text style={s.discountBadgeText}>
                      {offer.discountType === 'PERCENTAGE'
                        ? `${offer.discountValue}% OFF`
                        : `₹${offer.discountValue} OFF`}
                    </Text>
                  </View>
                  <View style={[s.statusPill, offer.isActive ? s.statusPillActive : s.statusPillInactive]}>
                    <Text style={[s.statusPillText, offer.isActive ? s.statusPillTextActive : s.statusPillTextInactive]}>
                      {offer.isActive ? '● ACTIVE' : '○ INACTIVE'}
                    </Text>
                  </View>
                </View>

                <Text style={s.offerTitle}>{offer.title}</Text>
                <Text style={s.offerDesc}>{offer.description}</Text>

                <View style={s.metaWrap}>
                  <Text style={s.metaItem}>🎯 Applicable: <Text style={{ fontWeight: '700', color: colors.ink }}>{serviceName}</Text></Text>
                  <Text style={s.metaItem}>📅 Valid until: <Text style={{ fontWeight: '700', color: colors.ink }}>{endStr}</Text></Text>
                </View>

                {/* Offer Actions */}
                <View style={s.cardActions}>
                  <Pressable
                    disabled={isToggling}
                    onPress={() => handleToggle(offer)}
                    style={[
                      s.toggleBtn,
                      offer.isActive ? s.toggleBtnDeactivate : s.toggleBtnActivate,
                      isToggling && { opacity: 0.5 }
                    ]}
                  >
                    <Text
                      style={[
                        s.toggleBtnText,
                        offer.isActive ? s.toggleBtnTextDeactivate : s.toggleBtnTextActivate
                      ]}
                    >
                      {isToggling ? 'Updating...' : offer.isActive ? 'Deactivate' : 'Activate'}
                    </Text>
                  </Pressable>

                  <Pressable onPress={() => openEditModal(offer)} style={s.editBtn}>
                    <Text style={s.editBtnText}>✏️ Edit</Text>
                  </Pressable>

                  <Pressable onPress={() => handleDelete(offer)} style={s.deleteBtn}>
                    <Text style={s.deleteBtnText}>🗑️</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Create / Edit Offer Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{editingOffer ? 'Edit Promotion Offer' : 'Create New Offer'}</Text>
              <Pressable onPress={() => setModalVisible(false)} style={s.closeBtn}>
                <Text style={s.closeText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={s.modalBody} showsVerticalScrollIndicator={false}>
              {/* Title */}
              <Text style={s.inputLabel}>Offer Title *</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. 20% OFF Hair Services"
                placeholderTextColor={colors.muted}
                value={title}
                onChangeText={setTitle}
              />

              {/* Description */}
              <Text style={s.inputLabel}>Description *</Text>
              <TextInput
                style={[s.input, s.textArea]}
                placeholder="Describe your special deal, treatment details, and seasonal terms..."
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={3}
                value={description}
                onChangeText={setDescription}
              />

              {/* Discount Type */}
              <Text style={s.inputLabel}>Discount Type</Text>
              <View style={s.segmentRow}>
                <Pressable
                  onPress={() => setDiscountType('PERCENTAGE')}
                  style={[s.segmentBtn, discountType === 'PERCENTAGE' && s.segmentBtnActive]}
                >
                  <Text style={[s.segmentBtnText, discountType === 'PERCENTAGE' && s.segmentBtnTextActive]}>
                    % Percentage Discount
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setDiscountType('FIXED')}
                  style={[s.segmentBtn, discountType === 'FIXED' && s.segmentBtnActive]}
                >
                  <Text style={[s.segmentBtnText, discountType === 'FIXED' && s.segmentBtnTextActive]}>
                    ₹ Fixed Amount Off
                  </Text>
                </Pressable>
              </View>

              {/* Discount Value */}
              <Text style={s.inputLabel}>
                {discountType === 'PERCENTAGE' ? 'Discount Percentage (%) *' : 'Discount Amount (₹) *'}
              </Text>
              <TextInput
                style={s.input}
                keyboardType="numeric"
                placeholder={discountType === 'PERCENTAGE' ? '20' : '500'}
                placeholderTextColor={colors.muted}
                value={discountValue}
                onChangeText={setDiscountValue}
              />

              {/* Applicable Service */}
              <Text style={s.inputLabel}>Applicable Service</Text>
              <View style={s.servicePillsWrap}>
                <Pressable
                  onPress={() => setApplicableService('ALL')}
                  style={[s.servicePill, applicableService === 'ALL' && s.servicePillActive]}
                >
                  <Text style={[s.servicePillText, applicableService === 'ALL' && s.servicePillTextActive]}>
                    ✦ All Services
                  </Text>
                </Pressable>
                {salon?.services?.map((svc) => {
                  const sId = (svc.id || (svc as any)._id || svc.name).toString();
                  return (
                    <Pressable
                      key={sId}
                      onPress={() => setApplicableService(sId)}
                      style={[s.servicePill, applicableService === sId && s.servicePillActive]}
                    >
                      <Text style={[s.servicePillText, applicableService === sId && s.servicePillTextActive]}>
                        {svc.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Dates */}
              <View style={s.dateRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={s.inputLabel}>Start Date</Text>
                  <TextInput
                    style={s.input}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.muted}
                    value={startDate}
                    onChangeText={setStartDate}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.inputLabel}>End Date *</Text>
                  <TextInput
                    style={s.input}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.muted}
                    value={endDate}
                    onChangeText={setEndDate}
                  />
                </View>
              </View>

              {/* Date Shortcuts */}
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
              </View>

              {/* Offer Banner Image Picker */}
              <Text style={s.inputLabel}>Offer Banner Image</Text>
              {localImageUri || imageUrl ? (
                <View style={s.imagePreviewContainer}>
                  <Image
                    source={{ uri: localImageUri || imageUrl }}
                    style={s.previewImage}
                    resizeMode="cover"
                  />
                  {uploadingImage && (
                    <View style={s.uploadingOverlay}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={s.uploadingText}>Uploading to Cloudinary...</Text>
                    </View>
                  )}
                  <View style={s.imageActionButtons}>
                    <Pressable
                      style={s.replaceImageBtn}
                      onPress={handlePickImage}
                      disabled={uploadingImage}
                    >
                      <Text style={s.replaceImageBtnText}>📷 Replace</Text>
                    </Pressable>
                    <Pressable
                      style={s.removeImageBtn}
                      onPress={handleRemoveImage}
                      disabled={uploadingImage}
                    >
                      <Text style={s.removeImageBtnText}>✕ Remove</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  style={s.pickImagePlaceholder}
                  onPress={handlePickImage}
                  disabled={uploadingImage}
                >
                  <Text style={s.pickImageIcon}>🖼️</Text>
                  <Text style={s.pickImageTitle}>Choose Offer Image</Text>
                  <Text style={s.pickImageSubtitle}>
                    Select from device gallery • JPEG, PNG, WebP (Max 5MB)
                  </Text>
                </Pressable>
              )}

              {/* Active / Inactive Switch */}
              <View style={s.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.toggleLabel}>Active Status</Text>
                  <Text style={s.toggleSub}>
                    {isActive ? 'Offer is live. Creating will notify registered customers!' : 'Offer is saved as draft and not visible to clients.'}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setIsActive(!isActive)}
                  style={[s.switchTrack, isActive && s.switchTrackActive]}
                >
                  <View style={[s.switchThumb, isActive && s.switchThumbActive]} />
                </Pressable>
              </View>

              {/* Submit Buttons */}
              <View style={s.modalActions}>
                <PrimaryButton
                  label={editingOffer ? 'Save Offer Changes' : '🔥 Publish & Broadcast Notification'}
                  loading={submitting}
                  onPress={handleSaveOffer}
                />
                <View style={{ marginTop: 10 }}>
                  <SecondaryButton label="Cancel" onPress={() => setModalVisible(false)} />
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,

    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  backBtn: { paddingVertical: 6, paddingRight: 8 },
  backText: { color: colors.gold, fontSize: 13, fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.ink },
  createBtn: {
    backgroundColor: colors.gold,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill
  },
  createBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  content: { padding: 18, paddingBottom: 40 },
  bannerCard: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 16
  },
  bannerRow: { flexDirection: 'row', alignItems: 'center' },
  bannerIcon: { fontSize: 24, marginRight: 12 },
  bannerTitle: { fontSize: 14, fontWeight: '800', color: '#92400E' },
  bannerBody: { fontSize: 12, color: '#78350F', marginTop: 2, lineHeight: 17 },

  filterRow: { flexDirection: 'row', marginBottom: 16 },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    marginRight: 8
  },
  filterPillActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  filterPillText: { fontSize: 12, fontWeight: '700', color: colors.muted },
  filterPillTextActive: { color: '#FFFFFF' },

  centerWrap: { padding: 40, alignItems: 'center' },
  loadingText: { color: colors.muted, marginTop: 12, fontSize: 13 },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 20
  },
  emptyIcon: { fontSize: 36, marginBottom: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.ink },
  emptyBody: {
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18
  },

  offerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 18,
    marginBottom: 14,
    borderColor: colors.border,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2
  },
  offerCardInactive: { opacity: 0.75, backgroundColor: '#F9FAFB' },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  discountBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill
  },
  discountBadgeText: { color: '#B45309', fontSize: 12, fontWeight: '800' },
  statusPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill },
  statusPillActive: { backgroundColor: '#ECFDF5' },
  statusPillInactive: { backgroundColor: '#F3F4F6' },
  statusPillText: { fontSize: 10, fontWeight: '800' },
  statusPillTextActive: { color: '#047857' },
  statusPillTextInactive: { color: '#6B7280' },

  offerTitle: { fontSize: 17, fontWeight: '800', color: colors.ink, marginBottom: 4 },
  offerDesc: { fontSize: 13, color: colors.muted, lineHeight: 18, marginBottom: 12 },
  metaWrap: { backgroundColor: colors.background, padding: 10, borderRadius: radius.sm, marginBottom: 14 },
  metaItem: { fontSize: 12, color: colors.muted, marginBottom: 3 },

  cardActions: { flexDirection: 'row', alignItems: 'center' },
  toggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginRight: 8
  },
  toggleBtnActivate: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  toggleBtnDeactivate: { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' },
  toggleBtnText: { fontSize: 12, fontWeight: '700' },
  toggleBtnTextActivate: { color: '#065F46' },
  toggleBtnTextDeactivate: { color: '#4B5563' },
  editBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8
  },
  editBtnText: { fontSize: 12, fontWeight: '700', color: colors.ink },
  deleteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA'
  },
  deleteBtnText: { fontSize: 12 },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.ink },
  closeBtn: { padding: 4 },
  closeText: { fontSize: 18, color: colors.muted },
  modalBody: { padding: 20, paddingBottom: 40 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: colors.ink, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.ink
  },
  textArea: { height: 75, textAlignVertical: 'top' },
  segmentRow: { flexDirection: 'row', marginBottom: 6 },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    marginRight: 6
  },
  segmentBtnActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  segmentBtnText: { fontSize: 12, fontWeight: '700', color: colors.muted },
  segmentBtnTextActive: { color: '#FFFFFF' },

  servicePillsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  servicePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background
  },
  servicePillActive: { backgroundColor: colors.goldSoft, borderColor: colors.gold },
  servicePillText: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  servicePillTextActive: { color: colors.gold, fontWeight: '700' },

  dateRow: { flexDirection: 'row' },
  quickDatesRow: { flexDirection: 'row', gap: 8, marginTop: 6, marginBottom: 8 },
  quickDateBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border
  },
  quickDateText: { fontSize: 11, color: colors.gold, fontWeight: '700' },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    padding: 12,
    backgroundColor: colors.background,
    borderRadius: radius.md
  },
  toggleLabel: { fontSize: 13, fontWeight: '700', color: colors.ink },
  toggleSub: { fontSize: 11, color: colors.muted, marginTop: 2 },
  switchTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#D1D5DB',
    padding: 2
  },
  switchTrackActive: { backgroundColor: colors.gold },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF'
  },
  switchThumbActive: { transform: [{ translateX: 20 }] },
  modalActions: { marginTop: 14 },

  cardBannerImage: {
    width: '100%',
    height: 140,
    borderRadius: radius.md,
    marginBottom: 12,
    backgroundColor: colors.surfaceWarm
  },

  imagePreviewContainer: {
    position: 'relative',
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceWarm,
    marginBottom: 6
  },
  previewImage: {
    width: '100%',
    height: 150
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8
  },
  uploadingText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700'
  },
  imageActionButtons: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: colors.surface,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  replaceImageBtn: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: colors.goldSoft,
    borderRadius: radius.sm,
    alignItems: 'center'
  },
  replaceImageBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gold
  },
  removeImageBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: radius.sm,
    alignItems: 'center'
  },
  removeImageBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626'
  },

  pickImagePlaceholder: {
    borderWidth: 1.5,
    borderColor: colors.gold,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    backgroundColor: colors.goldSoft,
    paddingVertical: 20,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6
  },
  pickImageIcon: {
    fontSize: 28,
    marginBottom: 6
  },
  pickImageTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 2
  },
  pickImageSubtitle: {
    fontSize: 11,
    color: colors.muted,
    textAlign: 'center'
  }
});
