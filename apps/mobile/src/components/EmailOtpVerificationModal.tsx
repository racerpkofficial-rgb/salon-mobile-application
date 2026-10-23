import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import { Mail, X, AlertCircle } from 'lucide-react-native';
import { colors, radius } from '../constants/theme';
import { authService } from '../services/auth.service';
import { dialogService } from '../services/dialog.service';
import { AuthResponse } from '../types';

interface EmailOtpVerificationModalProps {
  visible: boolean;
  email: string;
  onSuccess: (result: AuthResponse) => void;
  onClose: () => void;
}

export function EmailOtpVerificationModal({
  visible,
  email,
  onSuccess,
  onClose
}: EmailOtpVerificationModalProps) {
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(60);

  const inputRef = useRef<TextInput>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setOtp('');
      setErrorMessage(null);
      setCooldown(60);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [visible, email]);

  // Resend cooldown countdown
  useEffect(() => {
    if (!visible || cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [visible, cooldown]);

  const handleVerify = async () => {
    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6) {
      setErrorMessage('Please enter the complete 6-digit verification code.');
      return;
    }

    setVerifying(true);
    setErrorMessage(null);

    try {
      const res = await authService.verifyEmailOtp(email.toLowerCase().trim(), cleanOtp);
      onSuccess(res);
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Invalid verification code.';
      setErrorMessage(msg);
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;

    setResending(true);
    setErrorMessage(null);

    try {
      const res = await authService.resendEmailOtp(email.toLowerCase().trim());
      setCooldown(res.cooldownSeconds || 60);
      setOtp('');
      dialogService.showSuccess(
        'Code Resent',
        'A fresh 6-digit verification code has been dispatched to your email address.'
      );
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Failed to resend code. Please try again.';
      setErrorMessage(msg);
    } finally {
      setResending(false);
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
              {/* Header Icon & Close */}
              <View style={styles.headerRow}>
                <View style={styles.iconCircle}>
                  <Mail size={24} color={colors.gold || '#B08D57'} />
                </View>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={onClose}
                  accessibilityLabel="Close verification"
                  accessibilityRole="button"
                >
                  <X size={20} color={colors.muted || '#7A6E65'} />
                </TouchableOpacity>
              </View>

              {/* Title & Subtitle */}
              <Text style={styles.title}>Verify Your Email</Text>
              <Text style={styles.subtitle}>
                We sent a 6-digit verification code to{' '}
                <Text style={styles.emailHighlight}>{email}</Text>. Enter the code below to access your account.
              </Text>

              {/* 6-Digit Display Cells */}
              <TouchableOpacity
                activeOpacity={1}
                style={styles.otpBoxesRow}
                onPress={() => inputRef.current?.focus()}
              >
                {[0, 1, 2, 3, 4, 5].map((index) => {
                  const digit = otp[index] || '';
                  const isFocused = otp.length === index;
                  return (
                    <View
                      key={index}
                      style={[
                        styles.otpBox,
                        isFocused && styles.otpBoxFocused,
                        Boolean(digit) && styles.otpBoxFilled
                      ]}
                    >
                      <Text style={styles.otpDigit}>{digit}</Text>
                    </View>
                  );
                })}
              </TouchableOpacity>

              {/* Hidden Actual Input */}
              <TextInput
                ref={inputRef}
                value={otp}
                onChangeText={(text) => {
                  const numeric = text.replace(/[^0-9]/g, '').slice(0, 6);
                  setOtp(numeric);
                  if (errorMessage) setErrorMessage(null);
                }}
                keyboardType="number-pad"
                maxLength={6}
                style={styles.hiddenInput}
                autoFocus
                textContentType="oneTimeCode"
              />

              {/* Error Message */}
              {Boolean(errorMessage) && (
                <View style={styles.errorBox}>
                  <AlertCircle size={16} color="#DC2626" style={{ marginRight: 6 }} />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              )}

              {/* Verify Button */}
              <TouchableOpacity
                style={[
                  styles.verifyBtn,
                  (otp.length !== 6 || verifying) && styles.verifyBtnDisabled
                ]}
                onPress={handleVerify}
                disabled={otp.length !== 6 || verifying}
                activeOpacity={0.85}
              >
                {verifying ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.verifyBtnText}>Verify Email</Text>
                )}
              </TouchableOpacity>

              {/* Resend Cooldown Section */}
              <View style={styles.resendRow}>
                <Text style={styles.resendLabel}>Didn't receive the code?</Text>
                {cooldown > 0 ? (
                  <Text style={styles.cooldownText}>Resend in {cooldown}s</Text>
                ) : (
                  <TouchableOpacity
                    onPress={handleResend}
                    disabled={resending}
                    activeOpacity={0.7}
                  >
                    {resending ? (
                      <ActivityIndicator size="small" color={colors.gold || '#B08D57'} />
                    ) : (
                      <Text style={styles.resendLink}>Resend Code</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity style={styles.backBtn} onPress={onClose}>
                <Text style={styles.backBtnText}>Change Email or Back</Text>
              </TouchableOpacity>
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
    backgroundColor: 'rgba(20, 14, 10, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  },
  keyboardWrap: {
    width: '100%',
    maxWidth: 420
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 12
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FBF7EE',
    borderWidth: 1,
    borderColor: '#EFE5CE',
    alignItems: 'center',
    justifyContent: 'center'
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F2EC',
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#30231F',
    letterSpacing: -0.4,
    marginBottom: 8
  },
  subtitle: {
    fontSize: 13,
    color: '#6E6259',
    lineHeight: 19,
    marginBottom: 24
  },
  emailHighlight: {
    fontWeight: '700',
    color: '#30231F'
  },
  otpBoxesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  otpBox: {
    width: 46,
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E6DED2',
    backgroundColor: '#FAF8F5',
    alignItems: 'center',
    justifyContent: 'center'
  },
  otpBoxFocused: {
    borderColor: colors.gold || '#B08D57',
    backgroundColor: '#FFFFFF'
  },
  otpBoxFilled: {
    borderColor: '#30231F',
    backgroundColor: '#FFFFFF'
  },
  otpDigit: {
    fontSize: 22,
    fontWeight: '800',
    color: '#30231F'
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16
  },
  errorText: {
    fontSize: 12,
    color: '#B91C1C',
    fontWeight: '600',
    flex: 1
  },
  verifyBtn: {
    backgroundColor: colors.ink || '#30231F',
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  verifyBtnDisabled: {
    opacity: 0.5
  },
  verifyBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 12
  },
  resendLabel: {
    fontSize: 13,
    color: '#7A6E65'
  },
  cooldownText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#A89E94'
  },
  resendLink: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.gold || '#B08D57'
  },
  backBtn: {
    alignItems: 'center',
    paddingVertical: 8
  },
  backBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8A7D73'
  }
});
