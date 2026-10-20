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

interface OwnerBookingDetailsScreenProps {
  appointment: AppointmentData;
  onAccept: (appointmentId: string) => Promise<void>;
  onReject: (appointmentId: string, reason?: string) => Promise<void>;
  onComplete: (appointmentId: string) => Promise<void>;
  onBack: () => void;
}

export function OwnerBookingDetailsScreen({
  appointment,
  onAccept,
  onReject,
  onComplete,
  onBack
}: OwnerBookingDetailsScreenProps) {
  const [loading, setLoading] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const customerName = appointment.customerId?.name || 'Customer';
  const customerPhone = appointment.customerId?.phone || '+91 Not provided';
  const customerAvatar = appointment.customerId?.avatar;
  const serviceName = appointment.serviceName || appointment.serviceId?.name || 'Service';
  const serviceDesc = appointment.serviceId?.description || '';
  const serviceCategory = appointment.serviceId?.category || 'General';
  const servicePrice = appointment.totalPrice ?? appointment.serviceId?.price ?? 0;
  const serviceDuration = appointment.serviceDuration || appointment.serviceId?.duration || 30;

  const handleAccept = async () => {
    setLoading(true);
    try {
      await onAccept(appointment._id);
      dialogService.showSuccess(
        'Confirmed!',
        `Appointment for ${customerName} has been confirmed. Time slot is locked and customer has been notified.`,
        { onConfirm: onBack }
      );
    } catch (err: any) {
      dialogService.showError('Unable to Accept', err instanceof Error ? err.message : 'Slot collision or error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReject = async () => {
    setLoading(true);
    setRejectModalVisible(false);
    try {
      await onReject(appointment._id, rejectionReason.trim() || undefined);
      dialogService.showSuccess(
        'Rejected',
        `Booking request declined. Time slot has been released back into availability.`,
        { onConfirm: onBack }
      );
    } catch (err: any) {
      dialogService.showError('Error', err instanceof Error ? err.message : 'Failed to reject booking.');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      await onComplete(appointment._id);
      dialogService.showSuccess('Completed! 🏆', 'Appointment has been marked as completed.', { onConfirm: onBack });
    } catch (err: any) {
      dialogService.showError('Error', err instanceof Error ? err.message : 'Failed to complete appointment.');
    } finally {
      setLoading(false);
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
          <Text style={s.topTitle}>Booking Details</Text>
          <Text style={s.topSubtitle}>ID: {appointment._id.slice(-8).toUpperCase()}</Text>
        </View>
        <StatusBadge status={appointment.status} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Status Callout Banner */}
        {appointment.status === 'PENDING' && (
          <View style={[s.statusBanner, s.pendingBanner]}>
            <Text style={s.bannerIcon}>⚠️</Text>
            <View style={s.bannerContent}>
              <Text style={s.bannerTitle}>Awaiting Your Decision</Text>
              <Text style={s.bannerText}>
                Accept to confirm and lock this time slot. Reject to release it for other clients.
              </Text>
            </View>
          </View>
        )}

        {appointment.status === 'CONFIRMED' && (
          <View style={[s.statusBanner, s.confirmedBanner]}>
            <Text style={s.bannerIcon}>✓</Text>
            <View style={s.bannerContent}>
              <Text style={s.bannerTitle}>Booking Confirmed</Text>
              <Text style={s.bannerText}>
                Slot is locked on your calendar. Customer has received their confirmation receipt.
              </Text>
            </View>
          </View>
        )}

        {/* Client Profile Card */}
        <View style={s.card}>
          <Text style={s.cardHeading}>Customer Information</Text>
          <View style={s.clientRow}>
            <Avatar
              uri={customerAvatar}
              name={customerName}
              size={46}
              borderColor={colors.gold}
              borderWidth={1.5}
              backgroundColor={colors.goldSoft}
              textColor={colors.ink}
            />
            <View style={s.clientInfo}>
              <Text style={s.clientName}>{customerName}</Text>
              <Text style={s.clientDetail}>📞 {customerPhone}</Text>
            </View>
          </View>
        </View>

        {/* Service Details Card */}
        <View style={s.card}>
          <Text style={s.cardHeading}>Selected Service</Text>
          <View style={s.serviceHeader}>
            <Text style={s.serviceTitle}>{serviceName}</Text>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.servicePrice}>₹{servicePrice}</Text>
              {Boolean(appointment.originalPrice && appointment.discountAmount && appointment.discountAmount > 0) && (
                <Text style={s.strikethroughOriginal}>
                  ₹{appointment.originalPrice} (Save ₹{appointment.discountAmount})
                </Text>
              )}
            </View>
          </View>
          {!!serviceDesc && <Text style={s.serviceDesc}>{serviceDesc}</Text>}

          <View style={s.metaChips}>
            <View style={s.chip}>
              <Text style={s.chipText}>Category: {serviceCategory}</Text>
            </View>
            <View style={[s.chip, s.chipGreen]}>
              <Text style={s.chipGreenText}>Duration: {serviceDuration} mins</Text>
            </View>
          </View>
        </View>

        {/* Schedule & Timing Card */}
        <View style={s.card}>
          <Text style={s.cardHeading}>Appointment Schedule</Text>
          <View style={s.scheduleGrid}>
            <View style={s.scheduleCol}>
              <Text style={s.schedLabel}>Date</Text>
              <Text style={s.schedVal}>📅 {appointment.appointmentDate}</Text>
            </View>
            <View style={s.scheduleCol}>
              <Text style={s.schedLabel}>Time Window</Text>
              <Text style={s.schedVal}>⏰ {appointment.startTime} – {appointment.endTime}</Text>
            </View>
          </View>
        </View>

        {/* Customer Note */}
        {!!appointment.customerNote && (
          <View style={s.card}>
            <Text style={s.cardHeading}>Client Special Request</Text>
            <View style={s.noteQuote}>
              <Text style={s.noteQuoteText}>"{appointment.customerNote}"</Text>
            </View>
          </View>
        )}

        {/* Rejection Note (if rejected) */}
        {!!appointment.rejectionReason && (
          <View style={[s.card, s.rejectCard]}>
            <Text style={s.rejectHeading}>Rejection Reason</Text>
            <Text style={s.rejectText}>{appointment.rejectionReason}</Text>
          </View>
        )}

        {/* Booking Timeline */}
        <View style={s.card}>
          <Text style={s.cardHeading}>Record Info</Text>
          <Text style={s.timelineText}>
            • Created: {appointment.createdAt ? new Date(appointment.createdAt).toLocaleString() : 'N/A'}
          </Text>
          <Text style={s.timelineText}>
            • Status: {appointment.status}
          </Text>
        </View>

        {/* Bottom Actions based on status */}
        <View style={s.actionSection}>
          {appointment.status === 'PENDING' && (
            <View style={s.doubleActionRow}>
              <Pressable
                onPress={() => setRejectModalVisible(true)}
                style={[s.btn, s.btnDanger]}
                disabled={loading}
              >
                <Text style={s.btnDangerText}>✕ REJECT</Text>
              </Pressable>

              <Pressable
                onPress={handleAccept}
                style={[s.btn, s.btnSuccess]}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={s.btnSuccessText}>✓ ACCEPT & LOCK</Text>
                )}
              </Pressable>
            </View>
          )}

          {appointment.status === 'CONFIRMED' && (
            <View style={s.singleActionCol}>
              <Pressable
                onPress={handleComplete}
                style={[s.btn, s.btnComplete]}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={s.btnCompleteText}>✓ Mark Appointment as Completed</Text>
                )}
              </Pressable>

              <Pressable
                onPress={() => setRejectModalVisible(true)}
                style={s.cancelTextBtn}
                disabled={loading}
              >
                <Text style={s.cancelTextBtnLabel}>Decline / Cancel Booking</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Rejection Dialog */}
      <Modal visible={rejectModalVisible} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Decline Booking Request</Text>
            <Text style={s.modalSubtitle}>
              Declining will release the time slot ({appointment.startTime} – {appointment.endTime}) back to public availability and notify the client.
            </Text>

            <Text style={s.inputLabel}>Reason for client (optional):</Text>
            <TextInput
              style={s.textInput}
              placeholder="e.g. Double booked or emergency closure"
              placeholderTextColor="#999"
              value={rejectionReason}
              onChangeText={setRejectionReason}
            />

            <View style={s.modalBtnRow}>
              <Pressable onPress={() => setRejectModalVisible(false)} style={s.modalCancelBtn}>
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
  content: {
    padding: 16,
    paddingBottom: 40
  },
  statusBanner: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: radius.md,
    marginBottom: 16,
    borderWidth: 1
  },
  pendingBanner: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A'
  },
  confirmedBanner: {
    backgroundColor: '#E8F5E9',
    borderColor: '#A5D6A7'
  },
  bannerIcon: {
    fontSize: 20,
    marginRight: 12,
    marginTop: 2
  },
  bannerContent: {
    flex: 1
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 2
  },
  bannerText: {
    fontSize: 12,
    color: colors.slate,
    lineHeight: 16
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border
  },
  cardHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.slate,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.goldDark
  },
  clientInfo: {
    flex: 1
  },
  clientName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 3
  },
  clientDetail: {
    fontSize: 13,
    color: colors.slate,
    marginBottom: 2
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  serviceTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.ink
  },
  servicePrice: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.goldDark
  },
  strikethroughOriginal: {
    fontSize: 11,
    color: colors.slate,
    marginTop: 2
  },
  serviceDesc: {
    fontSize: 13,
    color: colors.slate,
    lineHeight: 18,
    marginBottom: 10
  },
  metaChips: {
    flexDirection: 'row',
    gap: 8
  },
  chip: {
    backgroundColor: colors.sand,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink
  },
  chipGreen: {
    backgroundColor: '#E8F5E9'
  },
  chipGreenText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2E7D32'
  },
  scheduleGrid: {
    flexDirection: 'row',
    gap: 12
  },
  scheduleCol: {
    flex: 1,
    backgroundColor: colors.sand,
    padding: 12,
    borderRadius: radius.md
  },
  schedLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.slate,
    textTransform: 'uppercase',
    marginBottom: 4
  },
  schedVal: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink
  },
  noteQuote: {
    backgroundColor: '#FFFDF6',
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
    padding: 12,
    borderRadius: 4
  },
  noteQuoteText: {
    fontSize: 13,
    color: colors.ink,
    fontStyle: 'italic',
    lineHeight: 18
  },
  rejectCard: {
    backgroundColor: '#FDEEEB',
    borderColor: '#F8C8C2'
  },
  rejectHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B72B1A',
    textTransform: 'uppercase',
    marginBottom: 6
  },
  rejectText: {
    fontSize: 13,
    color: '#7B1C10'
  },
  timelineText: {
    fontSize: 12,
    color: colors.slate,
    marginBottom: 4
  },
  actionSection: {
    marginTop: 10
  },
  doubleActionRow: {
    flexDirection: 'row',
    gap: 10
  },
  btn: {
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnDanger: {
    flex: 1,
    backgroundColor: '#FDEEEB',
    borderWidth: 1,
    borderColor: '#F8C8C2'
  },
  btnDangerText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#B72B1A'
  },
  btnSuccess: {
    flex: 2,
    backgroundColor: '#2A6F3F'
  },
  btnSuccessText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  singleActionCol: {
    gap: 12
  },
  btnComplete: {
    backgroundColor: colors.ink
  },
  btnCompleteText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  cancelTextBtn: {
    alignItems: 'center',
    paddingVertical: 8
  },
  cancelTextBtnLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B72B1A'
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
