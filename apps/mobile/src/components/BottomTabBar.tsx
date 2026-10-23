import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Sparkles,
  Search,
  CalendarCheck,
  TicketPercent,
  Heart,
  UserRound
} from 'lucide-react-native';
import { colors, typography } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

export type CustomerTabKey = 'Discover' | 'Search' | 'Bookings' | 'Coupons' | 'Profile' | 'Saved';

interface TabConfig {
  key: CustomerTabKey;
  label: string;
  IconComponent: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}

const TABS: TabConfig[] = [
  { key: 'Discover', label: 'Discover', IconComponent: Sparkles },
  { key: 'Search', label: 'Search', IconComponent: Search },
  { key: 'Bookings', label: 'Bookings', IconComponent: CalendarCheck },
  { key: 'Coupons', label: 'Coupons', IconComponent: TicketPercent },
  { key: 'Profile', label: 'Profile', IconComponent: UserRound }
];

interface BottomTabBarProps {
  activeTab?: string;
  onSelectTab?: (tab: string) => void;
}

interface TabButtonProps {
  tab: TabConfig;
  isActive: boolean;
  onPress: () => void;
}

function TabButton({ tab, isActive, onPress }: TabButtonProps) {
  const { colors, isDark } = useTheme();
  const scaleAnim = useRef(new Animated.Value(isActive ? 1 : 0.88)).current;
  const opacityAnim = useRef(new Animated.Value(isActive ? 1 : 0)).current;

  useEffect(() => {
    if (isActive) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 90,
          useNativeDriver: true
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true
        })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0.88,
          duration: 140,
          useNativeDriver: true
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 140,
          useNativeDriver: true
        })
      ]).start();
    }
  }, [isActive, scaleAnim, opacityAnim]);

  const { IconComponent } = tab;
  // Selected: warm gold/cream icon; Inactive: muted taupe icon
  const iconColor = isActive
    ? (isDark ? '#F5E4B8' : '#E6C98D')
    : (isDark ? '#A89D93' : '#8E8076');

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={`${tab.label} tab`}
      style={s.tab}
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
    >
      {/* Icon Pill Slot with Floating Active Background */}
      <View style={s.iconSlot}>
        {isActive && (
          <Animated.View
            style={[
              s.activeFloatingPill,
              {
                backgroundColor: isDark ? '#2B2319' : '#382622',
                borderColor: isDark ? '#543818' : 'transparent',
                borderWidth: isDark ? 1 : 0,
                opacity: opacityAnim,
                transform: [{ scale: scaleAnim }]
              }
            ]}
          />
        )}
        <View style={s.iconWrapper}>
          <IconComponent
            size={18}
            color={iconColor}
            strokeWidth={isActive ? 2.2 : 1.9}
          />
        </View>
      </View>

      {/* Label with Exact Uniform Sizing, Alignment and Spacing directly below */}
      <Text
        style={[
          s.label,
          {
            color: isActive
              ? (isDark ? '#D4AF37' : '#382622')
              : (isDark ? '#A89D93' : '#8E8076'),
            fontWeight: isActive ? '700' : '500'
          }
        ]}
        numberOfLines={1}
      >
        {tab.label}
      </Text>
    </Pressable>
  );
}

export function BottomTabBar({
  activeTab = 'Discover',
  onSelectTab
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  // Safe-area aware bottom padding respecting Android navigation bars
  const bottomPadding = Math.max(insets.bottom, 8);

  return (
    <View
      style={[
        s.barContainer,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          paddingBottom: bottomPadding
        }
      ]}
    >
      <View style={s.bar}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TabButton
              key={tab.key}
              tab={tab}
              isActive={isActive}
              onPress={() => onSelectTab?.(tab.key)}
            />
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  barContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: colors.border,
    elevation: 10,
    shadowColor: colors.espresso,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 8
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 8,
    paddingHorizontal: 6
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    minHeight: 52
  },
  iconSlot: {
    width: 48,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  activeFloatingPill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#382622',
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#382622',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4
  },
  iconWrapper: {
    width: 48,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center'
  },
  label: {
    ...typography.caption,
    fontSize: 10.5,
    marginTop: 4,
    textAlign: 'center',
    letterSpacing: 0.2
  },
  labelActive: {
    color: '#382622',
    fontWeight: '700'
  },
  labelInactive: {
    color: '#8E8076',
    fontWeight: '500'
  }
});