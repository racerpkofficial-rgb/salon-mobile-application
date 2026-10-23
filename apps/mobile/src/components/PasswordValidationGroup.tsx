import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { colors, radius, typography } from '../constants/theme';
import { checkPasswordStrength } from '../utils/validation';

export interface PasswordValidationGroupProps {
  password: string;
  onPasswordChange: (text: string) => void;
  confirmPassword: string;
  onConfirmPasswordChange: (text: string) => void;
  passwordLabel?: string;
  confirmPasswordLabel?: string;
}

export function PasswordValidationGroup({
  password,
  onPasswordChange,
  confirmPassword,
  onConfirmPasswordChange,
  passwordLabel = 'Password *',
  confirmPasswordLabel = 'Confirm password *'
}: PasswordValidationGroupProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const strength = checkPasswordStrength(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const hasTypedPassword = password.length > 0;
  const hasTypedConfirm = confirmPassword.length > 0;

  return (
    <View style={s.container}>
      {/* 1. Password Field */}
      <View style={s.fieldGroup}>
        <View style={s.labelRow}>
          <Text style={s.label}>{passwordLabel}</Text>
          {hasTypedPassword && (
            <Text
              style={[
                s.strengthTag,
                strength.score >= 4
                  ? s.strengthTagStrong
                  : strength.score >= 3
                    ? s.strengthTagFair
                    : s.strengthTagWeak
              ]}
            >
              Strength: {strength.label}
            </Text>
          )}
        </View>

        <View style={s.passwordWrap}>
          <TextInput
            style={[s.input, s.passwordInput]}
            value={password}
            onChangeText={onPasswordChange}
            placeholder="At least 8 characters"
            placeholderTextColor={colors.subtle}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable
            onPress={() => setShowPassword((prev) => !prev)}
            style={s.toggleBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          >
            <Text style={s.toggleBtnText}>{showPassword ? 'Hide' : 'Show'}</Text>
          </Pressable>
        </View>

        {/* Before typing: show concise hint only */}
        {!hasTypedPassword ? (
          <View style={s.hintBox}>
            <Text style={s.hintText}>
              💡 Create a strong password (minimum 8 characters with letters, numbers & symbols)
            </Text>
          </View>
        ) : (
          /* While typing: show dynamic strength meter and live rule checkmarks */
          <>
            {/* Strength meter bar */}
            <View style={s.meterBarWrap}>
              {[1, 2, 3, 4, 5].map((lvl) => (
                <View
                  key={lvl}
                  style={[
                    s.meterSegment,
                    strength.score >= lvl &&
                    (strength.score >= 4
                      ? s.meterSegmentSuccess
                      : strength.score >= 3
                        ? s.meterSegmentFair
                        : s.meterSegmentDanger)
                  ]}
                />
              ))}
            </View>

            {/* Dynamic Rule Items */}
            <View style={s.rulesList}>
              <View style={s.ruleRow}>
                <Text style={[s.ruleCheck, strength.hasMinLength ? s.ruleCheckDone : s.ruleCheckNeutral]}>
                  {strength.hasMinLength ? '✓' : '○'}
                </Text>
                <Text style={[s.ruleText, strength.hasMinLength ? s.ruleTextDone : s.ruleTextNeutral]}>
                  Minimum 8 characters
                </Text>
              </View>

              <View style={s.ruleRow}>
                <Text style={[s.ruleCheck, strength.hasUppercase ? s.ruleCheckDone : s.ruleCheckNeutral]}>
                  {strength.hasUppercase ? '✓' : '○'}
                </Text>
                <Text style={[s.ruleText, strength.hasUppercase ? s.ruleTextDone : s.ruleTextNeutral]}>
                  At least one uppercase letter (A-Z)
                </Text>
              </View>

              <View style={s.ruleRow}>
                <Text style={[s.ruleCheck, strength.hasLowercase ? s.ruleCheckDone : s.ruleCheckNeutral]}>
                  {strength.hasLowercase ? '✓' : '○'}
                </Text>
                <Text style={[s.ruleText, strength.hasLowercase ? s.ruleTextDone : s.ruleTextNeutral]}>
                  At least one lowercase letter (a-z)
                </Text>
              </View>

              <View style={s.ruleRow}>
                <Text style={[s.ruleCheck, strength.hasNumber ? s.ruleCheckDone : s.ruleCheckNeutral]}>
                  {strength.hasNumber ? '✓' : '○'}
                </Text>
                <Text style={[s.ruleText, strength.hasNumber ? s.ruleTextDone : s.ruleTextNeutral]}>
                  At least one number (0-9)
                </Text>
              </View>

              <View style={s.ruleRow}>
                <Text style={[s.ruleCheck, strength.hasSpecialChar ? s.ruleCheckDone : s.ruleCheckNeutral]}>
                  {strength.hasSpecialChar ? '✓' : '○'}
                </Text>
                <Text style={[s.ruleText, strength.hasSpecialChar ? s.ruleTextDone : s.ruleTextNeutral]}>
                  At least one special character (!@#$%^&*)
                </Text>
              </View>
            </View>
          </>
        )}
      </View>

      {/* 2. Confirm Password Field */}
      <View style={s.fieldGroup}>
        <View style={s.labelRow}>
          <Text style={s.label}>{confirmPasswordLabel}</Text>
          {hasTypedConfirm && (
            <Text
              style={[
                s.matchTag,
                passwordsMatch ? s.matchTagMatch : s.matchTagMismatch
              ]}
            >
              {passwordsMatch ? '✓ Passwords match' : '✕ Passwords do not match'}
            </Text>
          )}
        </View>

        <View style={s.passwordWrap}>
          <TextInput
            style={[
              s.input,
              s.passwordInput,
              hasTypedConfirm && !passwordsMatch && s.inputMismatch
            ]}
            value={confirmPassword}
            onChangeText={onConfirmPasswordChange}
            placeholder="Re-enter password"
            placeholderTextColor={colors.subtle}
            secureTextEntry={!showConfirmPassword}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable
            onPress={() => setShowConfirmPassword((prev) => !prev)}
            style={s.toggleBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
          >
            <Text style={s.toggleBtnText}>{showConfirmPassword ? 'Hide' : 'Show'}</Text>
          </Pressable>
        </View>

        {hasTypedConfirm && !passwordsMatch && (
          <Text style={s.fieldError}>
            Passwords must match exactly before continuing.
          </Text>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    width: '100%'
  },
  fieldGroup: {
    marginBottom: 16
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: 0.2
  },
  hintBox: {
    backgroundColor: '#F9F5EE',
    borderWidth: 1,
    borderColor: '#EFE7DA',
    borderRadius: radius.sm || 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 6
  },
  hintText: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 16
  },
  passwordWrap: {
    position: 'relative',
    justifyContent: 'center'
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8DED1',
    borderRadius: radius.md || 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.ink
  },
  passwordInput: {
    paddingRight: 64
  },
  inputMismatch: {
    borderColor: colors.danger
  },
  toggleBtn: {
    position: 'absolute',
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.goldDark
  },
  strengthTag: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm || 6
  },
  strengthTagWeak: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft
  },
  strengthTagFair: {
    color: '#9C6F1E',
    backgroundColor: '#FBF0D9'
  },
  strengthTagStrong: {
    color: colors.success,
    backgroundColor: colors.successSoft
  },
  meterBarWrap: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 8,
    marginBottom: 10
  },
  meterSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E8DED1'
  },
  meterSegmentDanger: {
    backgroundColor: colors.danger
  },
  meterSegmentFair: {
    backgroundColor: '#C59A45'
  },
  meterSegmentSuccess: {
    backgroundColor: colors.success
  },
  rulesList: {
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#EDE5D8',
    borderRadius: radius.sm || 10,
    padding: 10,
    gap: 6
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  ruleCheck: {
    fontSize: 12,
    fontWeight: '800',
    width: 14,
    textAlign: 'center'
  },
  ruleCheckDone: {
    color: colors.success
  },
  ruleCheckNeutral: {
    color: colors.subtle
  },
  ruleText: {
    fontSize: 12
  },
  ruleTextDone: {
    color: colors.ink,
    fontWeight: '600'
  },
  ruleTextNeutral: {
    color: colors.muted
  },
  matchTag: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm || 6
  },
  matchTagMatch: {
    color: colors.success,
    backgroundColor: colors.successSoft
  },
  matchTagMismatch: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft
  },
  fieldError: {
    fontSize: 11,
    color: colors.danger,
    marginTop: 4,
    fontWeight: '600'
  }
});
