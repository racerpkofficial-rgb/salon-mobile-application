import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { colors, radius, typography } from '../constants/theme';

interface EmptyStateProps {
  title: string;
  body: string;
  icon?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  title,
  body,
  icon = '✦',
  actionLabel,
  onAction
}: EmptyStateProps) {
  return (
    <View style={s.wrap}>
      <View style={s.iconCircle}>
        <Text style={s.iconText}>{icon}</Text>
      </View>
      <Text style={s.title}>{title}</Text>
      <Text style={s.body}>{body}</Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [s.actionBtn, pressed && s.actionBtnPressed]}
        >
          <Text style={s.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    paddingVertical: 36,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center'
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  iconText: {
    color: colors.gold,
    fontSize: 22
  },
  title: {
    ...typography.title,
    color: colors.espresso,
    textAlign: 'center',
    marginBottom: 8
  },
  body: {
    ...typography.body,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300
  },
  actionBtn: {
    marginTop: 18,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.border
  },
  actionBtnPressed: {
    backgroundColor: colors.champagne
  },
  actionText: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.espresso
  }
});