import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Sun, Moon, Smartphone, Check } from 'lucide-react-native';
import { ThemeMode, useTheme } from '../context/ThemeContext';
import { radius } from '../constants/theme';

interface ThemeSelectorProps {
  embedded?: boolean;
}

export function ThemeSelector({ embedded = false }: ThemeSelectorProps) {
  const { themeMode, activeTheme, isDark, colors, setThemeMode } = useTheme();

  const options: {
    mode: ThemeMode;
    label: string;
    description: string;
    icon: typeof Sun;
  }[] = [
      {
        mode: 'system',
        label: 'System Default',
        description: `Follows device appearance (${activeTheme === 'dark' ? 'Dark' : 'Light'})`,
        icon: Smartphone
      },
      {
        mode: 'light',
        label: 'Light Luxury',
        description: 'Warm ivory background with rich espresso contrast',
        icon: Sun
      },
      {
        mode: 'dark',
        label: 'Dark Obsidian',
        description: 'Deep obsidian elegance with luminous gold accents',
        icon: Moon
      }
    ];

  return (
    <View style={[s.container, embedded && { paddingHorizontal: 0, backgroundColor: 'transparent' }]}>
      <View style={s.optionsList}>
        {options.map((opt) => {
          const isSelected = themeMode === opt.mode;
          const IconComp = opt.icon;

          return (
            <Pressable
              key={opt.mode}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              accessibilityLabel={`${opt.label} theme`}
              onPress={() => void setThemeMode(opt.mode)}
              style={({ pressed }) => [
                s.optionCard,
                {
                  backgroundColor: colors.surfaceWarm,
                  borderColor: isSelected ? colors.gold : colors.border
                },
                isSelected && {
                  borderWidth: 1.5,
                  backgroundColor: isDark ? '#2B2319' : '#FBF6EE'
                },
                pressed && { opacity: 0.9 }
              ]}
            >
              <View style={[
                s.iconBox,
                {
                  backgroundColor: isSelected ? colors.gold : (isDark ? '#26201B' : '#FFFFFF'),
                  borderColor: isSelected ? colors.gold : colors.border
                }
              ]}>
                <IconComp
                  size={18}
                  color={isSelected ? '#FFFFFF' : (isDark ? '#E5C07B' : colors.espresso)}
                />
              </View>

              <View style={s.textCol}>
                <Text
                  style={[
                    s.optionTitle,
                    { color: isDark ? '#F8F4EE' : colors.espresso },
                    isSelected && { fontWeight: '700' }
                  ]}
                >
                  {opt.label}
                </Text>
                <Text style={[s.optionDesc, { color: isDark ? '#A89D93' : colors.muted }]}>
                  {opt.description}
                </Text>
              </View>

              <View
                style={[
                  s.radioCircle,
                  { borderColor: isSelected ? colors.gold : colors.border },
                  isSelected && { backgroundColor: colors.gold }
                ]}
              >
                {isSelected && <Check size={13} color="#FFFFFF" strokeWidth={3} />}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    paddingVertical: 4
  },
  optionsList: {
    gap: 10
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginRight: 12
  },
  textCol: {
    flex: 1,
    paddingRight: 8
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2
  },
  optionDesc: {
    fontSize: 11,
    lineHeight: 15
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
