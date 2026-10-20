import React, { useEffect, useState } from 'react';
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
import * as Location from 'expo-location';
import { ChangePasswordModal } from '../../components/ChangePasswordModal';
import { DeleteAccountModal } from '../../components/DeleteAccountModal';
import { HelpFaqModal } from '../../components/HelpFaqModal';
import { LegalDocumentModal, LegalDocType } from '../../components/LegalDocumentModal';
import { LocationPickerModal } from '../../components/LocationPickerModal';
import { LogoutConfirmModal } from '../../components/LogoutConfirmModal';
import { ReportProblemModal } from '../../components/ReportProblemModal';
import { Avatar } from '../../components/Avatar';
import { colors, radius, typography } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/auth.service';
import { dialogService } from '../../services/dialog.service';
import { CustomerLocationState } from '../../utils/location';
import { isValidPhone, normalizePhone } from '../../utils/validation';
import { OFFICIAL_SUPPORT_EMAIL, openSupportEmail } from '../../utils/support';
import { openPrivacyUrl, openTermsUrl } from '../../utils/legal';

interface CustomerSettingsScreenProps {
  onBack?: () => void;
  onNavigateTab: (tab: string) => void;
  favoritesCount?: number;
  customerLocation?: CustomerLocationState;
  onUpdateLocation?: (loc: CustomerLocationState) => void;
  onOpenReviews?: () => void;
}

