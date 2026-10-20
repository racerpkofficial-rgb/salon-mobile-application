import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  HelpCircle,
  Info,
  Sparkles
} from 'lucide-react-native';
import { colors, radius, typography } from '../constants/theme';

export type CustomModalType = 'success' | 'error' | 'warning' | 'confirmation' | 'info';

export interface CustomModalProps {
  visible: boolean;
  type?: CustomModalType;
  title: string;
  message?: string;
  primaryText?: string;
  secondaryText?: string;
  onPrimary?: () => Promise<void> | void;
  onSecondary?: () => void;
  onDismiss?: () => void;
  isDestructive?: boolean;
  dismissable?: boolean;
  icon?: React.ReactNode;
  autoDismissMs?: number;
}

export function CustomModal({
  visible,
  type = 'info',
  title,
  message,
  primaryText = 'OK',
  secondaryText,
  onPrimary,
  onSecondary,
  onDismiss,
  isDestructive = false,
  dismissable = true,
  icon,
  autoDismissMs
}: CustomModalProps) {
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (visible && autoDismissMs && autoDismissMs > 0) {
      const timer = setTimeout(() => {
        void handlePrimaryPress();
      }, autoDismissMs);
      return () => clearTimeout(timer);
    }
  }, [visible, autoDismissMs]);

  const handleDismiss = () => {
    if (submitting) return;
    if (onDismiss) {
      onDismiss();
    } else if (onSecondary) {
      onSecondary();
    }
  };

  const handlePrimaryPress = async () => {
    if (submitting) return;
    if (!onPrimary) {
      handleDismiss();
      return;
    }

    try {
      setSubmitting(true);
      await onPrimary();
    } finally {
      setSubmitting(false);
    }
  };

  const handleSecondaryPress = () => {
    if (submitting) return;
    if (onSecondary) {
      onSecondary();
    } else {
      handleDismiss();
    }
  };

  // Determine Icon and Icon background styling according to modal type
  const renderIcon = () => {
    if (icon) return icon;

    switch (type) {
      case 'success':
        return (
          <View style={[s.iconWrap, { backgroundColor: colors.successSoft || '#EBF1EC' }]}>
            <CheckCircle2 size={26} color={colors.success || '#4E7055'} strokeWidth={2.4} />
          </View>
        );
      case 'error':
        return (
          <View style={[s.iconWrap, { backgroundColor: colors.dangerSoft || '#F9ECE8' }]}>
            <AlertCircle size={26} color={colors.danger || '#B85D43'} strokeWidth={2.4} />
          </View>
        );
      case 'warning':
        return (
          <View style={[s.iconWrap, { backgroundColor: colors.warningSoft || '#FDF6EB' }]}>
            <AlertTriangle size={26} color={colors.warning || '#B57C32'} strokeWidth={2.4} />
          </View>
        );
      case 'confirmation':
        return (
          <View
            style={[
              s.iconWrap,
              {
                backgroundColor: isDestructive
                  ? colors.dangerSoft || '#F9ECE8'
                  : colors.goldSoft || '#F6EFE6'
              }
            ]}
          >
            {isDestructive ? (
              <AlertTriangle size={26} color={colors.danger || '#B85D43'} strokeWidth={2.4} />
            ) : (
              <HelpCircle size={26} color={colors.goldDark || '#8C6C38'} strokeWidth={2.4} />
            )}
          </View>
        );
      case 'info':
      default:
        return (
          <View style={[s.iconWrap, { backgroundColor: colors.champagne || '#F4EBDD' }]}>
            <Sparkles size={24} color={colors.goldDark || '#8C6C38'} strokeWidth={2.2} />
          </View>
        );
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={dismissable && !submitting ? handleDismiss : undefined}
    >
      <View style={s.backdrop}>
        {/* Backdrop touch to dismiss */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismissable && !submitting ? handleDismiss : undefined}
          accessibilityRole="button"
          accessibilityLabel="Close dialog"
        />

        <View style={s.card} pointerEvents="box-none">
          {renderIcon()}

          <Text style={s.title}>{title}</Text>

          {Boolean(message) && <Text style={s.message}>{message}</Text>}

          <View style={s.btnRow}>
            {Boolean(secondaryText) && (
              <Pressable
                onPress={handleSecondaryPress}
                disabled={submitting}
                style={[s.btn, s.secondaryBtn, submitting && s.btnDisabled]}
                accessibilityRole="button"
                accessibilityLabel={secondaryText}
              >
                <Text style={s.secondaryBtnText}>{secondaryText}</Text>
              </Pressable>
            )}

            <Pressable
              onPress={handlePrimaryPress}
              disabled={submitting}
              style={[
                s.btn,
                isDestructive ? s.destructiveBtn : s.primaryBtn,
                submitting && s.btnDisabled
              ]}
              accessibilityRole="button"
              accessibilityLabel={primaryText}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={[s.primaryBtnText, isDestructive && s.destructiveBtnText]}>
                  {primaryText}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(48, 35, 31, 0.72)', // Luxury dark espresso tint
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  card: {
    width: '100%',
    maxWidth: 348,
    backgroundColor: '#FFFCF7', // Warm ivory/cream
    borderRadius: radius.xl || 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#EFE7DC',
    alignItems: 'center',
    shadowColor: '#30231F',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: '#30231F',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.3,
    lineHeight: 24
  },
  message: {
    fontSize: 13.5,
    color: '#7A6E65',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 22,
    paddingHorizontal: 4
  },
  btnRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10
  },
  btn: {
    flex: 1,
    height: 46,
    borderRadius: radius.md || 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12
  },
  primaryBtn: {
    backgroundColor: '#30231F', // Luxury dark espresso
    borderWidth: 1,
    borderColor: '#30231F'
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFCF7', // Warm ivory text
    letterSpacing: 0.2
  },
  destructiveBtn: {
    backgroundColor: '#B85D43', // Terracotta danger
    borderWidth: 1,
    borderColor: '#A84C32'
  },
  destructiveBtnText: {
    color: '#FFFFFF'
  },
  secondaryBtn: {
    backgroundColor: '#F4EBDD', // Champagne warm
    borderWidth: 1,
    borderColor: '#E5D6C2'
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#49413D'
  },
  btnDisabled: {
    opacity: 0.6
  }
});
