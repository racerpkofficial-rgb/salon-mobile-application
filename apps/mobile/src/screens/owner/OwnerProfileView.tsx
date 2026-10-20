import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { StatusBadge } from '../../components/StatusBadge';
import { LogoutConfirmModal } from '../../components/LogoutConfirmModal';
import { ChangePasswordModal } from '../../components/ChangePasswordModal';
import { DeleteAccountModal } from '../../components/DeleteAccountModal';
import { HelpFaqModal } from '../../components/HelpFaqModal';
import { LegalDocumentModal, LegalDocType } from '../../components/LegalDocumentModal';
import { ReportProblemModal } from '../../components/ReportProblemModal';
import { OwnerAvailabilityModal } from './OwnerAvailabilityModal';
import { Avatar } from '../../components/Avatar';
import { colors, radius, typography } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { dialogService } from '../../services/dialog.service';
import { authService } from '../../services/auth.service';
import { salonService } from '../../services/salon.service';
import { AuthUser, SalonOwnerData, SubscriptionData, WorkingHours } from '../../types';
import { isValidPhone, normalizePhone } from '../../utils/validation';
import { OFFICIAL_SUPPORT_EMAIL, openSupportEmail } from '../../utils/support';
import { openPrivacyUrl, openTermsUrl } from '../../utils/legal';

interface OwnerProfileViewProps {
  user?: AuthUser | null;
  salon: SalonOwnerData | null;
  subscription: SubscriptionData | null;
  onEditProfile: () => void;
  onManagePlan: () => void;
  onViewSubscription: () => void;
  onLogout: () => void;
  onProfileUpdated?: (updatedUser: AuthUser, updatedSalon?: SalonOwnerData) => void;
  onNavigateToServices?: () => void;
  onNavigateToOffers?: () => void;
  onNavigateToBookings?: () => void;
  onNavigateToReviews?: () => void;
}

