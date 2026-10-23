import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { PrimaryButton, SecondaryButton } from '../components/Buttons';
import { colors, radius } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { authService } from '../services/auth.service';
import { salonService } from '../services/salon.service';
import { appointmentService } from '../services/appointment.service';
import { dialogService } from '../services/dialog.service';
import {
  AppointmentData,
  BillingCycle,
  PlanType,
  SalonOwnerData,
  SubscriptionData,
  UserRole
} from '../types';
import { PaymentScreen } from './PaymentScreen';
import { PlanSelectionScreen } from './PlanSelectionScreen';
import { SalonOnboardingScreen } from './SalonOnboardingScreen';
import { SubscriptionStatusScreen } from './SubscriptionStatusScreen';
import { OwnerDashboardView } from './owner/OwnerDashboardView';
import { OwnerPendingRequestsScreen } from './owner/OwnerPendingRequestsScreen';
import { OwnerBookingDetailsScreen } from './owner/OwnerBookingDetailsScreen';
import { OwnerConfirmedBookingsScreen } from './owner/OwnerConfirmedBookingsScreen';
import { OwnerCalendarScreen } from './owner/OwnerCalendarScreen';
import { OwnerAppointmentHistoryScreen } from './owner/OwnerAppointmentHistoryScreen';
import { OwnerOffersScreen } from './owner/OwnerOffersScreen';
import { OwnerServicesScreen } from './owner/OwnerServicesScreen';
import { OwnerBottomTabBar, OwnerTabType } from '../components/OwnerBottomTabBar';
import { OwnerBookingsHubView, BookingSectionTab } from './owner/OwnerBookingsHubView';
import { OwnerProfileView } from './owner/OwnerProfileView';
import { OwnerAppointmentStats, NotificationItem } from '../types';
import { LogoutConfirmModal } from '../components/LogoutConfirmModal';
import { CustomerNotificationsScreen } from './customer/CustomerNotificationsScreen';
import { notificationService } from '../services/notification.service';
import { PublicReviewsScreen } from './PublicReviewsScreen';
import { OwnerAnalyticsScreen } from './owner/OwnerAnalyticsScreen';

type OwnerViewState =
  | 'DASHBOARD'
  | 'PENDING_REQUESTS'
  | 'BOOKING_DETAILS'
  | 'CONFIRMED_BOOKINGS'
  | 'CALENDAR'
  | 'APPOINTMENT_HISTORY'
  | 'OFFERS'
  | 'SERVICES'
  | 'ONBOARDING'
  | 'PLANS'
  | 'PAYMENT'
  | 'SUBSCRIPTION_STATUS'
  | 'NOTIFICATIONS'
  | 'REVIEWS'
  | 'ANALYTICS';

