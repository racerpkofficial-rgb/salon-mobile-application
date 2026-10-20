import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { colors, radius } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/auth.service';
import { dialogService } from '../services/dialog.service';

const CATEGORIES = [
  'Booking or Appointment Issue',
  'Payment / Subscription',
  'Salon Service Experience',
  'Account & Security',
  'Location & Maps',
  'App Bug or Technical Glitch'
];

interface ReportProblemModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ReportProblemModal({
  visible,
  onClose
}: ReportProblemModalProps) {
  const { user, token } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [contactEmail, setContactEmail] = useState(user?.email || '');
  const [submitting, setSubmitting] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);

  const handleReset = () => {
    setSubject('');
    setDescription('');
    setTicketId(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!token) {
      dialogService.showInfo('Authentication Required', 'Please sign in to submit a support report.');
      return;
    }

    if (description.trim().length < 10) {
      dialogService.showWarning('Description Too Short', 'Please describe the problem with at least 10 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await authService.reportProblem(token, {
        category: selectedCategory,
        subject: subject.trim() || undefined,
        description: description.trim(),
        contactEmail: contactEmail.trim() || undefined
      });
      setTicketId(res.ticketId);
    } catch (e) {
      dialogService.showError(
        'Submission Failed',
        e instanceof Error ? e.message : 'Could not submit report. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleReset}
    >
      <View style={s.backdrop}>
        <View style={s.modalCard}>
          {/* Header */}
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.eyebrow}>PLATFORM SUPPORT DESK</Text>
              <Text style={s.title}>Report a Problem</Text>
              <Text style={s.subtitle}>Help our engineering & support team improve Book My Salon</Text>
            </View>
            <Pressable onPress={handleReset} hitSlop={12} style={s.closeBtn}>
              <Text style={s.closeText}>✕</Text>
            </Pressable>
          </View>

          {ticketId ? (
            /* Success State */
            <View style={s.successBox}>
              <Text style={s.successIcon}>🎉</Text>
              <Text style={s.successTitle}>Report Received!</Text>
              <Text style={s.successSub}>
                Your support inquiry has been logged in our system. A concierge specialist will investigate and reach out.
              </Text>
              <View style={s.ticketBadge}>
                <Text style={s.ticketLabel}>SUPPORT TICKET ID</Text>
                <Text style={s.ticketCode}>{ticketId}</Text>
              </View>
              <Pressable onPress={handleReset} style={s.successBtn}>
                <Text style={s.successBtnText}>Done</Text>
              </Pressable>
            </View>
          ) : (
            /* Form State */
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={s.content}
            >
              {/* Category Picker */}
              <Text style={s.fieldLabel}>Problem Category *</Text>
              <View style={s.categoriesGrid}>
                {CATEGORIES.map((cat) => {
                  const isSelected = selectedCategory === cat;
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => setSelectedCategory(cat)}
                      style={[s.categoryChip, isSelected && s.categoryChipActive]}
                    >
                      <Text style={[s.categoryChipText, isSelected && s.categoryChipTextActive]}>
                        {cat}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Subject Input */}
              <Text style={s.fieldLabel}>Problem Subject (optional)</Text>
              <TextInput
                style={s.input}
                value={subject}
                onChangeText={setSubject}
                placeholder="Brief summary of the issue..."
                placeholderTextColor={colors.subtle}
              />

              {/* Description Input */}
              <Text style={s.fieldLabel}>Detailed Description *</Text>
              <TextInput
                style={s.textArea}
                value={description}
                onChangeText={setDescription}
                placeholder="Explain what went wrong, error messages seen, or steps to reproduce..."
                placeholderTextColor={colors.subtle}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              {/* Contact Email */}
              <Text style={s.fieldLabel}>Follow-up Email</Text>
              <TextInput
                style={s.input}
                value={contactEmail}
                onChangeText={setContactEmail}
                placeholder="your-email@example.com"
                placeholderTextColor={colors.subtle}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              {/* Submit Button */}
              <Pressable
                onPress={handleSubmit}
                disabled={submitting}
                style={[s.submitBtn, submitting && { opacity: 0.7 }]}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={s.submitBtnText}>Submit Problem Report</Text>
                )}
              </Pressable>
            </ScrollView>
          )}
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
    maxHeight: '90%',
    minHeight: '60%',
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
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 8,
    marginTop: 10
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6
  },
  categoryChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  categoryChipActive: {
    backgroundColor: colors.espresso,
    borderColor: colors.espresso
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.subtle
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  textArea: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    fontSize: 13,
    color: colors.ink,
    height: 100
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.ink
  },
  submitBtn: {
    backgroundColor: colors.gold,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: 20
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14
  },
  successBox: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16
  },
  successIcon: {
    fontSize: 44,
    marginBottom: 12
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink
  },
  successSub: {
    fontSize: 13,
    color: colors.subtle,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 20
  },
  ticketBadge: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.md,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 24
  },
  ticketLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.gold,
    letterSpacing: 1
  },
  ticketCode: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.espresso,
    marginTop: 4
  },
  successBtn: {
    backgroundColor: colors.espresso,
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: radius.md
  },
  successBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14
  }
});
