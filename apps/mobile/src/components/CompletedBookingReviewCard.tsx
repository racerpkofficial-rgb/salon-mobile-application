import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { colors, radius } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { reviewService } from '../services/review.service';
import { AppointmentData, ReviewEligibility } from '../types';
import { ReviewModal } from './ReviewModal';

interface CompletedBookingReviewCardProps {
  appointment: AppointmentData;
  onRefreshParent?: () => void;
}

export function CompletedBookingReviewCard({
  appointment,
  onRefreshParent
}: CompletedBookingReviewCardProps) {
  const { token } = useAuth();
  const [eligibility, setEligibility] = useState<ReviewEligibility | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [remainingSecs, setRemainingSecs] = useState<number>(0);

  const fetchEligibility = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await reviewService.getReviewEligibility(token, appointment._id);
      setEligibility(res);

      if (res.reviewDeadline) {
        const diff = Math.floor((new Date(res.reviewDeadline).getTime() - Date.now()) / 1000);
        setRemainingSecs(Math.max(0, diff));
      } else {
        setRemainingSecs(0);
      }
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Could not check review status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchEligibility();
  }, [token, appointment._id]);

  // Live countdown ticker updated every second while active
  useEffect(() => {
    if (!eligibility?.reviewDeadline || eligibility.alreadyReviewed) return;

    const interval = setInterval(() => {
      const diff = Math.floor(
        (new Date(eligibility.reviewDeadline!).getTime() - Date.now()) / 1000
      );
      const nextVal = Math.max(0, diff);
      setRemainingSecs(nextVal);

      // If timer hit 0 just now, refresh eligibility from backend
      if (nextVal === 0 && remainingSecs > 0) {
        void fetchEligibility();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [eligibility?.reviewDeadline, eligibility?.alreadyReviewed, remainingSecs]);

  const formatDateTime = (iso?: string) => {
    if (!iso) return 'N/A';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch {
      return iso;
    }
  };

  const formatRemainingTime = (seconds: number) => {
    if (seconds <= 0) return '0s';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
    return `${mins}m ${secs}s`;
  };

  if (loading) {
    return (
      <View style={s.cardContainer}>
        <View style={s.loadingWrap}>
          <ActivityIndicator size="small" color={colors.gold} />
          <Text style={s.loadingText}>Checking review eligibility...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={s.cardContainer}>
        <Text style={s.errorText}>{error}</Text>
        <Pressable onPress={() => void fetchEligibility()} style={s.retryBtn}>
          <Text style={s.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  // CASE 1: Review already submitted -> Permanent Read-Only view
  if (eligibility?.alreadyReviewed || appointment.isReviewSubmitted) {
    const savedReview = eligibility?.review;
    return (
      <View style={s.cardContainer}>
        <View style={s.submittedHeader}>
          <View style={s.submittedPill}>
            <Text style={s.submittedPillText}>✓ Review Submitted</Text>
          </View>
          <Text style={s.readOnlyBadge}>Read-Only • Permanent Record</Text>
        </View>

        {savedReview ? (
          <View style={s.reviewDisplayBox}>
            <View style={s.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Text
                  key={star}
                  style={[
                    s.displayStar,
                    star <= savedReview.rating ? s.starGold : s.starGray
                  ]}
                >
                  ★
                </Text>
              ))}
              <Text style={s.ratingNum}>{savedReview.rating}.0 / 5</Text>
            </View>

            <Text style={s.commentText}>"{savedReview.comment}"</Text>

            <Text style={s.submittedDate}>
              Reviewed on {formatDateTime(savedReview.createdAt)}
            </Text>

            {/* Salon Owner Reply if present */}
            {savedReview.ownerReply && (
              <View style={s.ownerReplyBox}>
                <Text style={s.ownerReplyTitle}>Salon Response 💬</Text>
                <Text style={s.ownerReplyText}>"{savedReview.ownerReply}"</Text>
                {savedReview.ownerRepliedAt && (
                  <Text style={s.ownerReplyDate}>
                    {formatDateTime(savedReview.ownerRepliedAt)}
                  </Text>
                )}
              </View>
            )}
          </View>
        ) : (
          <Text style={s.submittedSummary}>
            Your review for this completed booking has been recorded.
          </Text>
        )}
      </View>
    );
  }

  // CASE 2: Expired 48-hour deadline
  const isExpired = remainingSecs <= 0 || eligibility?.canReview === false;
  if (isExpired) {
    return (
      <View style={[s.cardContainer, s.expiredCard]}>
        <View style={s.metaRow}>
          <Text style={s.metaLabel}>Completed:</Text>
          <Text style={s.metaVal}>{formatDateTime(eligibility?.completedAt || appointment.completedAt)}</Text>
        </View>
        {eligibility?.reviewDeadline && (
          <View style={s.metaRow}>
            <Text style={s.metaLabel}>Deadline:</Text>
            <Text style={s.metaVal}>{formatDateTime(eligibility.reviewDeadline)}</Text>
          </View>
        )}

        <View style={s.expiredNotice}>
          <Text style={s.expiredNoticeIcon}>⚠️</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.expiredNoticeTitle}>The 48-hour review period has expired</Text>
            <Text style={s.expiredNoticeSub}>
              Reviews must be submitted strictly within 48 hours of service completion.
            </Text>
          </View>
        </View>

        <Pressable disabled style={[s.actionBtn, s.actionBtnDisabled]}>
          <Text style={s.actionBtnDisabledText}>Review Window Expired</Text>
        </Pressable>
      </View>
    );
  }

  // CASE 3: Active & Eligible to review within 48 hours
  return (
    <View style={s.cardContainer}>
      <View style={s.metaRow}>
        <Text style={s.metaLabel}>Completed:</Text>
        <Text style={s.metaVal}>{formatDateTime(eligibility?.completedAt || appointment.completedAt)}</Text>
      </View>
      <View style={s.metaRow}>
        <Text style={s.metaLabel}>Review Deadline:</Text>
        <Text style={s.metaVal}>{formatDateTime(eligibility?.reviewDeadline)}</Text>
      </View>

      {/* Live Countdown Badge */}
      <View style={s.countdownBadge}>
        <Text style={s.countdownIcon}>⏳</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.countdownTitle}>Review Available</Text>
          <Text style={s.countdownTicker}>
            Review available for {formatRemainingTime(remainingSecs)}
          </Text>
        </View>
      </View>

      {/* Rate & Review Button */}
      <Pressable
        onPress={() => setModalVisible(true)}
        style={s.rateBtn}
      >
        <Text style={s.rateBtnText}>★ Rate & Review Salon</Text>
      </Pressable>

      {/* Interactive Review Submission Modal */}
      <ReviewModal
        visible={modalVisible}
        appointment={appointment}
        deadlineISO={eligibility?.reviewDeadline}
        onClose={() => setModalVisible(false)}
        onReviewSubmitted={() => {
          void fetchEligibility();
          onRefreshParent?.();
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#FAF7F2',
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EFE7DA',
    marginTop: 10
  },
  expiredCard: {
    backgroundColor: '#FFF7F7',
    borderColor: '#FED7D7'
  },
  loadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6
  },
  loadingText: {
    fontSize: 12,
    color: colors.muted
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    marginBottom: 6
  },
  retryBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  metaLabel: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '600'
  },
  metaVal: {
    fontSize: 12,
    color: colors.ink,
    fontWeight: '700'
  },
  countdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: radius.sm,
    padding: 10,
    marginTop: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 8
  },
  countdownIcon: {
    fontSize: 20
  },
  countdownTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E'
  },
  countdownTicker: {
    fontSize: 13,
    fontWeight: '800',
    color: '#B45309',
    marginTop: 1
  },
  rateBtn: {
    backgroundColor: colors.gold,
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2
  },
  rateBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  expiredNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: radius.sm,
    padding: 10,
    marginTop: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    gap: 8
  },
  expiredNoticeIcon: {
    fontSize: 20
  },
  expiredNoticeTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#991B1B'
  },
  expiredNoticeSub: {
    fontSize: 11,
    color: '#B91C1C',
    marginTop: 1
  },
  actionBtn: {
    borderRadius: radius.sm,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center'
  },
  actionBtnDisabled: {
    backgroundColor: '#E5E7EB'
  },
  actionBtnDisabledText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF'
  },
  submittedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  submittedPill: {
    backgroundColor: '#D1FAE5',
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  submittedPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065F46'
  },
  readOnlyBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.muted
  },
  reviewDisplayBox: {
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: 6
  },
  displayStar: {
    fontSize: 16
  },
  starGold: {
    color: '#F59E0B'
  },
  starGray: {
    color: '#D1D5DB'
  },
  ratingNum: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.ink,
    marginLeft: 6
  },
  commentText: {
    fontSize: 13,
    color: colors.ink,
    fontStyle: 'italic',
    lineHeight: 18,
    marginBottom: 6
  },
  submittedDate: {
    fontSize: 10,
    color: colors.muted
  },
  submittedSummary: {
    fontSize: 12,
    color: colors.muted,
    fontStyle: 'italic'
  },
  ownerReplyBox: {
    backgroundColor: '#F3F4F6',
    borderRadius: radius.sm,
    padding: 8,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold
  },
  ownerReplyTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 2
  },
  ownerReplyText: {
    fontSize: 12,
    color: '#374151',
    fontStyle: 'italic'
  },
  ownerReplyDate: {
    fontSize: 10,
    color: colors.muted,
    marginTop: 4
  }
});