export function CustomerSettingsScreen({
  onBack,
  onNavigateTab,
  favoritesCount = 0,
  customerLocation,
  onUpdateLocation,
  onOpenReviews
}: CustomerSettingsScreenProps) {
  const { user, token, updateUser, logout } = useAuth();

  // Modals visibility states
  const [editProfileModalVisible, setEditProfileModalVisible] = useState(false);
  const [changePasswordModalVisible, setChangePasswordModalVisible] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [deleteAccountModalVisible, setDeleteAccountModalVisible] = useState(false);
  const [helpModalVisible, setHelpModalVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [legalModalVisible, setLegalModalVisible] = useState(false);
  const [legalDocType, setLegalDocType] = useState<LegalDocType>('PRIVACY_POLICY');
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);

  // Edit Profile Form states
  const [editName, setEditName] = useState(user?.name || '');
  const [editPhone, setEditPhone] = useState(user?.phone || '');
  const [editAddress, setEditAddress] = useState(user?.address || '');
  const [editCity, setEditCity] = useState(user?.city || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Notification Preferences states (initialized from user model)
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

  // Location permission state
  const [locationPermStatus, setLocationPermStatus] = useState<string>('CHECKING');

  useEffect(() => {
    void checkLocationPermission();
  }, []);

  const checkLocationPermission = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      setLocationPermStatus(status === 'granted' ? 'GRANTED' : 'DENIED');
    } catch {
      setLocationPermStatus('UNKNOWN');
    }
  };

  const handleRequestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermStatus(status === 'granted' ? 'GRANTED' : 'DENIED');
      if (status === 'granted') {
        dialogService.showSuccess('Permission Granted', 'Location access enabled for salon proximity discovery.');
      } else {
        dialogService.showInfo('Permission Denied', 'You can still manually select your city to discover salons.');
      }
    } catch {
      dialogService.showError('Error', 'Unable to check location permission.');
    }
  };

  const handleOpenEditProfile = () => {
    setEditName(user?.name || '');
    setEditPhone(user?.phone || '');
    setEditAddress(user?.address || '');
    setEditCity(user?.city || '');
    setEditProfileModalVisible(true);
  };

  const handlePickAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        dialogService.showWarning('Permission Required', 'Please enable media library access to update profile photo.');
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

      const asset = result.assets[0];
      const mime = asset.mimeType || 'image/jpeg';
      const base64Data = asset.base64 ? `data:${mime};base64,${asset.base64}` : asset.uri;

      if (!token) return;

      setUploadingAvatar(true);
      try {
        const uploadRes = await authService.uploadProfilePhoto(token, base64Data);
        if (uploadRes.user) {
          updateUser(uploadRes.user);
        } else if (user && uploadRes.url) {
          updateUser({ ...user, avatar: uploadRes.url });
        }
        dialogService.showSuccess('Photo Updated', 'Your profile picture has been saved.');
      } catch (e) {
        dialogService.showError('Upload Failed', e instanceof Error ? e.message : 'Could not upload photo.');
      } finally {
        setUploadingAvatar(false);
      }
    } catch (e) {
      dialogService.showError('Error', 'Could not open photo library.');
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

    setSavingProfile(true);
    try {
      const res = await authService.updateProfile(token, {
        name: editName.trim(),
        phone: editPhone.trim() ? normalizePhone(editPhone.trim()) : undefined,
        address: editAddress.trim() || undefined,
        city: editCity.trim() || undefined
      });

      updateUser(res.user);
      setEditProfileModalVisible(false);
      dialogService.showSuccess('Profile Saved', 'Your personal account details have been updated.');
    } catch (e) {
      dialogService.showError('Save Failed', e instanceof Error ? e.message : 'Please check your inputs.');
    } finally {
      setSavingProfile(false);
    }
  };

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
    } catch (e) {
      // Revert local state on error
      if (key === 'bookingUpdates') setBookingUpdates(!value);
      if (key === 'reminders') setReminders(!value);
      if (key === 'promotions') setPromotions(!value);
      dialogService.showError('Update Failed', 'Could not save notification preferences.');
    } finally {
      setSavingPrefs(false);
    }
  };

  const openLegalDoc = (type: LegalDocType) => {
    setLegalDocType(type);
    setLegalModalVisible(true);
  };

  return (
    <ScrollView
      style={s.page}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Top Bar with Back Button */}
      {onBack && (
        <View style={s.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to Profile"
            onPress={onBack}
            style={s.backBtn}
          >
            <Text style={s.backIcon}>←</Text>
          </Pressable>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>Settings</Text>
            <Text style={s.headerSubtitle}>Client Preferences</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>
      )}

      {/* Eyebrow & Page Title */}
      <Text style={s.eyebrow}>CLIENT SETTINGS & PREFERENCES</Text>
      <Text style={s.title}>Settings</Text>
      <Text style={s.subtitle}>
        Manage your Book My Salon account, bookings, notification alerts, and security.
      </Text>

      {/* 1. Profile Header Card */}
      <View style={s.profileCard}>
        <View style={s.profileHeaderRow}>
          {/* Avatar with Upload Badge */}
          <Pressable
            onPress={handlePickAvatar}
            disabled={uploadingAvatar}
            style={s.avatarWrap}
          >
            <Avatar
              uri={user?.avatar}
              name={user?.name || 'Customer'}
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

          {/* User Details */}
          <View style={{ flex: 1, marginLeft: 14 }}>
            <View style={s.roleBadge}>
              <Text style={s.roleBadgeText}>AUTHENTICATED CUSTOMER</Text>
            </View>
            <Text style={s.userName}>{user?.name || 'Customer'}</Text>
            <Text style={s.userEmail}>{user?.email}</Text>
            {!!user?.phone && <Text style={s.userPhone}>📱 {user.phone}</Text>}
          </View>
        </View>

        <Pressable onPress={handleOpenEditProfile} style={s.editProfileBtn}>
          <Text style={s.editProfileBtnText}>✏️ Edit Profile Details</Text>
        </Pressable>
      </View>

      {/* 2. My Account Section */}
      <View style={s.sectionCard}>
        <Text style={s.sectionTitle}>MY ACCOUNT</Text>

        <View style={s.infoRow}>
          <Text style={s.infoLabel}>Primary Mobile:</Text>
          <Text style={s.infoValue}>
            {user?.phone ? user.phone : <Text style={s.emptyValue}>Not provided</Text>}
          </Text>
        </View>

        <View style={s.infoRow}>
          <Text style={s.infoLabel}>Saved Address:</Text>
          <Text style={s.infoValue}>
            {user?.address ? user.address : <Text style={s.emptyValue}>No address set</Text>}
          </Text>
        </View>

        <View style={s.infoRow}>
          <Text style={s.infoLabel}>Home City:</Text>
          <Text style={s.infoValue}>
            {user?.city ? user.city : <Text style={s.emptyValue}>Not selected</Text>}
          </Text>
        </View>
      </View>

      {/* 3. Booking Preferences Section */}
      <View style={s.sectionCard}>
        <Text style={s.sectionTitle}>BOOKING PREFERENCES</Text>

        <Pressable
          onPress={() => onNavigateTab('Bookings')}
          style={s.navItem}
        >
          <View style={s.navItemLeft}>
            <Text style={s.navItemIcon}>📅</Text>
            <View>
              <Text style={s.navItemTitle}>Upcoming Bookings & History</Text>
              <Text style={s.navItemSubtitle}>View confirmed salon appointments and status</Text>
            </View>
          </View>
          <Text style={s.chevron}>›</Text>
        </Pressable>

        <Pressable
          onPress={() => onNavigateTab('Saved')}
          style={[s.navItem, { borderBottomWidth: 0 }]}
        >
          <View style={s.navItemLeft}>
            <Text style={s.navItemIcon}>♡</Text>
            <View>
              <Text style={s.navItemTitle}>Saved & Favourite Salons</Text>
              <Text style={s.navItemSubtitle}>
                {favoritesCount > 0 ? `${favoritesCount} luxury salons bookmarked` : 'No saved salons yet'}
              </Text>
            </View>
          </View>
          <Text style={s.chevron}>›</Text>
        </Pressable>
      </View>

      {/* 4. Notification Preferences Section */}
      <View style={s.sectionCard}>
        <View style={s.sectionHeaderRow}>
          <Text style={s.sectionTitle}>NOTIFICATIONS</Text>
          {savingPrefs && <ActivityIndicator size="small" color={colors.gold} />}
        </View>

        <View style={s.toggleRow}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={s.toggleTitle}>Booking Confirmations & Updates</Text>
            <Text style={s.toggleSubtitle}>Instant alerts when salons accept, confirm, or modify bookings</Text>
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
            <Text style={s.toggleSubtitle}>Timely push reminders before scheduled treatments</Text>
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
            <Text style={s.toggleTitle}>Offers & Promotions</Text>
            <Text style={s.toggleSubtitle}>Exclusive salon discounts and seasonal luxury deals</Text>
          </View>
          <Switch
            value={promotions}
            onValueChange={(val) => handleTogglePreference('promotions', val)}
            trackColor={{ false: colors.border, true: colors.gold }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      {/* 5. Security & Privacy Section */}
      <View style={s.sectionCard}>
        <Text style={s.sectionTitle}>SECURITY & PRIVACY</Text>

        {/* Change / Set Password */}
        <Pressable
          onPress={() => setChangePasswordModalVisible(true)}
          style={s.navItem}
        >
          <View style={s.navItemLeft}>
            <Text style={s.navItemIcon}>🔒</Text>
            <View>
              <Text style={s.navItemTitle}>
                {user?.authProvider === 'GOOGLE' && !user?.hasCustomPassword
                  ? 'Set Account Password'
                  : 'Change Account Password'}
              </Text>
              <Text style={s.navItemSubtitle}>
                {user?.authProvider === 'GOOGLE' && !user?.hasCustomPassword
                  ? 'Enable email/password login for this account'
                  : 'Update credentials with current password verification'}
              </Text>
            </View>
          </View>
          <Text style={s.chevron}>›</Text>
        </Pressable>

        {/* Google Provider Information */}
        {user?.authProvider === 'GOOGLE' && (
          <View style={s.googleBanner}>
            <Text style={s.googleIcon}>G</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.googleTitle}>Google Authenticated</Text>
              <Text style={s.googleCopy}>
                Linked to {user.email}. Fast, biometric Google Sign-In is enabled.
              </Text>
            </View>
          </View>
        )}

        {/* Location Permission Status Card */}
        <View style={s.locationCard}>
          <View style={{ flex: 1 }}>
            <Text style={s.locationCardTitle}>Android Location Services</Text>
            <Text style={s.locationCardCopy}>
              Status: {locationPermStatus === 'GRANTED' ? '🟢 Permission Granted' : '🟠 Not Granted'}
              {customerLocation?.city ? ` • City: ${customerLocation.city}` : ''}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              if (locationPermStatus === 'GRANTED') {
                setLocationPickerVisible(true);
              } else {
                void handleRequestLocationPermission();
              }
            }}
            style={s.locationBtn}
          >
            <Text style={s.locationBtnText}>
              {locationPermStatus === 'GRANTED' ? 'Change City' : 'Enable'}
            </Text>
          </Pressable>
        </View>

        {/* Delete Account Action */}
        <Pressable
          onPress={() => setDeleteAccountModalVisible(true)}
          style={[s.navItem, { borderBottomWidth: 0, marginTop: 4 }]}
        >
          <View style={s.navItemLeft}>
            <Text style={[s.navItemIcon, { color: '#D32F2F' }]}>⚠️</Text>
            <View>
              <Text style={[s.navItemTitle, { color: '#D32F2F' }]}>Delete Account</Text>
              <Text style={s.navItemSubtitle}>Permanently remove profile and appointment records</Text>
            </View>
          </View>
          <Text style={[s.chevron, { color: '#D32F2F' }]}>›</Text>
        </Pressable>
      </View>

      {/* 6. Support & Legal Section */}
      <View style={s.sectionCard}>
        <Text style={s.sectionTitle}>SUPPORT & LEGAL</Text>

        {onOpenReviews && (
          <Pressable
            onPress={onOpenReviews}
            style={s.navItem}
          >
            <View style={s.navItemLeft}>
              <Text style={s.navItemIcon}>⭐</Text>
              <View>
                <Text style={s.navItemTitle}>Ratings & Reviews</Text>
                <Text style={s.navItemSubtitle}>Explore customer feedback across all salons</Text>
              </View>
            </View>
            <Text style={s.chevron}>›</Text>
          </Pressable>
        )}

        <Pressable
          onPress={() => setHelpModalVisible(true)}
          style={s.navItem}
        >
          <View style={s.navItemLeft}>
            <Text style={s.navItemIcon}>❓</Text>
            <View>
              <Text style={s.navItemTitle}>Help & FAQs</Text>
              <Text style={s.navItemSubtitle}>Booking assistance, policies, and helpline</Text>
            </View>
          </View>
          <Text style={s.chevron}>›</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            void openSupportEmail({
              role: 'CUSTOMER',
              userName: user?.name,
              userEmail: user?.email
            });
          }}
          style={s.navItem}
        >
          <View style={s.navItemLeft}>
            <Text style={s.navItemIcon}>✉️</Text>
            <View>
              <Text style={s.navItemTitle}>Email Support</Text>
              <Text style={s.navItemSubtitle}>{OFFICIAL_SUPPORT_EMAIL}</Text>
            </View>
          </View>
          <Text style={s.chevron}>›</Text>
        </Pressable>

        <Pressable
          onPress={() => setReportModalVisible(true)}
          style={s.navItem}
        >
          <View style={s.navItemLeft}>
            <Text style={s.navItemIcon}>🚨</Text>
            <View>
              <Text style={s.navItemTitle}>Report a Problem</Text>
              <Text style={s.navItemSubtitle}>Submit technical issues directly to support</Text>
            </View>
          </View>
          <Text style={s.chevron}>›</Text>
        </Pressable>

        <Pressable
          onPress={() => void openPrivacyUrl()}
          style={s.navItem}
        >
          <View style={s.navItemLeft}>
            <Text style={s.navItemIcon}>📄</Text>
            <View>
              <Text style={s.navItemTitle}>Privacy Policy</Text>
              <Text style={s.navItemSubtitle}>How your personal data is protected • Official URL</Text>
            </View>
          </View>
          <Text style={s.chevron}>›</Text>
        </Pressable>

        <Pressable
          onPress={() => void openTermsUrl()}
          style={[s.navItem, { borderBottomWidth: 0 }]}
        >
          <View style={s.navItemLeft}>
            <Text style={s.navItemIcon}>⚖️</Text>
            <View>
              <Text style={s.navItemTitle}>Terms & Conditions</Text>
              <Text style={s.navItemSubtitle}>Platform rules and salon reservation terms • Official URL</Text>
            </View>
          </View>
          <Text style={s.chevron}>›</Text>
        </Pressable>
      </View>

      {/* 7. App Version & Logout */}
      <View style={s.footerSection}>
        <Pressable
          onPress={() => setLogoutModalVisible(true)}
          style={s.logoutBtn}
        >
          <Text style={s.logoutBtnText}>🚪 Sign Out of Book My Salon</Text>
        </Pressable>
        <Text style={s.versionText}>Book My Salon v1.5.0 (Build 2026.10)</Text>
      </View>

      {/* Modals */}
      <ChangePasswordModal
        visible={changePasswordModalVisible}
        onClose={() => setChangePasswordModalVisible(false)}
      />

      <LogoutConfirmModal
        visible={logoutModalVisible}
        onCancel={() => setLogoutModalVisible(false)}
        onConfirm={async () => {
          setLogoutModalVisible(false);
          await logout();
        }}
      />

      <DeleteAccountModal
        visible={deleteAccountModalVisible}
        onClose={() => setDeleteAccountModalVisible(false)}
        onSuccess={async () => {
          await logout();
        }}
      />

      <HelpFaqModal
        visible={helpModalVisible}
        role="CUSTOMER"
        onClose={() => setHelpModalVisible(false)}
        onOpenReport={() => setReportModalVisible(true)}
      />

      <ReportProblemModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
      />

      <LegalDocumentModal
        visible={legalModalVisible}
        type={legalDocType}
        onClose={() => setLegalModalVisible(false)}
      />

      {locationPickerVisible && customerLocation && (
        <LocationPickerModal
          visible={locationPickerVisible}
          currentLocation={customerLocation}
          onClose={() => setLocationPickerVisible(false)}
          onSelectLocation={(newLoc) => {
            setLocationPickerVisible(false);
            if (onUpdateLocation) {
              onUpdateLocation(newLoc);
            }
          }}
        />
      )}

      {/* Edit Profile Details Modal */}
      <Modal
        visible={editProfileModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditProfileModalVisible(false)}
      >
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Edit Customer Profile</Text>
              <Pressable
                onPress={() => setEditProfileModalVisible(false)}
                hitSlop={8}
              >
                <Text style={s.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={s.modalField}>
                <Text style={s.modalLabel}>Full Name *</Text>
                <TextInput
                  style={s.modalInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Your Name"
                  placeholderTextColor={colors.subtle}
                />
              </View>

              <View style={s.modalField}>
                <Text style={s.modalLabel}>Mobile Number</Text>
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
                <Text style={s.modalLabel}>Delivery / Residence Address</Text>
                <TextInput
                  style={s.modalInput}
                  value={editAddress}
                  onChangeText={setEditAddress}
                  placeholder="Apartment, Street, Landmark"
                  placeholderTextColor={colors.subtle}
                />
              </View>

              <View style={s.modalField}>
                <Text style={s.modalLabel}>City</Text>
                <TextInput
                  style={s.modalInput}
                  value={editCity}
                  onChangeText={setEditCity}
                  placeholder="e.g. Bengaluru, Chennai, Mumbai"
                  placeholderTextColor={colors.subtle}
                />
              </View>

              <Pressable
                onPress={handleSaveProfile}
                disabled={savingProfile}
                style={[s.modalSaveBtn, savingProfile && { opacity: 0.7 }]}
              >
                {savingProfile ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={s.modalSaveBtnText}>Save Profile Changes</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    padding: 20,
    paddingTop: 14,
    paddingBottom: 40
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    marginBottom: 6
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 2,
    shadowColor: colors.espresso,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3
  },
  backIcon: {
    fontSize: 20,
    color: colors.espresso,
    fontWeight: '700'
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center'
  },
  headerTitle: {
    ...typography.title,
    color: colors.espresso
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.muted
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '800',
    color: colors.gold
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.ink,
    marginTop: 2
  },
  subtitle: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 16
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
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
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  avatarWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    position: 'relative'
  },
  avatarImg: {
    width: 68,
    height: 68,
    borderRadius: 34
  },
  avatarPlaceholder: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarInitial: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.gold
  },
  avatarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.espresso,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF'
  },
  avatarBadgeIcon: {
    fontSize: 11
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F5EBE1',
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 4
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.espresso,
    letterSpacing: 0.8
  },
  userName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink
  },
  userEmail: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 1
  },
  userPhone: {
    fontSize: 12,
    color: colors.subtle,
    marginTop: 2
  },
  editProfileBtn: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: colors.surface
  },
  editProfileBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.espresso
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.gold,
    letterSpacing: 1.2,
    marginBottom: 10
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface
  },
  infoLabel: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '600'
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink
  },
  emptyValue: {
    color: colors.subtle,
    fontStyle: 'italic',
    fontWeight: '400'
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface
  },
  navItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12
  },
  navItemIcon: {
    fontSize: 16
  },
  navItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink
  },
  navItemSubtitle: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 1
  },
  chevron: {
    fontSize: 18,
    color: colors.subtle,
    fontWeight: '600',
    marginLeft: 8
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
  googleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E8EAED',
    borderRadius: radius.md,
    padding: 12,
    marginVertical: 10,
    gap: 12
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: '800',
    color: '#4285F4'
  },
  googleTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink
  },
  googleCopy: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    marginVertical: 6,
    gap: 10
  },
  locationCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink
  },
  locationCardCopy: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2
  },
  locationBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm
  },
  locationBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.espresso
  },
  footerSection: {
    marginTop: 10,
    alignItems: 'center'
  },
  logoutBtn: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 14
  },
  logoutBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.espresso
  },
  versionText: {
    fontSize: 11,
    color: colors.subtle
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 12, 10, 0.72)',
    justifyContent: 'flex-end'
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    maxHeight: '85%'
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 10
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink
  },
  modalCloseText: {
    fontSize: 18,
    color: colors.muted,
    fontWeight: '700'
  },
  modalField: {
    marginBottom: 14
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 6
  },
  modalInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.ink
  },
  modalSaveBtn: {
    backgroundColor: colors.espresso,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20
  },
  modalSaveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14
  }
});
