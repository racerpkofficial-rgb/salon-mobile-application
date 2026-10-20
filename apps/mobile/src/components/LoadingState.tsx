import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '../constants/theme';

export function LoadingState({ message }: { message?: string }) {
  return (
    <View style={s.wrap} accessibilityRole="progressbar" accessibilityLabel={message || 'Loading'}>
      <ActivityIndicator size="large" color={colors.gold} />
      {message ? <Text style={s.message}>{message}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: 24
  },
  message: {
    ...typography.bodySmall,
    color: colors.muted,
    marginTop: 14,
    letterSpacing: 0.2
  }
});