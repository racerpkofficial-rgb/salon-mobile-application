import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { AppHeader } from '../components/AppHeader';
import { InputField } from '../components/InputField';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, radius } from '../constants/theme';
import { authService } from '../services/auth.service';
import { dialogService } from '../services/dialog.service';
import { UserRole } from '../types';
import { isEmail } from '../utils/validation';

export interface ForgotPasswordScreenProps {
  role: UserRole;
  initialEmail?: string;
  onBack: () => void;
  onSuccess: (email: string) => void;
}

export function ForgotPasswordScreen({
  role,
  initialEmail = '',
  onBack,
  onSuccess
}: ForgotPasswordScreenProps) {
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);

  const cleanEmail = email.trim().toLowerCase();
  const valid = isEmail(cleanEmail);
  const roleName = role === 'SALON_OWNER' ? 'Salon Partner' : 'Customer';

  const handleSubmit = async () => {
    if (!valid || loading) return;

    setLoading(true);
    try {
      await authService.forgotPassword(cleanEmail, role);
      dialogService.showSuccess(
        'Code Sent',
        'If an account exists with this email, a 6-digit verification code has been sent to your inbox.',
        {
          confirmText: 'Enter Code',
          onConfirm: () => onSuccess(cleanEmail)
        }
      );
    } catch (e: any) {
      const code = e?.code;
      const msg = e instanceof Error ? e.message : 'Unable to request verification code.';

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
      } else if (code === 'RESEND_COOLDOWN') {
        dialogService.showWarning('Please Wait', msg);
      } else {
        dialogService.showError('Request Failed', msg);
      }
    } finally {
      setLoading(false);
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
        <AppHeader title="Password Recovery" onBack={onBack} />

        <Text style={s.eyebrow}>SECURITY VERIFICATION • {roleName.toUpperCase()}</Text>
        <Text style={s.title}>Forgot password?</Text>
        <Text style={s.copy}>
          Enter your registered email address to receive a 6-digit verification code.
        </Text>

        <View style={s.infoBox}>
          <Text style={s.infoIcon}>💡</Text>
          <Text style={s.infoText}>
            If you normally sign in with Google, you can continue signing in directly with Google.
            Entering your email here will allow you to set a password for direct email login.
          </Text>
        </View>

        <View style={s.form}>
          <InputField
            label="Registered email address"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@example.com"
          />

          <View style={s.btnWrap}>
            <PrimaryButton
              label={loading ? 'Sending Code...' : 'Send Verification Code'}
              loading={loading}
              disabled={!valid || loading}
              onPress={() => void handleSubmit()}
            />
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
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.goldSoft,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 14,
    marginTop: 20,
    gap: 10
  },
  infoIcon: {
    fontSize: 16,
    marginTop: 1
  },
  infoText: {
    flex: 1,
    color: colors.ink,
    fontSize: 12,
    lineHeight: 18
  },
  form: {
    marginTop: 24
  },
  btnWrap: {
    marginTop: 24
  }
});
