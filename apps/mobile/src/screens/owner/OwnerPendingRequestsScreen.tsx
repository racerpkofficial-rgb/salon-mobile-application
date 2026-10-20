import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
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
import { AppointmentData } from '../../types';

interface OwnerPendingRequestsScreenProps {
  requests: AppointmentData[];
  loading: boolean;
  onRefresh: () => void;
  onAccept: (appointmentId: string) => Promise<void>;
  onReject: (appointmentId: string, reason?: string) => Promise<void>;
  onViewDetails: (appointment: AppointmentData) => void;
  onBack: () => void;
}

export function OwnerPendingRequestsScreen({
  requests,
  loading,
  onRefresh,
  onAccept,
  onReject,
  onViewDetails,
  onBack
}: OwnerPendingRequestsScreenProps) {
  const [actingId, setActingId] = useState<string | null>(null);
  const [rejectModalItem, setRejectModalItem] = useState<AppointmentData | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const handleAccept = async (app: AppointmentData) => {
    setActingId(app._id);
    try {
      await onAccept(app._id);
    } catch (err: any) {
      dialogService.showError('Unable to Accept', err instanceof Error ? err.message : 'Slot conflict or error occurred.');
    } finally {
      setActingId(null);
    }
  };

  const handleOpenReject = (app: AppointmentData) => {
    setRejectModalItem(app);
    setRejectionReason('');
  };

  const handleConfirmReject = async () => {
    if (!rejectModalItem) return;
    setActingId(rejectModalItem._id);
    const appId = rejectModalItem._id;
    const reason = rejectionReason.trim();
    setRejectModalItem(null);
    try {
      await onReject(appId, reason || undefined);
    } catch (err: any) {
      dialogService.showError('Unable to Reject', err instanceof Error ? err.message : 'Failed to reject booking.');
    } finally {
      setActingId(null);
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
          <Text style={s.topTitle}>Pending Requests</Text>
          <Text style={s.topSubtitle}>{requests.length} requests awaiting your action</Text>
        </View>
        <Pressable onPress={onRefresh} style={s.refreshButton}>
          <Text style={s.refreshText}>{loading ? '...' : '↻'}</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[s.content, requests.length === 0 && s.emptyContentContainer]}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner Notice */}
        <View style={s.infoBanner}>
          <Text style={s.infoIcon}>ⓘ</Text>
          <Text style={s.infoText}>
            Accepting locks the slot and notifies the client immediately. Rejecting releases the slot for others.
          </Text>
        </View>

        {loading && requests.length === 0 ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator size="large" color={colors.gold} />
            <Text style={s.loadingText}>Fetching pending bookings...</Text>
          </View>
        ) : requests.length === 0 ? (
          <View style={s.emptyCard}>
            <View style={s.emptyIconCircle}>
              <Text style={s.emptyIconText}>✓</Text>
            </View>
            <Text style={s.emptyTitle}>All Caught Up!</Text>
            <Text style={s.emptySubtitle}>
              No pending appointment requests currently. New customer bookings will appear here.
            </Text>
            <Pressable onPress={onRefresh} style={s.emptyActionBtn}>
              <Text style={s.emptyActionBtnText}>↻ Check for New Requests</Text>
            </Pressable>
          </View>
        ) : (

          requests.map((app, index) => {
            const customerName = app.customerId?.name || 'Valued Customer';
            const customerPhone = app.customerId?.phone || '';
            const customerAvatar = (app.customerId as any)?.avatar;
            const serviceName = app.serviceId?.name || 'Salon Service';
            const serviceCategory = app.serviceId?.category || 'Service';
            const price = app.serviceId?.price ?? 0;
            const duration = app.serviceId?.duration || 30;
            const isProcessing = actingId === app._id;

            return (
              <View key={`${app._id}-${index}`} style={s.card}>
                {/* Header row with customer and status badge */}
                <View style={s.cardHeader}>
                  <View style={s.customerHeaderLeft}>
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
                      <Text style={s.customerName}>{customerName}</Text>
                      {!!customerPhone && <Text style={s.customerEmail}>📞 {customerPhone}</Text>}
                    </View>
                  </View>
                  <StatusBadge status={app.status} />
                </View>

                {/* Service Details Card */}
                <View style={s.serviceHighlight}>
                  <View style={s.serviceRow}>
                    <Text style={s.serviceName}>{serviceName}</Text>
                    <Text style={s.servicePrice}>₹{price}</Text>
                  </View>
                  <View style={s.badgeRow}>
                    <View style={s.pill}>
                      <Text style={s.pillText}>{serviceCategory}</Text>
                    </View>
                    <View style={[s.pill, s.pillDuration]}>
                      <Text style={s.pillDurationText}>⏱ {duration} mins</Text>
                    </View>
                  </View>
                </View>

                {/* Date & Time Specifications */}
                <View style={s.metaGrid}>
                  <View style={s.metaItem}>
                    <Text style={s.metaLabel}>Date</Text>
                    <Text style={s.metaValue}>📅 {app.appointmentDate}</Text>
                  </View>
                  <View style={s.metaItem}>
                    <Text style={s.metaLabel}>Time Slot</Text>
                    <Text style={s.metaValue}>
                      ⏰ {app.startTime} – {app.endTime}
                    </Text>
                  </View>
                </View>

                {/* Customer Note (if present) */}
                {!!app.customerNote && (
                  <View style={s.noteBox}>
                    <Text style={s.noteLabel}>Customer Note:</Text>
                    <Text style={s.noteText}>"{app.customerNote}"</Text>
                  </View>
                )}

                {/* Actions: ACCEPT & REJECT */}
                <View style={s.actionRow}>
                  <Pressable
                    onPress={() => onViewDetails(app)}
                    style={s.detailsBtn}
                    disabled={isProcessing}
                  >
                    <Text style={s.detailsBtnText}>Details</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => handleOpenReject(app)}
                    style={[s.rejectBtn, isProcessing && s.btnDisabled]}
                    disabled={isProcessing}
                  >
                    <Text style={s.rejectBtnText}>✕ REJECT</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => handleAccept(app)}
                    style={[s.acceptBtn, isProcessing && s.btnDisabled]}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={s.acceptBtnText}>✓ ACCEPT</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Reject Modal with Optional Note */}
      <Modal visible={!!rejectModalItem} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Reject Booking Request?</Text>
            <Text style={s.modalSubtitle}>
              Are you sure you want to decline {rejectModalItem?.customerId?.name || 'this customer'}'s request for{' '}
              {rejectModalItem?.serviceId?.name || 'service'}? The time slot ({rejectModalItem?.startTime} – {rejectModalItem?.endTime}) will be released immediately.
            </Text>

            <Text style={s.inputLabel}>Reason (optional, sent to customer):</Text>
            <TextInput
              style={s.textInput}
              placeholder="e.g. Fully booked or stylist unavailable"
              placeholderTextColor="#999"
              value={rejectionReason}
              onChangeText={setRejectionReason}
            />

            <View style={s.modalBtnRow}>
              <Pressable onPress={() => setRejectModalItem(null)} style={s.modalCancelBtn}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleConfirmReject} style={s.modalRejectBtn}>
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
  content: {
    padding: 16,
    paddingBottom: 40
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: colors.goldSoft,
    padding: 12,
    borderRadius: radius.md,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#DFCA8D'
  },
  infoIcon: {
    fontSize: 16,
    color: colors.goldDark,
    marginRight: 8,
    marginTop: 2
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: colors.ink,
    lineHeight: 17
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
    backgroundColor: '#E4F0E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12
  },
  emptyIconText: {
    fontSize: 22,
    color: '#2A6F3F'
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
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  customerHeaderLeft: {
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
  customerName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink
  },
  customerEmail: {
    fontSize: 12,
    color: colors.slate,
    marginTop: 1
  },
  serviceHighlight: {
    backgroundColor: colors.sand,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 12
  },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  serviceName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
    flex: 1,
    marginRight: 8
  },
  servicePrice: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.goldDark
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8
  },
  pill: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border
  },
  pillText: {
    fontSize: 11,
    color: colors.slate,
    fontWeight: '600'
  },
  pillDuration: {
    backgroundColor: '#E8F5E9',
    borderColor: '#C8E6C9'
  },
  pillDurationText: {
    fontSize: 11,
    color: '#2E7D32',
    fontWeight: '700'
  },
  metaGrid: {
    flexDirection: 'row',
    backgroundColor: '#FAFAFA',
    borderRadius: radius.md,
    padding: 10,
    marginBottom: 12,
    gap: 12
  },
  metaItem: {
    flex: 1
  },
  metaLabel: {
    fontSize: 11,
    color: colors.slate,
    textTransform: 'uppercase',
    fontWeight: '700',
    marginBottom: 2
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink
  },
  noteBox: {
    backgroundColor: '#FFFDF6',
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
    padding: 10,
    borderRadius: 4,
    marginBottom: 14
  },
  noteLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.goldDark,
    marginBottom: 2
  },
  noteText: {
    fontSize: 12,
    color: colors.ink,
    fontStyle: 'italic',
    lineHeight: 16
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4
  },
  detailsBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
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
  rejectBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: radius.md,
    backgroundColor: '#FDEEEB',
    borderWidth: 1,
    borderColor: '#F8C8C2',
    alignItems: 'center',
    justifyContent: 'center'
  },
  rejectBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B72B1A'
  },
  acceptBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: radius.md,
    backgroundColor: '#2A6F3F',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2A6F3F',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3
  },
  acceptBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  btnDisabled: {
    opacity: 0.6
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
    maxWidth: 400
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 8
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.slate,
    lineHeight: 18,
    marginBottom: 16
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 6
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 10,
    fontSize: 13,
    color: colors.ink,
    marginBottom: 16
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    backgroundColor: colors.sand
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink
  },
  modalRejectBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    backgroundColor: '#B72B1A'
  },
  modalRejectText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF'
  }
});
