import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { StatusBadge } from '../../components/StatusBadge';
import { Avatar } from '../../components/Avatar';
import { colors, radius, typography } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import {
  AppointmentData,
  OwnerAppointmentStats,
  OwnerScreenView,
  SalonOwnerData,
  SubscriptionData
} from '../../types';

interface OwnerDashboardViewProps {
  salon: SalonOwnerData | null;
  subscription: SubscriptionData | null;
  stats: OwnerAppointmentStats | null;
  pendingRequests: AppointmentData[];
  loadingStats: boolean;
  unreadNotificationsCount?: number;
  onOpenNotifications?: () => void;
  onRefresh: () => void;
  onNavigate: (screen: OwnerScreenView) => void;
  onAccept: (appointmentId: string) => Promise<void>;
  onReject: (appointmentId: string, reason?: string) => Promise<void>;
  onViewDetails: (appointment: AppointmentData) => void;
  onLogout: () => void;
}

export function OwnerDashboardView({
  salon,
  subscription,
  stats,
  pendingRequests,
  loadingStats,
  unreadNotificationsCount,
  onOpenNotifications,
  onRefresh,
  onNavigate,
  onAccept,
  onReject,
  onViewDetails,
  onLogout
}: OwnerDashboardViewProps) {
  const { user } = useAuth();
  const pendingCount = stats?.pendingCount ?? pendingRequests.length;
  const confirmedToday = stats?.confirmedTodayCount ?? 0;
  const upcomingConfirmed = stats?.upcomingConfirmedCount ?? 0;
  const todayApps = stats?.todayAppointments ?? [];

  // Expiry date formatter if real data exists
  const expiryFormatted = React.useMemo(() => {
    if (!subscription?.endDate) return null;
    try {
      const d = new Date(subscription.endDate);
      if (isNaN(d.getTime())) return null;
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return null;
    }
  }, [subscription?.endDate]);

  return (
    <ScrollView
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={loadingStats}
          onRefresh={onRefresh}
          tintColor={colors.gold}
          colors={[colors.gold]}
        />
      }
    >
      {/* 1. Luxury Header */}
      <View style={s.headerCard}>
        <View style={s.headerTopRow}>
          <View style={s.brandCol}>
            <Text style={s.brandOverline}>BOOK MY SALON</Text>
            <Text style={s.salonName} numberOfLines={1}>
              {salon?.salonName || 'My Atelier Salon'}
            </Text>
            <Text style={s.salonCity} numberOfLines={1}>
              📍 {salon?.city || salon?.address || 'Location setup in progress'}
            </Text>
          </View>

          <View style={s.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Refresh dashboard"
              onPress={onRefresh}
              hitSlop={8}
              style={({ pressed }) => [s.headerIconBtn, pressed && s.btnPressed]}
            >
              {loadingStats ? (
                <ActivityIndicator size="small" color={colors.gold} />
              ) : (
                <Text style={s.headerIcon}>↻</Text>
              )}
            </Pressable>

            {Boolean(onOpenNotifications) && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Notifications"
                onPress={onOpenNotifications}
                hitSlop={8}
                style={({ pressed }) => [s.headerIconBtn, pressed && s.btnPressed]}
              >
                <Text style={[s.headerIcon, { fontSize: 16 }]}>🔔</Text>
                {Boolean(unreadNotificationsCount && unreadNotificationsCount > 0) && (
                  <View style={s.bellBadge}>
                    <Text style={s.bellBadgeText}>
                      {(unreadNotificationsCount ?? 0) > 9 ? '9+' : unreadNotificationsCount}
                    </Text>
                  </View>
                )}
              </Pressable>
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Salon profile"
              onPress={() => onNavigate('PROFILE')}
              hitSlop={8}
              style={({ pressed }) => [s.avatarBtn, pressed && s.btnPressed]}
            >
              <Avatar
                uri={user?.avatar}
                name={user?.name || salon?.salonName || 'S'}
                size={36}
                borderColor={colors.gold}
                borderWidth={1}
                backgroundColor={colors.goldSoft}
                textColor={colors.ink}
              />
            </Pressable>
          </View>
        </View>

        <View style={s.headerBottomRow}>
          <View style={s.statusPillGroup}>
            <Text style={s.statusLabel}>Partner Approval:</Text>
            <StatusBadge status={salon?.status || 'PENDING_APPROVAL'} />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Salon ratings and reviews"
            onPress={() => onNavigate('REVIEWS')}
            style={s.headerRatingChip}
          >
            <Text style={s.headerRatingText}>
              ★ {(salon?.rating || 0).toFixed(1)} ({salon?.reviews || 0})
            </Text>
          </Pressable>
        </View>
      </View>

      {/* 2. Compact Premium Subscription Card */}
      <View style={s.subCard}>
        <View style={s.subLeft}>
          <View style={s.subPlanHeader}>
            <Text style={s.subTag}>PARTNER MEMBERSHIP</Text>
            <View style={s.planBadge}>
              <Text style={s.planBadgeText}>
                {subscription?.plan || 'STARTER'}
              </Text>
            </View>
          </View>
          {expiryFormatted ? (
            <Text style={s.subExpiry}>Valid until {expiryFormatted}</Text>
          ) : (
            <Text style={s.subExpiry}>
              {subscription?.status === 'ACTIVE'
                ? 'Active subscription'
                : 'Registration under review'}
            </Text>
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Manage partner plan"
          onPress={() => onNavigate('PLANS')}
          style={({ pressed }) => [s.subActionBtn, pressed && s.btnPressed]}
        >
          <Text style={s.subActionText}>
            {subscription?.status === 'ACTIVE' ? 'Upgrade →' : 'Select Plan →'}
          </Text>
        </Pressable>
      </View>

      {/* 3. Dashboard Metrics (Responsive Grid) */}
      <View style={s.metricsRow}>
        {/* Pending Requests */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Pending requests: ${pendingCount}`}
          onPress={() => onNavigate('PENDING_REQUESTS')}
          style={({ pressed }) => [
            s.metricCard,
            pendingCount > 0 && s.metricCardAlert,
            pressed && s.cardPressed
          ]}
        >
          <View style={s.metricTop}>
            <Text style={s.metricLabel}>Pending Requests</Text>
            {pendingCount > 0 && <View style={s.alertDot} />}
          </View>
          <Text
            style={[
              s.metricNumber,
              pendingCount > 0 && { color: colors.warning }
            ]}
          >
            {pendingCount}
          </Text>
          <Text style={s.metricFoot}>Review requests →</Text>
        </Pressable>

        {/* Today's Confirmed */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Today's confirmed appointments: ${confirmedToday}`}
          onPress={() => onNavigate('CONFIRMED_BOOKINGS')}
          style={({ pressed }) => [s.metricCard, pressed && s.cardPressed]}
        >
          <View style={s.metricTop}>
            <Text style={s.metricLabel}>Today's Confirmed</Text>
          </View>
          <Text style={[s.metricNumber, { color: colors.success }]}>
            {confirmedToday}
          </Text>
          <Text style={s.metricFoot}>Today's clients</Text>
        </Pressable>

        {/* Upcoming Appointments */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Upcoming appointments: ${upcomingConfirmed}`}
          onPress={() => onNavigate('CALENDAR')}
          style={({ pressed }) => [s.metricCard, pressed && s.cardPressed]}
        >
          <View style={s.metricTop}>
            <Text style={s.metricLabel}>Upcoming</Text>
          </View>
          <Text style={s.metricNumber}>{upcomingConfirmed}</Text>
          <Text style={s.metricFoot}>On schedule →</Text>
        </Pressable>
      </View>

      {/* 4. Quick Actions */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Quick Management</Text>
        <View style={s.quickGrid}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View salon analytics"
            onPress={() => onNavigate('ANALYTICS')}
            style={({ pressed }) => [s.quickItem, pressed && s.cardPressed]}
          >
            <View style={s.quickIconCircle}>
              <Text style={s.quickIcon}>📊</Text>
            </View>
            <Text style={s.quickTitle}>Salon Analytics</Text>
            <Text style={s.quickSubtitle}>Performance & charts</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View calendar"
            onPress={() => onNavigate('CALENDAR')}
            style={({ pressed }) => [s.quickItem, pressed && s.cardPressed]}
          >
            <View style={s.quickIconCircle}>
              <Text style={s.quickIcon}>📅</Text>
            </View>
            <Text style={s.quickTitle}>Calendar</Text>
            <Text style={s.quickSubtitle}>Daily agenda</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Manage services"
            onPress={() => onNavigate('SERVICES')}
            style={({ pressed }) => [s.quickItem, pressed && s.cardPressed]}
          >
            <View style={s.quickIconCircle}>
              <Text style={s.quickIcon}>✂️</Text>
            </View>
            <Text style={s.quickTitle}>Services</Text>
            <Text style={s.quickSubtitle}>Menu & prices</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create offer"
            onPress={() => onNavigate('OFFERS')}
            style={({ pressed }) => [s.quickItem, pressed && s.cardPressed]}
          >
            <View style={s.quickIconCircle}>
              <Text style={s.quickIcon}>🏷️</Text>
            </View>
            <Text style={s.quickTitle}>Offers</Text>
            <Text style={s.quickSubtitle}>Promotions</Text>
          </Pressable>
        </View>
      </View>

      {/* Reviews & Reputation Banner */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Customer reviews and ratings"
        onPress={() => onNavigate('REVIEWS')}
        style={({ pressed }) => [s.reviewsBanner, pressed && s.cardPressed]}
      >
        <View style={s.reviewsBannerLeft}>
          <View style={s.reviewsStarCircle}>
            <Text style={{ fontSize: 18 }}>⭐</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.reviewsBannerTitle}>Customer Reviews & Reputation</Text>
            <Text style={s.reviewsBannerSub}>
              ★ {(salon?.rating || 0).toFixed(1)} rating • {salon?.reviews || 0} customer reviews
            </Text>
          </View>
        </View>
        <View style={s.reviewsBannerBadge}>
          <Text style={s.reviewsBannerAction}>Manage & Reply →</Text>
        </View>
      </Pressable>

      {/* 5. Action Required: Pending Requests Preview (if real pending exist) */}
      {pendingRequests.length > 0 && (
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>
              Action Required ({pendingRequests.length})
            </Text>
            <Pressable onPress={() => onNavigate('PENDING_REQUESTS')}>
              <Text style={s.viewAllLink}>View All →</Text>
            </Pressable>
          </View>

          {pendingRequests.slice(0, 2).map((app, index) => {
            const customerName = (app.customerId as any)?.name || 'Customer';
            const customerAvatar = (app.customerId as any)?.avatar;
            const serviceName = (app.serviceId as any)?.name || 'Service';
            const price = (app.serviceId as any)?.price ?? 0;
            const duration = (app.serviceId as any)?.duration || 30;

            return (
              <View key={`${app._id}-${index}`} style={s.pendingCard}>
                <View style={s.pendingTop}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <Avatar
                      uri={customerAvatar}
                      name={customerName}
                      size={38}
                      borderColor={colors.gold}
                      borderWidth={1}
                      backgroundColor={colors.goldSoft}
                      textColor={colors.ink}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={s.pendingName}>{customerName}</Text>
                      <Text style={s.pendingService}>
                        {serviceName} • {duration}m
                      </Text>
                    </View>
                  </View>
                  <Text style={s.pendingPrice}>₹{price}</Text>
                </View>

                <View style={s.pendingTimeRow}>
                  <Text style={s.pendingTime}>
                    📅 {app.appointmentDate} • ⏰ {app.startTime} – {app.endTime}
                  </Text>
                </View>

                {Boolean(app.customerNote) && (
                  <Text style={s.pendingNote} numberOfLines={1}>
                    "{app.customerNote}"
                  </Text>
                )}

                <View style={s.pendingActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="View request details"
                    onPress={() => onViewDetails(app)}
                    style={s.btnDetails}
                  >
                    <Text style={s.btnDetailsText}>Details</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Decline booking request"
                    onPress={() => onReject(app._id)}
                    style={s.btnDecline}
                  >
                    <Text style={s.btnDeclineText}>Decline</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Confirm booking request"
                    onPress={() => onAccept(app._id)}
                    style={s.btnAccept}
                  >
                    <Text style={s.btnAcceptText}>Accept</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* 6. Today's Confirmed Schedule Preview */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Today's Schedule</Text>
          <Pressable onPress={() => onNavigate('CALENDAR')}>
            <Text style={s.viewAllLink}>Open Calendar →</Text>
          </Pressable>
        </View>

        {todayApps.length === 0 ? (
          <View style={s.emptyTodayBox}>
            <Text style={s.emptyTodayIcon}>✦</Text>
            <Text style={s.emptyTodayText}>
              No appointments scheduled for today.
            </Text>
            <Text style={s.emptyTodaySub}>
              Confirmed bookings will appear here in chronological order.
            </Text>
          </View>
        ) : (
          todayApps.map((app, index) => {
            const clientName = (app.customerId as any)?.name || 'Client';
            const clientAvatar = (app.customerId as any)?.avatar;
            const serviceName = (app.serviceId as any)?.name || 'Service';
            const duration = (app.serviceId as any)?.duration || 30;

            return (
              <Pressable
                key={`${app._id}-${index}`}
                accessibilityRole="button"
                accessibilityLabel={`Appointment: ${clientName}, ${app.startTime}`}
                onPress={() => onViewDetails(app)}
                style={({ pressed }) => [s.todayRow, pressed && s.cardPressed]}
              >
                <View style={s.todayTimeBox}>
                  <Text style={s.todayTimeText}>{app.startTime}</Text>
                  <Text style={s.todayDurationText}>{duration}m</Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <Avatar
                    uri={clientAvatar}
                    name={clientName}
                    size={36}
                    borderColor={colors.gold}
                    borderWidth={1}
                    backgroundColor={colors.goldSoft}
                    textColor={colors.ink}
                  />
                  <View style={s.todayClientCol}>
                    <Text style={s.todayClientName}>{clientName}</Text>
                    <Text style={s.todayServiceName}>{serviceName}</Text>
                  </View>
                </View>

                <StatusBadge status={app.status} />
              </Pressable>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 36
  },
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.espresso,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  brandCol: {
    flex: 1,
    paddingRight: 10
  },
  brandOverline: {
    ...typography.brandOverline,
    color: colors.goldDark,
    marginBottom: 3
  },
  salonName: {
    ...typography.displayMedium,
    color: colors.espresso,
    marginBottom: 2
  },
  salonCity: {
    ...typography.bodySmall,
    color: colors.muted
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerIcon: {
    fontSize: 18,
    color: colors.espresso,
    fontWeight: '700'
  },
  bellBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: colors.gold,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3
  },
  bellBadgeText: {
    color: '#30231F',
    fontSize: 9,
    fontWeight: '800'
  },
  avatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.espresso,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: {
    color: '#FFFCF7',
    fontSize: 14,
    fontWeight: '700'
  },
  btnPressed: {
    opacity: 0.85
  },
  cardPressed: {
    opacity: 0.94
  },
  headerBottomRow: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  headerRatingChip: {
    backgroundColor: colors.goldSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#EFE2CF'
  },
  headerRatingText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.goldDark,
    fontSize: 11
  },
  statusPillGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  statusLabel: {
    ...typography.bodySmall,
    color: colors.muted
  },
  subCard: {
    backgroundColor: colors.surfaceWarm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  subLeft: {
    flex: 1,
    marginRight: 12
  },
  subPlanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4
  },
  subTag: {
    ...typography.brandOverline,
    fontSize: 9,
    color: colors.muted
  },
  planBadge: {
    backgroundColor: colors.goldSoft,
    borderWidth: 1,
    borderColor: '#EFE2CF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill
  },
  planBadgeText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.goldDark,
    fontSize: 10
  },
  subExpiry: {
    ...typography.caption,
    color: colors.espresso
  },
  subActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border
  },
  subActionText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.espresso
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'space-between'
  },
  metricCardAlert: {
    borderColor: colors.warningBorder,
    backgroundColor: colors.warningSoft
  },
  metricTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 18
  },
  metricLabel: {
    ...typography.caption,
    color: colors.muted,
    fontSize: 10,
    fontWeight: '600'
  },
  alertDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.warning
  },
  metricNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.espresso,
    marginVertical: 4
  },
  metricFoot: {
    ...typography.caption,
    fontSize: 10,
    color: colors.muted
  },
  section: {
    marginBottom: 16
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  sectionTitle: {
    ...typography.titleSmall,
    color: colors.espresso
  },
  viewAllLink: {
    ...typography.caption,
    color: colors.goldDark,
    fontWeight: '700'
  },
  quickGrid: {
    flexDirection: 'row',
    gap: 8
  },
  quickItem: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center'
  },
  quickIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6
  },
  quickIcon: {
    fontSize: 16
  },
  quickTitle: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.espresso,
    textAlign: 'center'
  },
  quickSubtitle: {
    ...typography.caption,
    fontSize: 9,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 1
  },
  pendingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10
  },
  pendingTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6
  },
  pendingName: {
    ...typography.bodyLarge,
    fontWeight: '700',
    color: colors.espresso
  },
  pendingService: {
    ...typography.bodySmall,
    color: colors.muted,
    marginTop: 1
  },
  pendingPrice: {
    ...typography.titleSmall,
    fontWeight: '700',
    color: colors.goldDark
  },
  pendingTimeRow: {
    marginBottom: 6
  },
  pendingTime: {
    ...typography.caption,
    color: colors.espresso
  },
  pendingNote: {
    ...typography.caption,
    color: colors.muted,
    fontStyle: 'italic',
    marginBottom: 10
  },
  pendingActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6
  },
  btnDetails: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceWarm
  },
  btnDetailsText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.espresso
  },
  btnDecline: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerSoft
  },
  btnDeclineText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.danger
  },
  btnAccept: {
    flex: 1.2,
    paddingVertical: 8,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.espresso
  },
  btnAcceptText: {
    ...typography.caption,
    fontWeight: '700',
    color: '#FFFCF7'
  },
  emptyTodayBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyTodayIcon: {
    fontSize: 20,
    color: colors.gold,
    marginBottom: 8
  },
  emptyTodayText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.espresso,
    textAlign: 'center'
  },
  emptyTodaySub: {
    ...typography.caption,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 4
  },
  todayRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  todayTimeBox: {
    width: 60,
    borderRightWidth: 1,
    borderRightColor: colors.borderLight,
    paddingRight: 8,
    marginRight: 10,
    alignItems: 'center'
  },
  todayTimeText: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.espresso
  },
  todayDurationText: {
    ...typography.caption,
    color: colors.muted,
    fontSize: 10
  },
  todayClientCol: {
    flex: 1
  },
  todayClientName: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.espresso
  },
  todayServiceName: {
    ...typography.caption,
    color: colors.muted
  },
  reviewsBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  reviewsBannerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  reviewsStarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center'
  },
  reviewsBannerTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.espresso
  },
  reviewsBannerSub: {
    ...typography.caption,
    color: colors.muted,
    marginTop: 2
  },
  reviewsBannerBadge: {
    backgroundColor: colors.goldSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#EFE2CF'
  },
  reviewsBannerAction: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.goldDark,
    fontSize: 11
  }
});
