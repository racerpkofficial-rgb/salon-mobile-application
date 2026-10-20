import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { CompletedBookingReviewCard } from '../../components/CompletedBookingReviewCard';
import { StatusBadge } from '../../components/StatusBadge';
import { colors, radius } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { appointmentService } from '../../services/appointment.service';
import { dialogService } from '../../services/dialog.service';
import { AppointmentData, BookingStatus } from '../../types';
import { formatLocation } from '../../utils/location';


interface CustomerBookingsScreenProps {
  onExplore: () => void;
}

export function CustomerBookingsScreen({ onExplore }: CustomerBookingsScreenProps) {
  const { token } = useAuth();
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | BookingStatus>('ALL');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchBookings = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await appointmentService.getCustomerAppointments(token);
      setAppointments(res.data || []);
    } catch {
      // quiet fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchBookings();
  }, [token]);

  const handleCancelBooking = (appointmentId: string) => {
    dialogService.showConfirm(
      'Cancel Appointment',
      'Are you sure you want to cancel this appointment reservation?',
      {
        confirmText: 'Yes, Cancel',
        cancelText: 'No, Keep',
        isDestructive: true,
        onConfirm: async () => {
          if (!token) return;
          setCancellingId(appointmentId);
          try {
            await appointmentService.cancelAppointment(token, appointmentId);
            dialogService.showSuccess('Booking Cancelled', 'Your appointment has been cancelled.');
            await fetchBookings();
          } catch (e: any) {
            dialogService.showError('Cancellation Error', e instanceof Error ? e.message : 'Failed to cancel');
          } finally {
            setCancellingId(null);
          }
        }
      }
    );
  };

  const filteredAppointments = appointments.filter((app) => {
    if (filter === 'ALL') return true;
    return app.status === filter;
  });

  return (
    <View style={s.page}>
      {/* Top Header */}
      <View style={s.header}>
        <View>
          <Text style={s.eyebrow}>RESERVATIONS</Text>
          <Text style={s.title}>My Appointments</Text>
        </View>
        <Pressable onPress={() => void fetchBookings()} style={s.refreshBtn}>
          <Text style={s.refreshText}>↻ Refresh</Text>
        </Pressable>
      </View>

      {/* Filter Tabs */}
      <View style={s.filterRow}>
        {(['ALL', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as const).map((tab) => {
          const active = filter === tab;
          return (
            <Pressable
              key={tab}
              style={[s.filterChip, active && s.filterChipActive]}
              onPress={() => setFilter(tab)}
            >
              <Text style={[s.filterChipText, active && s.filterChipTextActive]}>
                {tab === 'ALL' ? 'All' : tab.toLowerCase()}
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
          <View style={s.loadingWrap}>
            <ActivityIndicator size="large" color={colors.gold} />
            <Text style={s.loadingText}>Fetching your appointments...</Text>
          </View>
        ) : filteredAppointments.length > 0 ? (
          <View style={s.list}>
            {filteredAppointments.map((app, index) => {
              const salon = typeof app.salonId === 'object' ? app.salonId : null;
              const service = typeof app.serviceId === 'object' ? app.serviceId : null;
              const isWorking = cancellingId === app._id;

              return (
                <View key={`${app._id}-${index}`} style={s.card}>
                  <View style={s.cardHeader}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={s.salonName}>
                        {salon?.salonName || salon?.name || 'Book My Salon Partner'}
                      </Text>
                      <Text style={s.salonLocation}>
                        📍 {formatLocation(salon?.location, salon?.city, salon?.address, 'Partner Salon')}
                      </Text>
                    </View>

                    {/* Accessible Status Badge */}
                    <StatusBadge status={app.status} />
                  </View>

                  {/* Prominent Notice for PENDING */}
                  {app.status === 'PENDING' && (
                    <View style={s.pendingNotice}>
                      <Text style={s.pendingNoticeIcon}>⏳</Text>
                      <Text style={s.pendingNoticeText}>
                        Waiting for salon confirmation.
                      </Text>
                    </View>
                  )}

                  <View style={s.divider} />

                  {/* Service & Timing Info */}
                  <View style={s.detailRow}>
                    <Text style={s.detailLabel}>Treatment:</Text>
                    <Text style={s.detailValue}>
                      {app.serviceName || service?.name || 'Salon Treatment'}
                    </Text>
                  </View>

                  <View style={s.detailRow}>
                    <Text style={s.detailLabel}>Date & Time:</Text>
                    <Text style={[s.detailValue, { fontWeight: '800' }]}>
                      {app.appointmentDate} • {app.startTime} - {app.endTime}
                      {Boolean(app.serviceDuration) && ` (${app.serviceDuration} mins)`}
                    </Text>
                  </View>

                  <View style={s.detailRow}>
                    <Text style={s.detailLabel}>Price Paid / Total:</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[s.detailValue, { color: colors.gold, fontWeight: '800' }]}>
                        ₹{app.totalPrice ?? service?.price ?? 'Custom'}
                      </Text>
                      {Boolean(app.originalPrice && app.discountAmount && app.discountAmount > 0) && (
                        <Text style={[s.detailValue, { color: colors.muted, textDecorationLine: 'line-through', fontSize: 12 }]}>
                          ₹{app.originalPrice}
                        </Text>
                      )}
                    </View>
                  </View>

                  {app.customerNote ? (
                    <View style={s.noteBox}>
                      <Text style={s.noteLabel}>Note:</Text>
                      <Text style={s.noteText}>{app.customerNote}</Text>
                    </View>
                  ) : null}

                  {/* Actions & Reviews */}
                  {(app.status === 'PENDING' || app.status === 'CONFIRMED') && (
                    <View style={s.cardActions}>
                      <Pressable
                        disabled={isWorking}
                        onPress={() => handleCancelBooking(app._id)}
                        style={[s.cancelBtn, isWorking && { opacity: 0.5 }]}
                      >
                        <Text style={s.cancelBtnText}>
                          {isWorking ? 'Cancelling...' : 'Cancel Reservation'}
                        </Text>
                      </Pressable>
                    </View>
                  )}

                  {/* Rating & Review Section for Completed Bookings with 48h Deadline */}
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
          <View style={s.emptyCard}>
            <Text style={s.emptyIcon}>📅</Text>
            <Text style={s.emptyTitle}>No appointments found</Text>
            <Text style={s.emptyCopy}>
              {filter === 'ALL'
                ? "You haven't booked any appointments yet. Discover verified luxury salons and book your signature ritual."
                : `No ${filter.toLowerCase()} appointments found.`}
            </Text>
            <Pressable onPress={onExplore} style={s.exploreBtn}>
              <Text style={s.exploreBtnText}>Book an Appointment →</Text>
            </Pressable>
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
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 14,

    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: colors.gold
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.5,
    marginTop: 2
  },
  refreshBtn: { paddingVertical: 4 },
  refreshText: { fontSize: 13, fontWeight: '700', color: colors.gold },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  filterChip: {
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border
  },
  filterChipActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink,
    textTransform: 'capitalize'
  },
  filterChipTextActive: {
    color: '#FFFFFF'
  },
  content: { padding: 20, paddingBottom: 40 },
  loadingWrap: { paddingVertical: 80, alignItems: 'center' },
  loadingText: { color: colors.muted, marginTop: 12, fontSize: 13 },
  list: { gap: 14 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  salonName: { fontSize: 16, fontWeight: '800', color: colors.ink },
  salonLocation: { fontSize: 12, color: colors.muted, marginTop: 2 },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill
  },
  pillPending: { backgroundColor: '#FEF3C7' },
  pillConfirmed: { backgroundColor: '#D1FAE5' },
  pillCompleted: { backgroundColor: '#E0E7FF' },
  pillCancelled: { backgroundColor: '#F3F4F6' },
  statusPillText: { fontSize: 10, fontWeight: '800' },
  textPending: { color: '#92400E' },
  textConfirmed: { color: '#065F46' },
  textCompleted: { color: '#3730A3' },
  textCancelled: { color: '#6B7280' },
  pendingNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    padding: 8,
    borderRadius: radius.sm,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FDE68A'
  },
  pendingNoticeIcon: { fontSize: 14, marginRight: 6 },
  pendingNoticeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B45309'
  },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  detailLabel: { fontSize: 12, color: colors.muted },
  detailValue: { fontSize: 12, fontWeight: '600', color: colors.ink },
  noteBox: {
    backgroundColor: colors.background,
    padding: 8,
    borderRadius: radius.sm,
    marginTop: 6
  },
  noteLabel: { fontSize: 10, fontWeight: '800', color: colors.gold },
  noteText: { fontSize: 11, color: colors.ink, marginTop: 2 },
  cardActions: { marginTop: 12, alignItems: 'flex-end' },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2'
  },
  cancelBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626'
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 32,
    alignItems: 'center',
    marginTop: 30,
    borderWidth: 1,
    borderColor: colors.border
  },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.ink },
  emptyCopy: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19
  },
  exploreBtn: {
    marginTop: 18,
    backgroundColor: colors.ink,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.pill
  },
  exploreBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' }
});
