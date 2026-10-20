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
import { PasswordValidationGroup } from '../components/PasswordValidationGroup';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../constants/theme';
import { authService } from '../services/auth.service';
import { dialogService } from '../services/dialog.service';
import { isStrongPassword } from '../utils/validation';

export interface ResetPasswordScreenProps {
  resetToken: string;
  onBack: () => void;
  onSuccess: () => void;
}

export function ResetPasswordScreen({
  resetToken,
  onBack,
  onSuccess
}: ResetPasswordScreenProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const isPasswordValid = isStrongPassword(newPassword);
  const isMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit = isPasswordValid && isMatch && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setLoading(true);
    try {
      await authService.resetPassword(resetToken, newPassword, confirmPassword);
      dialogService.showSuccess(
        'Password Updated Successfully',
        'Your password has been reset. You can now sign in with your new password.',
        {
          confirmText: 'Sign In Now',
          onConfirm: () => onSuccess()
        }
      );
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : 'Unable to reset password. Please try again.';
      dialogService.showError('Reset Failed', msg);
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
        <AppHeader title="Reset Password" onBack={onBack} />

        <Text style={s.eyebrow}>STEP 3 OF 3 • NEW CREDENTIALS</Text>
        <Text style={s.title}>Create new password</Text>
        <Text style={s.copy}>
          Please choose a strong password that you haven't used before.
        </Text>

        <View style={s.form}>
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
              label={loading ? 'Updating Password...' : 'Save & Reset Password'}
              loading={loading}
              disabled={!canSubmit}
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
  form: {
    marginTop: 24
  },
  btnWrap: {
    marginTop: 28
  }
});
