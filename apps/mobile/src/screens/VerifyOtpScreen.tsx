import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { AppHeader } from '../components/AppHeader';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, radius } from '../constants/theme';
import { authService } from '../services/auth.service';
import { dialogService } from '../services/dialog.service';
import { UserRole } from '../types';

export interface VerifyOtpScreenProps {
  email: string;
  role: UserRole;
  onBack: () => void;
  onSuccess: (resetToken: string) => void;
}

export function VerifyOtpScreen({
  email,
  role,
  onBack,
  onSuccess
}: VerifyOtpScreenProps) {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [attemptsMsg, setAttemptsMsg] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (countdown > 0) {
      timer = setTimeout(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [countdown]);

  const cleanOtp = otp.trim().replace(/\D/g, '').slice(0, 6);
  const isValid = cleanOtp.length === 6;

  const handleVerify = async () => {
    if (!isValid || loading) return;

    setLoading(true);
    setAttemptsMsg(null);
    try {
      const res = await authService.verifyResetOtp(email, cleanOtp, role);
      if (res?.resetToken) {
        onSuccess(res.resetToken);
      } else {
        dialogService.showError('Verification Error', 'Did not receive valid reset authorization.');
      }
    } catch (e: any) {
      const code = e?.code;
      const msg = e instanceof Error ? e.message : 'Invalid verification code.';

      if (code === 'INVALID_OTP') {
        setAttemptsMsg(msg);
      } else if (code === 'OTP_EXPIRED' || code === 'MAX_ATTEMPTS_EXCEEDED') {
        dialogService.showWarning(
          'Verification Code Expired',
          msg + ' Please request a new code.',
          {
            confirmText: 'Request New Code',
            onConfirm: () => void handleResend()
          }
        );
      } else {
        dialogService.showError('Verification Failed', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || resending || loading) return;

    setResending(true);
    setAttemptsMsg(null);
    try {
      await authService.forgotPassword(email, role);
      setCountdown(60);
      setOtp('');
      dialogService.showSuccess('Code Resent', 'A fresh 6-digit verification code has been sent to your email.');
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : 'Unable to resend verification code.';
      dialogService.showError('Resend Failed', msg);
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={s.page}
    >
      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AppHeader title="Verify Code" onBack={onBack} />

        <Text style={s.eyebrow}>STEP 2 OF 3 • CODE VERIFICATION</Text>
        <Text style={s.title}>Enter 6-digit code</Text>
        <Text style={s.copy}>
          We've sent a 6-digit verification code to{' '}
          <Text style={s.emailHighlight}>{email}</Text>. The code expires in 5 minutes.
        </Text>

        <View style={s.form}>
          <Text style={s.inputLabel}>Verification Code</Text>
          <View style={s.otpWrap}>
            <TextInput
              style={s.otpInput}
              value={cleanOtp}
              onChangeText={(text) => setOtp(text.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="••••••"
              placeholderTextColor={colors.subtle}
              autoFocus
              textAlign="center"
            />
          </View>

          {attemptsMsg && (
            <View style={s.errorBox}>
              <Text style={s.errorText}>⚠️ {attemptsMsg}</Text>
            </View>
          )}

          <View style={s.btnWrap}>
            <PrimaryButton
              label={loading ? 'Verifying...' : 'Verify & Continue'}
              loading={loading}
              disabled={!isValid || loading}
              onPress={() => void handleVerify()}
            />
          </View>

          {/* Resend Cooldown Section */}
          <View style={s.resendWrap}>
            <Text style={s.resendQuestion}>Didn't receive the code?</Text>
            {countdown > 0 ? (
              <Text style={s.resendTimer}>Resend code in {countdown}s</Text>
            ) : (
              <Pressable
                onPress={() => void handleResend()}
                disabled={resending || loading}
                hitSlop={8}
                style={s.resendBtn}
              >
                {resending ? (
                  <ActivityIndicator color={colors.gold} size="small" />
                ) : (
                  <Text style={s.resendBtnText}>Resend Code</Text>
                )}
              </Pressable>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    padding: 24,
    paddingTop: 8,
    paddingBottom: 40
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '800',
    color: colors.gold,
    marginTop: 20
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -1,
    color: colors.ink,
    fontWeight: '800',
    marginTop: 8
  },
  copy: {
    color: colors.muted,
    lineHeight: 22,
    marginTop: 8,
    fontSize: 14
  },
  emailHighlight: {
    color: colors.ink,
    fontWeight: '700'
  },
  form: {
    marginTop: 28
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: 0.5,
    marginBottom: 8,
    textTransform: 'uppercase'
  },
  otpWrap: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  otpInput: {
    fontSize: 32,
    letterSpacing: 12,
    fontWeight: '800',
    color: colors.ink,
    width: '100%',
    textAlign: 'center'
  },
  errorBox: {
    backgroundColor: '#FDECEC',
    borderColor: '#F8B4B4',
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: 10,
    marginTop: 14
  },
  errorText: {
    color: '#9B1C1C',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center'
  },
  btnWrap: {
    marginTop: 24
  },
  resendWrap: {
    marginTop: 28,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8
  },
  resendQuestion: {
    color: colors.muted,
    fontSize: 13
  },
  resendTimer: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '700'
  },
  resendBtn: {
    paddingVertical: 4
  },
  resendBtnText: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '800',
    textDecorationLine: 'underline'
  }
});
