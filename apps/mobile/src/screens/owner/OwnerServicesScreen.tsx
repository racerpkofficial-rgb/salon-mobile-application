import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from 'react-native';
import { PrimaryButton, SecondaryButton } from '../../components/Buttons';
import { colors, radius, space, typography } from '../../constants/theme';
import { dialogService } from '../../services/dialog.service';
import { salonService } from '../../services/salon.service';
import { SalonOwnerData, Service } from '../../types';

export interface OwnerServicesScreenProps {
  token: string;
  salon: SalonOwnerData | null;
  onBack: () => void;
  onRefreshSalon?: () => Promise<void> | void;
}

const PRESET_CATEGORIES = [
  'Hair',
  'Styling',
  'Beard & Shave',
  'Facial',
  'Skin Care',
  'Spa',
  'Massage',
  'Nails',
  'Color & Highlights',
  'General'
];

const PRESET_DURATIONS = [15, 30, 45, 60, 90, 120];

export function OwnerServicesScreen({
  token,
  salon,
  onBack,
  onRefreshSalon
}: OwnerServicesScreenProps) {
  // Service list state
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successFeedback, setSuccessFeedback] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Action states
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Modal / Form state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('Hair');
  const [formCustomCategory, setFormCustomCategory] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formDuration, setFormDuration] = useState('30');
  const [formDescription, setFormDescription] = useState('');
  const [formImage, setFormImage] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

  // Show temporary toast feedback
  const showFeedback = useCallback((msg: string) => {
    setSuccessFeedback(msg);
    setTimeout(() => {
      setSuccessFeedback(null);
    }, 3500);
  }, []);

  // Fetch Services from API
  const loadServices = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setErrorMessage(null);

    try {
      const res = await salonService.getOwnerServices(token);
      const list = res.data || [];
      setServices(list);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to load salon services.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    void loadServices();
  }, [loadServices]);

  // Hardware Back Handler
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (modalVisible) {
        setModalVisible(false);
        return true;
      }
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [modalVisible, onBack]);

  // Distinct Categories derived from loaded services + presets
  const availableCategories = useMemo(() => {
    const catSet = new Set<string>();
    services.forEach((s) => {
      if (s.category && s.category.trim()) catSet.add(s.category.trim());
    });
    return Array.from(catSet);
  }, [services]);

  // Filtered Services List
  const filteredServices = useMemo(() => {
    return services.filter((serv) => {
      // 1. Status Filter
      if (statusFilter === 'ACTIVE' && serv.isActive === false) return false;
      if (statusFilter === 'INACTIVE' && serv.isActive !== false) return false;

      // 2. Category Filter
      if (selectedCategory !== 'ALL') {
        const cat = (serv.category || 'General').toLowerCase();
        if (cat !== selectedCategory.toLowerCase()) return false;
      }

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = serv.name.toLowerCase().includes(q);
        const matchesCat = (serv.category || '').toLowerCase().includes(q);
        const matchesDesc = (serv.description || '').toLowerCase().includes(q);
        if (!matchesName && !matchesCat && !matchesDesc) return false;
      }

      return true;
    });
  }, [services, statusFilter, selectedCategory, searchQuery]);

  // Active / Inactive Counts
  const activeCount = useMemo(
    () => services.filter((s) => s.isActive !== false).length,
    [services]
  );
  const inactiveCount = useMemo(
    () => services.filter((s) => s.isActive === false).length,
    [services]
  );

  // Form Handlers
  const handleOpenAddModal = () => {
    setEditingService(null);
    setFormName('');
    setFormCategory('Hair');
    setFormCustomCategory('');
    setFormPrice('');
    setFormDuration('30');
    setFormDescription('');
    setFormImage('');
    setFormIsActive(true);
    setFormError(null);
    setModalVisible(true);
  };

  const handleOpenEditModal = (service: Service) => {
    setEditingService(service);
    setFormName(service.name);

    const existingCat = service.category || 'General';
    if (PRESET_CATEGORIES.includes(existingCat)) {
      setFormCategory(existingCat);
      setFormCustomCategory('');
    } else {
      setFormCategory('Other');
      setFormCustomCategory(existingCat);
    }

    const priceNum =
      typeof service.price === 'number'
        ? service.price
        : parseFloat(String(service.price).replace(/[^0-9.]/g, '')) || 0;
    setFormPrice(priceNum.toString());

    const dur =
      service.durationMinutes ||
      (typeof service.duration === 'number'
        ? service.duration
        : parseInt(String(service.duration).replace(/[^0-9]/g, ''), 10) || 30);
    setFormDuration(dur.toString());

    setFormDescription(service.description || '');
    setFormImage(service.image || '');
    setFormIsActive(service.isActive !== false);
    setFormError(null);
    setModalVisible(true);
  };

  const handleSaveService = async () => {
    // 1. Validation
    const nameTrimmed = formName.trim();
    if (!nameTrimmed || nameTrimmed.length < 2) {
      setFormError('Service name is required and must have at least 2 characters.');
      return;
    }

    const priceVal = parseFloat(formPrice);
    if (isNaN(priceVal) || priceVal < 0) {
      setFormError('Price in ₹ is required and must be a valid non-negative number.');
      return;
    }

    const durationVal = parseInt(formDuration, 10);
    if (isNaN(durationVal) || durationVal < 5) {
      setFormError('Duration in minutes is required and must be at least 5 minutes.');
      return;
    }

    const resolvedCategory =
      formCategory === 'Other'
        ? formCustomCategory.trim() || 'General'
        : formCategory.trim() || 'General';

    setSubmitting(true);
    setFormError(null);

    const payload = {
      name: nameTrimmed,
      category: resolvedCategory,
      price: priceVal,
      durationMinutes: durationVal,
      description: formDescription.trim(),
      image: formImage.trim() || undefined,
      isActive: formIsActive
    };

    try {
      if (editingService) {
        const serviceId = editingService._id || editingService.id || '';
        const res = await salonService.updateOwnerService(token, serviceId, payload);
        showFeedback(res.message || 'Service updated successfully ✨');
      } else {
        const res = await salonService.createOwnerService(token, payload);
        showFeedback(res.message || 'New service added to menu 🎉');
      }

      setModalVisible(false);
      await loadServices();
      if (onRefreshSalon) {
        void onRefreshSalon();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save service.';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Service Active Status
  const handleToggle = async (service: Service) => {
    const serviceId = service._id || service.id || '';
    if (!serviceId) return;

    setTogglingId(serviceId);
    try {
      const res = await salonService.toggleOwnerService(token, serviceId);
      // Immediately reflect in local state
      setServices((prev) =>
        prev.map((s) => {
          if ((s._id || s.id) === serviceId) {
            return {
              ...s,
              isActive: res.service?.isActive !== undefined ? res.service.isActive : !s.isActive
            };
          }
          return s;
        })
      );
      showFeedback(
        res.message ||
        (service.isActive ? 'Service deactivated' : 'Service activated successfully')
      );
      if (onRefreshSalon) {
        void onRefreshSalon();
      }
    } catch (err) {
      dialogService.showError(
        'Toggle Status Failed',
        err instanceof Error ? err.message : 'Could not change service status.'
      );
    } finally {
      setTogglingId(null);
    }
  };

  // Delete Service Confirmation & Handler
  const handleDelete = (service: Service) => {
    const serviceId = service._id || service.id || '';
    if (!serviceId) return;

    dialogService.showConfirm(
      'Delete Service',
      `Are you sure you want to remove "${service.name}" from your salon menu? Active bookings will remain intact, but clients won't be able to book this treatment anymore.`,
      {
        confirmText: 'Delete',
        cancelText: 'Cancel',
        isDestructive: true,
        onConfirm: async () => {
          setDeletingId(serviceId);
          try {
            const res = await salonService.deleteOwnerService(token, serviceId);
            setServices((prev) => prev.filter((s) => (s._id || s.id) !== serviceId));
            showFeedback(res.message || 'Service deleted successfully.');
            if (onRefreshSalon) {
              void onRefreshSalon();
            }
          } catch (err) {
            dialogService.showError(
              'Delete Failed',
              err instanceof Error ? err.message : 'Could not delete service.'
            );
          } finally {
            setDeletingId(null);
          }
        }
      }
    );
  };

  return (
    <View style={s.page}>
      {/* 1. Header Bar */}
      <View style={s.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Dashboard"
          onPress={onBack}
          hitSlop={10}
          style={s.backBtn}
        >
          <Text style={s.backText}>← Back</Text>
        </Pressable>

        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Manage Services</Text>
          <Text style={s.headerSubtitle}>
            {salon?.salonName ? `${salon.salonName}` : 'Salon Treatment Menu'}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add New Service"
          onPress={handleOpenAddModal}
          hitSlop={8}
          style={s.headerAddBtn}
        >
          <Text style={s.headerAddBtnText}>+ Add Service</Text>
        </Pressable>
      </View>

      {/* Success Notification Banner */}
      {successFeedback ? (
        <View style={s.feedbackBanner}>
          <Text style={s.feedbackText}>{successFeedback}</Text>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadServices(true)}
            tintColor={colors.gold}
            colors={[colors.gold]}
          />
        }
      >
        {/* 2. Overview Metric Cards */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statValue}>{services.length}</Text>
            <Text style={s.statLabel}>Total Services</Text>
          </View>
          <View style={[s.statCard, s.statCardActive]}>
            <Text style={[s.statValue, s.statValueActive]}>{activeCount}</Text>
            <Text style={s.statLabel}>Active & Bookable</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statValue, s.statValueInactive]}>{inactiveCount}</Text>
            <Text style={s.statLabel}>Inactive / Paused</Text>
          </View>
        </View>

        {/* 3. Search Bar */}
        <View style={s.searchWrap}>
          <Text style={s.searchIcon}>🔍</Text>
          <TextInput
            style={s.searchInput}
            placeholder="Search treatments by name or category..."
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <Text style={s.clearSearch}>✕</Text>
            </Pressable>
          ) : null}
        </View>

        {/* 4. Filter Pills: Status */}
        <View style={s.filterRow}>
          {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((tab) => {
            const isSel = statusFilter === tab;
            const count =
              tab === 'ALL'
                ? services.length
                : tab === 'ACTIVE'
                  ? activeCount
                  : inactiveCount;
            return (
              <Pressable
                key={tab}
                accessibilityRole="button"
                onPress={() => setStatusFilter(tab)}
                style={[s.filterPill, isSel && s.filterPillSelected]}
              >
                <Text style={[s.filterPillText, isSel && s.filterPillTextSelected]}>
                  {tab === 'ALL' ? 'All Services' : tab === 'ACTIVE' ? 'Active' : 'Inactive'} ({count})
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* 5. Category Chips (Horizontal Scroll) */}
        {availableCategories.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.catChipsRow}
          >
            <Pressable
              onPress={() => setSelectedCategory('ALL')}
              style={[
                s.catChip,
                selectedCategory === 'ALL' && s.catChipSelected
              ]}
            >
              <Text
                style={[
                  s.catChipText,
                  selectedCategory === 'ALL' && s.catChipTextSelected
                ]}
              >
                All Categories
              </Text>
            </Pressable>

            {availableCategories.map((cat) => {
              const isSel = selectedCategory.toLowerCase() === cat.toLowerCase();
              return (
                <Pressable
                  key={cat}
                  onPress={() => setSelectedCategory(isSel ? 'ALL' : cat)}
                  style={[s.catChip, isSel && s.catChipSelected]}
                >
                  <Text style={[s.catChipText, isSel && s.catChipTextSelected]}>
                    {cat}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* 6. Main Content Area */}
        {loading ? (
          <View style={s.centerWrap}>
            <ActivityIndicator size="large" color={colors.gold} />
            <Text style={s.loadingText}>Loading salon service catalog...</Text>
          </View>
        ) : errorMessage ? (
          <View style={s.errorCard}>
            <Text style={s.errorIcon}>⚠️</Text>
            <Text style={s.errorTitle}>Could Not Load Services</Text>
            <Text style={s.errorDesc}>{errorMessage}</Text>
            <View style={{ marginTop: 12 }}>
              <PrimaryButton label="Retry Connection" onPress={() => loadServices()} />
            </View>
          </View>
        ) : filteredServices.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyIcon}>✂️</Text>
            <Text style={s.emptyTitle}>
              {services.length === 0
                ? 'No Services Configured'
                : 'No Matching Services'}
            </Text>
            <Text style={s.emptyBody}>
              {services.length === 0
                ? 'Your salon menu is currently empty. Add your haircuts, coloring, facials, and styling packages so clients can browse and book appointments.'
                : 'No services match your active filters or search term. Try resetting your search or filter options.'}
            </Text>
            <View style={{ marginTop: 16 }}>
              {services.length === 0 ? (
                <PrimaryButton
                  label="+ Add First Salon Service"
                  onPress={handleOpenAddModal}
                />
              ) : (
                <SecondaryButton
                  label="Reset All Filters"
                  onPress={() => {
                    setSearchQuery('');
                    setStatusFilter('ALL');
                    setSelectedCategory('ALL');
                  }}
                />
              )}
            </View>
          </View>
        ) : (
          filteredServices.map((service, index) => {
            const serviceId = service._id || service.id || `serv-${index}`;
            const isToggling = togglingId === serviceId;
            const isDeleting = deletingId === serviceId;
            const isActive = service.isActive !== false;

            const priceNum =
              typeof service.price === 'number'
                ? service.price
                : parseFloat(String(service.price).replace(/[^0-9.]/g, '')) || 0;

            const durationStr =
              service.durationMinutes ||
              (typeof service.duration === 'number'
                ? service.duration
                : parseInt(String(service.duration).replace(/[^0-9]/g, ''), 10) || 30);

            return (
              <View
                key={serviceId}
                style={[
                  s.serviceCard,
                  !isActive && s.serviceCardInactive
                ]}
              >
                {/* Header row of Card: Category tag + Status Badge */}
                <View style={s.cardTopRow}>
                  <View style={s.categoryTag}>
                    <Text style={s.categoryTagText}>
                      {service.category || 'General'}
                    </Text>
                  </View>

                  <View
                    style={[
                      s.statusPill,
                      isActive ? s.statusPillActive : s.statusPillInactive
                    ]}
                  >
                    <View
                      style={[
                        s.statusDot,
                        isActive ? s.statusDotActive : s.statusDotInactive
                      ]}
                    />
                    <Text
                      style={[
                        s.statusPillText,
                        isActive ? s.statusPillTextActive : s.statusPillTextInactive
                      ]}
                    >
                      {isActive ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                </View>

                {/* Service Details */}
                <View style={s.cardMiddleRow}>
                  {service.image ? (
                    <Image
                      source={{ uri: service.image }}
                      style={s.serviceThumb}
                      resizeMode="cover"
                    />
                  ) : null}

                  <View style={{ flex: 1 }}>
                    <Text style={s.serviceTitle} numberOfLines={2}>
                      {service.name}
                    </Text>

                    {service.description ? (
                      <Text style={s.serviceDesc} numberOfLines={3}>
                        {service.description}
                      </Text>
                    ) : null}

                    <View style={s.metaWrap}>
                      <Text style={s.priceText}>₹{priceNum.toLocaleString('en-IN')}</Text>
                      <Text style={s.dotSep}>•</Text>
                      <Text style={s.durationText}>⏱ {durationStr} mins</Text>
                    </View>
                  </View>
                </View>

                {/* Card Actions Footer */}
                <View style={s.cardActionsRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      isActive ? 'Deactivate Service' : 'Activate Service'
                    }
                    disabled={isToggling || isDeleting}
                    onPress={() => handleToggle(service)}
                    style={({ pressed }) => [
                      s.toggleBtn,
                      isActive ? s.toggleBtnActive : s.toggleBtnInactive,
                      (isToggling || isDeleting) && { opacity: 0.5 },
                      pressed && s.btnPressed
                    ]}
                  >
                    {isToggling ? (
                      <ActivityIndicator
                        size="small"
                        color={isActive ? colors.danger : colors.success}
                      />
                    ) : (
                      <Text
                        style={[
                          s.toggleBtnText,
                          isActive ? s.toggleBtnTextActive : s.toggleBtnTextInactive
                        ]}
                      >
                        {isActive ? 'Deactivate' : 'Activate'}
                      </Text>
                    )}
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Edit Service"
                    disabled={isToggling || isDeleting}
                    onPress={() => handleOpenEditModal(service)}
                    style={({ pressed }) => [
                      s.editBtn,
                      pressed && s.btnPressed
                    ]}
                  >
                    <Text style={s.editBtnText}>✏️ Edit</Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Delete Service"
                    disabled={isToggling || isDeleting}
                    onPress={() => handleDelete(service)}
                    style={({ pressed }) => [
                      s.deleteBtn,
                      pressed && s.btnPressed
                    ]}
                  >
                    {isDeleting ? (
                      <ActivityIndicator size="small" color={colors.danger} />
                    ) : (
                      <Text style={s.deleteBtnText}>🗑️ Delete</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* 7. Add / Edit Service Modal Sheet */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (!submitting) setModalVisible(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={s.modalOverlay}
        >
          <View style={s.modalSheet}>
            {/* Modal Header */}
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>
                  {editingService ? 'Edit Service' : 'Add New Service'}
                </Text>
                <Text style={s.modalSubtitle}>
                  {editingService
                    ? 'Update treatment pricing, duration, or details'
                    : 'Create a new salon offering for customer discovery'}
                </Text>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close Modal"
                disabled={submitting}
                onPress={() => setModalVisible(false)}
                hitSlop={10}
                style={s.modalCloseBtn}
              >
                <Text style={s.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            {/* Modal Error Banner */}
            {formError ? (
              <View style={s.formErrorBanner}>
                <Text style={s.formErrorText}>⚠️ {formError}</Text>
              </View>
            ) : null}

            <ScrollView
              contentContainerStyle={s.modalBody}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Field: Service Name */}
              <Text style={s.inputLabel}>Service Name *</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. Signature Botanical Haircut & Wash"
                placeholderTextColor={colors.subtle}
                value={formName}
                onChangeText={setFormName}
                editable={!submitting}
              />

              {/* Field: Category Selection */}
              <Text style={s.inputLabel}>Category *</Text>
              <View style={s.categorySelectRow}>
                {PRESET_CATEGORIES.map((cat) => {
                  const isSel = formCategory === cat;
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => {
                        setFormCategory(cat);
                        setFormCustomCategory('');
                      }}
                      style={[
                        s.categorySelectChip,
                        isSel && s.categorySelectChipActive
                      ]}
                    >
                      <Text
                        style={[
                          s.categorySelectChipText,
                          isSel && s.categorySelectChipTextActive
                        ]}
                      >
                        {cat}
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  onPress={() => setFormCategory('Other')}
                  style={[
                    s.categorySelectChip,
                    formCategory === 'Other' && s.categorySelectChipActive
                  ]}
                >
                  <Text
                    style={[
                      s.categorySelectChipText,
                      formCategory === 'Other' && s.categorySelectChipTextActive
                    ]}
                  >
                    Custom...
                  </Text>
                </Pressable>
              </View>

              {formCategory === 'Other' && (
                <View style={{ marginTop: 6, marginBottom: 10 }}>
                  <TextInput
                    style={s.input}
                    placeholder="Enter custom category name..."
                    placeholderTextColor={colors.subtle}
                    value={formCustomCategory}
                    onChangeText={setFormCustomCategory}
                    editable={!submitting}
                  />
                </View>
              )}

              {/* Dual Fields: Price & Duration */}
              <View style={s.dualRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={s.inputLabel}>Price in ₹ *</Text>
                  <TextInput
                    style={s.input}
                    placeholder="e.g. 650"
                    placeholderTextColor={colors.subtle}
                    keyboardType="numeric"
                    value={formPrice}
                    onChangeText={setFormPrice}
                    editable={!submitting}
                  />
                </View>

                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={s.inputLabel}>Duration (mins) *</Text>
                  <TextInput
                    style={s.input}
                    placeholder="e.g. 45"
                    placeholderTextColor={colors.subtle}
                    keyboardType="numeric"
                    value={formDuration}
                    onChangeText={setFormDuration}
                    editable={!submitting}
                  />
                </View>
              </View>

              {/* Quick Duration Buttons */}
              <View style={s.quickDurRow}>
                <Text style={s.quickDurLabel}>Quick presets:</Text>
                {PRESET_DURATIONS.map((mins) => (
                  <Pressable
                    key={mins}
                    onPress={() => setFormDuration(mins.toString())}
                    style={[
                      s.quickDurPill,
                      formDuration === mins.toString() && s.quickDurPillActive
                    ]}
                  >
                    <Text
                      style={[
                        s.quickDurText,
                        formDuration === mins.toString() && s.quickDurTextActive
                      ]}
                    >
                      {mins}m
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Field: Description */}
              <Text style={s.inputLabel}>Description (Optional)</Text>
              <TextInput
                style={[s.input, s.textArea]}
                placeholder="Describe this treatment, products used, and what clients should anticipate..."
                placeholderTextColor={colors.subtle}
                multiline
                numberOfLines={3}
                value={formDescription}
                onChangeText={setFormDescription}
                editable={!submitting}
              />

              {/* Field: Image URL */}
              <Text style={s.inputLabel}>Image URL (Optional)</Text>
              <TextInput
                style={s.input}
                placeholder="https://images.unsplash.com/photo-..."
                placeholderTextColor={colors.subtle}
                value={formImage}
                onChangeText={setFormImage}
                autoCapitalize="none"
                editable={!submitting}
              />

              {/* Active Toggle Switch */}
              <View style={s.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.switchTitle}>Service Availability</Text>
                  <Text style={s.switchSubtitle}>
                    {formIsActive
                      ? 'Service is active and visible for client bookings'
                      : 'Service is paused and hidden from client bookings'}
                  </Text>
                </View>
                <Switch
                  value={formIsActive}
                  onValueChange={setFormIsActive}
                  trackColor={{ false: colors.border, true: colors.gold }}
                  thumbColor={formIsActive ? colors.surface : '#F4F4F5'}
                  disabled={submitting}
                />
              </View>

              {/* Action Buttons */}
              <View style={s.modalBtnRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <SecondaryButton
                    label="Cancel"
                    disabled={submitting}
                    onPress={() => setModalVisible(false)}
                  />
                </View>
                <View style={{ flex: 1.5, marginLeft: 8 }}>
                  <PrimaryButton
                    label={
                      submitting
                        ? 'Saving...'
                        : editingService
                          ? 'Save Changes'
                          : 'Create Service'
                    }
                    loading={submitting}
                    disabled={submitting}
                    onPress={handleSaveService}
                  />
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background
  },

  // Header
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  backBtn: {
    paddingVertical: 6,
    paddingRight: 8
  },
  backText: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: '700'
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 8
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.ink
  },
  headerSubtitle: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 1
  },
  headerAddBtn: {
    backgroundColor: colors.gold,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill
  },
  headerAddBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },

  // Feedback Banner
  feedbackBanner: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderBottomWidth: 1,
    paddingVertical: 9,
    paddingHorizontal: 16,
    alignItems: 'center'
  },
  feedbackText: {
    color: '#065F46',
    fontSize: 13,
    fontWeight: '700'
  },

  // Content Container
  content: {
    padding: 16,
    paddingBottom: 48
  },

  // Metrics Row
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center'
  },
  statCardActive: {
    borderColor: '#C7E4CE',
    backgroundColor: '#F3F9F4'
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink
  },
  statValueActive: {
    color: colors.success
  },
  statValueInactive: {
    color: colors.muted
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.muted,
    marginTop: 2,
    textAlign: 'center'
  },

  // Search Wrap
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    marginBottom: 12
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.ink,
    paddingVertical: 4
  },
  clearSearch: {
    fontSize: 13,
    color: colors.muted,
    paddingHorizontal: 4
  },

  // Status Filter Row
  filterRow: {
    flexDirection: 'row',
    marginBottom: 10,
    gap: 8
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1
  },
  filterPillSelected: {
    backgroundColor: colors.gold,
    borderColor: colors.gold
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted
  },
  filterPillTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700'
  },

  // Category Chips
  catChipsRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    marginBottom: 14,
    gap: 8
  },
  catChip: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.border
  },
  catChipSelected: {
    backgroundColor: colors.espresso,
    borderColor: colors.espresso
  },
  catChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted
  },
  catChipTextSelected: {
    color: '#FFFCF7',
    fontWeight: '700'
  },

  // Service Cards
  serviceCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 14,
    shadowColor: colors.espresso,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2
  },
  serviceCardInactive: {
    opacity: 0.72,
    backgroundColor: '#FAFAF9'
  },

  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  categoryTag: {
    backgroundColor: colors.goldSoft,
    borderColor: '#EFE2CF',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.xs
  },
  categoryTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.goldDark,
    letterSpacing: 0.2
  },

  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  statusPillActive: {
    backgroundColor: colors.successSoft,
    borderColor: colors.successBorder
  },
  statusPillInactive: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB'
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5
  },
  statusDotActive: {
    backgroundColor: colors.success
  },
  statusDotInactive: {
    backgroundColor: '#9CA3AF'
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700'
  },
  statusPillTextActive: {
    color: colors.success
  },
  statusPillTextInactive: {
    color: '#6B7280'
  },

  cardMiddleRow: {
    flexDirection: 'row',
    marginBottom: 12
  },
  serviceThumb: {
    width: 64,
    height: 64,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceWarm,
    marginRight: 12,
    borderWidth: 1,
    borderColor: colors.border
  },
  serviceTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.espresso,
    lineHeight: 22
  },
  serviceDesc: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 3,
    lineHeight: 17
  },
  metaWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6
  },
  priceText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.goldDark
  },
  dotSep: {
    marginHorizontal: 8,
    color: colors.border,
    fontSize: 12
  },
  durationText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted
  },

  // Card Actions
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: 12,
    gap: 8
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.sm,
    borderWidth: 1
  },
  toggleBtnActive: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FEE2E2'
  },
  toggleBtnInactive: {
    backgroundColor: colors.successSoft,
    borderColor: colors.successBorder
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: '700'
  },
  toggleBtnTextActive: {
    color: colors.danger
  },
  toggleBtnTextInactive: {
    color: colors.success
  },

  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.border
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink
  },

  deleteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#FCA5A5'
  },
  deleteBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.danger
  },

  btnPressed: {
    opacity: 0.85
  },

  // Loading, Empty, Error
  centerWrap: {
    paddingVertical: 60,
    alignItems: 'center'
  },
  loadingText: {
    color: colors.muted,
    marginTop: 12,
    fontSize: 13
  },

  emptyCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 24,
    alignItems: 'center',
    marginTop: 16
  },
  emptyIcon: {
    fontSize: 38,
    marginBottom: 8
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.ink
  },
  emptyBody: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 6
  },

  errorCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 20,
    alignItems: 'center',
    marginTop: 16
  },
  errorIcon: {
    fontSize: 28,
    marginBottom: 6
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#991B1B'
  },
  errorDesc: {
    fontSize: 12,
    color: '#B91C1C',
    textAlign: 'center',
    marginTop: 4
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(26, 18, 16, 0.55)',
    justifyContent: 'flex-end'
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '92%'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2
  },
  modalCloseBtn: {
    padding: 6
  },
  modalCloseText: {
    fontSize: 18,
    color: colors.muted,
    fontWeight: '700'
  },

  formErrorBanner: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderBottomWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 20
  },
  formErrorText: {
    fontSize: 12,
    color: colors.danger,
    fontWeight: '600'
  },

  modalBody: {
    padding: 20,
    paddingBottom: 36
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 6,
    marginTop: 10
  },
  input: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 9,
    fontSize: 14,
    color: colors.ink
  },
  textArea: {
    height: 76,
    textAlignVertical: 'top'
  },

  categorySelectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4
  },
  categorySelectChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1
  },
  categorySelectChipActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold
  },
  categorySelectChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted
  },
  categorySelectChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700'
  },

  dualRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },

  quickDurRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8
  },
  quickDurLabel: {
    fontSize: 11,
    color: colors.muted,
    marginRight: 4
  },
  quickDurPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.xs,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.border
  },
  quickDurPillActive: {
    backgroundColor: colors.espresso,
    borderColor: colors.espresso
  },
  quickDurText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.muted
  },
  quickDurTextActive: {
    color: '#FFFFFF'
  },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 14,
    marginTop: 16,
    marginBottom: 20
  },
  switchTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink
  },
  switchSubtitle: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2
  },

  modalBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8
  }
});