export function DashboardScreen({ role }: { role: Exclude<UserRole, 'CUSTOMER'> }) {
  const { user, token, logout } = useAuth();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState<string | null>(null);

  // Salon Owner States
  const [activeOwnerTab, setActiveOwnerTab] = useState<OwnerTabType>('HOME');
  const [ownerSubView, setOwnerSubView] = useState<OwnerViewState | null>(null);
  const [bookingHubFilter, setBookingHubFilter] = useState<BookingSectionTab>('PENDING');
  const [salon, setSalon] = useState<SalonOwnerData | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('BUSINESS');
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>('MONTHLY');

  const [fetchingSalon, setFetchingSalon] = useState(false);
  const [ownerAppointments, setOwnerAppointments] = useState<AppointmentData[]>([]);
  const [stats, setStats] = useState<OwnerAppointmentStats | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentData | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [updatingAppId, setUpdatingAppId] = useState<string | null>(null);

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [ownerNotifications, setOwnerNotifications] = useState<NotificationItem[]>([]);
  const [unreadOwnerNotifsCount, setUnreadOwnerNotifsCount] = useState(0);
  const [loadingOwnerNotifs, setLoadingOwnerNotifs] = useState(false);

  const loadOwnerNotifications = async () => {
    if (!token || !isOwner) return;
    setLoadingOwnerNotifs(true);
    try {
      const res = await notificationService.getNotifications(token);
      setOwnerNotifications(res.data || []);
      setUnreadOwnerNotifsCount(res.unreadCount || 0);
    } catch {
      // Quiet fallback
    } finally {
      setLoadingOwnerNotifs(false);
    }
  };

  // Admin States
  const [pendingSalons, setPendingSalons] = useState<SalonOwnerData[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectingSalon, setRejectingSalon] = useState<{ id: string; name: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);

  const isOwner = role === 'SALON_OWNER';
  const isAdmin = role === 'SUPER_ADMIN';

  // Load Owner Salon & Subscription
  const loadOwnerData = async () => {
    if (!token || !isOwner) return;
    setFetchingSalon(true);
    try {
      const res = await salonService.getOwnerSalon(token);
      if (res.hasSalon && res.salon) {
        setSalon(res.salon);
      }
      const subRes = await salonService.getOwnerSubscriptionStatus(token).catch(() => null);
      if (subRes?.subscription) {
        setSubscription(subRes.subscription);
      }
    } catch {
      // Quiet fallback
    } finally {
      setFetchingSalon(false);
    }
  };

  // Load Admin Approvals Queue
  const loadAdminQueue = async () => {
    if (!token || !isAdmin) return;
    try {
      const res = await salonService.getPendingSalons(token);
      setPendingSalons(res.data || []);
    } catch {
      // Quiet fallback
    }
  };

  // Load Owner Appointments
  const loadOwnerAppointments = async () => {
    if (!token || !isOwner) return;
    try {
      const res = await appointmentService.getOwnerAppointments(token);
      setOwnerAppointments(res.data || []);
    } catch {
      // Quiet fallback
    }
  };

  // Load Owner Stats
  const loadOwnerStats = async () => {
    if (!token || !isOwner) return;
    setLoadingStats(true);
    try {
      const res = await appointmentService.getOwnerAppointmentStats(token);
      setStats(res);
    } catch {
      // Quiet fallback
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    if (isOwner) {
      void loadOwnerData();
      void loadOwnerAppointments();
      void loadOwnerStats();
      void loadOwnerNotifications();
    }
    if (isAdmin) void loadAdminQueue();
  }, [token, role]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (ownerSubView) {
        setOwnerSubView(null);
        return true;
      }
      if (activeOwnerTab !== 'HOME') {
        setActiveOwnerTab('HOME');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [ownerSubView, activeOwnerTab]);


  const handleAcceptAppointment = async (id: string) => {
    if (!token) return;
    setUpdatingAppId(id);
    try {
      await appointmentService.acceptAppointment(token, id);
      await loadOwnerAppointments();
      await loadOwnerStats();
    } finally {
      setUpdatingAppId(null);
    }
  };

  const handleRejectAppointment = async (id: string, reason?: string) => {
    if (!token) return;
    setUpdatingAppId(id);
    try {
      await appointmentService.rejectAppointment(token, id, reason);
      await loadOwnerAppointments();
      await loadOwnerStats();
    } finally {
      setUpdatingAppId(null);
    }
  };

  const handleCompleteAppointment = async (id: string) => {
    if (!token) return;
    setUpdatingAppId(id);
    try {
      await appointmentService.completeAppointment(token, id);
      await loadOwnerAppointments();
      await loadOwnerStats();
    } finally {
      setUpdatingAppId(null);
    }
  };

  const handleConfirmAppointment = handleAcceptAppointment;

  // Admin Approve Action
  const handleApproveSalon = async (salonId: string, name: string) => {
    if (!token) return;
    setApprovingId(salonId);
    try {
      await salonService.approveSalon(token, salonId);
      dialogService.showSuccess('Salon Approved! 🎉', `"${name}" is now ACTIVE and visible to customers in discovery.`);
      await loadAdminQueue();
    } catch (e) {
      dialogService.showError('Approval Error', e instanceof Error ? e.message : 'Failed to approve salon');
    } finally {
      setApprovingId(null);
    }
  };

  // Admin Reject Action
  const handleOpenRejectModal = (salonId: string, name: string) => {
    setRejectingSalon({ id: salonId, name });
    setRejectReason('');
    setRejectError(null);
    setRejectModalVisible(true);
  };

  const handleConfirmRejectSalon = async () => {
    if (!token || !rejectingSalon || approvingId) return;
    const trimmedReason = rejectReason.trim();
    if (!trimmedReason) {
      setRejectError('A rejection reason is required before rejecting.');
      dialogService.showError('Validation Error', 'Please enter a rejection reason.');
      return;
    }
    setApprovingId(rejectingSalon.id);
    setRejectError(null);
    try {
      await salonService.rejectSalon(token, rejectingSalon.id, trimmedReason);
      dialogService.showSuccess('Salon Rejected', `"${rejectingSalon.name}" registration has been rejected.`);
      setRejectModalVisible(false);
      setRejectingSalon(null);
      setRejectReason('');
      await loadAdminQueue();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to reject salon';
      setRejectError(msg);
      dialogService.showError('Rejection Error', msg);
    } finally {
      setApprovingId(null);
    }
  };

  // Test Protected API
  const fetchProtectedApi = async () => {
    if (!token) return;
    setLoading(true);
    setServerStatus(null);
    try {
      if (isOwner) {
        const res = await authService.getOwnerProfile(token);
        setServerStatus(`Verified: ${res.message} (Role: ${res.user.role})`);
        dialogService.showSuccess('Owner Profile Verified', `API Endpoint: /api/v1/owner/profile\nStatus: 200 OK\nMessage: ${res.message}\nRole: ${res.user.role}`);
      } else {
        const res = await authService.getAdminDashboard(token);
        setServerStatus(`Verified: ${res.message} (Role: ${res.user.role})`);
        dialogService.showSuccess('Admin Dashboard Verified', `API Endpoint: /api/v1/admin/dashboard\nStatus: 200 OK\nMessage: ${res.message}\nRole: ${res.user.role}`);
      }
    } catch (e) {
      dialogService.showError('API Error', e instanceof Error ? e.message : 'Failed to fetch protected API');
    } finally {
      setLoading(false);
    }
  };

  const handleOwnerNavigation = (target: string) => {
    if (target === 'DASHBOARD' || target === 'HOME') {
      setActiveOwnerTab('HOME');
      setOwnerSubView(null);
    } else if (target === 'PENDING_REQUESTS') {
      setBookingHubFilter('PENDING');
      setActiveOwnerTab('BOOKINGS');
      setOwnerSubView(null);
    } else if (target === 'CONFIRMED_BOOKINGS') {
      setBookingHubFilter('CONFIRMED');
      setActiveOwnerTab('BOOKINGS');
      setOwnerSubView(null);
    } else if (target === 'APPOINTMENT_HISTORY') {
      setBookingHubFilter('HISTORY');
      setActiveOwnerTab('BOOKINGS');
      setOwnerSubView(null);
    } else if (target === 'BOOKINGS') {
      setActiveOwnerTab('BOOKINGS');
      setOwnerSubView(null);
    } else if (target === 'CALENDAR') {
      setActiveOwnerTab('CALENDAR');
      setOwnerSubView(null);
    } else if (target === 'OFFERS') {
      setActiveOwnerTab('OFFERS');
      setOwnerSubView(null);
    } else if (target === 'PROFILE') {
      setActiveOwnerTab('PROFILE');
      setOwnerSubView(null);
    } else {
      setOwnerSubView(target as OwnerViewState);
    }
  };

  // Sub-Screen Router for Salon Owner
  if (isOwner) {
    if (ownerSubView === 'ANALYTICS') {
      return (
        <OwnerAnalyticsScreen
          token={token}
          salon={salon}
          onSettings={() => handleOwnerNavigation('PROFILE')}
        />
      );
    }
    if (ownerSubView === 'REVIEWS') {
      return (
        <PublicReviewsScreen
          initialSalonId={(salon?._id || salon?.id || '').toString()}
          initialSalonName={salon?.salonName}
          onBack={() => setOwnerSubView(null)}
        />
      );
    }
    if (ownerSubView === 'SERVICES') {
      return (
        <OwnerServicesScreen
          token={token || ''}
          salon={salon}
          onBack={() => setOwnerSubView(null)}
          onRefreshSalon={loadOwnerData}
        />
      );
    }
    if (ownerSubView === 'ONBOARDING') {
      return (
        <SalonOnboardingScreen
          existingSalon={salon}
          onBack={() => setOwnerSubView(null)}
          onSuccess={(newSalon) => {
            setSalon(newSalon);
            setOwnerSubView(null);
          }}
        />
      );
    }
    if (ownerSubView === 'PLANS') {
      return (
        <PlanSelectionScreen
          initialPlan={selectedPlan}
          initialCycle={selectedCycle}
          onBack={() => setOwnerSubView(null)}
          onProceedToPayment={(p, c) => {
            setSelectedPlan(p);
            setSelectedCycle(c);
            setOwnerSubView('PAYMENT');
          }}
        />
      );
    }
    if (ownerSubView === 'PAYMENT') {
      return (
        <PaymentScreen
          plan={selectedPlan}
          billingCycle={selectedCycle}
          onBack={() => setOwnerSubView('PLANS')}
          onPaymentSuccess={(newSub, updatedSalon) => {
            setSubscription(newSub);
            setSalon(updatedSalon);
            setOwnerSubView('SUBSCRIPTION_STATUS');
          }}
        />
      );
    }
    if (ownerSubView === 'SUBSCRIPTION_STATUS') {
      return (
        <SubscriptionStatusScreen
          onBack={() => {
            void loadOwnerData();
            setOwnerSubView(null);
          }}
          onChangePlan={() => setOwnerSubView('PLANS')}
        />
      );
    }
    if (ownerSubView === 'BOOKING_DETAILS' && selectedAppointment) {
      return (
        <OwnerBookingDetailsScreen
          appointment={selectedAppointment}
          onAccept={async (id) => {
            await handleAcceptAppointment(id);
            setSelectedAppointment((prev) => (prev ? { ...prev, status: 'CONFIRMED' } : null));
          }}
          onReject={async (id, reason) => {
            await handleRejectAppointment(id, reason);
            setSelectedAppointment((prev) => (prev ? { ...prev, status: 'REJECTED' } : null));
          }}
          onComplete={async (id) => {
            await handleCompleteAppointment(id);
            setSelectedAppointment((prev) => (prev ? { ...prev, status: 'COMPLETED' } : null));
          }}
          onBack={() => setOwnerSubView(null)}
        />
      );
    }
    if (ownerSubView === 'NOTIFICATIONS') {
      return (
        <CustomerNotificationsScreen
          notifications={ownerNotifications}
          loading={loadingOwnerNotifs}
          onRefresh={loadOwnerNotifications}
          onMarkRead={async (id) => {
            if (!token) return;
            await notificationService.markAsRead(token, id);
            setOwnerNotifications((prev) =>
              prev.map((n) => (n._id === id || n.id === id ? { ...n, isRead: true } : n))
            );
            setUnreadOwnerNotifsCount((c) => Math.max(0, c - 1));
          }}
          onMarkAllRead={async () => {
            if (!token) return;
            await notificationService.markAllAsRead(token);
            setOwnerNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
            setUnreadOwnerNotifsCount(0);
          }}
          onSelectNotification={(item) => {
            if (item.type === 'SALON_APPROVED') {
              setActiveOwnerTab('HOME');
              setOwnerSubView(null);
            } else if (item.type === 'SALON_REJECTED') {
              setOwnerSubView('ONBOARDING');
            } else if (
              item.type === 'BOOKING_REQUEST_SENT' ||
              item.type === 'BOOKING_ACCEPTED' ||
              item.type === 'BOOKING_REJECTED'
            ) {
              if (item.appointmentId) {
                const found = ownerAppointments.find(
                  (a) => (a._id || a.id) === item.appointmentId?.toString()
                );
                if (found) {
                  setSelectedAppointment(found);
                  setOwnerSubView('BOOKING_DETAILS');
                  return;
                }
              }
              setBookingHubFilter('PENDING');
              setActiveOwnerTab('BOOKINGS');
              setOwnerSubView(null);
            } else if (item.type === 'SUBSCRIPTION_STATUS') {
              setOwnerSubView('SUBSCRIPTION_STATUS');
            } else {
              setOwnerSubView(null);
            }
          }}
          onBack={() => setOwnerSubView(null)}
        />
      );
    }

    // 5 Primary Tabs for Salon Owner
    let tabContent;
    if (activeOwnerTab === 'HOME') {
      tabContent = (
        <OwnerDashboardView
          salon={salon}
          subscription={subscription}
          stats={stats}
          pendingRequests={ownerAppointments.filter((a) => a.status === 'PENDING')}
          loadingStats={loadingStats}
          unreadNotificationsCount={unreadOwnerNotifsCount}
          onOpenNotifications={() => {
            void loadOwnerNotifications();
            setOwnerSubView('NOTIFICATIONS');
          }}
          onRefresh={() => {
            void loadOwnerData();
            void loadOwnerAppointments();
            void loadOwnerStats();
            void loadOwnerNotifications();
          }}
          onNavigate={handleOwnerNavigation}
          onAccept={handleAcceptAppointment}
          onReject={handleRejectAppointment}
          onViewDetails={(app) => {
            setSelectedAppointment(app);
            setOwnerSubView('BOOKING_DETAILS');
          }}
          onLogout={logout}
        />
      );
    } else if (activeOwnerTab === 'BOOKINGS') {
      tabContent = (
        <OwnerBookingsHubView
          appointments={ownerAppointments}
          loading={fetchingSalon}
          initialTab={bookingHubFilter}
          onRefresh={() => {
            void loadOwnerAppointments();
            void loadOwnerStats();
          }}
          onAccept={handleAcceptAppointment}
          onReject={handleRejectAppointment}
          onComplete={handleCompleteAppointment}
          onViewDetails={(app) => {
            setSelectedAppointment(app);
            setOwnerSubView('BOOKING_DETAILS');
          }}
          onNavigateToCalendar={() => setActiveOwnerTab('CALENDAR')}
        />
      );
    } else if (activeOwnerTab === 'CALENDAR') {
      tabContent = (
        <OwnerCalendarScreen
          appointments={ownerAppointments}
          onViewDetails={(app) => {
            setSelectedAppointment(app);
            setOwnerSubView('BOOKING_DETAILS');
          }}
          onBack={() => setActiveOwnerTab('HOME')}
        />
      );
    } else if (activeOwnerTab === 'OFFERS') {
      tabContent = (
        <OwnerOffersScreen
          token={token || ''}
          salon={salon}
          initialSection="OFFERS"
        />
      );
    } else if (activeOwnerTab === 'COUPONS') {
      tabContent = (
        <OwnerOffersScreen
          token={token || ''}
          salon={salon}
          initialSection="COUPONS"
        />
      );
    } else if (activeOwnerTab === 'NOTIFICATIONS') {
      tabContent = (
        <CustomerNotificationsScreen
          notifications={ownerNotifications}
          loading={loadingOwnerNotifs}
          onRefresh={loadOwnerNotifications}
          onMarkRead={async (id) => {
            if (!token) return;
            await notificationService.markAsRead(token, id);
            setOwnerNotifications((prev) =>
              prev.map((n) => (n._id === id || n.id === id ? { ...n, isRead: true } : n))
            );
            setUnreadOwnerNotifsCount((c) => Math.max(0, c - 1));
          }}
          onMarkAllRead={async () => {
            if (!token) return;
            await notificationService.markAllAsRead(token);
            setOwnerNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
            setUnreadOwnerNotifsCount(0);
          }}
          onSelectNotification={(item) => {
            if (item.type === 'SALON_APPROVED') {
              setActiveOwnerTab('HOME');
              setOwnerSubView(null);
            } else if (item.type === 'SALON_REJECTED') {
              setOwnerSubView('ONBOARDING');
            } else if (
              item.type === 'BOOKING_REQUEST_SENT' ||
              item.type === 'BOOKING_ACCEPTED' ||
              item.type === 'BOOKING_REJECTED'
            ) {
              if (item.appointmentId) {
                const found = ownerAppointments.find(
                  (a) => (a._id || a.id) === item.appointmentId?.toString()
                );
                if (found) {
                  setSelectedAppointment(found);
                  setOwnerSubView('BOOKING_DETAILS');
                  return;
                }
              }
              setBookingHubFilter('PENDING');
              setActiveOwnerTab('BOOKINGS');
              setOwnerSubView(null);
            } else if (item.type === 'SUBSCRIPTION_STATUS') {
              setOwnerSubView('SUBSCRIPTION_STATUS');
            } else {
              setOwnerSubView(null);
            }
          }}
          onBack={() => setActiveOwnerTab('HOME')}
        />
      );
    } else {
      tabContent = (
        <OwnerProfileView
          user={user}
          salon={salon}
          subscription={subscription}
          onEditProfile={() => setOwnerSubView('ONBOARDING')}
          onManagePlan={() => setOwnerSubView('PLANS')}
          onViewSubscription={() => setOwnerSubView('SUBSCRIPTION_STATUS')}
          onLogout={logout}
          onNavigateToServices={() => setOwnerSubView('SERVICES')}
          onNavigateToOffers={() => setActiveOwnerTab('OFFERS')}
          onNavigateToBookings={() => setActiveOwnerTab('BOOKINGS')}
          onNavigateToReviews={() => setOwnerSubView('REVIEWS')}
          onProfileUpdated={(_upUser, upSalon) => {
            if (upSalon) setSalon(upSalon);
            void loadOwnerData();
          }}
        />
      );
    }

    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1 }}>{tabContent}</View>
        <OwnerBottomTabBar
          activeTab={activeOwnerTab}
          onSelectTab={(tab) => {
            setActiveOwnerTab(tab);
            setOwnerSubView(null);
          }}
          pendingCount={stats?.pendingCount ?? ownerAppointments.filter((a) => a.status === 'PENDING').length}
          unreadCount={unreadOwnerNotifsCount}
        />
      </View>
    );
  }


  const isPendingReview = salon?.status === 'PENDING_APPROVAL';
  const isActive = salon?.status === 'ACTIVE';

  return (
    <ScrollView style={s.page} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <Text style={s.eyebrow}>
        {isAdmin ? 'PLATFORM ADMINISTRATION' : 'SALON PARTNER PORTAL'}
      </Text>
      <Text style={s.title}>
        {isAdmin ? 'System & Approvals' : 'Your Salon Space'}
      </Text>

      {/* Prominent Under Review Notice Banner for Salon Owner */}
      {isOwner && isPendingReview && (
        <View style={s.reviewAlert}>
          <View style={s.alertRow}>
            <Text style={s.alertIcon}>⏳</Text>
            <Text style={s.alertTitle}>Your salon registration is under review.</Text>
          </View>
          <Text style={s.alertBody}>
            Our team is reviewing your registration and services. Customers cannot discover or book your salon until a Super Admin approves it.
          </Text>
          <Pressable onPress={() => setOwnerSubView('SUBSCRIPTION_STATUS')} style={s.alertLink}>
            <Text style={s.alertLinkText}>View Subscription & Review Details →</Text>
          </Pressable>

        </View>
      )}

      {isOwner && isActive && (
        <View style={[s.reviewAlert, s.approvedAlert]}>
          <View style={s.alertRow}>
            <Text style={s.alertIcon}>✓</Text>
            <Text style={[s.alertTitle, s.approvedTitle]}>Salon is Live & Discoverable</Text>
          </View>
          <Text style={s.alertBody}>
            Your salon is verified and actively listed on the Book My Salon customer discovery marketplace.
          </Text>
        </View>
      )}

      {isOwner && salon?.status === 'REJECTED' && (
        <View style={[s.reviewAlert, s.rejectedAlert]}>
          <View style={s.alertRow}>
            <Text style={s.alertIcon}>⚠️</Text>
            <Text style={[s.alertTitle, s.rejectedTitle]}>Registration Requires Correction</Text>
          </View>
          <Text style={[s.alertBody, s.rejectedBody]}>
            Administrative Notice: {salon.rejectionReason || 'Please review guidelines and update your profile.'}
          </Text>
          <Pressable onPress={() => setOwnerSubView('ONBOARDING')} style={s.alertLink}>
            <Text style={[s.alertLinkText, { color: '#B91C1C' }]}>Update Salon Details & Resubmit →</Text>
          </Pressable>

        </View>
      )}

      {isOwner && salon?.status === 'SUSPENDED' && (
        <View style={[s.reviewAlert, s.suspendedAlert]}>
          <View style={s.alertRow}>
            <Text style={s.alertIcon}>⛔</Text>
            <Text style={[s.alertTitle, s.suspendedTitle]}>Account Suspended</Text>
          </View>
          <Text style={[s.alertBody, { color: '#6B7280' }]}>
            Your salon is temporarily suspended from customer discovery. Contact platform support for assistance.
          </Text>
        </View>
      )}

      {/* Authenticated User Card */}
      <View style={s.card}>
        <Text style={s.cardLabel}>AUTHENTICATED PARTNER</Text>
        <Text style={s.name}>{user?.name}</Text>
        <Text style={s.email}>{user?.email}</Text>
        <View style={s.badge}>
          <Text style={s.badgeText}>{role.replace('_', ' ')}</Text>
        </View>

        {serverStatus && (
          <View style={s.serverBox}>
            <Text style={s.serverText}>✓ {serverStatus}</Text>
          </View>
        )}
      </View>

      {/* Salon Owner Onboarding & Subscription Overview */}
      {isOwner && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>ONBOARDING & MEMBERSHIP</Text>

          {fetchingSalon ? (
            <ActivityIndicator color={colors.gold} style={{ padding: 20 }} />
          ) : salon ? (
            <View style={s.salonCard}>
              <View style={s.salonHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.salonName}>{salon.salonName}</Text>
                  <Text style={s.salonCity}>{salon.city} • {salon.address}</Text>
                </View>
                <View
                  style={[
                    s.statusPill,
                    isPendingReview ? s.statusPillWarning : isActive ? s.statusPillSuccess : s.statusPillDefault
                  ]}
                >
                  <Text
                    style={[
                      s.statusPillText,
                      isPendingReview ? s.statusPillTextWarning : isActive ? s.statusPillTextSuccess : s.statusPillTextDefault
                    ]}
                  >
                    {salon.status.replace('_', ' ')}
                  </Text>
                </View>
              </View>

              <View style={s.divider} />

              <View style={s.subRow}>
                <Text style={s.subLabel}>Subscription Plan:</Text>
                <Text style={s.subVal}>
                  {subscription ? `${subscription.plan} (${subscription.billingCycle})` : 'No Active Plan'}
                </Text>
              </View>
              <View style={s.subRow}>
                <Text style={s.subLabel}>Subscription Status:</Text>
                <Text style={[s.subVal, { color: subscription?.status === 'ACTIVE' ? colors.success : colors.gold }]}>
                  {salon.subscriptionStatus || 'PENDING'}
                </Text>
              </View>

              <View style={s.cardActions}>
                <Pressable
                  style={s.outlineActionBtn}
                  onPress={() => setOwnerSubView('SUBSCRIPTION_STATUS')}
                >
                  <Text style={s.outlineActionText}>View Subscription Status</Text>
                </Pressable>
                <Pressable
                  style={s.outlineActionBtn}
                  onPress={() => setOwnerSubView('PLANS')}
                >
                  <Text style={s.outlineActionText}>Change Plan</Text>
                </Pressable>
              </View>

            </View>
          ) : (
            <View style={s.onboardPrompt}>
              <Text style={s.promptTitle}>Complete Salon Onboarding</Text>
              <Text style={s.promptCopy}>
                Set up your salon details and pick a subscription plan to submit for review.
              </Text>
              <View style={{ marginTop: 14 }}>
                <PrimaryButton label="Start Salon Setup →" onPress={() => setOwnerSubView('ONBOARDING')} />
              </View>

            </View>
          )}

          {/* Owner Incoming Appointments Queue */}
          {isActive && (
            <View style={{ marginTop: 22 }}>
              <View style={s.adminHeaderRow}>
                <Text style={s.sectionTitle}>CUSTOMER APPOINTMENTS</Text>
                <Pressable onPress={() => void loadOwnerAppointments()}>
                  <Text style={s.refreshText}>↻ Refresh ({ownerAppointments.length})</Text>
                </Pressable>
              </View>

              {ownerAppointments.length === 0 ? (
                <View style={s.emptyQueueCard}>
                  <Text style={s.emptyQueueIcon}>📅</Text>
                  <Text style={s.emptyQueueTitle}>No Bookings Yet</Text>
                  <Text style={s.emptyQueueCopy}>
                    Your salon is active and visible in discovery. Customer appointment requests will appear here for your confirmation.
                  </Text>
                </View>
              ) : (
                <View style={s.pendingList}>
                  {ownerAppointments.map((app, index) => {
                    const cust = typeof app.customerId === 'object' ? app.customerId : null;
                    const svc = typeof app.serviceId === 'object' ? app.serviceId : null;
                    const isWorking = updatingAppId === app._id;

                    return (
                      <View key={`${app._id}-${index}`} style={s.pendingCard}>
                        <View style={s.pendingHeader}>
                          <Text style={s.pendingName}>{cust?.name || 'Customer'}</Text>
                          <View
                            style={[
                              s.statusPill,
                              app.status === 'PENDING'
                                ? s.statusPillWarning
                                : app.status === 'CONFIRMED'
                                ? s.statusPillSuccess
                                : s.statusPillDefault
                            ]}
                          >
                            <Text
                              style={[
                                s.statusPillText,
                                app.status === 'PENDING'
                                  ? s.statusPillTextWarning
                                  : app.status === 'CONFIRMED'
                                  ? s.statusPillTextSuccess
                                  : s.statusPillTextDefault
                              ]}
                            >
                              {app.status}
                            </Text>
                          </View>
                        </View>

                        <Text style={s.pendingDesc}>
                          Treatment: <Text style={{ fontWeight: '700', color: colors.ink }}>{svc?.name}</Text> (₹{svc?.price})
                        </Text>
                        <Text style={s.pendingMeta}>
                          📅 {app.appointmentDate} • ⏱ {app.startTime} - {app.endTime} ({svc?.duration || 30} mins)
                        </Text>
                        {Boolean(cust?.phone) && (
                          <Text style={s.pendingMeta}>
                            📞 {cust.phone}
                          </Text>
                        )}

                        {app.customerNote ? (
                          <Text style={[s.pendingMeta, { color: colors.gold, fontStyle: 'italic', marginTop: 4 }]}>
                            Note: "{app.customerNote}"
                          </Text>
                        ) : null}

                        {/* Owner Confirmation / Rejection Buttons */}
                        {app.status === 'PENDING' && (
                          <View style={s.approvalButtons}>
                            <Pressable
                              disabled={isWorking}
                              onPress={() => handleConfirmAppointment(app._id)}
                              style={[s.approveBtn, isWorking && { opacity: 0.5 }]}
                            >
                              <Text style={s.approveBtnText}>
                                {isWorking ? 'Processing...' : '✓ Confirm Slot'}
                              </Text>
                            </Pressable>

                            <Pressable
                              disabled={isWorking}
                              onPress={() => handleRejectAppointment(app._id)}
                              style={[s.rejectBtn, isWorking && { opacity: 0.5 }]}
                            >
                              <Text style={s.rejectBtnText}>✕ Decline</Text>
                            </Pressable>
                          </View>
                        )}

                        {app.status === 'CONFIRMED' && (
                          <View style={{ marginTop: 10 }}>
                            <Pressable
                              disabled={isWorking}
                              onPress={() => handleCompleteAppointment(app._id)}
                              style={[s.outlineActionBtn, isWorking && { opacity: 0.5 }]}
                            >
                              <Text style={s.outlineActionText}>
                                {isWorking ? 'Updating...' : '✓ Mark as Completed'}
                              </Text>
                            </Pressable>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* SUPER_ADMIN Pending Approvals Section */}
      {isAdmin && (
        <View style={s.section}>
          <View style={s.adminHeaderRow}>
            <Text style={s.sectionTitle}>SALON APPROVALS QUEUE</Text>
            <Pressable onPress={() => void loadAdminQueue()}>
              <Text style={s.refreshText}>↻ Refresh Queue</Text>
            </Pressable>
          </View>

          {pendingSalons.length === 0 ? (
            <View style={s.emptyQueueCard}>
              <Text style={s.emptyQueueIcon}>✓</Text>
              <Text style={s.emptyQueueTitle}>All Submissions Up to Date</Text>
              <Text style={s.emptyQueueCopy}>
                No salons are currently awaiting review. New owner registrations will appear here.
              </Text>
            </View>
          ) : (
            <View style={s.pendingList}>
              {pendingSalons.map((p, index) => {
                const isWorking = approvingId === p._id;
                return (
                  <View key={`${p._id}-${index}`} style={s.pendingCard}>
                    <View style={s.pendingHeader}>
                      <Text style={s.pendingName}>{p.salonName}</Text>
                      <View style={s.reviewBadge}>
                        <Text style={s.reviewBadgeText}>PENDING APPROVAL</Text>
                      </View>
                    </View>

                    <Text style={s.pendingDesc}>{p.description}</Text>
                    <Text style={s.pendingMeta}>📍 {p.city} • {p.address}</Text>
                    <Text style={s.pendingMeta}>📞 {p.phone} | ✉️ {p.email}</Text>
                    <Text style={s.pendingMeta}>
                      💳 Subscription: {p.subscriptionStatus} ({p.services?.length || 0} services)
                    </Text>

                    <View style={s.approvalButtons}>
                      <Pressable
                        disabled={isWorking}
                        onPress={() => p._id && handleApproveSalon(p._id, p.salonName)}
                        style={[s.approveBtn, isWorking && { opacity: 0.5 }]}
                      >
                        <Text style={s.approveBtnText}>
                          {isWorking ? 'Processing...' : '✓ Approve Salon'}
                        </Text>
                      </Pressable>

                      <Pressable
                        disabled={isWorking}
                        onPress={() => p._id && handleOpenRejectModal(p._id, p.salonName)}
                        style={[s.rejectBtn, isWorking && { opacity: 0.5 }]}
                      >
                        <Text style={s.rejectBtnText}>✕ Reject</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* Verification & Sign Out Actions */}
      <View style={s.footerActions}>
        <SecondaryButton label="Sign out" onPress={() => setShowLogoutModal(true)} />

        {/* Luxury Logout Confirmation Modal */}
        <LogoutConfirmModal
          visible={showLogoutModal}
          onCancel={() => setShowLogoutModal(false)}
          onConfirm={async () => {
            setShowLogoutModal(false);
            await logout();
          }}
        />

        {/* Admin Rejection Modal */}
        <Modal visible={rejectModalVisible} animationType="fade" transparent>
          <View style={s.modalOverlay}>
            <View style={[s.modalBox, { maxHeight: 420 }]}>
              <Text style={s.modalTitle}>Reject Salon Registration</Text>
              <Text style={s.modalSub}>
                Please provide a reason. The salon owner will receive this reason in their notification email to correct and resubmit.
              </Text>

              <TextInput
                style={[
                  s.reasonInput,
                  rejectError ? { borderColor: colors.danger, borderWidth: 1.5 } : null
                ]}
                multiline
                numberOfLines={4}
                value={rejectReason}
                onChangeText={(text) => {
                  setRejectReason(text);
                  if (rejectError) setRejectError(null);
                }}
                placeholder="Explain why the application is rejected (required)..."
                placeholderTextColor={colors.subtle}
              />

              {rejectError ? (
                <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '600', marginBottom: 12 }}>
                  ⚠️ {rejectError}
                </Text>
              ) : null}

              <View style={s.modalActions}>
                <PrimaryButton
                  label={approvingId ? 'Rejecting...' : 'Confirm Rejection'}
                  loading={!!approvingId}
                  disabled={!!approvingId || !rejectReason.trim()}
                  onPress={() => void handleConfirmRejectSalon()}
                />
                <View style={{ height: 10 }} />
                <SecondaryButton
                  label="Cancel"
                  disabled={!!approvingId}
                  onPress={() => {
                    setRejectModalVisible(false);
                    setRejectError(null);
                  }}
                />
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 22, paddingTop: 40, paddingBottom: 40 },
  eyebrow: { color: colors.gold, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  title: { fontSize: 32, lineHeight: 37, letterSpacing: -1, color: colors.ink, fontWeight: '700', marginTop: 8 },

  reviewAlert: {
    backgroundColor: '#FFFBEB',
    borderRadius: radius.md,
    padding: 16,
    marginTop: 18,
    borderWidth: 1.5,
    borderColor: '#FCD34D'
  },
  approvedAlert: {
    backgroundColor: '#ECFDF5',
    borderColor: '#6EE7B7'
  },
  rejectedAlert: {
    backgroundColor: '#FEF2F2',
    borderColor: '#F87171'
  },
  suspendedAlert: {
    backgroundColor: '#F3F4F6',
    borderColor: '#9CA3AF'
  },
  alertRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  alertIcon: { fontSize: 18, marginRight: 8 },
  alertTitle: { fontSize: 14, fontWeight: '800', color: '#92400E', flex: 1 },
  approvedTitle: { color: '#065F46' },
  rejectedTitle: { color: '#991B1B' },
  suspendedTitle: { color: '#1F2937' },
  alertBody: { fontSize: 12, color: '#78350F', lineHeight: 18 },
  rejectedBody: { color: '#B91C1C', fontWeight: '600' },
  alertLink: { marginTop: 10, alignSelf: 'flex-start' },
  alertLinkText: { fontSize: 12, fontWeight: '700', color: colors.gold },

  card: {
    marginVertical: 18,
    padding: 20,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg
  },
  cardLabel: { fontSize: 11, letterSpacing: 1.2, fontWeight: '700', color: colors.gold },
  name: { color: colors.ink, fontSize: 20, fontWeight: '700', marginTop: 10 },
  email: { color: colors.muted, marginTop: 4, fontSize: 13 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.goldSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 14
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: colors.ink },
  serverBox: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#ECFDF5',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#A7F3D0'
  },
  serverText: { fontSize: 12, color: '#065F46', fontWeight: '600' },

  section: { marginTop: 10 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: colors.gold, letterSpacing: 1.2, marginBottom: 12 },
  adminHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  refreshText: { fontSize: 12, fontWeight: '700', color: colors.gold },

  salonCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border
  },
  salonHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  salonName: { fontSize: 18, fontWeight: '700', color: colors.ink },
  salonCity: { fontSize: 12, color: colors.muted, marginTop: 3 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  statusPillWarning: { backgroundColor: '#FEF3C7' },
  statusPillSuccess: { backgroundColor: '#D1FAE5' },
  statusPillDefault: { backgroundColor: colors.background },
  statusPillText: { fontSize: 10, fontWeight: '800' },
  statusPillTextWarning: { color: '#92400E' },
  statusPillTextSuccess: { color: '#065F46' },
  statusPillTextDefault: { color: colors.muted },

  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  subRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  subLabel: { fontSize: 12, color: colors.muted },
  subVal: { fontSize: 12, fontWeight: '700', color: colors.ink },

  cardActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  outlineActionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.background
  },
  outlineActionText: { fontSize: 12, fontWeight: '700', color: colors.ink },

  onboardPrompt: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center'
  },
  promptTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  promptCopy: { fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: 6, lineHeight: 19 },

  emptyQueueCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center'
  },
  emptyQueueIcon: { fontSize: 28, color: colors.success, marginBottom: 8 },
  emptyQueueTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  emptyQueueCopy: { fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 4, lineHeight: 18 },

  pendingList: { gap: 14 },
  pendingCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border
  },
  pendingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pendingName: { fontSize: 17, fontWeight: '700', color: colors.ink, flex: 1 },
  reviewBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  reviewBadgeText: { fontSize: 9, fontWeight: '800', color: '#92400E' },
  pendingDesc: { fontSize: 12, color: colors.muted, marginTop: 6, lineHeight: 17 },
  pendingMeta: { fontSize: 11, color: colors.ink, marginTop: 4 },

  approvalButtons: { flexDirection: 'row', gap: 10, marginTop: 14 },
  approveBtn: {
    flex: 1,
    height: 42,
    backgroundColor: '#059669',
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center'
  },
  approveBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  rejectBtn: {
    flex: 1,
    height: 42,
    backgroundColor: '#EF4444',
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center'
  },
  rejectBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  footerActions: { marginTop: 24 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20
  },
  modalBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    maxHeight: '85%',
    padding: 20
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.ink },
  modalSub: { fontSize: 11, color: colors.muted, marginTop: 4, marginBottom: 12 },
  reasonInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    padding: 12,
    fontSize: 13,
    color: colors.ink,
    textAlignVertical: 'top',
    minHeight: 90,
    marginBottom: 8
  },
  modalActions: { marginTop: 12 }
});