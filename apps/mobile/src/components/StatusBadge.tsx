import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { colors, radius } from '../constants/theme';
import { BookingStatus, SalonStatus } from '../types';

const label: Record<string, string> = {
  PENDING: 'Waiting for salon confirmation',
  CONFIRMED: 'Confirmed',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
  PENDING_APPROVAL: 'Under Review',
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended'
};

const badgeStyles: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  PENDING: { bg: colors.goldSoft, text: '#8C6C38', border: '#EFE2CF', dot: '#8C6C38' },
  CONFIRMED: { bg: colors.successSoft, text: colors.success, border: colors.successBorder, dot: colors.success },
  REJECTED: { bg: colors.dangerSoft, text: colors.danger, border: colors.dangerBorder, dot: colors.danger },
  CANCELLED: { bg: '#EFECE6', text: '#7A6E65', border: '#DFD9CE', dot: '#7A6E65' },
  COMPLETED: { bg: '#F2ECE4', text: '#49413D', border: '#E2D8CA', dot: '#49413D' },
  PENDING_APPROVAL: { bg: colors.goldSoft, text: '#8C6C38', border: '#EFE2CF', dot: '#8C6C38' },
  ACTIVE: { bg: colors.successSoft, text: colors.success, border: colors.successBorder, dot: colors.success },
  SUSPENDED: { bg: colors.dangerSoft, text: colors.danger, border: colors.dangerBorder, dot: colors.danger }
};

export function StatusBadge({ status }: { status: BookingStatus | SalonStatus | string }) {
  const style = badgeStyles[status] || badgeStyles.PENDING;
  return (
    <View
      style={[
        s.badge,
        { backgroundColor: style.bg, borderColor: style.border }
      ]}
      accessibilityRole="text"
      accessibilityLabel={`Status: ${label[status] || status}`}
    >
      <View style={[s.dot, { backgroundColor: style.dot }]} />
      <Text style={[s.text, { color: style.text }]}>{label[status] || status}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2
  }
});