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
import { colors, radius } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/auth.service';
import { dialogService } from '../services/dialog.service';

interface DeleteAccountModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const DELETION_REASONS = [
  'I found another salon or service provider',
  'Privacy, data, or security concerns',
  'Not using Book My Salon frequently',
  'App performance or technical issues',
  'Dissatisfied with salon experience or bookings',
  'Other reasons'
];

export function DeleteAccountModal({
  visible,
  onClose,
  onSuccess
}: DeleteAccountModalProps) {
  const { user, token, logout } = useAuth();
  const [selectedReason, setSelectedReason] = useState(DELETION_REASONS[0]);
  const [feedback, setFeedback] = useState('');
  const [deleting, setDeleting] = useState(false);

  const isOwner = user?.role === 'SALON_OWNER';

  const handleClose = () => {
    setFeedback('');
    setSelectedReason(DELETION_REASONS[0]);
    onClose();
  };

  const handleDelete = async () => {
    if (!token) return;

    setDeleting(true);
    try {
      const res = await authService.requestAccountDeletion(token, {
        reason: selectedReason,
        feedback: feedback.trim() || undefined
      });

      dialogService.alert(
        'Deletion Scheduled (30-Day Grace Period)',
        res.message || 'Your account deletion request has been submitted. Your account is scheduled for deletion after 30 days. You will now be logged out. If you log back in within 30 days, your deletion request will be cancelled automatically.',
        [
          {
            text: 'OK',
            onPress: async () => {
              try {
                await logout();
              } catch {
                // quiet
              }
              handleClose();
              onSuccess();
            }
          }
        ]
      );
    } catch (e: any) {
      dialogService.showError(
        'Deletion Request Failed',
        e instanceof Error
          ? e.message
          : 'Unable to schedule account deletion. Please try again later.'
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={s.backdrop}>
        <View style={s.modalCard}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
            {/* Warning Icon */}
            <View style={s.iconWrap}>
              <Text style={s.icon}>⚠️</Text>
            </View>

            <Text style={s.title}>
              Delete {isOwner ? 'Salon Partner' : 'Customer'} Account
            </Text>

            {/* 30-Day Policy Notice Box */}
            <View style={s.gracePeriodBox}>
              <Text style={s.gracePeriodHeading}>30-Day Grace Period Notice</Text>
              <Text style={s.gracePeriodText}>
                • Your account is scheduled for deletion after <Text style={s.bold}>30 days</Text>.{'\n'}
                • You will be immediately logged out of all active sessions.{'\n'}
                • <Text style={s.bold}>Logging back in during the 30-day grace period automatically cancels</Text> the pending deletion and restores your active account.{'\n'}
                • If you do not log in within 30 days, your personal profile and preferences will be permanently erased.
              </Text>
            </View>

            {/* Reason Selection */}
            <Text style={s.sectionLabel}>Please select a reason for leaving:</Text>
            <View style={s.reasonsList}>
              {DELETION_REASONS.map((reason) => {
                const isSelected = selectedReason === reason;
                return (
                  <Pressable
                    key={reason}
                    style={[s.reasonItem, isSelected && s.reasonItemSelected]}
                    onPress={() => setSelectedReason(reason)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <View style={[s.radioCircle, isSelected && s.radioCircleSelected]}>
                      {isSelected && <View style={s.radioDot} />}
                    </View>
                    <Text style={[s.reasonText, isSelected && s.reasonTextSelected]}>
                      {reason}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Optional Feedback */}
            <Text style={s.sectionLabel}>Additional comments or feedback (Optional):</Text>
            <TextInput
              style={s.feedbackInput}
              value={feedback}
              onChangeText={setFeedback}
              placeholder="Tell us what we could improve..."
              placeholderTextColor={colors.subtle}
              multiline
              numberOfLines={3}
              maxLength={500}
            />

            <View style={s.btnRow}>
              <Pressable
                onPress={handleClose}
                disabled={deleting}
                style={s.cancelBtn}
              >
                <Text style={s.cancelBtnText}>Keep Account</Text>
              </Pressable>

              <Pressable
                onPress={handleDelete}
                disabled={deleting}
                style={[s.deleteBtn, deleting && { opacity: 0.6 }]}
              >
                {deleting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={s.deleteBtnText}>Schedule Deletion</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 12, 10, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 24
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    width: '100%',
    maxWidth: 440,
    maxHeight: '92%',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10
  },
  scrollContent: {
    paddingBottom: 4
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFEBEE',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 12
  },
  icon: {
    fontSize: 26
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: '#D32F2F',
    textAlign: 'center',
    marginBottom: 12
  },
  gracePeriodBox: {
    backgroundColor: '#FFF8F0',
    borderWidth: 1,
    borderColor: '#FFE0B2',
    borderRadius: radius.md,
    padding: 12,
    width: '100%',
    marginBottom: 14
  },
  gracePeriodHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#E65100',
    marginBottom: 6
  },
  gracePeriodText: {
    fontSize: 11.5,
    lineHeight: 18,
    color: '#6D4C41'
  },
  bold: {
    fontWeight: '700'
  },
  sectionLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 8,
    marginTop: 4
  },
  reasonsList: {
    marginBottom: 12
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EFEAE2',
    marginBottom: 6,
    backgroundColor: '#FAF8F5'
  },
  reasonItemSelected: {
    borderColor: '#D32F2F',
    backgroundColor: '#FFF5F5'
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#C7BBB0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10
  },
  radioCircleSelected: {
    borderColor: '#D32F2F'
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D32F2F'
  },
  reasonText: {
    fontSize: 12,
    color: '#4A3E38',
    flex: 1
  },
  reasonTextSelected: {
    fontWeight: '700',
    color: '#991B1B'
  },
  feedbackInput: {
    width: '100%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12.5,
    color: colors.ink,
    textAlignVertical: 'top',
    minHeight: 65,
    marginBottom: 16
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 4
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: '#FFFFFF'
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink
  },
  deleteBtn: {
    flex: 1.3,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: '#D32F2F',
    alignItems: 'center',
    justifyContent: 'center'
  },
  deleteBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF'
  }
});
