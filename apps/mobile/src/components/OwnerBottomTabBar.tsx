import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography } from '../constants/theme';

export type OwnerTabType = 'HOME' | 'BOOKINGS' | 'CALENDAR' | 'OFFERS' | 'PROFILE';

interface TabItem {
  key: OwnerTabType;
  label: string;
  icon: string;
  badge?: number;
}

interface OwnerBottomTabBarProps {
  activeTab: OwnerTabType;
  onSelectTab: (tab: OwnerTabType) => void;
  pendingCount?: number;
}

export function OwnerBottomTabBar({
  activeTab,
  onSelectTab,
  pendingCount = 0
}: OwnerBottomTabBarProps) {
  const insets = useSafeAreaInsets();

  const tabs: TabItem[] = [
    { key: 'HOME', label: 'Home', icon: '⌂' },
    { key: 'BOOKINGS', label: 'Bookings', icon: '📋', badge: pendingCount > 0 ? pendingCount : undefined },
    { key: 'CALENDAR', label: 'Calendar', icon: '📅' },
    { key: 'OFFERS', label: 'Offers', icon: '🏷️' },
    { key: 'PROFILE', label: 'Profile', icon: '◉' }
  ];

  return (
    <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`${tab.label} tab`}
            style={s.tab}
            onPress={() => onSelectTab(tab.key)}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            {isActive && <View style={s.activeTopBar} />}
            <View style={s.iconWrap}>
              <Text style={[s.icon, isActive && s.activeIcon]}>{tab.icon}</Text>
              {typeof tab.badge === 'number' && tab.badge > 0 && (
                <View style={s.badge}>
                  <Text style={s.badgeText}>
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </Text>
                </View>
              )}
            </View>
            <Text
              style={[s.label, isActive && s.activeLabel]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 8,
    minHeight: 62,
    elevation: 8,
    shadowColor: colors.espresso,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 5
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
    flex: 1,
    position: 'relative',
    minHeight: 48
  },
  activeTopBar: {
    position: 'absolute',
    top: -8,
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.espresso
  },
  iconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 24
  },
  icon: {
    fontSize: 18,
    color: colors.muted
  },
  activeIcon: {
    color: colors.espresso,
    transform: [{ scale: 1.08 }]
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: colors.danger,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3
  },
  badgeText: {
    color: '#FFFCF7',
    fontSize: 9,
    fontWeight: '800'
  },
  label: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '500',
    color: colors.muted,
    marginTop: 2
  },
  activeLabel: {
    color: colors.espresso,
    fontWeight: '700'
  }
});
