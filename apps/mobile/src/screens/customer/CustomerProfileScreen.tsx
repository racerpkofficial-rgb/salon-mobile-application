import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import {
  Settings,
  UserRound,
  Calendar,
  Heart,
  MapPin,
  ChevronRight,
  Edit3,
  LogOut,
  HelpCircle,
  Mail,
  AlertCircle
} from 'lucide-react-native';
import { HelpFaqModal } from '../../components/HelpFaqModal';
import { LogoutConfirmModal } from '../../components/LogoutConfirmModal';
import { ReportProblemModal } from '../../components/ReportProblemModal';
import { colors, radius, typography } from '../../constants/theme';
import { Avatar } from '../../components/Avatar';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/auth.service';
import { CustomerLocationState } from '../../utils/location';
import { isValidPhone, normalizePhone } from '../../utils/validation';
import { OFFICIAL_SUPPORT_EMAIL, openSupportEmail } from '../../utils/support';
import { dialogService } from '../../services/dialog.service';

interface CustomerProfileScreenProps {
  onOpenSettings: () => void;
  onNavigateTab: (tab: string) => void;
  favoritesCount?: number;
  appointmentsCount?: number;
  customerLocation?: CustomerLocationState;
  onOpenAppointments: () => void;
  onOpenFavorites: () => void;
  onOpenSalonArea: () => void;
  onOpenReviews?: () => void;
}

