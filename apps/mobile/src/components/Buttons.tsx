import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
  TextStyle
} from 'react-native';
import { colors, radius } from '../constants/theme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: string;
}

export function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        s.primary,
        (disabled || loading) && s.disabled,
        pressed && s.primaryPressed,
        style
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#FFFCF7" size="small" />
      ) : (
        <>
          {icon ? <Text style={[s.primaryIcon, textStyle]}>{icon} </Text> : null}
          <Text style={[s.primaryText, textStyle]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  disabled = false,
  style,
  textStyle,
  icon
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.secondary,
        disabled && s.disabled,
        pressed && s.secondaryPressed,
        style
      ]}
    >
      {icon ? <Text style={[s.secondaryIcon, textStyle]}>{icon} </Text> : null}
      <Text style={[s.secondaryText, textStyle]}>{label}</Text>
    </Pressable>
  );
}

export function GoldButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  style,
  textStyle
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        s.gold,
        (disabled || loading) && s.disabled,
        pressed && s.goldPressed,
        style
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" size="small" />
      ) : (
        <Text style={[s.goldText, textStyle]}>{label}</Text>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  primary: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.espresso,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    elevation: 2,
    shadowColor: colors.espresso,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4
  },
  primaryPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }]
  },
  primaryText: {
    color: '#FFFCF7',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.3
  },
  primaryIcon: {
    color: '#FFFCF7',
    fontSize: 16
  },
  secondary: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20
  },
  secondaryPressed: {
    backgroundColor: colors.surfaceWarm,
    opacity: 0.9
  },
  secondaryText: {
    color: colors.espresso,
    fontWeight: '600',
    fontSize: 15,
    letterSpacing: 0.2
  },
  secondaryIcon: {
    color: colors.espresso,
    fontSize: 15
  },
  gold: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    elevation: 2,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4
  },
  goldPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }]
  },
  goldText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.3
  },
  disabled: {
    opacity: 0.45
  }
});