import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { StatusBadge } from '../../components/StatusBadge';
import { Avatar } from '../../components/Avatar';
import { colors, radius } from '../../constants/theme';
import { dialogService } from '../../services/dialog.service';
import { AppointmentData, AppointmentStatus } from '../../types';

export type BookingSectionTab = 'PENDING' | 'CONFIRMED' | 'UPCOMING' | 'HISTORY';

interface OwnerBookingsHubViewProps {
  appointments: AppointmentData[];
  loading: boolean;
  initialTab?: BookingSectionTab;
  onRefresh: () => void;
  onAccept: (appointmentId: string) => Promise<void>;
  onReject: (appointmentId: string, reason?: string) => Promise<void>;
  onComplete: (appointmentId: string) => Promise<void>;
  onViewDetails: (appointment: AppointmentData) => void;
  onNavigateToCalendar?: () => void;
}

export function OwnerBookingsHubView({
  appointments,
  loading,
  initialTab = 'PENDING',
  onRefresh,
  onAccept,
  onReject,
  onComplete,
  onViewDetails,
  onNavigateToCalendar
}: OwnerBookingsHubViewProps) {
  const [activeTab, setActiveTab] = useState<BookingSectionTab>(initialTab);
  const [actingId, setActingId] = useState<string | null>(null);

  // Reject Modal State
  const [rejectItem, setRejectItem] = useState<AppointmentData | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // History Search & Sub-Filter
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState<'ALL' | 'COMPLETED' | 'REJECTED' | 'CANCELLED'>('ALL');

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Filtered Lists
  const pendingList = useMemo(
    () => appointments.filter((a) => a.status === 'PENDING'),
    [appointments]
  );

  const confirmedList = useMemo(
    () => appointments.filter((a) => a.status === 'CONFIRMED'),
    [appointments]
  );

  const upcomingList = useMemo(
    () => appointments.filter((a) => a.status === 'CONFIRMED' && a.appointmentDate > todayStr),
    [appointments, todayStr]
  );

  const historyList = useMemo(() => {
    return appointments.filter((a) => {
      if (a.status === 'PENDING') return false;
      if (historyFilter !== 'ALL' && a.status !== historyFilter) return false;
      if (historySearch.trim()) {
        const term = historySearch.toLowerCase();
        const cust = (a.customerId?.name || '').toLowerCase();
        const serv = (a.serviceId?.name || '').toLowerCase();
        return cust.includes(term) || serv.includes(term);
      }
      return true;
    });
  }, [appointments, historyFilter, historySearch]);

  const handleAcceptAppointment = async (app: AppointmentData) => {
    setActingId(app._id);
    try {
      await onAccept(app._id);
      dialogService.showSuccess('Booking Accepted! 🎉', `Slot confirmed for ${app.customerId?.name || 'Customer'}.`);
    } catch (err: any) {
      dialogService.showError('Unable to Accept', err instanceof Error ? err.message : 'Slot conflict or network error.');
    } finally {
      setActingId(null);
    }
  };

  const handleOpenRejectModal = (app: AppointmentData) => {
    setRejectItem(app);
    setRejectionReason('');
  };

  const handleConfirmReject = async () => {
    if (!rejectItem) return;
    const appId = rejectItem._id;
    const reason = rejectionReason.trim();
    setRejectItem(null);
    setActingId(appId);
    try {
      await onReject(appId, reason || undefined);
      dialogService.showSuccess('Booking Rejected', 'Appointment slot released.');
    } catch (err: any) {
      dialogService.showError('Error', err instanceof Error ? err.message : 'Failed to reject booking.');
    } finally {
      setActingId(null);
    }
  };

  const handleCompleteAppointment = async (app: AppointmentData) => {
    setActingId(app._id);
    try {
      await onComplete(app._id);
      dialogService.showSuccess('Marked as Completed', `Service completed for ${app.customerId?.name || 'Customer'}.`);
    } catch (err: any) {
      dialogService.showError('Error', err instanceof Error ? err.message : 'Failed to complete appointment.');
    } finally {
      setActingId(null);
    }
  };

  const currentList =
    activeTab === 'PENDING'
      ? pendingList
      : activeTab === 'CONFIRMED'
      ? confirmedList
      : activeTab === 'UPCOMING'
      ? upcomingList
      : historyList;

  const isEmpty = currentList.length === 0;

  return (
    <View style={s.page}>
      {/* Top Header */}
      <View style={s.header}>
        <View>
          <Text style={s.eyebrow}>BOOK MY SALON</Text>
          <Text style={s.title}>Salon Bookings</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh bookings"
          onPress={onRefresh}
          style={s.refreshBtn}
        >
          <Text style={s.refreshBtnText}>{loading ? '...' : '↻'}</Text>
        </Pressable>
      </View>

      {/* Segmented Filter Pills */}
      <View style={s.tabsBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabsScroll}>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'PENDING' }}
            accessibilityLabel="Pending bookings tab"
            style={[s.tabPill, activeTab === 'PENDING' && s.tabPillActive]}
            onPress={() => setActiveTab('PENDING')}
          >
            <Text style={[s.tabPillText, activeTab === 'PENDING' && s.tabPillTextActive]}>
              Pending
            </Text>
            {pendingList.length > 0 && (
              <View style={[s.badge, activeTab === 'PENDING' ? s.badgeOnActive : s.badgePending]}>
                <Text style={s.badgeText}>{pendingList.length}</Text>
              </View>
            )}
          </Pressable>

          <Pressable
            style={[s.tabPill, activeTab === 'CONFIRMED' && s.tabPillActive]}
            onPress={() => setActiveTab('CONFIRMED')}
          >
            <Text style={[s.tabPillText, activeTab === 'CONFIRMED' && s.tabPillTextActive]}>
              Confirmed
            </Text>
            {confirmedList.length > 0 && (
              <View style={[s.badge, activeTab === 'CONFIRMED' ? s.badgeOnActive : s.badgeConfirmed]}>
                <Text style={s.badgeText}>{confirmedList.length}</Text>
              </View>
            )}
          </Pressable>

          <Pressable
            style={[s.tabPill, activeTab === 'UPCOMING' && s.tabPillActive]}
            onPress={() => setActiveTab('UPCOMING')}
          >
            <Text style={[s.tabPillText, activeTab === 'UPCOMING' && s.tabPillTextActive]}>
              Upcoming
            </Text>
            {upcomingList.length > 0 && (
              <View style={[s.badge, activeTab === 'UPCOMING' ? s.badgeOnActive : s.badgeDefault]}>
                <Text style={s.badgeText}>{upcomingList.length}</Text>
              </View>
            )}
          </Pressable>

          <Pressable
            style={[s.tabPill, activeTab === 'HISTORY' && s.tabPillActive]}
            onPress={() => setActiveTab('HISTORY')}
          >
            <Text style={[s.tabPillText, activeTab === 'HISTORY' && s.tabPillTextActive]}>
              History
            </Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* History Search & Filters if in HISTORY tab */}
      {activeTab === 'HISTORY' && (
        <View style={s.historyHeaderWrap}>
          <TextInput
            style={s.searchInput}
            placeholder="🔍 Search client or service..."
            placeholderTextColor="#999"
            value={historySearch}
            onChangeText={setHistorySearch}
          />
          <View style={s.subFilterRow}>
            {(['ALL', 'COMPLETED', 'REJECTED', 'CANCELLED'] as const).map((filter) => (
              <Pressable
                key={filter}
                style={[s.subPill, historyFilter === filter && s.subPillActive]}
                onPress={() => setHistoryFilter(filter)}
              >
                <Text style={[s.subPillText, historyFilter === filter && s.subPillTextActive]}>
                  {filter}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Main Content Area */}
      <ScrollView
        contentContainerStyle={[s.content, isEmpty && s.emptyContentContainer]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} colors={[colors.goldDark]} />}
      >
        {loading && appointments.length === 0 ? (
          <View style={s.centerBox}>
            <ActivityIndicator size="large" color={colors.goldDark} />
            <Text style={s.loadingText}>Syncing bookings...</Text>
          </View>
        ) : isEmpty ? (
          /* Issue 3 — Centered Compact Empty State */
          <View style={s.emptyCard}>
            <View style={s.emptyIconCircle}>
              <Text style={s.emptyIconText}>
                {activeTab === 'PENDING'
                  ? '✓'
                  : activeTab === 'CONFIRMED'
                  ? '📅'
                  : activeTab === 'UPCOMING'
                  ? '🗓️'
                  : '📜'}
              </Text>
            </View>
            <Text style={s.emptyTitle}>
              {activeTab === 'PENDING'
                ? 'All Caught Up!'
                : activeTab === 'CONFIRMED'
                ? 'No Confirmed Bookings'
                : activeTab === 'UPCOMING'
                ? 'No Upcoming Bookings'
                : 'No History Records Found'}
            </Text>
            <Text style={s.emptySubtitle}>
              {activeTab === 'PENDING'
                ? 'No pending client requests awaiting your action. New customer bookings will appear here.'
                : activeTab === 'CONFIRMED'
                ? 'No active confirmed appointments scheduled right now. Accepted bookings will appear here.'
                : activeTab === 'UPCOMING'
                ? 'There are no future appointments booked beyond today.'
                : 'No past booking records matching the selected search criteria.'}
            </Text>

            <View style={s.emptyActionRow}>
              <Pressable onPress={onRefresh} style={s.emptySecondaryBtn}>
                <Text style={s.emptySecondaryBtnText}>↻ Refresh</Text>
              </Pressable>
              {onNavigateToCalendar && (
                <Pressable onPress={onNavigateToCalendar} style={s.emptyPrimaryBtn}>
                  <Text style={s.emptyPrimaryBtnText}>📅 Open Calendar</Text>
                </Pressable>
              )}
            </View>
          </View>
        ) : (
          /* Bookings List */
          currentList.map((app, index) => {
            const customerName = app.customerId?.name || 'Customer';
            const customerPhone = app.customerId?.phone || '';
            const customerAvatar = (app.customerId as any)?.avatar;
            const serviceName = app.serviceId?.name || 'Salon Treatment';
            const serviceCategory = app.serviceId?.category || 'Service';
            const price = app.serviceId?.price ?? 0;
            const duration = app.serviceId?.duration || 30;
            const isActing = actingId === app._id;
            const isPending = app.status === 'PENDING';
            const isConfirmed = app.status === 'CONFIRMED';

            return (
              <View key={`${app._id}-${index}`} style={s.card}>
                {/* Card Top: Customer & Status */}
                <View style={s.cardHeader}>
                  <View style={s.custRow}>
                    <Avatar
                      uri={customerAvatar}
                      name={customerName}
                      size={40}
                      borderColor={colors.gold}
                      borderWidth={1}
                      backgroundColor={colors.goldSoft}
                      textColor={colors.ink}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={s.custName}>{customerName}</Text>
                      {!!customerPhone && (
                        <Text style={s.custPhone}>{customerPhone}</Text>
                      )}
                    </View>
                  </View>
                  <StatusBadge status={app.status} />
                </View>

                {/* Service Info Box */}
                <View style={s.serviceBox}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.servName}>{serviceName}</Text>
                    <Text style={s.servMeta}>
                      {serviceCategory} • {duration} mins
                    </Text>
                  </View>
                  <Text style={s.servPrice}>₹{price}</Text>
                </View>

                {/* Schedule Info */}
                <View style={s.timeRow}>
                  <Text style={s.timeText}>
                    📅 {app.appointmentDate}
                  </Text>
                  <Text style={s.timeText}>
                    ⏰ {app.startTime} – {app.endTime}
                  </Text>
                </View>

                {/* Customer Note */}
                {!!app.customerNote && (
                  <View style={s.noteBox}>
                    <Text style={s.noteText}>"{app.customerNote}"</Text>
                  </View>
                )}

                {/* Actions Row */}
                <View style={s.actionsRow}>
                  <Pressable
                    onPress={() => onViewDetails(app)}
                    style={s.detailsBtn}
                  >
                    <Text style={s.detailsBtnText}>Details</Text>
                  </Pressable>

                  {isPending && (
                    <>
                      <Pressable
                        onPress={() => handleOpenRejectModal(app)}
                        disabled={isActing}
                        style={[s.rejectBtn, isActing && s.btnDisabled]}
                      >
                        <Text style={s.rejectBtnText}>Reject</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleAcceptAppointment(app)}
                        disabled={isActing}
                        style={[s.acceptBtn, isActing && s.btnDisabled]}
                      >
                        <Text style={s.acceptBtnText}>Accept</Text>
                      </Pressable>
                    </>
                  )}

                  {isConfirmed && (
                    <Pressable
                      onPress={() => handleCompleteAppointment(app)}
                      disabled={isActing}
                      style={[s.completeBtn, isActing && s.btnDisabled]}
                    >
                      <Text style={s.completeBtnText}>Mark Completed ✓</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Reject Reason Modal */}
      <Modal
        visible={!!rejectItem}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectItem(null)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Reject Appointment</Text>
            <Text style={s.modalSubtitle}>
              Releasing this slot will notify {rejectItem?.customerId?.name || 'the customer'} and restore calendar availability.
            </Text>
            <Text style={s.inputLabel}>Reason for Rejection (Optional):</Text>
            <TextInput
              style={s.textInput}
              placeholder="e.g. Fully booked at this time, emergency closure..."
              placeholderTextColor="#999"
              value={rejectionReason}
              onChangeText={setRejectionReason}
            />
            <View style={s.modalBtnRow}>
              <Pressable
                onPress={() => setRejectItem(null)}
                style={s.modalCancelBtn}
              >
                <Text style={s.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmReject}
                style={s.modalRejectBtn}
              >
                <Text style={s.modalRejectText}>Confirm Reject</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '800',
    color: colors.goldDark,
    textTransform: 'uppercase'
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    color: colors.ink
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  refreshBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink
  },
  tabsBar: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: '#FFFFFF'
  },
  tabsScroll: {
    gap: 8,
    paddingVertical: 4
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.sand,
    gap: 6
  },
  tabPillActive: {
    backgroundColor: colors.ink
  },
  tabPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.slate
  },
  tabPillTextActive: {
    color: '#FFFFFF'
  },
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center'
  },
  badgePending: {
    backgroundColor: '#B72B1A'
  },
  badgeConfirmed: {
    backgroundColor: '#2A6F3F'
  },
  badgeDefault: {
    backgroundColor: colors.goldDark
  },
  badgeOnActive: {
    backgroundColor: 'rgba(255,255,255,0.25)'
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  historyHeaderWrap: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  searchInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    color: colors.ink,
    marginBottom: 8
  },
  subFilterRow: {
    flexDirection: 'row',
    gap: 6
  },
  subPill: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.sand
  },
  subPillActive: {
    backgroundColor: colors.goldDark
  },
  subPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.slate
  },
  subPillTextActive: {
    color: '#FFFFFF'
  },
  content: {
    padding: 16,
    paddingBottom: 32
  },
  emptyContentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20
  },
  centerBox: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: colors.slate
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2
  },
  emptyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F4ECE1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12
  },
  emptyIconText: {
    fontSize: 22,
    color: colors.goldDark
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 6,
    textAlign: 'center'
  },
  emptySubtitle: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.slate,
    textAlign: 'center',
    marginBottom: 16
  },
  emptyActionRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%'
  },
  emptySecondaryBtn: {
    flex: 1,
    backgroundColor: colors.sand,
    borderRadius: radius.md,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptySecondaryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink
  },
  emptyPrimaryBtn: {
    flex: 1,
    backgroundColor: colors.ink,
    borderRadius: radius.md,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyPrimaryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  custRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.goldDark
  },
  custName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink
  },
  custPhone: {
    fontSize: 11,
    color: colors.slate,
    marginTop: 1
  },
  serviceBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FAF8F5',
    borderRadius: radius.md,
    padding: 10,
    marginBottom: 8
  },
  servName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink
  },
  servMeta: {
    fontSize: 11,
    color: colors.slate,
    marginTop: 2
  },
  servPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.goldDark
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 4,
    marginBottom: 6
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink
  },
  noteBox: {
    backgroundColor: '#FFFDF6',
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
    padding: 8,
    borderRadius: 4,
    marginBottom: 10
  },
  noteText: {
    fontSize: 11,
    fontStyle: 'italic',
    color: colors.slate
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4
  },
  detailsBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center'
  },
  detailsBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink
  },
  rejectBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: '#FDEEEB',
    borderWidth: 1,
    borderColor: '#F8C8C2',
    alignItems: 'center',
    justifyContent: 'center'
  },
  rejectBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B72B1A'
  },
  acceptBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: '#2A6F3F',
    alignItems: 'center',
    justifyContent: 'center'
  },
  acceptBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  completeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center'
  },
  completeBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  btnDisabled: {
    opacity: 0.5
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    padding: 20,
    width: '100%',
    maxWidth: 380
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 6
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.slate,
    lineHeight: 17,
    marginBottom: 14
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 6
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 10,
    fontSize: 12,
    color: colors.ink,
    marginBottom: 16
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8
  },
  modalCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.sand
  },
  modalCancelText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink
  },
  modalRejectBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: '#B72B1A'
  },
  modalRejectText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF'
  }
});
