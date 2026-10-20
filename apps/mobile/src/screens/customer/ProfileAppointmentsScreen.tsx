import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import {
  ArrowLeft,
  Calendar,
  Clock,
  RefreshCw,
  Phone,
  FileText,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react-native';
import { StatusBadge } from '../../components/StatusBadge';
import { CompletedBookingReviewCard } from '../../components/CompletedBookingReviewCard';
import { colors, radius, typography } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { appointmentService } from '../../services/appointment.service';
import { AppointmentData, BookingStatus } from '../../types';
import { formatLocation } from '../../utils/location';
import { dialogService } from '../../services/dialog.service';

interface ProfileAppointmentsScreenProps {
  onBack: () => void;
}

export function ProfileAppointmentsScreen({ onBack }: ProfileAppointmentsScreenProps) {
  const { token } = useAuth();
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'UPCOMING' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [expandedBookingIds, setExpandedBookingIds] = useState<Record<string, boolean>>({});

  const fetchBookings = async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await appointmentService.getCustomerAppointments(token);
      setAppointments(res.data || []);
    } catch (e: any) {
      setErrorMessage(e instanceof Error ? e.message : 'Failed to load appointments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchBookings();
  }, [token]);

  // Summary counts
  const upcomingCount = useMemo(() => {
    return appointments.filter((a) => a.status === 'PENDING' || a.status === 'CONFIRMED').length;
  }, [appointments]);

  const completedCount = useMemo(() => {
    return appointments.filter((a) => a.status === 'COMPLETED').length;
  }, [appointments]);

  const cancelledCount = useMemo(() => {
    return appointments.filter((a) => a.status === 'CANCELLED' || a.status === 'REJECTED').length;
  }, [appointments]);

  // Filtered appointments
  const filteredAppointments = useMemo(() => {
    if (filter === 'UPCOMING') {
      return appointments.filter((a) => a.status === 'PENDING' || a.status === 'CONFIRMED');
    }
    if (filter === 'COMPLETED') {
      return appointments.filter((a) => a.status === 'COMPLETED');
    }
    if (filter === 'CANCELLED') {
      return appointments.filter((a) => a.status === 'CANCELLED' || a.status === 'REJECTED');
    }
    return appointments;
  }, [appointments, filter]);

  const toggleExpand = (id: string) => {
    setExpandedBookingIds((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleCancelBooking = (appointmentId: string) => {
    dialogService.showConfirm(
      'Cancel Appointment?',
      'Are you sure you want to cancel this appointment reservation? This action cannot be undone.',
      async () => {
        if (!token) return;
        setCancellingId(appointmentId);
        try {
          await appointmentService.cancelAppointment(token, appointmentId);
          dialogService.showSuccess('Booking Cancelled', 'Your appointment reservation has been cancelled.');
          await fetchBookings();
        } catch (e: any) {
          dialogService.showError('Cancellation Error', e instanceof Error ? e.message : 'Failed to cancel appointment.');
        } finally {
          setCancellingId(null);
        }
      },
      undefined,
      'Yes, Cancel',
      'Keep Appointment',
      true
    );
  };

  return (
    <View style={s.page}>
      {/* Header with Back button and Refresh */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Return to Profile"
            onPress={onBack}
            style={s.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={20} color={colors.espresso} />
          </Pressable>
          <View style={{ marginLeft: 12 }}>
            <Text style={s.eyebrow}>CLIENT RESERVATIONS</Text>
            <Text style={s.title}>My Appointments</Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh appointments"
          onPress={() => void fetchBookings()}
          disabled={loading}
          style={s.refreshBtn}
        >
          <RefreshCw size={16} color={colors.goldDark} />
        </Pressable>
      </View>

      {/* Summary KPI Cards */}
      <View style={s.statsRow}>
        <View style={s.statCard}>
          <Text style={s.statNumber}>{upcomingCount}</Text>
          <Text style={s.statLabel}>UPCOMING</Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statNumber}>{completedCount}</Text>
          <Text style={s.statLabel}>COMPLETED</Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statNumber}>{cancelledCount}</Text>
          <Text style={s.statLabel}>CANCELLED</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={s.filterRow}>
        {(['ALL', 'UPCOMING', 'COMPLETED', 'CANCELLED'] as const).map((tab) => {
          const active = filter === tab;
          return (
            <Pressable
              key={tab}
              onPress={() => setFilter(tab)}
              style={[s.filterChip, active && s.filterChipActive]}
            >
              <Text style={[s.filterChipText, active && s.filterChipTextActive]}>
                {tab === 'ALL' ? 'All' : tab.charAt(0) + tab.slice(1).toLowerCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={s.centerWrap}>
            <ActivityIndicator size="large" color={colors.gold} />
            <Text style={s.loadingText}>Loading your appointments...</Text>
          </View>
        ) : errorMessage ? (
          <View style={s.emptyBox}>
            <AlertTriangle size={36} color="#D9534F" style={{ marginBottom: 8 }} />
            <Text style={s.emptyTitle}>Could not load appointments</Text>
            <Text style={s.emptyCopy}>{errorMessage}</Text>
            <Pressable onPress={() => void fetchBookings()} style={s.retryBtn}>
              <Text style={s.retryBtnText}>Try Again</Text>
            </Pressable>
          </View>
        ) : filteredAppointments.length > 0 ? (
          <View style={s.list}>
            {filteredAppointments.map((app, index) => {
              const salon = typeof app.salonId === 'object' ? app.salonId : null;
              const service = typeof app.serviceId === 'object' ? app.serviceId : null;
              const isWorking = cancellingId === app._id;
              const isExpanded = !!expandedBookingIds[app._id];

              return (
                <View key={`${app._id}-${index}`} style={s.card}>
                  <View style={s.cardHeader}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={s.salonName}>
                        {salon?.salonName || salon?.name || 'Book My Salon Partner'}
                      </Text>
                      <Text style={s.salonLocation} numberOfLines={1}>
                        📍 {formatLocation(salon?.location, salon?.city, salon?.address, 'Partner Salon')}
                      </Text>
                    </View>
                    <StatusBadge status={app.status} />
                  </View>

                  {app.status === 'PENDING' && (
                    <View style={s.pendingNotice}>
                      <Clock size={14} color="#856404" style={{ marginRight: 6 }} />
                      <Text style={s.pendingNoticeText}>
                        Waiting for salon confirmation.
                      </Text>
                    </View>
                  )}

                  <View style={s.divider} />

                  <View style={s.detailRow}>
                    <Text style={s.detailLabel}>Treatment:</Text>
                    <Text style={s.detailValue}>
                      {app.serviceName || service?.name || 'Salon Treatment'}
                    </Text>
                  </View>

                  <View style={s.detailRow}>
                    <Text style={s.detailLabel}>Date & Time:</Text>
                    <Text style={[s.detailValue, { fontWeight: '700' }]}>
                      {app.appointmentDate} • {app.startTime} - {app.endTime}
                      {Boolean(app.serviceDuration) && ` (${app.serviceDuration}m)`}
                    </Text>
                  </View>

                  <View style={s.detailRow}>
                    <Text style={s.detailLabel}>Total Amount:</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[s.detailValue, { color: colors.gold, fontWeight: '800' }]}>
                        ₹{app.totalPrice ?? service?.price ?? 'Custom'}
                      </Text>
                      {Boolean(app.originalPrice && app.discountAmount && app.discountAmount > 0) && (
                        <Text style={s.strikethroughPrice}>₹{app.originalPrice}</Text>
                      )}
                    </View>
                  </View>

                  {/* Expanded Inspection Details */}
                  {isExpanded && (
                    <View style={s.inspectionBox}>
                      <View style={s.detailRow}>
                        <Text style={s.detailLabel}>Reservation ID:</Text>
                        <Text style={[s.detailValue, { fontSize: 11 }]}>{app._id}</Text>
                      </View>
                      {salon?.phone && (
                        <View style={s.detailRow}>
                          <Text style={s.detailLabel}>Salon Phone:</Text>
                          <Text style={s.detailValue}>{salon.phone}</Text>
                        </View>
                      )}
                      {app.customerNote ? (
                        <View style={{ marginTop: 6 }}>
                          <Text style={s.detailLabel}>Your Note:</Text>
                          <Text style={s.noteText}>{app.customerNote}</Text>
                        </View>
                      ) : null}
                    </View>
                  )}

                  {/* Toggle Details Button */}
                  <Pressable
                    onPress={() => toggleExpand(app._id)}
                    style={s.inspectBtn}
                  >
                    <Text style={s.inspectBtnText}>
                      {isExpanded ? 'Hide Details ▲' : 'Inspect Booking Details ▾'}
                    </Text>
                  </Pressable>

                  {/* Cancel Action */}
                  {(app.status === 'PENDING' || app.status === 'CONFIRMED') && (
                    <Pressable
                      disabled={isWorking}
                      onPress={() => handleCancelBooking(app._id)}
                      style={[s.cancelBtn, isWorking && { opacity: 0.5 }]}
                    >
                      <Text style={s.cancelBtnText}>
                        {isWorking ? 'Cancelling...' : 'Cancel Reservation'}
                      </Text>
                    </Pressable>
                  )}

                  {/* Review Card for Completed Bookings */}
                  {app.status === 'COMPLETED' && (
                    <CompletedBookingReviewCard
                      appointment={app}
                      onRefreshParent={fetchBookings}
                    />
                  )}
                </View>
              );
            })}
          </View>
        ) : (
          <View style={s.emptyBox}>
            <Calendar size={40} color={colors.subtle} style={{ marginBottom: 10 }} />
            <Text style={s.emptyTitle}>No appointments found</Text>
            <Text style={s.emptyCopy}>
              {filter === 'ALL'
                ? "You haven't booked any appointments yet. Discover verified luxury salons and book your signature ritual."
                : `No ${filter.toLowerCase()} appointments found.`}
            </Text>
          </View>
        )}
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
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.goldDark
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.espresso,
    letterSpacing: -0.4,
    marginTop: 1
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surfaceWarm,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.espresso
  },
  statLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: colors.goldDark,
    marginTop: 2
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 8
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.borderLight
  },
  filterChipActive: {
    backgroundColor: colors.espresso,
    borderColor: colors.espresso
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted
  },
  filterChipTextActive: {
    color: '#E6C98D'
  },
  content: {
    padding: 20,
    paddingTop: 8,
    paddingBottom: 40
  },
  centerWrap: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: colors.muted
  },
  list: {
    gap: 14
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 2,
    shadowColor: colors.espresso,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between'
  },
  salonName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.espresso
  },
  salonLocation: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2
  },
  pendingNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.xs,
    marginTop: 8
  },
  pendingNoticeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#856404'
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 12
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  detailLabel: {
    fontSize: 12.5,
    color: colors.muted
  },
  detailValue: {
    fontSize: 13,
    color: colors.espresso,
    fontWeight: '500'
  },
  strikethroughPrice: {
    fontSize: 11.5,
    color: colors.subtle,
    textDecorationLine: 'line-through'
  },
  inspectionBox: {
    backgroundColor: colors.surfaceWarm,
    borderRadius: radius.sm,
    padding: 12,
    marginTop: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.borderLight
  },
  noteText: {
    fontSize: 12,
    color: colors.espresso,
    fontStyle: 'italic',
    marginTop: 2
  },
  inspectBtn: {
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 4
  },
  inspectBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.goldDark
  },
  cancelBtn: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#FFA39E',
    backgroundColor: '#FFF1F0',
    alignItems: 'center',
    justifyContent: 'center'
  },
  cancelBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#CF1322'
  },
  emptyBox: {
    paddingVertical: 50,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 10
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.espresso,
    marginBottom: 6
  },
  emptyCopy: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 19
  },
  retryBtn: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    backgroundColor: colors.espresso
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF'
  }
});
