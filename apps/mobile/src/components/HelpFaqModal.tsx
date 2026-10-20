import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { colors, radius } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { callSupportPhone, OFFICIAL_SUPPORT_EMAIL, openSupportEmail } from '../utils/support';

interface FaqItem {
  id: string;
  category: string;
  question: string;
  answer: string;
}

const FAQ_DATA: FaqItem[] = [
  {
    id: 'faq_1',
    category: 'Bookings & Appointments',
    question: 'How do I book an appointment?',
    answer:
      'Search or discover luxury salons in your city, select a treatment or offer, choose your preferred appointment date and time slot, and tap "Request Appointment". The salon will confirm your reservation in real time.'
  },
  {
    id: 'faq_2',
    category: 'Bookings & Appointments',
    question: 'Can I reschedule an appointment?',
    answer:
      'Yes, you can view all upcoming bookings under the "Bookings" tab. To reschedule, select your appointment and choose an alternative time slot or contact the salon directly via the in-app phone contact.'
  },
  {
    id: 'faq_3',
    category: 'Cancellations & Refunds',
    question: 'What is the cancellation policy?',
    answer:
      'You can cancel pending or confirmed appointments directly from the "Bookings" screen. We recommend canceling at least 2 hours prior to your scheduled time to allow the salon to release the styling chair.'
  },
  {
    id: 'faq_4',
    category: 'Quality & Salon Verification',
    question: 'How are salons verified on Book My Salon?',
    answer:
      'Every salon partner undergoes strict platform verification, including government identity proof checks, commercial studio validation, hygiene audits, and active membership review before becoming discoverable.'
  },
  {
    id: 'faq_5',
    category: 'Offers & Discounts',
    question: 'How do salon promotional offers work?',
    answer:
      'Salons publish seasonal offers with instant percentage or flat-amount discounts. When you select an offer, the discount is automatically applied to your booking summary without needing promo codes.'
  },
  {
    id: 'faq_6',
    category: 'Security & Account',
    question: 'How is my account secured?',
    answer:
      'All passwords are encrypted with bcrypt hashes, sessions use JWT tokens stored in Android SecureStore, and OTP verification ensures secure self-service password recovery.'
  }
];

interface HelpFaqModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenReport?: () => void;
  role?: 'CUSTOMER' | 'SALON_OWNER';
}

export function HelpFaqModal({
  visible,
  onClose,
  onOpenReport,
  role
}: HelpFaqModalProps) {
  const { user } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>('faq_1');

  const effectiveRole = role || (user?.role === 'SALON_OWNER' ? 'SALON_OWNER' : 'CUSTOMER');

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleContactEmail = () => {
    void openSupportEmail({
      role: effectiveRole,
      userName: user?.name,
      userEmail: user?.email
    });
  };

  const handleContactPhone = () => {
    void callSupportPhone();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={s.backdrop}>
        <View style={s.modalCard}>
          {/* Header */}
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.eyebrow}>24/7 CONCIERGE & SUPPORT</Text>
              <Text style={s.title}>Help & Frequently Asked</Text>
              <Text style={s.subtitle}>Instant answers to common booking & account questions</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={s.closeBtn}>
              <Text style={s.closeText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.content}
          >
            {/* Quick Contact Desk */}
            <View style={s.contactCard}>
              <Text style={s.contactCardTitle}>Direct Support Channels</Text>
              <Text style={s.contactCardSub}>
                Official Desk: {OFFICIAL_SUPPORT_EMAIL} • Mon–Sun 8:00 AM – 10:00 PM IST
              </Text>
              <View style={s.contactBtnRow}>
                <Pressable onPress={handleContactEmail} style={s.contactBtn}>
                  <Text style={s.contactBtnIcon}>✉️</Text>
                  <Text style={s.contactBtnText}>Email Support</Text>
                </Pressable>
                <Pressable onPress={handleContactPhone} style={s.contactBtn}>
                  <Text style={s.contactBtnIcon}>📞</Text>
                  <Text style={s.contactBtnText}>Call Helpline</Text>
                </Pressable>
              </View>
            </View>

            {/* Accordion FAQ Items */}
            <Text style={s.faqSectionTitle}>Frequently Asked Questions</Text>

            {FAQ_DATA.map((item) => {
              const isExpanded = expandedId === item.id;
              return (
                <View key={item.id} style={s.faqItem}>
                  <Pressable
                    onPress={() => toggleExpand(item.id)}
                    style={s.faqHeader}
                  >
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={s.faqCategory}>{item.category.toUpperCase()}</Text>
                      <Text style={s.faqQuestion}>{item.question}</Text>
                    </View>
                    <Text style={[s.chevron, isExpanded && s.chevronExpanded]}>
                      {isExpanded ? '▲' : '▼'}
                    </Text>
                  </Pressable>

                  {isExpanded && (
                    <View style={s.faqBody}>
                      <Text style={s.faqAnswer}>{item.answer}</Text>
                    </View>
                  )}
                </View>
              );
            })}

            {/* Report Problem Card */}
            {onOpenReport && (
              <View style={s.reportBox}>
                <Text style={s.reportTitle}>Experiencing a technical issue?</Text>
                <Text style={s.reportCopy}>
                  Submit a diagnostic report directly to our development and security engineering team.
                </Text>
                <Pressable
                  onPress={() => {
                    onClose();
                    onOpenReport();
                  }}
                  style={s.reportBtn}
                >
                  <Text style={s.reportBtnText}>🚨 Report a Problem</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>

          {/* Action Row */}
          <View style={s.actionRow}>
            <Pressable onPress={onClose} style={s.doneBtn}>
              <Text style={s.doneBtnText}>Close Help Center</Text>
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
    backgroundColor: 'rgba(15, 12, 10, 0.72)',
    justifyContent: 'flex-end'
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    minHeight: '65%',
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 24
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 14
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.gold,
    letterSpacing: 1.2
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink,
    marginTop: 2
  },
  subtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center'
  },
  closeText: {
    fontSize: 16,
    color: colors.ink,
    fontWeight: '700'
  },
  content: {
    paddingVertical: 16
  },
  contactCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 18
  },
  contactCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink
  },
  contactCardSub: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
    marginBottom: 12
  },
  contactBtnRow: {
    flexDirection: 'row',
    gap: 10
  },
  contactBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    borderRadius: radius.sm
  },
  contactBtnIcon: {
    fontSize: 14
  },
  contactBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.espresso
  },
  faqSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.espresso,
    marginBottom: 10,
    letterSpacing: 0.5
  },
  faqItem: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden'
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14
  },
  faqCategory: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.gold,
    letterSpacing: 0.8,
    marginBottom: 2
  },
  faqQuestion: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink
  },
  chevron: {
    fontSize: 11,
    color: colors.muted
  },
  chevronExpanded: {
    color: colors.gold
  },
  faqBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.surface
  },
  faqAnswer: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.subtle
  },
  reportBox: {
    marginTop: 10,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: '#FFF8F0',
    borderWidth: 1,
    borderColor: '#FFE0B2'
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E65100'
  },
  reportCopy: {
    fontSize: 12,
    color: '#6D4C41',
    marginTop: 4,
    marginBottom: 10
  },
  reportBtn: {
    backgroundColor: '#E65100',
    paddingVertical: 10,
    borderRadius: radius.sm,
    alignItems: 'center'
  },
  reportBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13
  },
  actionRow: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  doneBtn: {
    backgroundColor: colors.espresso,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center'
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14
  }
});
