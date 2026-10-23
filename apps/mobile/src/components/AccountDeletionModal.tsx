import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import { Trash2, X, ShieldCheck } from 'lucide-react-native';
import { colors, radius } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/auth.service';
import { dialogService } from '../services/dialog.service';

interface AccountDeletionModalProps {
  visible: boolean;
  role: 'CUSTOMER' | 'SALON_OWNER';
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

export function AccountDeletionModal({
  visible,
  role,
  onClose,
  onSuccess
}: AccountDeletionModalProps) {
  const { token, logout } = useAuth();
  const [selectedReason, setSelectedReason] = useState(DELETION_REASONS[0]);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleDelete = async () => {
    if (!token) {
      dialogService.showError('Authentication Error', 'Session expired. Please log in again.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await authService.requestAccountDeletion(token, {
        reason: selectedReason,
        feedback: feedback.trim() || undefined
      });

      dialogService.alert(
        'Deletion Scheduled (30-Day Grace Period)',
        'Your account deletion request has been submitted. Your account is scheduled for deletion after 30 days. You will now be logged out. If you log back in within 30 days, your deletion request will be cancelled automatically.',
        [
          {
            text: 'OK',
            onPress: async () => {
              try {
                await logout();
              } catch {
                // ignore
              }
              onSuccess();
            }
          }
        ]
      );
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Failed to schedule account deletion.';
      dialogService.showError('Deletion Request Failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardWrap}
          >
            <View style={styles.card}>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* Header Icon */}
                <View style={styles.headerRow}>
                  <View style={styles.warningIconCircle}>
                    <Trash2 size={24} color="#DC2626" />
                  </View>
                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={onClose}
                    disabled={submitting}
                    accessibilityLabel="Cancel deletion"
                    accessibilityRole="button"
                  >
                    <X size={20} color="#7A6E65" />
                  </TouchableOpacity>
                </View>

                {/* Title */}
                <Text style={styles.title}>
                  Delete {role === 'SALON_OWNER' ? 'Salon Partner' : 'Customer'} Account
                </Text>

                {/* 30-Day Policy Box */}
                <View style={styles.policyBox}>
                  <View style={styles.policyHeader}>
                    <ShieldCheck size={18} color="#92400E" style={{ marginRight: 6 }} />
                    <Text style={styles.policyTitle}>30-Day Grace Period Notice</Text>
                  </View>
                  <Text style={styles.policyBody}>
                    Your account will enter a <Text style={{ fontWeight: '700' }}>30-day grace period</Text>. You will be signed out immediately.
                  </Text>
                  <Text style={styles.policyBody}>
                    If you change your mind, simply <Text style={{ fontWeight: '700' }}>sign back in anytime within 30 days</Text> to cancel this request and restore your active account.
                  </Text>
                </View>

                {/* Reason Selection */}
                <Text style={styles.sectionLabel}>Reason for leaving (Required):</Text>
                <View style={styles.reasonsList}>
                  {DELETION_REASONS.map((r) => {
                    const isSelected = selectedReason === r;
                    return (
                      <TouchableOpacity
                        key={r}
                        style={[styles.reasonItem, isSelected && styles.reasonItemSelected]}
                        onPress={() => setSelectedReason(r)}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                          {isSelected && <View style={styles.radioDot} />}
                        </View>
                        <Text style={[styles.reasonText, isSelected && styles.reasonTextSelected]}>{r}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Optional Feedback */}
                <Text style={styles.sectionLabel}>Additional feedback (Optional):</Text>
                <TextInput
                  style={styles.feedbackInput}
                  value={feedback}
                  onChangeText={setFeedback}
                  placeholder="Tell us what we could have done better..."
                  placeholderTextColor="#A89E94"
                  multiline
                  numberOfLines={3}
                  maxLength={500}
                />

                {/* Confirm Delete Button */}
                <TouchableOpacity
                  style={[styles.deleteBtn, submitting && styles.deleteBtnDisabled]}
                  onPress={handleDelete}
                  disabled={submitting}
                  activeOpacity={0.85}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.deleteBtnText}>Schedule Account Deletion</Text>
                  )}
                </TouchableOpacity>

                {/* Cancel / Keep Account Button */}
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={onClose}
                  disabled={submitting}
                >
                  <Text style={styles.cancelBtnText}>Keep My Account</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(20, 14, 10, 0.76)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18
  },
  keyboardWrap: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%'
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12
  },
  scrollContent: {
    paddingBottom: 8
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14
  },
  warningIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center'
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F5F2EC',
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#30231F',
    letterSpacing: -0.4,
    marginBottom: 12
  },
  policyBox: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16
  },
  policyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6
  },
  policyTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E'
  },
  policyBody: {
    fontSize: 12,
    color: '#78350F',
    lineHeight: 18,
    marginTop: 4
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#30231F',
    marginBottom: 8,
    marginTop: 6
  },
  reasonsList: {
    marginBottom: 12
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EFE9DE',
    marginBottom: 6,
    backgroundColor: '#FAF8F5'
  },
  reasonItemSelected: {
    borderColor: '#DC2626',
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
    borderColor: '#DC2626'
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DC2626'
  },
  reasonText: {
    fontSize: 12.5,
    color: '#4A3E38',
    flex: 1
  },
  reasonTextSelected: {
    fontWeight: '700',
    color: '#991B1B'
  },
  feedbackInput: {
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#E8DFD3',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#30231F',
    textAlignVertical: 'top',
    minHeight: 70,
    marginBottom: 16
  },
  deleteBtn: {
    backgroundColor: '#DC2626',
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10
  },
  deleteBtnDisabled: {
    opacity: 0.5
  },
  deleteBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 8
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7A6E65'
  }
});
