import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { ThemeSelector } from './ThemeSelector';
import { useTheme } from '../context/ThemeContext';
import { radius } from '../constants/theme';

interface ThemeSelectorModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ThemeSelectorModal({ visible, onClose }: ThemeSelectorModalProps) {
  const { colors, isDark } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable
          style={[
            s.modalCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border
            }
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={s.header}>
            <View>
              <Text style={[s.title, { color: isDark ? '#F8F4EE' : colors.espresso }]}>
                Theme Preference
              </Text>
              <Text style={[s.subtitle, { color: isDark ? '#A89D93' : colors.muted }]}>
                Choose your preferred interface appearance
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={[s.closeBtn, { borderColor: colors.border }]}
              hitSlop={8}
            >
              <Text style={[s.closeText, { color: isDark ? '#F8F4EE' : colors.espresso }]}>✕</Text>
            </Pressable>
          </View>

          <ThemeSelector embedded />

          <Pressable
            onPress={onClose}
            style={[s.doneBtn, { backgroundColor: colors.gold }]}
          >
            <Text style={s.doneBtnText}>Done</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.lg,
    padding: 22,
    borderWidth: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  closeText: {
    fontSize: 14,
    fontWeight: '700'
  },
  doneBtn: {
    marginTop: 18,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700'
  }
});
