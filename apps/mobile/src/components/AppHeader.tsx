import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '../constants/theme';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  brandLabel?: string;
  onBack?: () => void;
  rightElement?: React.ReactNode;
}

export function AppHeader({
  title,
  subtitle,
  brandLabel,
  onBack,
  rightElement
}: AppHeaderProps) {
  return (
    <View style={s.bar}>
      <View style={s.left}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={onBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={({ pressed }) => [s.backBtn, pressed && s.backBtnPressed]}
          >
            <Text style={s.backIcon}>‹</Text>
          </Pressable>
        ) : (
          <View style={s.spacer} />
        )}
      </View>

      <View style={s.center}>
        {brandLabel ? (
          <Text style={s.brandLabel}>{brandLabel}</Text>
        ) : null}
        <Text style={s.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={s.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View style={s.right}>
        {rightElement ? rightElement : <View style={s.spacer} />}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    minHeight: 56,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    flexDirection: 'row',
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight
  },
  left: {
    minWidth: 44,
    alignItems: 'flex-start',
    justifyContent: 'center'
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  backBtnPressed: {
    backgroundColor: colors.surfaceWarm,
    opacity: 0.85
  },
  backIcon: {
    fontSize: 26,
    lineHeight: 28,
    color: colors.espresso,
    marginLeft: -2,
    fontWeight: '300'
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8
  },
  brandLabel: {
    ...typography.brandOverline,
    color: colors.goldDark,
    marginBottom: 2
  },
  title: {
    ...typography.titleSmall,
    color: colors.espresso,
    textAlign: 'center'
  },
  subtitle: {
    ...typography.caption,
    color: colors.muted,
    marginTop: 2
  },
  right: {
    minWidth: 44,
    alignItems: 'flex-end',
    justifyContent: 'center'
  },
  spacer: {
    width: 38
  }
});