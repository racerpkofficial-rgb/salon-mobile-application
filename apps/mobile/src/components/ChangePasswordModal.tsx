import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { isStrongPassword } from '../utils/validation';
import { PasswordValidationGroup } from './PasswordValidationGroup';
import { PrimaryButton } from './PrimaryButton';

export interface ChangePasswordModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ChangePasswordModal({
  visible,
  onClose,
  onSuccess
}: ChangePasswordModalProps) {
  const { user, token, updateUser } = useAuth();

  const isGoogleOnly = user?.authProvider === 'GOOGLE' && !user?.hasCustomPassword;

  // Form states
  const [currentPassword, setCurrentPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Timer for OTP resend
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (resendCountdown > 0) {
      timer = setTimeout(() => {
        setResendCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [resendCountdown]);

  // Reset fields on modal close or open
  useEffect(() => {
    if (visible) {
      setCurrentPassword('');
      setOtp('');
      setOtpSent(false);
      setResendCountdown(0);
      setNewPassword('');
      setConfirmPassword('');
      setLoading(false);
    }
  }, [visible]);

  const cleanOtp = otp.trim().replace(/\D/g, '').slice(0, 6);
  const isNewPassValid = isStrongPassword(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const canSubmit =
    isNewPassValid &&
    passwordsMatch &&
    !loading &&
    (isGoogleOnly ? cleanOtp.length === 6 : currentPassword.length > 0);

  const handleRequestOtp = async () => {
    if (!token || sendingOtp || resendCountdown > 0) return;

    setSendingOtp(true);
    try {
      await authService.requestSetupPasswordOtp(token);
      setOtpSent(true);
      setResendCountdown(60);
      dialogService.showSuccess(
        'Code Sent',
        `A 6-digit verification code has been sent to ${user?.email || 'your email'}.`
      );
    } catch (e: any) {
      const code = e?.code;
      const msg = e instanceof Error ? e.message : 'Unable to send verification code.';
      if (code === 'EMAIL_SERVICE_NOT_CONFIGURED') {
        dialogService.showWarning(
          'Email Service Unavailable',
          'The email delivery service is currently not configured on the server. Please contact platform administration.'
        );
      } else if (code === 'EMAIL_DELIVERY_FAILED') {
        dialogService.showError(
          'Email Delivery Failed',
          'Unable to deliver the verification code email. Please verify SMTP server settings or try again later.'
        );
      } else {
        dialogService.showError('Request Failed', msg);
      }
    } finally {
      setSendingOtp(false);
    }
  };

  const handleSubmit = async () => {
    if (!token || !canSubmit) return;

    setLoading(true);
    try {
      await authService.changePassword(token, {
        currentPassword: isGoogleOnly ? undefined : currentPassword,
        otp: isGoogleOnly ? cleanOtp : undefined,
        newPassword,
        confirmPassword
      });

      if (user) {
        updateUser({
          ...user,
          hasCustomPassword: true
        });
      }

      dialogService.showSuccess('Success', 'Your password has been updated successfully.', {
        onConfirm: () => {
          onClose();
          onSuccess?.();
        }
      });
    } catch (e: any) {
      const code = e?.code;
      const msg = e instanceof Error ? e.message : 'Unable to update password.';

      if (code === 'INCORRECT_CURRENT_PASSWORD') {
        dialogService.showError('Incorrect Password', 'Your current password does not match.');
      } else if (code === 'PASSWORD_REUSED') {
        dialogService.showWarning('Password Reused', 'Your new password cannot be the same as your current password.');
      } else if (code === 'INVALID_OTP') {
        dialogService.showError('Invalid Code', msg);
      } else {
        dialogService.showError('Error', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.modalBackdrop}
      >
        <View style={s.modalCard}>
          <View style={s.modalHeader}>
            <View>
              <Text style={s.modalEyebrow}>SECURITY SETTINGS</Text>
              <Text style={s.modalTitle}>
                {isGoogleOnly ? 'Set Account Password' : 'Change Password'}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={s.closeBtn}>
              <Text style={s.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.scrollContent}
          >
            {isGoogleOnly ? (
              <View style={s.googleBox}>
                <Text style={s.googleBoxIcon}>🛡️</Text>
                <Text style={s.googleBoxText}>
                  Your account was created via Google Sign-In. To establish an independent password
                  for direct sign-in, please verify with an email code.
                </Text>
                <View style={s.otpActionRow}>
                  <Pressable
                    onPress={() => void handleRequestOtp()}
                    disabled={sendingOtp || resendCountdown > 0}
                    style={[
                      s.otpReqBtn,
                      (sendingOtp || resendCountdown > 0) && { opacity: 0.6 }
                    ]}
                  >
                    {sendingOtp ? (
                      <ActivityIndicator color={colors.ink} size="small" />
                    ) : (
                      <Text style={s.otpReqBtnText}>
                        {resendCountdown > 0
                          ? `Resend in ${resendCountdown}s`
                          : otpSent
                          ? 'Resend Verification Code'
                          : 'Send 6-digit Code to Email'}
                      </Text>
                    )}
                  </Pressable>
                </View>

                {otpSent && (
                  <View style={s.otpFieldWrap}>
                    <Text style={s.fieldLabel}>6-Digit Verification Code *</Text>
                    <TextInput
                      style={s.otpInput}
                      value={cleanOtp}
                      onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 6))}
                      keyboardType="number-pad"
                      maxLength={6}
                      placeholder="••••••"
                      placeholderTextColor={colors.subtle}
                      textAlign="center"
                    />
                  </View>
                )}
              </View>
            ) : (
              <View style={s.fieldWrap}>
                <View style={s.labelRow}>
                  <Text style={s.fieldLabel}>Current Password *</Text>
                </View>
                <View style={s.passwordWrap}>
                  <TextInput
                    style={s.passwordInput}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder="Enter current password"
                    placeholderTextColor={colors.subtle}
                    secureTextEntry={!showCurrentPassword}
                    autoCapitalize="none"
                  />
                  <Pressable
                    onPress={() => setShowCurrentPassword((prev) => !prev)}
                    hitSlop={8}
                    style={s.toggleBtn}
                  >
                    <Text style={s.toggleBtnText}>
                      {showCurrentPassword ? 'Hide' : 'Show'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            <PasswordValidationGroup
              password={newPassword}
              onPasswordChange={setNewPassword}
              confirmPassword={confirmPassword}
              onConfirmPasswordChange={setConfirmPassword}
              passwordLabel="New Password *"
              confirmPasswordLabel="Confirm New Password *"
            />

            <View style={s.btnWrap}>
              <PrimaryButton
                label={
                  loading
                    ? 'Updating...'
                    : isGoogleOnly
                    ? 'Set Account Password'
                    : 'Update Password'
                }
                loading={loading}
                disabled={!canSubmit}
                onPress={() => void handleSubmit()}
              />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end'
  },
  modalCard: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 40 : 20
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  modalEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.gold,
    letterSpacing: 1.2
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink,
    marginTop: 2
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border
  },
  closeBtnText: {
    fontSize: 15,
    color: colors.ink,
    fontWeight: '700'
  },
  scrollContent: {
    padding: 22
  },
  googleBox: {
    backgroundColor: colors.goldSoft,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 16,
    marginBottom: 20
  },
  googleBoxIcon: {
    fontSize: 20,
    marginBottom: 6
  },
  googleBoxText: {
    color: colors.ink,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12
  },
  otpActionRow: {
    alignItems: 'flex-start'
  },
  otpReqBtn: {
    backgroundColor: colors.gold,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.sm
  },
  otpReqBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  otpFieldWrap: {
    marginTop: 14
  },
  otpInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 16,
    fontSize: 24,
    letterSpacing: 8,
    fontWeight: '800',
    color: colors.ink
  },
  fieldWrap: {
    marginBottom: 16
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    color: colors.ink,
    fontSize: 14
  },
  toggleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  toggleBtnText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '700'
  },
  btnWrap: {
    marginTop: 24,
    marginBottom: 20
  }
});