export function OwnerProfileView({
  user: userProp,
  salon,
  subscription,
  onEditProfile,
  onManagePlan,
  onViewSubscription,
  onLogout,
  onProfileUpdated,
  onNavigateToServices,
  onNavigateToOffers,
  onNavigateToBookings,
  onNavigateToReviews
}: OwnerProfileViewProps) {
  const { user: authUser, token, updateUser } = useAuth();
  const user = userProp || authUser;

  // In-line Edit Profile Modal State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [changePasswordModalVisible, setChangePasswordModalVisible] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [editPhone, setEditPhone] = useState(user?.phone || salon?.phone || '');
  const [editSalonName, setEditSalonName] = useState(salon?.salonName || '');
  const [editAddress, setEditAddress] = useState(salon?.address || '');
  const [editCity, setEditCity] = useState(salon?.city || '');
  const [editDescription, setEditDescription] = useState(salon?.description || '');
  const [editImages, setEditImages] = useState<string[]>(
    (salon?.images || [])
      .filter((img) => typeof img === 'string' && img.trim().length > 0 && !img.includes('images.unsplash.com'))
      .slice(0, 8)
  );
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);

  // Settings Modals States
  const [availabilityModalVisible, setAvailabilityModalVisible] = useState(false);
  const [deleteAccountModalVisible, setDeleteAccountModalVisible] = useState(false);
  const [helpModalVisible, setHelpModalVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [legalModalVisible, setLegalModalVisible] = useState(false);
  const [legalDocType, setLegalDocType] = useState<LegalDocType>('PRIVACY_POLICY');

  // Working Hours & Availability State
  const [localWorkingHours, setLocalWorkingHours] = useState<WorkingHours>(
    salon?.workingHours || {
      openTime: '09:00',
      closeTime: '20:00',
      slotIntervalMinutes: 30,
      daysOpen: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    }
  );
  const [localUnavailableDates, setLocalUnavailableDates] = useState<string[]>(
    salon?.unavailableDates || []
  );

  // Notification Preferences State
  const [bookingUpdates, setBookingUpdates] = useState(
    user?.notificationPreferences?.bookingUpdates ?? true
  );
  const [reminders, setReminders] = useState(
    user?.notificationPreferences?.reminders ?? true
  );
  const [promotions, setPromotions] = useState(
    user?.notificationPreferences?.promotions ?? true
  );
  const [savingPrefs, setSavingPrefs] = useState(false);

  const handleTogglePreference = async (
    key: 'bookingUpdates' | 'reminders' | 'promotions',
    value: boolean
  ) => {
    if (!token) return;

    const newPrefs = {
      bookingUpdates: key === 'bookingUpdates' ? value : bookingUpdates,
      reminders: key === 'reminders' ? value : reminders,
      promotions: key === 'promotions' ? value : promotions
    };

    if (key === 'bookingUpdates') setBookingUpdates(value);
    if (key === 'reminders') setReminders(value);
    if (key === 'promotions') setPromotions(value);

    setSavingPrefs(true);
    try {
      const res = await authService.updateNotificationPreferences(token, newPrefs);
      if (user) {
        updateUser({
          ...user,
          notificationPreferences: res.notificationPreferences
        });
      }
    } catch {
      if (key === 'bookingUpdates') setBookingUpdates(!value);
      if (key === 'reminders') setReminders(!value);
      if (key === 'promotions') setPromotions(!value);
      dialogService.showError('Update Failed', 'Could not save notification preferences.');
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleOpenEdit = () => {
    setEditName(user?.name || '');
    setEditPhone(user?.phone || salon?.phone || '');
    setEditSalonName(salon?.salonName || '');
    setEditAddress(salon?.address || '');
    setEditCity(salon?.city || '');
    setEditDescription(salon?.description || '');
    setEditImages(
      (salon?.images || [])
        .filter((img) => typeof img === 'string' && img.trim().length > 0 && !img.includes('images.unsplash.com'))
        .slice(0, 8)
    );
    setEditModalVisible(true);
  };

  const handlePickImages = async () => {
    if (editImages.length >= 8) {
      dialogService.showWarning('Maximum Limit Reached', 'You can upload up to 8 photos for your salon.');
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        dialogService.showWarning('Permission Needed', 'Please allow camera roll access to select salon photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        allowsMultipleSelection: true,
        selectionLimit: 8 - editImages.length,
        quality: 0.8,
        base64: true
      });

      if (result.canceled || !result.assets?.length) return;

      const assetsToUpload = result.assets.slice(0, 8 - editImages.length);
      setUploadingImage(true);

      const newlyUploadedUrls: string[] = [];

      for (const asset of assetsToUpload) {
        if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
          dialogService.showWarning('File Skipped', `${asset.fileName || 'An image'} exceeds the 5MB size limit.`);
          continue;
        }

        if (asset.mimeType) {
          const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
          if (!allowed.includes(asset.mimeType.toLowerCase())) {
            dialogService.showWarning('Invalid Format', 'Supported formats: JPEG, PNG, WebP.');
            continue;
          }
        }

        const mime = asset.mimeType || 'image/jpeg';
        const base64Data = asset.base64 ? `data:${mime};base64,${asset.base64}` : asset.uri;

        if (token) {
          try {
            const uploadRes = await salonService.uploadSalonImage(token, base64Data, mime);
            const savedUrl = uploadRes.secureUrl || uploadRes.url;
            if (savedUrl) newlyUploadedUrls.push(savedUrl);
          } catch (uploadErr) {
            dialogService.showError('Upload Error', uploadErr instanceof Error ? uploadErr.message : 'Failed to upload photo.');
          }
        }
      }

      if (newlyUploadedUrls.length > 0) {
        setEditImages((prev) => [...prev, ...newlyUploadedUrls].slice(0, 8));
      }
    } catch (e) {
      dialogService.showError('Gallery Error', e instanceof Error ? e.message : 'Could not open image gallery.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = (index: number) => {
    setEditImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePickAvatar = async () => {
    if (!token) {
      dialogService.showInfo('Sign In Required', 'Please sign in to update your profile photo.');
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        dialogService.showWarning(
          'Photo Access Required',
          'Book My Salon needs camera roll permission so you can upload your owner profile picture.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true
      });

      if (result.canceled || !result.assets?.[0]) return;

      const selectedAsset = result.assets[0];
      const mime = selectedAsset.mimeType || 'image/jpeg';
      const base64Data = selectedAsset.base64 ? `data:${mime};base64,${selectedAsset.base64}` : selectedAsset.uri;

      setUploadingAvatar(true);

      const res = await authService.uploadProfilePhoto(token, base64Data);
      if (res.user) {
        updateUser(res.user);
        onProfileUpdated?.(res.user, salon || undefined);
        dialogService.showSuccess('Photo Updated', 'Your owner profile photo has been refreshed.', undefined, 'Got it');
      } else if (user && res.url) {
        const updated = { ...user, avatar: res.url };
        updateUser(updated);
        onProfileUpdated?.(updated, salon || undefined);
        dialogService.showSuccess('Photo Updated', 'Your owner profile photo has been refreshed.', undefined, 'Got it');
      }
    } catch (e) {
      dialogService.showError('Upload Failed', e instanceof Error ? e.message : 'Could not upload photo.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!token) return;
    if (editName.trim().length < 2) {
      dialogService.showError('Validation Error', 'Full name must have at least 2 characters.');
      return;
    }
    if (editPhone.trim() && !isValidPhone(editPhone.trim())) {
      dialogService.showError('Validation Error', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    if (editSalonName.trim().length < 2) {
      dialogService.showError('Validation Error', 'Salon name must have at least 2 characters.');
      return;
    }

    setSaving(true);
    try {
      const res = await authService.updateProfile(token, {
        name: editName.trim(),
        phone: editPhone.trim() ? normalizePhone(editPhone.trim()) : undefined,
        salonName: editSalonName.trim(),
        address: editAddress.trim() || undefined,
        city: editCity.trim() || undefined,
        description: editDescription.trim(),
        images: editImages.slice(0, 8)
      });

      updateUser(res.user);
      if (onProfileUpdated) {
        onProfileUpdated(res.user, res.salon);
      }

      setEditModalVisible(false);
      dialogService.showSuccess('Profile Updated', 'Your profile and salon details have been saved.');
    } catch (e) {
      dialogService.showError(
        'Update Failed',
        e instanceof Error ? e.message : 'Unable to update profile. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleConfirmLogout = () => {
    setShowLogoutModal(true);
  };

  const services = salon?.services || [];
  const salonPhotos = (salon?.images || [])
    .filter((img) => typeof img === 'string' && img.trim().length > 0 && !img.includes('images.unsplash.com'))
    .slice(0, 8);
  const planName = subscription?.plan || 'STARTER';
  const planCycle = subscription?.billingCycle || 'MONTHLY';
  const isSubActive = subscription?.status === 'ACTIVE';

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Page Header */}
      <View style={s.header}>
        <Text style={s.eyebrow}>SALON PARTNER PORTAL</Text>
        <Text style={s.title}>Salon Profile & Account</Text>
        <Text style={s.subtitle}>
          Official salon details, partner contact, verification status, and membership.
        </Text>
      </View>

      {/* 1. Verified Owner Account Card */}
      <View style={s.card}>
        <View style={s.cardHeaderRow}>
          {/* Avatar with Camera Badge */}
          <Pressable
            onPress={handlePickAvatar}
            disabled={uploadingAvatar}
            style={s.avatarWrap}
            accessibilityLabel="Update owner profile photo"
          >
            <Avatar
              uri={user?.avatar}
              name={user?.name || salon?.salonName || 'Owner'}
              size={64}
              borderColor={colors.gold}
              borderWidth={1.5}
              backgroundColor={colors.goldSoft}
              textColor={colors.ink}
            />
            <View style={s.avatarBadge}>
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={s.avatarBadgeIcon}>📷</Text>
              )}
            </View>
          </Pressable>

          <View style={{ flex: 1, marginLeft: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={s.cardCategory}>AUTHENTICATED OWNER</Text>
              <View style={s.roleBadge}>
                <Text style={s.roleBadgeText}>SALON PARTNER</Text>
              </View>
            </View>
            <Text style={s.ownerName}>{user?.name || 'Owner Name Pending'}</Text>
            <Text style={s.ownerEmail}>{user?.email || salon?.email || 'Email pending'}</Text>
          </View>
        </View>

        <View style={s.infoRow}>
          <Text style={s.infoLabel}>Primary Mobile:</Text>
          <Text style={s.infoValue}>
            {user?.phone || salon?.phone ? (
              user?.phone || salon?.phone
            ) : (
              <Text style={s.emptyValue}>Add your mobile number</Text>
            )}
          </Text>
        </View>

        <Pressable onPress={handleOpenEdit} style={s.actionBtn}>
          <Text style={s.actionBtnText}>✏️ Edit Profile & Contact Details</Text>
        </Pressable>

        <Pressable
          onPress={() => setChangePasswordModalVisible(true)}
          style={[s.actionBtn, { marginTop: 10, borderColor: colors.gold }]}
        >
          <Text style={[s.actionBtnText, { color: colors.gold }]}>
            🔒 {user?.authProvider === 'GOOGLE' && !user?.hasCustomPassword ? 'Set Account Password' : 'Change Password'}
          </Text>
        </Pressable>
      </View>

      {/* 2. Salon Atelier Details Card */}
      <View style={s.card}>
        <View style={s.cardHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.cardCategory}>ATELIER ESTABLISHMENT</Text>
            <Text style={s.salonName}>{salon?.salonName || 'Salon Name Pending'}</Text>
            <Text style={s.salonAddress}>
              {salon?.address ? (
                `📍 ${salon.address}${salon.city ? `, ${salon.city}` : ''}`
              ) : salon?.city ? (
                `📍 ${salon.city}`
              ) : (
                <Text style={s.emptyValue}>📍 Add your salon address</Text>
              )}
            </Text>
          </View>
          <StatusBadge status={salon?.status || 'PENDING_APPROVAL'} />
        </View>

        {/* Real description or helpful empty state */}
        <View style={s.descWrap}>
          {salon?.description ? (
            <Text style={s.salonDesc}>{salon.description}</Text>
          ) : (
            <View style={s.emptyBox}>
              <Text style={s.emptyTitle}>No description added yet</Text>
              <Text style={s.emptyCopy}>
                Add a boutique description to introduce your salon to clients on discovery.
              </Text>
            </View>
          )}
        </View>

        {/* Salon Photos Gallery Preview */}
        <View style={s.photosSection}>
          <View style={s.photosHeaderRow}>
            <Text style={s.photosHeaderTitle}>Salon Gallery Photos ({salonPhotos.length}/8)</Text>
            <Pressable onPress={handleOpenEdit} hitSlop={6}>
              <Text style={s.photosManageText}>Manage Photos</Text>
            </Pressable>
          </View>
          {salonPhotos.length === 0 ? (
            <View style={s.noPhotosBox}>
              <Text style={s.noPhotosIcon}>📷</Text>
              <Text style={s.noPhotosTitle}>No salon photos uploaded</Text>
              <Text style={s.noPhotosSub}>Upload up to 8 photos so customers can view your styling stations.</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.photosScroll}>
              {salonPhotos.map((photo, i) => (
                <View key={i} style={s.photoCard}>
                  <Image source={{ uri: photo }} style={s.photoImg} />
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={s.contactRow}>
          <View style={s.contactItem}>
            <Text style={s.contactLabel}>Public Contact Phone</Text>
            <Text style={s.contactValue}>{salon?.phone || user?.phone || 'Not provided'}</Text>
          </View>
          <View style={s.contactItem}>
            <Text style={s.contactLabel}>Account Email (Private)</Text>
            <Text style={s.contactValue}>{salon?.email || user?.email || 'Not provided'}</Text>
          </View>
        </View>

        <Pressable onPress={onEditProfile} style={s.actionBtn}>
          <Text style={s.actionBtnText}>⚙️ Manage Full Salon Profile & Catalog</Text>
        </Pressable>
      </View>

      {/* 3. Services & Pricing Catalog */}
      <View style={s.card}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Services & Treatment Catalog</Text>
          <View style={s.countBadge}>
            <Text style={s.countBadgeText}>{services.length} Services</Text>
          </View>
        </View>

        {services.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyTitle}>No services configured yet</Text>
            <Text style={s.emptyCopy}>
              Configure your salon treatments so clients can book appointments online.
            </Text>
          </View>
        ) : (
          <View style={s.servicesList}>
            {services.slice(0, 4).map((serv, index) => (
              <View key={serv.id || serv.name || index} style={s.serviceItem}>
                <View style={{ flex: 1 }}>
                  <Text style={s.serviceName}>{serv.name}</Text>
                  <Text style={s.serviceMeta}>
                    {serv.category || 'General'} • {serv.duration || serv.durationMinutes || 30} mins
                  </Text>
                </View>
                <Text style={s.servicePrice}>₹{serv.price}</Text>
              </View>
            ))}
            {services.length > 4 && (
              <Text style={s.moreServicesText}>+ {services.length - 4} more services</Text>
            )}
          </View>
        )}

        <Pressable
          onPress={() => {
            if (onNavigateToServices) {
              onNavigateToServices();
            } else {
              onEditProfile();
            }
          }}
          style={s.actionBtn}
        >
          <Text style={s.actionBtnText}>📋 Manage Full Services Catalog & Pricing</Text>
        </Pressable>
      </View>

      {/* 4. Booking Preferences & Operating Availability */}
      <View style={s.card}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Booking Preferences & Hours</Text>
          <View style={s.countBadge}>
            <Text style={s.countBadgeText}>
              {localUnavailableDates.length > 0 ? `${localUnavailableDates.length} Blackout Dates` : 'All Days Active'}
            </Text>
          </View>
        </View>

        <View style={s.infoRow}>
          <Text style={s.infoLabel}>Daily Hours:</Text>
          <Text style={s.infoValue}>
            {localWorkingHours.openTime} – {localWorkingHours.closeTime} ({localWorkingHours.slotIntervalMinutes}m slots)
          </Text>
        </View>

        <View style={s.infoRow}>
          <Text style={s.infoLabel}>Operating Days:</Text>
          <Text style={s.infoValue} numberOfLines={1}>
            {localWorkingHours.daysOpen.length === 7 ? '7 Days / Week' : localWorkingHours.daysOpen.map(d => d.slice(0, 3)).join(', ')}
          </Text>
        </View>

        <View style={s.infoRow}>
          <Text style={s.infoLabel}>Holiday Blackout:</Text>
          <Text style={s.infoValue}>
            {localUnavailableDates.length > 0 ? `${localUnavailableDates.length} date(s) marked closed` : 'No blackout dates'}
          </Text>
        </View>

        <View style={s.dualBtnRow}>
          <Pressable onPress={() => setAvailabilityModalVisible(true)} style={s.primaryActionBtn}>
            <Text style={s.primaryActionBtnText}>⚙️ Configure Hours</Text>
          </Pressable>
          {onNavigateToBookings && (
            <Pressable onPress={onNavigateToBookings} style={s.secondaryActionBtn}>
              <Text style={s.secondaryActionBtnText}>📅 Bookings Hub</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* 5. Offers & Promotions Section */}
      <View style={s.card}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Offers & Promotions</Text>
          <View style={s.countBadge}>
            <Text style={s.countBadgeText}>Marketing Hub</Text>
          </View>
        </View>
        <Text style={s.cardDescription}>
          Create and manage seasonal promotional discounts to attract discovery clients.
        </Text>
        <Pressable
          onPress={() => {
            if (onNavigateToOffers) {
              onNavigateToOffers();
            }
          }}
          style={s.actionBtn}
        >
          <Text style={s.actionBtnText}>🏷️ Manage Promotional Offers & Discounts</Text>
        </Pressable>
      </View>

      {/* Ratings & Customer Reviews Section */}
      <View style={s.card}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Ratings & Customer Reviews</Text>
          <View style={s.countBadge}>
            <Text style={s.countBadgeText}>
              ★ {(salon?.rating || 0).toFixed(1)} ({salon?.reviews || 0})
            </Text>
          </View>
        </View>
        <Text style={s.cardDescription}>
          View public feedback from clients and respond to customer reviews with official salon owner replies.
        </Text>
        <Pressable
          onPress={() => {
            if (onNavigateToReviews) {
              onNavigateToReviews();
            }
          }}
          style={s.actionBtn}
        >
          <Text style={s.actionBtnText}>⭐ Manage Ratings & Reply to Reviews →</Text>
        </Pressable>
      </View>

      {/* 6. Partner Subscription Membership Card */}
      <View style={s.card}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Partner Membership Plan</Text>
          <View style={[s.subStatusBadge, isSubActive ? s.subActive : s.subInactive]}>
            <Text style={[s.subStatusText, isSubActive ? s.subActiveText : s.subInactiveText]}>
              {subscription?.status || 'PENDING'}
            </Text>
          </View>
        </View>

        <View style={s.planDetailRow}>
          <View style={s.planIconCircle}>
            <Text style={s.planIconText}>👑</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.planTitle}>{planName} PLAN</Text>
            <Text style={s.planSubtitle}>
              Billed {planCycle.toLowerCase()} • {isSubActive ? 'Active subscription' : 'Subscription pending activation'}
            </Text>
            {!!subscription?.endDate && (
              <Text style={s.planExpiry}>
                Valid until {new Date(subscription.endDate).toLocaleDateString()}
              </Text>
            )}
          </View>
        </View>

        <View style={s.dualBtnRow}>
          <Pressable onPress={onViewSubscription} style={s.secondaryActionBtn}>
            <Text style={s.secondaryActionBtnText}>Status Details</Text>
          </Pressable>
          <Pressable onPress={onManagePlan} style={s.primaryActionBtn}>
            <Text style={s.primaryActionBtnText}>Change Plan</Text>
          </Pressable>
        </View>
      </View>

      {/* 7. Notification Preferences */}
      <View style={s.card}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Notification Alerts</Text>
          {savingPrefs && <ActivityIndicator size="small" color={colors.gold} />}
        </View>

        <View style={s.toggleRow}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={s.toggleTitle}>Booking Requests & Confirmations</Text>
            <Text style={s.toggleSubtitle}>Instant alerts when customers submit appointments</Text>
          </View>
          <Switch
            value={bookingUpdates}
            onValueChange={(val) => handleTogglePreference('bookingUpdates', val)}
            trackColor={{ false: colors.border, true: colors.gold }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={s.toggleRow}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={s.toggleTitle}>Appointment Reminders</Text>
            <Text style={s.toggleSubtitle}>Upcoming appointment reminders for styling chairs</Text>
          </View>
          <Switch
            value={reminders}
            onValueChange={(val) => handleTogglePreference('reminders', val)}
            trackColor={{ false: colors.border, true: colors.gold }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={[s.toggleRow, { borderBottomWidth: 0 }]}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={s.toggleTitle}>Promotional & System Announcements</Text>
            <Text style={s.toggleSubtitle}>Platform updates, subscription receipts, and tips</Text>
          </View>
          <Switch
            value={promotions}
            onValueChange={(val) => handleTogglePreference('promotions', val)}
            trackColor={{ false: colors.border, true: colors.gold }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      {/* 8. Account & Security Section */}
      <View style={s.card}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Security & Partner Account</Text>
          <StatusBadge status={salon?.status || 'PENDING_APPROVAL'} />
        </View>

        <Pressable
          onPress={() => setChangePasswordModalVisible(true)}
          style={[s.actionBtn, { borderColor: colors.gold }]}
        >
          <Text style={[s.actionBtnText, { color: colors.gold }]}>
            🔒 {user?.authProvider === 'GOOGLE' && !user?.hasCustomPassword ? 'Set Account Password' : 'Change Password'}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setDeleteAccountModalVisible(true)}
          style={[s.actionBtn, { marginTop: 10, borderColor: '#D32F2F', backgroundColor: '#FFF8F8' }]}
        >
          <Text style={[s.actionBtnText, { color: '#D32F2F' }]}>
            ⚠️ Request Account Deletion
          </Text>
        </Pressable>
      </View>

      {/* 9. Support & Legal Section */}
      <View style={s.card}>
        <Text style={s.sectionTitle}>Support & Policies</Text>

        <Pressable onPress={() => setHelpModalVisible(true)} style={s.supportItem}>
          <Text style={s.supportItemTitle}>❓ Partner Help & FAQs</Text>
          <Text style={s.chevron}>›</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            void openSupportEmail({
              role: 'SALON_OWNER',
              userName: user?.name,
              userEmail: user?.email
            });
          }}
          style={s.supportItem}
        >
          <View style={{ flex: 1 }}>
            <Text style={s.supportItemTitle}>✉️ Email Partner Support</Text>
            <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>
              {OFFICIAL_SUPPORT_EMAIL}
            </Text>
          </View>
          <Text style={s.chevron}>›</Text>
        </Pressable>

        <Pressable onPress={() => setReportModalVisible(true)} style={s.supportItem}>
          <Text style={s.supportItemTitle}>🚨 Report a Technical Problem</Text>
          <Text style={s.chevron}>›</Text>
        </Pressable>

        <Pressable onPress={() => void openPrivacyUrl()} style={s.supportItem}>
          <View style={{ flex: 1 }}>
            <Text style={s.supportItemTitle}>📄 Partner Privacy Policy</Text>
            <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>
              Data governance, protection standards & official URL
            </Text>
          </View>
          <Text style={s.chevron}>›</Text>
        </Pressable>

        <Pressable onPress={() => void openTermsUrl()} style={[s.supportItem, { borderBottomWidth: 0 }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.supportItemTitle}>⚖️ Commercial Terms & Conditions</Text>
            <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>
              Partner rules, salon subscriptions & official URL
            </Text>
          </View>
          <Text style={s.chevron}>›</Text>
        </Pressable>
      </View>

      {/* 10. Logout & Account Actions */}
      <View style={s.logoutSection}>
        <Pressable onPress={handleConfirmLogout} style={s.logoutBtn}>
          <Text style={s.logoutBtnText}>🚪 Log Out of Partner Account</Text>
        </Pressable>
        <Text style={s.versionText}>Book My Salon Partner v1.5.0 (Build 2026.10)</Text>
      </View>

      {/* In-line Edit Profile Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Edit Profile & Salon Details</Text>
              <Pressable
                onPress={() => setEditModalVisible(false)}
                hitSlop={8}
                style={s.modalCloseBtn}
              >
                <Text style={s.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              <View style={s.modalField}>
                <Text style={s.modalLabel}>Owner Name *</Text>
                <TextInput
                  style={s.modalInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Full Name"
                  placeholderTextColor={colors.subtle}
                />
              </View>

              <View style={s.modalField}>
                <Text style={s.modalLabel}>Mobile Number *</Text>
                <TextInput
                  style={s.modalInput}
                  value={editPhone}
                  onChangeText={setEditPhone}
                  placeholder="+91 98765 43210"
                  placeholderTextColor={colors.subtle}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={s.modalField}>
                <Text style={s.modalLabel}>Salon Name *</Text>
                <TextInput
                  style={s.modalInput}
                  value={editSalonName}
                  onChangeText={setEditSalonName}
                  placeholder="Salon Atelier Name"
                  placeholderTextColor={colors.subtle}
                />
              </View>

              <View style={s.modalField}>
                <Text style={s.modalLabel}>Address</Text>
                <TextInput
                  style={s.modalInput}
                  value={editAddress}
                  onChangeText={setEditAddress}
                  placeholder="Street, Building, Landmark"
                  placeholderTextColor={colors.subtle}
                />
              </View>

              <View style={s.modalField}>
                <Text style={s.modalLabel}>City</Text>
                <TextInput
                  style={s.modalInput}
                  value={editCity}
                  onChangeText={setEditCity}
                  placeholder="e.g. Bengaluru"
                  placeholderTextColor={colors.subtle}
                />
              </View>

              <View style={s.modalField}>
                <Text style={s.modalLabel}>Salon Description (Optional)</Text>
                <TextInput
                  style={[s.modalInput, { height: 75, textAlignVertical: 'top' }]}
                  value={editDescription}
                  onChangeText={setEditDescription}
                  placeholder="Tell clients about your salon (or leave blank)..."
                  placeholderTextColor={colors.subtle}
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Modal Photo Management */}
              <View style={s.modalField}>
                <View style={s.modalPhotoHeaderRow}>
                  <Text style={s.modalLabel}>Salon Photos ({editImages.length}/8)</Text>
                  <Text style={s.modalPhotoSub}>Max 8 photos</Text>
                </View>
                {editImages.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.modalPhotoScroll}>
                    {editImages.map((imgUrl, idx) => (
                      <View key={idx} style={s.modalThumbWrap}>
                        <Image source={{ uri: imgUrl }} style={s.modalThumbImg} />
                        <Pressable onPress={() => handleRemoveImage(idx)} style={s.modalRemoveBtn} hitSlop={6}>
                          <Text style={s.modalRemoveText}>✕</Text>
                        </Pressable>
                      </View>
                    ))}
                  </ScrollView>
                )}
                {editImages.length < 8 && (
                  <Pressable
                    onPress={handlePickImages}
                    disabled={uploadingImage}
                    style={[s.modalUploadBtn, uploadingImage && { opacity: 0.6 }]}
                  >
                    {uploadingImage ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <ActivityIndicator size="small" color={colors.gold} />
                        <Text style={s.modalUploadText}>Uploading photo...</Text>
                      </View>
                    ) : (
                      <Text style={s.modalUploadText}>📷 + Add Salon Photo ({editImages.length}/8)</Text>
                    )}
                  </Pressable>
                )}
              </View>

              <Pressable
                onPress={handleSaveProfile}
                disabled={saving}
                style={[s.saveBtn, saving && { opacity: 0.7 }]}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={s.saveBtnText}>Save Profile Changes</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <ChangePasswordModal
        visible={changePasswordModalVisible}
        onClose={() => setChangePasswordModalVisible(false)}
      />

      {/* Luxury Logout Confirmation Modal */}
      <LogoutConfirmModal
        visible={showLogoutModal}
        onCancel={() => setShowLogoutModal(false)}
        onConfirm={async () => {
          setShowLogoutModal(false);
          await onLogout();
        }}
      />

      {/* Salon Availability Modal */}
      <OwnerAvailabilityModal
        visible={availabilityModalVisible}
        salon={salon}
        onClose={() => setAvailabilityModalVisible(false)}
        onSaved={(updatedHours, updatedUnavailable) => {
          setLocalWorkingHours(updatedHours);
          setLocalUnavailableDates(updatedUnavailable);
          if (salon) {
            salon.workingHours = updatedHours;
            salon.unavailableDates = updatedUnavailable;
          }
        }}
      />

      {/* Delete Account Modal */}
      <DeleteAccountModal
        visible={deleteAccountModalVisible}
        onClose={() => setDeleteAccountModalVisible(false)}
        onSuccess={async () => {
          await onLogout();
        }}
      />

      {/* Help & FAQs Modal */}
      <HelpFaqModal
        visible={helpModalVisible}
        role="SALON_OWNER"
        onClose={() => setHelpModalVisible(false)}
        onOpenReport={() => setReportModalVisible(true)}
      />

      {/* Report Problem Modal */}
      <ReportProblemModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
      />

      {/* Legal Documentation Modal */}
      <LegalDocumentModal
        visible={legalModalVisible}
        type={legalDocType}
        onClose={() => setLegalModalVisible(false)}
      />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 20, marginTop: 10 },
  eyebrow: {
    ...typography.brandOverline,
    color: colors.gold,
    letterSpacing: 1.6,
    marginBottom: 4
  },
  title: {
    ...typography.displayMedium,
    color: colors.espresso,
    letterSpacing: -0.5
  },
  subtitle: {
    ...typography.body,
    color: colors.muted,
    marginTop: 4,
    lineHeight: 20
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 18,
    marginBottom: 16
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  avatarWrap: {
    position: 'relative'
  },
  avatarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: colors.gold,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 3
  },
  avatarBadgeIcon: {
    fontSize: 11
  },
  cardCategory: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.goldDark,
    marginBottom: 4
  },
  ownerName: {
    ...typography.title,
    color: colors.espresso,
    fontWeight: '800'
  },
  ownerEmail: {
    ...typography.caption,
    color: colors.muted,
    marginTop: 2
  },
  roleBadge: {
    backgroundColor: colors.champagne,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.espresso,
    letterSpacing: 0.5
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
    marginRight: 6
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.espresso
  },
  emptyValue: {
    color: colors.subtle,
    fontStyle: 'italic',
    fontWeight: '500'
  },

  salonName: {
    ...typography.title,
    color: colors.espresso,
    fontWeight: '800'
  },
  salonAddress: {
    ...typography.caption,
    color: colors.muted,
    marginTop: 3
  },
  descWrap: {
    marginTop: 12
  },
  salonDesc: {
    ...typography.body,
    color: colors.charcoal,
    lineHeight: 20
  },
  emptyBox: {
    padding: 12,
    backgroundColor: colors.surfaceWarm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderLight
  },
  emptyTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted
  },
  emptyCopy: {
    fontSize: 11,
    color: colors.subtle,
    marginTop: 2,
    lineHeight: 16
  },
  contactRow: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    gap: 16
  },
  contactItem: { flex: 1 },
  contactLabel: { fontSize: 10, fontWeight: '700', color: colors.muted },
  contactValue: { fontSize: 12, fontWeight: '600', color: colors.espresso, marginTop: 2 },

  actionBtn: {
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    alignItems: 'center'
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.espresso
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  sectionTitle: {
    ...typography.titleSmall,
    color: colors.espresso,
    fontWeight: '700'
  },
  countBadge: {
    backgroundColor: colors.champagne,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.espresso
  },

  servicesList: { gap: 8 },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight
  },
  serviceName: { fontSize: 13, fontWeight: '700', color: colors.espresso },
  serviceMeta: { fontSize: 11, color: colors.muted, marginTop: 2 },
  servicePrice: { fontSize: 13, fontWeight: '800', color: colors.espresso },
  moreServicesText: { fontSize: 11, color: colors.goldDark, fontWeight: '700', marginTop: 4 },

  subStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill
  },
  subActive: { backgroundColor: colors.successSoft },
  subInactive: { backgroundColor: colors.dangerSoft },
  subStatusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  subActiveText: { color: colors.success },
  subInactiveText: { color: colors.danger },

  planDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10
  },
  planIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.champagne,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  planIconText: { fontSize: 18 },
  planTitle: { fontSize: 15, fontWeight: '800', color: colors.espresso },
  planSubtitle: { fontSize: 11, color: colors.muted, marginTop: 2 },
  planExpiry: { fontSize: 11, color: colors.goldDark, fontWeight: '600', marginTop: 2 },

  dualBtnRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  secondaryActionBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    alignItems: 'center'
  },
  secondaryActionBtnText: { fontSize: 12, fontWeight: '700', color: colors.espresso },
  primaryActionBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: colors.espresso,
    borderRadius: radius.md,
    alignItems: 'center'
  },
  primaryActionBtnText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },

  logoutSection: { marginTop: 10, alignItems: 'center' },
  logoutBtn: {
    width: '100%',
    paddingVertical: 12,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    alignItems: 'center'
  },
  logoutBtnText: { fontSize: 13, fontWeight: '700', color: colors.danger },
  versionText: { fontSize: 11, color: colors.subtle, marginTop: 12 },

  // Edit Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: 20,
    maxHeight: '85%'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  modalTitle: { ...typography.title, color: colors.espresso },
  modalCloseBtn: { padding: 4 },
  modalCloseText: { fontSize: 18, color: colors.muted, fontWeight: '700' },
  modalField: { marginBottom: 12 },
  modalLabel: { fontSize: 12, fontWeight: '700', color: colors.espresso, marginBottom: 4 },
  modalInput: {
    height: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    fontSize: 13,
    color: colors.espresso,
    backgroundColor: '#FFFFFF'
  },
  saveBtn: {
    marginTop: 12,
    height: 48,
    backgroundColor: colors.espresso,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center'
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  // Photos Gallery Styles
  photosSection: {
    marginTop: 14,
    marginBottom: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12
  },
  photosHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  photosHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.espresso
  },
  photosManageText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.gold
  },
  noPhotosBox: {
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 14,
    alignItems: 'center'
  },
  noPhotosIcon: { fontSize: 24, marginBottom: 4 },
  noPhotosTitle: { fontSize: 13, fontWeight: '700', color: colors.ink },
  noPhotosSub: { fontSize: 11, color: colors.muted, textAlign: 'center', marginTop: 2 },
  photosScroll: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  photoCard: {
    width: 68,
    height: 68,
    borderRadius: radius.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border
  },
  photoImg: { width: '100%', height: '100%', resizeMode: 'cover' },

  // Modal Photo Styles
  modalPhotoHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  modalPhotoSub: { fontSize: 11, color: colors.muted },
  modalPhotoScroll: { flexDirection: 'row', gap: 8, paddingVertical: 6 },
  modalThumbWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.sm,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border
  },
  modalThumbImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  modalRemoveBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.7)',
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalRemoveText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  modalUploadBtn: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.gold,
    borderStyle: 'dashed',
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#FAF7F2'
  },
  modalUploadText: { fontSize: 12, fontWeight: '600', color: colors.gold },

  cardDescription: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 18,
    marginBottom: 12
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink
  },
  toggleSubtitle: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2
  },
  supportItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface
  },
  supportItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink
  },
  chevron: {
    fontSize: 18,
    color: colors.subtle,
    fontWeight: '600',
    marginLeft: 8
  }
});