export function CustomerProfileScreen({
  onOpenSettings,
  onNavigateTab,
  favoritesCount = 0,
  appointmentsCount,
  customerLocation,
  onOpenAppointments,
  onOpenFavorites,
  onOpenSalonArea,
  onOpenReviews
}: CustomerProfileScreenProps) {
  const { user, token, updateUser, logout } = useAuth();

  // Modals visibility
  const [editProfileModalVisible, setEditProfileModalVisible] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [helpModalVisible, setHelpModalVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);

  // Edit Profile Form states
  const [editName, setEditName] = useState(user?.name || '');
  const [editPhone, setEditPhone] = useState(user?.phone || '');
  const [editAddress, setEditAddress] = useState(user?.address || '');
  const [editCity, setEditCity] = useState(user?.city || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

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
          'Book My Salon needs camera roll permission so you can upload your profile picture.'
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
        dialogService.showSuccess('Photo Updated', 'Your profile photo has been refreshed.', undefined, 'Got it');
      } else if (user && res.url) {
        updateUser({ ...user, avatar: res.url });
        dialogService.showSuccess('Photo Updated', 'Your profile photo has been refreshed.', undefined, 'Got it');
      }
    } catch (e) {
      dialogService.showError('Upload Failed', e instanceof Error ? e.message : 'Could not upload photo.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleOpenEditProfile = () => {
    setEditName(user?.name || '');
    setEditPhone(user?.phone || '');
    setEditAddress(user?.address || '');
    setEditCity(user?.city || '');
    setEditProfileModalVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!token) return;

    const trimmedName = editName.trim();
    if (trimmedName.length < 2) {
      dialogService.showError('Invalid Name', 'Please enter your full name (at least 2 characters).');
      return;
    }

    const trimmedPhone = editPhone.trim();
    if (trimmedPhone && !isValidPhone(trimmedPhone)) {
      dialogService.showError('Invalid Mobile Number', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    setSavingProfile(true);
    try {
      const res = await authService.updateProfile(token, {
        name: trimmedName,
        phone: trimmedPhone ? normalizePhone(trimmedPhone) : undefined,
        address: editAddress.trim() || undefined,
        city: editCity.trim() || undefined
      });

      updateUser(res.user);
      setEditProfileModalVisible(false);
      dialogService.showSuccess('Profile Saved', 'Your personal account details have been updated.', undefined, 'Got it');
    } catch (e) {
      dialogService.showError('Save Failed', e instanceof Error ? e.message : 'Please check your inputs.');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <ScrollView
      style={s.page}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. Profile Header with Prominent Settings Button */}
      <View style={s.topHeaderRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>CLIENT PROFILE & ACCOUNT</Text>
          <Text style={s.title}>My Profile</Text>
        </View>

        {/* Prominent Top-Right Settings Button */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Account Settings"
          onPress={onOpenSettings}
          style={s.settingsBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Settings size={18} color="#E6C98D" strokeWidth={2.2} />
          <Text style={s.settingsBtnText}>Settings</Text>
        </Pressable>
      </View>

      <Text style={s.subtitle}>
        Manage your personal account, appointments, saved salons, and salon area preferences.
      </Text>

      {/* 2. Profile Card */}
      <View style={s.profileCard}>
        <View style={s.profileHeaderRow}>
          {/* Avatar with Camera Badge */}
          <Pressable
            onPress={handlePickAvatar}
            disabled={uploadingAvatar}
            style={s.avatarWrap}
            accessibilityLabel="Update profile photo"
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
          <Edit3 size={15} color={colors.espresso} style={{ marginRight: 6 }} />
          <Text style={s.editProfileBtnText}>Edit Profile Details</Text>
        </Pressable>
      </View>

      {/* 3. Three Dedicated Navigation Cards (Separate Screens) */}
      <View style={s.navCardsSection}>
        {/* Card 1: My Appointments */}
        <Pressable
          onPress={onOpenAppointments}
          style={s.navCard}
          accessibilityRole="button"
          accessibilityLabel="Open My Appointments screen"
        >
          <View style={s.navCardLeft}>
            <View style={[s.navCardIconCircle, { backgroundColor: '#FDF6E2' }]}>
              <Calendar size={20} color={colors.goldDark} />
            </View>
            <View style={s.navCardTextWrap}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={s.navCardTitle}>My Appointments</Text>
                {typeof appointmentsCount === 'number' && appointmentsCount > 0 && (
                  <View style={s.miniCountBadge}>
                    <Text style={s.miniCountText}>{appointmentsCount}</Text>
                  </View>
                )}
              </View>
              <Text style={s.navCardDesc}>
                Upcoming, completed & cancelled booking details
              </Text>
            </View>
          </View>
          <ChevronRight size={19} color={colors.subtle} />
        </Pressable>

        {/* Card 2: My Favourite Salons */}
        <Pressable
          onPress={onOpenFavorites}
          style={s.navCard}
          accessibilityRole="button"
          accessibilityLabel="Open My Favourite Salons screen"
        >
          <View style={s.navCardLeft}>
            <View style={[s.navCardIconCircle, { backgroundColor: '#FEECEB' }]}>
              <Heart size={20} color="#D9534F" />
            </View>
            <View style={s.navCardTextWrap}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={s.navCardTitle}>My Favourite Salons</Text>
                {favoritesCount > 0 && (
                  <View style={s.miniCountBadge}>
                    <Text style={s.miniCountText}>{favoritesCount}</Text>
                  </View>
                )}
              </View>
              <Text style={s.navCardDesc}>
                Quick access to your preferred saved salons
              </Text>
            </View>
          </View>
          <ChevronRight size={19} color={colors.subtle} />
        </Pressable>

        {/* Card 3: My Salon Area */}
        <Pressable
          onPress={onOpenSalonArea}
          style={s.navCard}
          accessibilityRole="button"
          accessibilityLabel="Open My Salon Area screen"
        >
          <View style={s.navCardLeft}>
            <View style={[s.navCardIconCircle, { backgroundColor: '#EBF4FF' }]}>
              <MapPin size={20} color="#2B6CB0" />
            </View>
            <View style={s.navCardTextWrap}>
              <Text style={s.navCardTitle}>My Salon Area</Text>
              <Text style={s.navCardDesc} numberOfLines={1}>
                {user?.city || customerLocation?.city || 'Location preferences'} • {user?.searchRadius || 10} km radius
              </Text>
            </View>
          </View>
          <ChevronRight size={19} color={colors.subtle} />
        </Pressable>
      </View>

      {/* 4. My Account Section */}
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

        <View style={s.infoRow}>
          <Text style={s.infoLabel}>Search Radius:</Text>
          <Text style={s.infoValue}>{user?.searchRadius || 10} km</Text>
        </View>

        <View style={[s.infoRow, { borderBottomWidth: 0 }]}>
          <Text style={s.infoLabel}>Account Email:</Text>
          <Text style={s.infoValue}>{user?.email}</Text>
        </View>
      </View>

      {/* 5. Support & Feedback Section */}
      <View style={s.sectionCard}>
        <Text style={s.sectionTitle}>SUPPORT & FEEDBACK</Text>

        {onOpenReviews && (
          <Pressable onPress={onOpenReviews} style={s.navItem}>
            <View style={s.navItemLeft}>
              <Text style={s.navItemEmoji}>⭐</Text>
              <View>
                <Text style={s.navItemTitle}>Ratings & Reviews</Text>
                <Text style={s.navItemSubtitle}>Explore customer feedback across all salons</Text>
              </View>
            </View>
            <ChevronRight size={18} color={colors.subtle} />
          </Pressable>
        )}

        <Pressable onPress={() => setHelpModalVisible(true)} style={s.navItem}>
          <View style={s.navItemLeft}>
            <HelpCircle size={20} color={colors.goldDark} style={{ marginRight: 12 }} />
            <View>
              <Text style={s.navItemTitle}>Help & FAQs</Text>
              <Text style={s.navItemSubtitle}>Booking assistance, policies, and helpline</Text>
            </View>
          </View>
          <ChevronRight size={18} color={colors.subtle} />
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
            <Mail size={20} color={colors.goldDark} style={{ marginRight: 12 }} />
            <View>
              <Text style={s.navItemTitle}>Email Support</Text>
              <Text style={s.navItemSubtitle}>{OFFICIAL_SUPPORT_EMAIL}</Text>
            </View>
          </View>
          <ChevronRight size={18} color={colors.subtle} />
        </Pressable>

        <Pressable
          onPress={() => setReportModalVisible(true)}
          style={[s.navItem, { borderBottomWidth: 0 }]}
        >
          <View style={s.navItemLeft}>
            <AlertCircle size={20} color="#D9534F" style={{ marginRight: 12 }} />
            <View>
              <Text style={s.navItemTitle}>Report a Problem</Text>
              <Text style={s.navItemSubtitle}>Submit technical issues directly to support</Text>
            </View>
          </View>
          <ChevronRight size={18} color={colors.subtle} />
        </Pressable>
      </View>

      {/* 6. Log Out Button */}
      <Pressable onPress={() => setLogoutModalVisible(true)} style={s.logoutBtn}>
        <LogOut size={18} color="#D32F2F" style={{ marginRight: 8 }} />
        <Text style={s.logoutBtnText}>Log Out of Account</Text>
      </Pressable>

      <Text style={s.versionText}>Book My Salon • Customer v1.0.0</Text>

      {/* Edit Profile Modal */}
      <Modal
        visible={editProfileModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditProfileModalVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Edit Profile Details</Text>
            <Text style={s.modalSubtitle}>Update your primary contact and location info.</Text>

            <View style={s.modalInputGroup}>
              <Text style={s.modalInputLabel}>Full Name</Text>
              <TextInput
                style={s.modalInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Your full name"
                placeholderTextColor={colors.subtle}
              />
            </View>

            <View style={s.modalInputGroup}>
              <Text style={s.modalInputLabel}>Primary Mobile (10 digits)</Text>
              <TextInput
                style={s.modalInput}
                value={editPhone}
                onChangeText={setEditPhone}
                keyboardType="phone-pad"
                placeholder="e.g. 9876543210"
                placeholderTextColor={colors.subtle}
              />
            </View>

            <View style={s.modalInputGroup}>
              <Text style={s.modalInputLabel}>Home City</Text>
              <TextInput
                style={s.modalInput}
                value={editCity}
                onChangeText={setEditCity}
                placeholder="e.g. Bengaluru, Tiruchirappalli"
                placeholderTextColor={colors.subtle}
              />
            </View>

            <View style={s.modalInputGroup}>
              <Text style={s.modalInputLabel}>Street / Delivery Address</Text>
              <TextInput
                style={[s.modalInput, { height: 60, textAlignVertical: 'top' }]}
                value={editAddress}
                onChangeText={setEditAddress}
                multiline
                placeholder="Your street address"
                placeholderTextColor={colors.subtle}
              />
            </View>

            <View style={s.modalActions}>
              <Pressable
                onPress={() => setEditProfileModalVisible(false)}
                style={s.modalCancelBtn}
                disabled={savingProfile}
              >
                <Text style={s.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveProfile}
                style={s.modalSaveBtn}
                disabled={savingProfile}
              >
                {savingProfile ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={s.modalSaveText}>Save Changes</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Logout Confirmation Modal */}
      <LogoutConfirmModal
        visible={logoutModalVisible}
        onCancel={() => setLogoutModalVisible(false)}
        onConfirm={async () => {
          setLogoutModalVisible(false);
          await logout();
        }}
      />

      {/* Help & FAQ Modal */}
      <HelpFaqModal
        visible={helpModalVisible}
        onClose={() => setHelpModalVisible(false)}
      />

      {/* Report a Problem Modal */}
      <ReportProblemModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
      />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 16, paddingBottom: 36 },
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  eyebrow: {
    ...typography.brandOverline,
    color: colors.goldDark,
    marginBottom: 2
  },
  title: {
    ...typography.displayLarge,
    color: colors.espresso
  },
  subtitle: {
    ...typography.body,
    color: colors.muted,
    marginBottom: 16,
    lineHeight: 20
  },
  settingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#382622',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    elevation: 2,
    shadowColor: '#382622',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3
  },
  settingsBtnText: {
    color: '#E6C98D',
    fontWeight: '700',
    fontSize: 13,
    marginLeft: 6
  },
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
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
    position: 'relative'
  },
  avatarImg: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: colors.gold
  },
  avatarPlaceholder: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.champagne,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.gold
  },
  avatarInitial: {
    ...typography.displayMedium,
    color: colors.espresso
  },
  avatarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: colors.espresso,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF'
  },
  avatarBadgeIcon: {
    fontSize: 11
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.goldLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: colors.border
  },
  roleBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: colors.goldDark,
    letterSpacing: 0.4
  },
  userName: {
    ...typography.title,
    color: colors.espresso
  },
  userEmail: {
    ...typography.bodySmall,
    color: colors.muted
  },
  userPhone: {
    ...typography.caption,
    color: colors.charcoal,
    marginTop: 2
  },
  editProfileBtn: {
    marginTop: 14,
    paddingVertical: 10,
    backgroundColor: colors.surfaceWarm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  editProfileBtnText: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.espresso
  },
  navCardsSection: {
    gap: 12,
    marginBottom: 16
  },
  navCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 2,
    shadowColor: colors.espresso,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4
  },
  navCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 10
  },
  navCardIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14
  },
  navCardTextWrap: {
    flex: 1
  },
  navCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.espresso
  },
  miniCountBadge: {
    backgroundColor: colors.surfaceWarm,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border
  },
  miniCountText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.espresso
  },
  navCardDesc: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
    lineHeight: 16
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border
  },
  sectionTitle: {
    ...typography.brandOverline,
    color: colors.goldDark,
    marginBottom: 12
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight
  },
  infoLabel: {
    ...typography.bodySmall,
    color: colors.muted,
    fontWeight: '500'
  },
  infoValue: {
    ...typography.bodySmall,
    color: colors.espresso,
    fontWeight: '600',
    maxWidth: '60%',
    textAlign: 'right'
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
    borderBottomColor: colors.borderLight
  },
  navItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  navItemEmoji: {
    fontSize: 18,
    marginRight: 12
  },
  navItemTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.espresso
  },
  navItemSubtitle: {
    ...typography.caption,
    color: colors.muted,
    marginTop: 1
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: '#FFF2F0',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#FFCCC7',
    marginTop: 4,
    marginBottom: 16
  },
  logoutBtnText: {
    ...typography.body,
    fontWeight: '700',
    color: '#D32F2F'
  },
  versionText: {
    ...typography.caption,
    color: colors.subtle,
    textAlign: 'center',
    marginBottom: 16
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20
  },
  modalBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 20
  },
  modalTitle: {
    ...typography.title,
    color: colors.espresso,
    marginBottom: 4
  },
  modalSubtitle: {
    ...typography.bodySmall,
    color: colors.muted,
    marginBottom: 16
  },
  modalInputGroup: {
    marginBottom: 12
  },
  modalInputLabel: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.espresso,
    marginBottom: 4
  },
  modalInput: {
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...typography.body,
    color: colors.espresso
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.border
  },
  modalCancelText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.muted
  },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.espresso
  },
  modalSaveText: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: '#FFFFFF'
  }
});
