import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View
} from 'react-native';
import { colors, radius, typography } from '../constants/theme';

interface InputFieldProps extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
  isPassword?: boolean;
}

export function InputField({
  label,
  error,
  hint,
  isPassword,
  secureTextEntry,
  onFocus,
  onBlur,
  ...props
}: InputFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const effectiveSecure = isPassword ? !showPassword : secureTextEntry;

  return (
    <View style={s.wrap}>
      <View style={s.labelRow}>
        <Text style={s.label}>{label}</Text>
        {hint ? <Text style={s.hint}>{hint}</Text> : null}
      </View>
      <View style={s.inputContainer}>
        <TextInput
          style={[
            s.input,
            isPassword && s.passwordInput,
            isFocused && s.inputFocused,
            Boolean(error) && s.inputError
          ]}
          placeholderTextColor={colors.subtle}
          secureTextEntry={effectiveSecure}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          {...props}
        />
        {isPassword && (
          <Pressable
            style={s.toggleBtn}
            hitSlop={8}
            onPress={() => setShowPassword((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          >
            <Text style={s.toggleBtnText}>{showPassword ? 'Hide' : 'Show'}</Text>
          </Pressable>
        )}
      </View>
      {error ? (
        <View style={s.errorRow}>
          <Text style={s.errorIcon}>⚠</Text>
          <Text style={s.error}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    marginBottom: 16
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8
  },
  label: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.espresso,
    letterSpacing: 0.3
  },
  hint: {
    ...typography.caption,
    color: colors.muted
  },
  inputContainer: {
    position: 'relative',
    justifyContent: 'center'
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    color: colors.espresso,
    fontSize: 15
  },
  passwordInput: {
    paddingRight: 64
  },
  toggleBtn: {
    position: 'absolute',
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    zIndex: 2
  },
  toggleBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.goldDark
  },
  inputFocused: {
    borderColor: colors.gold,
    backgroundColor: '#FFFFFF',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 1
  },
  inputError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6
  },
  errorIcon: {
    fontSize: 11,
    color: colors.danger,
    marginRight: 4
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    fontWeight: '500'
  }
});