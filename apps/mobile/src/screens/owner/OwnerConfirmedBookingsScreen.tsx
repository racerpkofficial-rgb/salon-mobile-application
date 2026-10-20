import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { StatusBadge } from '../../components/StatusBadge';
import { Avatar } from '../../components/Avatar';
import { colors, radius } from '../../constants/theme';
import { dialogService } from '../../services/dialog.service';
import { AppointmentData } from '../../types';

interface OwnerConfirmedBookingsScreenProps {
  bookings: AppointmentData[];
  loading: boolean;
  onRefresh: () => void;
  onComplete: (appointmentId: string) => Promise<void>;
  onViewDetails: (appointment: AppointmentData) => void;
  onBack: () => void;
}

type DateFilter = 'ALL' | 'TODAY' | 'UPCOMING';

export function OwnerConfirmedBookingsScreen({
  bookings,
  loading,
  onRefresh,
  onComplete,
  onViewDetails,
  onBack
}: OwnerConfirmedBookingsScreenProps) {
  const [filter, setFilter] = useState<DateFilter>('ALL');
  const [completingId, setCompletingId] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  const filteredBookings = bookings.filter((b) => {
    if (filter === 'TODAY') return b.appointmentDate === todayStr;
    if (filter === 'UPCOMING') return b.appointmentDate >= todayStr;
    return true;
  });

  const handleComplete = async (app: AppointmentData) => {
    setCompletingId(app._id);
    try {
      await onComplete(app._id);
      dialogService.showSuccess('Service Completed', `Marked appointment for ${app.customerId?.name || 'Customer'} as completed.`);
    } catch (err: any) {
      dialogService.showError('Error', err instanceof Error ? err.message : 'Failed to complete appointment.');
    } finally {
      setCompletingId(null);
    }
  };

  return (
    <View style={s.page}>
      {/* Top Header */}
      <View style={s.topBar}>
        <Pressable onPress={onBack} style={s.iconButton}>
          <Text style={s.backIcon}>←</Text>
        </Pressable>
        <View style={s.titleWrap}>
          <Text style={s.topTitle}>Confirmed Bookings</Text>
          <Text style={s.topSubtitle}>{bookings.length} confirmed schedule slots</Text>
        </View>
        <Pressable onPress={onRefresh} style={s.refreshButton}>
          <Text style={s.refreshText}>{loading ? '...' : '↻'}</Text>
        </Pressable>
      </View>

      {/* Filter Tabs */}
      <View style={s.tabRow}>
        <Pressable
          onPress={() => setFilter('ALL')}
          style={[s.tabPill, filter === 'ALL' && s.tabPillActive]}
        >
          <Text style={[s.tabPillText, filter === 'ALL' && s.tabPillTextActive]}>
            All Confirmed ({bookings.length})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setFilter('TODAY')}
          style={[s.tabPill, filter === 'TODAY' && s.tabPillActive]}
        >
          <Text style={[s.tabPillText, filter === 'TODAY' && s.tabPillTextActive]}>
            Today ({bookings.filter((b) => b.appointmentDate === todayStr).length})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setFilter('UPCOMING')}
          style={[s.tabPill, filter === 'UPCOMING' && s.tabPillActive]}
        >
          <Text style={[s.tabPillText, filter === 'UPCOMING' && s.tabPillTextActive]}>
            Upcoming
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[s.content, filteredBookings.length === 0 && s.emptyContentContainer]}
        showsVerticalScrollIndicator={false}
      >
        {loading && bookings.length === 0 ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator size="large" color={colors.gold} />
            <Text style={s.loadingText}>Loading confirmed bookings...</Text>
          </View>
        ) : filteredBookings.length === 0 ? (
          <View style={s.emptyCard}>
            <View style={s.emptyIconCircle}>
              <Text style={s.emptyIconText}>📅</Text>
            </View>
            <Text style={s.emptyTitle}>No Confirmed Bookings</Text>
            <Text style={s.emptySubtitle}>
              {filter === 'TODAY'
                ? 'No appointments scheduled for today.'
                : 'Appointments you accept will appear here ready for execution.'}
            </Text>
            <Pressable onPress={onRefresh} style={s.emptyActionBtn}>
              <Text style={s.emptyActionBtnText}>↻ Refresh Schedule</Text>
            </Pressable>
          </View>
        ) : (

          filteredBookings.map((app, index) => {
            const customerName = app.customerId?.name || 'Customer';
            const customerPhone = app.customerId?.phone || 'Phone not provided';
            const customerAvatar = (app.customerId as any)?.avatar;
            const serviceName = app.serviceId?.name || 'Service';
            const price = app.serviceId?.price ?? 0;
            const duration = app.serviceId?.duration || 30;
            const isProcessing = completingId === app._id;
            const isToday = app.appointmentDate === todayStr;

            return (
              <View key={`${app._id}-${index}`} style={[s.card, isToday && s.todayCard]}>
                {isToday && (
                  <View style={s.todayTag}>
                    <Text style={s.todayTagText}>TODAY</Text>
                  </View>
                )}

                <View style={s.cardTop}>
                  <View style={s.clientRow}>
                    <Avatar
                      uri={customerAvatar}
                      name={customerName}
                      size={40}
                      borderColor={colors.gold}
                      borderWidth={1}
                      backgroundColor={colors.goldSoft}
                      textColor={colors.ink}
                    />
                    <View>
                      <Text style={s.clientName}>{customerName}</Text>
                      <Text style={s.clientPhone}>📞 {customerPhone}</Text>
                    </View>
                  </View>
                  <StatusBadge status="CONFIRMED" />
                </View>

                {/* Service Details */}
                <View style={s.serviceBlock}>
                  <View style={s.serviceRow}>
                    <Text style={s.serviceTitle}>{serviceName}</Text>
                    <Text style={s.servicePrice}>₹{price}</Text>
                  </View>
                  <Text style={s.serviceDuration}>⏱ Duration: {duration} mins</Text>
                </View>

                {/* Date & Time Slot */}
                <View style={s.timeRow}>
                  <Text style={s.timeText}>📅 {app.appointmentDate}</Text>
                  <Text style={s.timeText}>⏰ {app.startTime} – {app.endTime}</Text>
                </View>

                {/* Actions */}
                <View style={s.actionRow}>
                  <Pressable
                    onPress={() => onViewDetails(app)}
                    style={s.detailsBtn}
                  >
                    <Text style={s.detailsBtnText}>View Details</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => handleComplete(app)}
                    style={[s.completeBtn, isProcessing && s.btnDisabled]}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={s.completeBtnText}>✓ Mark Completed</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.surface
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  backIcon: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.ink
  },
  titleWrap: {
    flex: 1
  },
  topTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink
  },
  topSubtitle: {
    fontSize: 12,
    color: colors.slate,
    marginTop: 2
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center'
  },
  refreshText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.goldDark
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8
  },
  tabPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.sand
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
  content: {
    padding: 16,
    paddingBottom: 40
  },
  loadingWrap: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.slate
  },
  emptyContentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20
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
    backgroundColor: '#FAF8F5',
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
    color: colors.slate,
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 16
  },
  emptyActionBtn: {
    backgroundColor: colors.sand,
    borderRadius: radius.md,
    paddingVertical: 9,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2
  },
  todayCard: {
    borderColor: '#2A6F3F',
    borderWidth: 1.5
  },
  todayTag: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#2A6F3F',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill
  },
  todayTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.goldDark
  },
  clientName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink
  },
  clientPhone: {
    fontSize: 12,
    color: colors.slate,
    marginTop: 1
  },
  serviceBlock: {
    backgroundColor: colors.sand,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 10
  },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2
  },
  serviceTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink
  },
  servicePrice: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.goldDark
  },
  serviceDuration: {
    fontSize: 12,
    color: colors.slate
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FAFAFA',
    borderRadius: radius.md,
    padding: 10,
    marginBottom: 12
  },
  timeText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8
  },
  detailsBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center'
  },
  detailsBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink
  },
  completeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center'
  },
  completeBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  btnDisabled: {
    opacity: 0.6
  }
});
