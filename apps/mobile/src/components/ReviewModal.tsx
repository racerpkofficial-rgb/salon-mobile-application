import React, { useEffect, useState } from 'react';
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
import { dialogService } from '../services/dialog.service';
import { reviewService } from '../services/review.service';
import { AppointmentData } from '../types';

interface ReviewModalProps {
  visible: boolean;
  appointment: AppointmentData;
  deadlineISO?: string;
  onClose: () => void;
  onReviewSubmitted: () => void;
}

const RATING_LABELS: Record<number, string> = {
  1: '1 Star — Poor Experience',
  2: '2 Stars — Fair',
  3: '3 Stars — Good Service',
  4: '4 Stars — Very Good',
  5: '5 Stars — Outstanding Experience'
};

export function ReviewModal({
  visible,
  appointment,
  deadlineISO,
  onClose,
  onReviewSubmitted
}: ReviewModalProps) {
  const { token } = useAuth();
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [remainingSecs, setRemainingSecs] = useState<number>(() => {
    if (!deadlineISO) return 0;
    const diff = Math.floor((new Date(deadlineISO).getTime() - Date.now()) / 1000);
    return Math.max(0, diff);
  });

  // Live countdown ticker inside the modal
  useEffect(() => {
    if (!visible || !deadlineISO) return;

    const updateCountdown = () => {
      const diff = Math.floor((new Date(deadlineISO).getTime() - Date.now()) / 1000);
      setRemainingSecs(Math.max(0, diff));
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [visible, deadlineISO]);

  const isExpired = remainingSecs <= 0;

  const formatRemaining = (seconds: number) => {
    if (seconds <= 0) return 'Expired';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const handleSubmit = async () => {
    if (isExpired) {
      dialogService.showWarning(
        'Review Window Expired',
        'The 48-hour review deadline has expired. Review submissions are no longer accepted.'
      );
      return;
    }

    if (!token) {
      dialogService.showInfo('Authentication Required', 'Please sign in to submit a review.');
      return;
    }

    const trimmedComment = comment.trim();
    if (trimmedComment.length < 5) {
      dialogService.showWarning('Review Too Short', 'Please write at least 5 characters sharing your experience.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await reviewService.submitReview(token, appointment._id, {
        rating,
        comment: trimmedComment
      });

      dialogService.showSuccess(
        'Review Submitted! ⭐',
        res.message || 'Thank you for rating and reviewing your experience!',
        {
          onConfirm: () => {
            setComment('');
            setRating(5);
            onReviewSubmitted();
            onClose();
          }
        }
      );
    } catch (err: any) {
      dialogService.showError(
        'Submission Error',
        err instanceof Error ? err.message : 'Failed to submit review. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const salon = typeof appointment.salonId === 'object' ? appointment.salonId : null;
  const salonName = salon?.salonName || salon?.name || 'Salon';
  const serviceName = appointment.serviceName || 'Salon Service';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.modalContainer}>
          {/* Header */}
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.headerEyebrow}>VERIFIED REVIEW</Text>
              <Text style={s.headerTitle}>Rate Your Experience</Text>
            </View>
            <Pressable onPress={onClose} style={s.closeBtn} hitSlop={10}>
              <Text style={s.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={s.body} showsVerticalScrollIndicator={false}>
            {/* Salon & Service Details */}
            <View style={s.targetInfoCard}>
              <Text style={s.targetSalonName}>{salonName}</Text>
              <Text style={s.targetService}>{serviceName}</Text>
              <Text style={s.targetDate}>
                Completed: {appointment.appointmentDate} • {appointment.startTime}
              </Text>
            </View>

            {/* Countdown Badge / Expiry Notice */}
            {isExpired ? (
              <View style={s.expiredBanner}>
                <Text style={s.expiredIcon}>⚠️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.expiredTitle}>The 48-hour review period has expired</Text>
                  <Text style={s.expiredSub}>
                    Submissions are strictly accepted within 48 hours of service completion.
                  </Text>
                </View>
              </View>
            ) : (
              <View style={s.timerBanner}>
                <Text style={s.timerIcon}>⏳</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.timerTitle}>Review window closing soon</Text>
                  <Text style={s.timerCountdown}>Available for {formatRemaining(remainingSecs)}</Text>
                </View>
              </View>
            )}

            {/* Star Rating Picker */}
            <View style={s.section}>
              <Text style={s.sectionLabel}>Select Your Rating</Text>
              <View style={s.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Pressable
                    key={star}
                    disabled={isExpired || submitting}
                    onPress={() => setRating(star)}
                    style={s.starBtn}
                  >
                    <Text style={[s.starIcon, rating >= star ? s.starFilled : s.starEmpty]}>
                      ★
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={s.ratingDescription}>{RATING_LABELS[rating]}</Text>
            </View>

            {/* Review Comment Input */}
            <View style={s.section}>
              <View style={s.labelRow}>
                <Text style={s.sectionLabel}>Your Feedback</Text>
                <Text style={s.charCount}>{comment.length}/1000</Text>
              </View>
              <TextInput
                style={s.textInput}
                multiline
                numberOfLines={4}
                maxLength={1000}
                placeholder="Share specific details about the service quality, staff courtesy, cleanliness, and overall atmosphere..."
                placeholderTextColor={colors.muted}
                value={comment}
                onChangeText={setComment}
                editable={!isExpired && !submitting}
                textAlignVertical="top"
              />
            </View>

            {/* Strict Immutability Notice */}
            <View style={s.immutabilityNotice}>
              <Text style={s.noticeIcon}>🔒</Text>
              <Text style={s.noticeText}>
                Important: Once submitted, customer reviews cannot be edited or modified. Your review will be saved as permanently read-only.
              </Text>
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={s.footer}>
            <Pressable
              disabled={submitting}
              onPress={onClose}
              style={s.secondaryBtn}
            >
              <Text style={s.secondaryBtnText}>Cancel</Text>
            </Pressable>

            <Pressable
              disabled={isExpired || submitting}
              onPress={handleSubmit}
              style={[
                s.submitBtn,
                (isExpired || submitting) && s.submitBtnDisabled
              ]}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={s.submitBtnText}>
                  {isExpired ? 'Review Expired' : 'Submit Review'}
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
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end'
  },
  modalContainer: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '90%',
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  headerEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.gold,
    marginBottom: 2
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border
  },
  closeBtnText: {
    fontSize: 16,
    color: colors.muted,
    fontWeight: '700'
  },
  body: {
    paddingHorizontal: 22,
    paddingTop: 16
  },
  targetInfoCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14
  },
  targetSalonName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink
  },
  targetService: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gold,
    marginTop: 2
  },
  targetDate: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 4
  },
  timerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 16,
    gap: 10
  },
  timerIcon: {
    fontSize: 22
  },
  timerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E'
  },
  timerCountdown: {
    fontSize: 14,
    fontWeight: '800',
    color: '#B45309',
    marginTop: 1
  },
  expiredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginBottom: 16,
    gap: 10
  },
  expiredIcon: {
    fontSize: 22
  },
  expiredTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#991B1B'
  },
  expiredSub: {
    fontSize: 11,
    color: '#B91C1C',
    marginTop: 1
  },
  section: {
    marginBottom: 18
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: 0.3,
    marginBottom: 6
  },
  charCount: {
    fontSize: 11,
    color: colors.muted
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4
  },
  starBtn: {
    padding: 4
  },
  starIcon: {
    fontSize: 36
  },
  starFilled: {
    color: '#F59E0B'
  },
  starEmpty: {
    color: '#D1D5DB'
  },
  ratingDescription: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.gold,
    marginTop: 6
  },
  textInput: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    fontSize: 14,
    color: colors.ink,
    minHeight: 100
  },
  immutabilityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: radius.sm,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 14
  },
  noticeIcon: {
    fontSize: 14
  },
  noticeText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: '#4B5563'
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 22,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  secondaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.muted
  },
  submitBtn: {
    flex: 2,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold
  },
  submitBtnDisabled: {
    opacity: 0.5,
    backgroundColor: '#9CA3AF'
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF'
  }
});
