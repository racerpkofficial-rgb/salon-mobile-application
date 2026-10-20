import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { PrimaryButton, SecondaryButton } from '../components/Buttons';
import { Avatar } from '../components/Avatar';
import { colors, radius, typography } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { dialogService } from '../services/dialog.service';
import { reviewService, SalonReviewsResponse } from '../services/review.service';
import { ReviewData, Salon } from '../types';

interface PublicReviewsScreenProps {
  initialSalonId?: string;
  initialSalonName?: string;
  onBack: () => void;
  onSelectSalon?: (salonId: string) => void;
}

export function PublicReviewsScreen({
  initialSalonId,
  initialSalonName,
  onBack,
  onSelectSalon
}: PublicReviewsScreenProps) {
  const { user, token } = useAuth();

  // Salon-specific mode: When opened for a specific salon, lock reviews to that salon only
  const isSalonSpecific = Boolean(initialSalonId && String(initialSalonId).trim().length > 0);
  const [selectedSalonId, setSelectedSalonId] = useState<string | undefined>(initialSalonId);
  const effectiveSalonId = isSalonSpecific ? initialSalonId : selectedSalonId;
  const [selectedRating, setSelectedRating] = useState<number | undefined>(undefined);
  const [sortBy, setSortBy] = useState<'newest' | 'highest' | 'lowest'>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  // Data States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [pagination, setPagination] = useState<{
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1
  });
  const [summary, setSummary] = useState<{
    averageRating: number;
    totalReviews: number;
    distribution: Record<number, number>;
  }>({
    averageRating: 0,
    totalReviews: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  });

  // Owner Reply States
  const [replyingReviewId, setReplyingReviewId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  // Hardware Back Handler (Android)
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (replyingReviewId) {
        setReplyingReviewId(null);
        setReplyText('');
        return true;
      }
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [replyingReviewId, onBack]);

  // Fetch Reviews Function
  const fetchReviews = async (
    targetPage = 1,
    isRefresh = false,
    append = false
  ) => {
    if (isRefresh) {
      setRefreshing(true);
    } else if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const res = await reviewService.getPublicReviews({
        salonId: effectiveSalonId,
        rating: selectedRating,
        sortBy,
        search: searchQuery.trim() || undefined,
        page: targetPage,
        limit: 20
      });

      if (append) {
        setReviews((prev) => [...prev, ...(res.data || [])]);
      } else {
        setReviews(res.data || []);
      }

      if (res.pagination) {
        setPagination(res.pagination);
        setPage(res.pagination.page);
      }
      if (res.summary) {
        setSummary(res.summary);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load ratings and reviews.';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    setPage(1);
    void fetchReviews(1, false, false);
  }, [effectiveSalonId, selectedRating, sortBy, searchQuery]);

  const handleRefresh = () => {
    void fetchReviews(1, true, false);
  };

  const handleLoadMore = () => {
    if (loadingMore || page >= pagination.totalPages) return;
    void fetchReviews(page + 1, false, true);
  };

  // Check if current user is owner of the given salon
  const isOwnerOfSalon = (salonIdVal: any): boolean => {
    if (!user || user.role !== 'SALON_OWNER') return false;
    if (typeof salonIdVal === 'object' && salonIdVal !== null) {
      const ownerId = salonIdVal.ownerId?.toString?.() || salonIdVal.ownerId;
      if (ownerId && ownerId === user.id) return true;
    }
    return false;
  };

  // Submit Salon Owner Reply
  const handleSendReply = async (reviewId: string) => {
    if (!token) {
      dialogService.showInfo('Authentication Required', 'Please sign in to reply to reviews.');
      return;
    }
    const cleanReply = replyText.trim();
    if (!cleanReply) {
      dialogService.showError('Validation Error', 'Please enter a reply before submitting.');
      return;
    }

    setSubmittingReply(true);
    try {
      const res = await reviewService.replyToReview(token, reviewId, cleanReply);
      dialogService.showSuccess('Reply Saved 🎉', 'Your salon response has been posted publicly under the customer review.');

      // Update review locally
      setReviews((prev) =>
        prev.map((r) =>
          r._id === reviewId
            ? {
                ...r,
                ownerReply: cleanReply,
                ownerRepliedAt: new Date().toISOString()
              }
            : r
        )
      );

      setReplyingReviewId(null);
      setReplyText('');
    } catch (err) {
      dialogService.showError('Error Submitting Reply', err instanceof Error ? err.message : 'Could not submit reply.');
    } finally {
      setSubmittingReply(false);
    }
  };

  // Helper to extract display values
  const getSalonName = (r: ReviewData): string => {
    if (typeof r.salonId === 'object' && r.salonId?.salonName) {
      return r.salonId.salonName;
    }
    return initialSalonName || 'Book My Salon Partner';
  };

  const getServiceName = (r: ReviewData): string => {
    if (typeof r.appointmentId === 'object' && r.appointmentId?.serviceName) {
      return r.appointmentId.serviceName;
    }
    return 'Salon Service';
  };

  const getCustomerName = (r: ReviewData): string => {
    if (typeof r.customerId === 'object' && r.customerId?.name) {
      return r.customerId.name;
    }
    return 'Verified Customer';
  };

  return (
    <View style={s.page}>
      {/* 1. Header Bar */}
      <View style={s.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={onBack}
          style={s.backBtn}
        >
          <Text style={s.backIcon}>←</Text>
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle} numberOfLines={1}>
            {isSalonSpecific
              ? (initialSalonName || 'Ratings & Reviews')
              : (selectedSalonId && initialSalonName ? initialSalonName : 'Ratings & Reviews')}
          </Text>
          <Text style={s.headerSubtitle}>
            {isSalonSpecific
              ? 'Salon Verified Feedback'
              : (selectedSalonId ? 'Salon Verified Feedback' : 'Public Customer Reviews')}
          </Text>
        </View>
        {!isSalonSpecific && selectedSalonId ? (
          <Pressable
            onPress={() => setSelectedSalonId(undefined)}
            style={s.clearSalonFilterBtn}
          >
            <Text style={s.clearSalonFilterText}>All Salons</Text>
          </Pressable>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.gold}
            colors={[colors.gold]}
          />
        }
      >
        {/* 2. Rating & Review Summary Banner */}
        <View style={s.summaryCard}>
          <View style={s.summaryLeftCol}>
            <Text style={s.overallRatingNum}>{summary.averageRating > 0 ? summary.averageRating.toFixed(1) : '5.0'}</Text>
            <View style={s.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Text
                  key={star}
                  style={[
                    s.summaryStar,
                    star <= Math.round(summary.averageRating || 5) ? s.starActive : s.starInactive
                  ]}
                >
                  ★
                </Text>
              ))}
            </View>
            <Text style={s.summaryTotalCount}>
              {summary.totalReviews} {summary.totalReviews === 1 ? 'Review' : 'Total Reviews'}
            </Text>
            <View style={s.verifiedBadgePill}>
              <Text style={s.verifiedBadgeText}>✓ 100% Genuine Customers</Text>
            </View>
          </View>

          {/* Star Distribution Progress Bars */}
          <View style={s.distributionCol}>
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = summary.distribution[stars] || 0;
              const pct = summary.totalReviews > 0 ? Math.round((count / summary.totalReviews) * 100) : 0;
              return (
                <Pressable
                  key={stars}
                  onPress={() => setSelectedRating(selectedRating === stars ? undefined : stars)}
                  style={[
                    s.distRow,
                    selectedRating === stars && s.distRowSelected
                  ]}
                >
                  <Text style={s.distStarLabel}>{stars} ★</Text>
                  <View style={s.distBarTrack}>
                    <View style={[s.distBarFill, { width: `${pct}%` }]} />
                  </View>
                  <Text style={s.distCountLabel}>{count}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 3. Search Bar */}
        <View style={s.searchContainer}>
          <View style={s.searchBox}>
            <Text style={s.searchIcon}>⌕</Text>
            <TextInput
              style={s.searchInput}
              placeholder="Search comments, services, reviews..."
              placeholderTextColor={colors.subtle}
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} style={s.clearSearchBtn}>
                <Text style={s.clearSearchText}>✕</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* 4. Filters & Sorting Section */}
        <View style={s.filtersSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsRow}>
            {/* Star Filters */}
            <Pressable
              onPress={() => setSelectedRating(undefined)}
              style={[s.chip, selectedRating === undefined && s.chipActive]}
            >
              <Text style={[s.chipText, selectedRating === undefined && s.chipTextActive]}>
                All Ratings
              </Text>
            </Pressable>

            {[5, 4, 3, 2, 1].map((st) => (
              <Pressable
                key={st}
                onPress={() => setSelectedRating(selectedRating === st ? undefined : st)}
                style={[s.chip, selectedRating === st && s.chipActive]}
              >
                <Text style={[s.chipText, selectedRating === st && s.chipTextActive]}>
                  {st} ★
                </Text>
              </Pressable>
            ))}

            <View style={s.chipDivider} />

            {/* Sort Chips */}
            <Pressable
              onPress={() => setSortBy('newest')}
              style={[s.chip, sortBy === 'newest' && s.chipActive]}
            >
              <Text style={[s.chipText, sortBy === 'newest' && s.chipTextActive]}>
                Newest First
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSortBy('highest')}
              style={[s.chip, sortBy === 'highest' && s.chipActive]}
            >
              <Text style={[s.chipText, sortBy === 'highest' && s.chipTextActive]}>
                Highest Rating
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSortBy('lowest')}
              style={[s.chip, sortBy === 'lowest' && s.chipActive]}
            >
              <Text style={[s.chipText, sortBy === 'lowest' && s.chipTextActive]}>
                Lowest Rating
              </Text>
            </Pressable>
          </ScrollView>
        </View>

        {/* 5. Content Area: Loading / Error / Empty / List */}
        {loading && !refreshing ? (
          <View style={s.centerBox}>
            <ActivityIndicator size="large" color={colors.gold} />
            <Text style={s.loadingText}>Loading verified customer reviews...</Text>
          </View>
        ) : error ? (
          <View style={s.centerBox}>
            <Text style={s.errorIcon}>⚠️</Text>
            <Text style={s.errorTitle}>Could Not Load Reviews</Text>
            <Text style={s.errorBody}>{error}</Text>
            <View style={{ height: 16 }} />
            <PrimaryButton label="Retry" onPress={() => void fetchReviews(1)} />
          </View>
        ) : reviews.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyIcon}>⭐</Text>
            <Text style={s.emptyTitle}>No Reviews Found</Text>
            <Text style={s.emptyBody}>
              {searchQuery || selectedRating !== undefined
                ? 'No customer reviews match your selected filter criteria.'
                : 'Reviews are submitted by verified customers within 48 hours of completing their appointments.'}
            </Text>
            {(searchQuery || selectedRating !== undefined) && (
              <View style={{ marginTop: 14 }}>
                <SecondaryButton
                  label="Clear Filters"
                  onPress={() => {
                    setSearchQuery('');
                    setSelectedRating(undefined);
                    setSortBy('newest');
                  }}
                />
              </View>
            )}
          </View>
        ) : (
          <View style={s.reviewsList}>
            {reviews.map((r) => {
              const custName = getCustomerName(r);
              const salonName = getSalonName(r);
              const serviceName = getServiceName(r);
              const isOwner = isOwnerOfSalon(r.salonId);
              const isReplying = replyingReviewId === r._id;

              return (
                <View key={r._id} style={s.reviewCard}>
                  {/* Review Card Header */}
                  <View style={s.cardTopRow}>
                    <Avatar
                      uri={(r.customerId as any)?.avatar}
                      name={custName}
                      size={38}
                      borderColor={colors.gold}
                      borderWidth={1}
                      backgroundColor={colors.goldSoft}
                      textColor={colors.ink}
                    />

                    <View style={s.custInfoCol}>
                      <View style={s.nameBadgeRow}>
                        <Text style={s.custNameText}>{custName}</Text>
                        <View style={s.verifiedBookingBadge}>
                          <Text style={s.verifiedBookingText}>✓ Verified</Text>
                        </View>
                      </View>

                      {/* Star Rating & Date */}
                      <View style={s.ratingDateRow}>
                        <View style={s.miniStarsRow}>
                          {[1, 2, 3, 4, 5].map((st) => (
                            <Text
                              key={st}
                              style={[
                                s.miniStar,
                                st <= r.rating ? s.starActive : s.starInactive
                              ]}
                            >
                              ★
                            </Text>
                          ))}
                        </View>
                        <Text style={s.ratingScoreText}>{r.rating}.0</Text>
                        <Text style={s.bulletDot}>•</Text>
                        <Text style={s.dateText}>
                          {new Date(r.createdAt).toLocaleDateString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Salon & Service Badges */}
                  <View style={s.metaChipsRow}>
                    <View style={s.metaSalonBadge}>
                      <Text style={s.metaSalonText}>🏛️ {salonName}</Text>
                    </View>
                    <View style={s.metaServiceBadge}>
                      <Text style={s.metaServiceText}>✂ {serviceName}</Text>
                    </View>
                  </View>

                  {/* Customer Review Comment */}
                  <Text style={s.commentText}>"{r.comment}"</Text>

                  {/* Salon Owner Reply Section */}
                  {r.ownerReply ? (
                    <View style={s.ownerReplyContainer}>
                      <View style={s.ownerReplyHeader}>
                        <View style={s.ownerBadgeRow}>
                          <Text style={s.ownerReplyBadgeTitle}>Salon Owner Reply</Text>
                          <Text style={s.ownerBadgeVerified}>✓ Partner</Text>
                        </View>
                        {r.ownerRepliedAt && (
                          <Text style={s.ownerReplyDate}>
                            {new Date(r.ownerRepliedAt).toLocaleDateString('en-IN', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </Text>
                        )}
                      </View>
                      <Text style={s.ownerReplyBody}>"{r.ownerReply}"</Text>

                      {/* Edit Button if Current User is the Owner */}
                      {isOwner && !isReplying && (
                        <Pressable
                          onPress={() => {
                            setReplyingReviewId(r._id);
                            setReplyText(r.ownerReply || '');
                          }}
                          style={s.editReplyBtn}
                        >
                          <Text style={s.editReplyBtnText}>✏ Edit Reply</Text>
                        </Pressable>
                      )}
                    </View>
                  ) : null}

                  {/* Reply Input Box for Eligible Salon Owner */}
                  {isOwner && !r.ownerReply && !isReplying && (
                    <Pressable
                      onPress={() => {
                        setReplyingReviewId(r._id);
                        setReplyText('');
                      }}
                      style={s.replyToReviewTrigger}
                    >
                      <Text style={s.replyToReviewTriggerText}>💬 Reply to customer review</Text>
                    </Pressable>
                  )}

                  {/* Active Reply / Edit Box */}
                  {isReplying && (
                    <View style={s.replyFormBox}>
                      <Text style={s.replyFormLabel}>
                        {r.ownerReply ? 'Edit Salon Owner Reply' : 'Reply as Salon Owner'}
                      </Text>
                      <TextInput
                        style={s.replyInput}
                        multiline
                        numberOfLines={3}
                        maxLength={1000}
                        placeholder="Thank your customer and address their feedback..."
                        placeholderTextColor={colors.subtle}
                        value={replyText}
                        onChangeText={setReplyText}
                      />
                      <Text style={s.charCountText}>{replyText.length}/1000 characters</Text>

                      <View style={s.replyFormActions}>
                        <PrimaryButton
                          label={submittingReply ? 'Sending...' : 'Post Reply'}
                          loading={submittingReply}
                          disabled={submittingReply || !replyText.trim()}
                          onPress={() => void handleSendReply(r._id)}
                          style={{ flex: 1 }}
                        />
                        <View style={{ width: 10 }} />
                        <SecondaryButton
                          label="Cancel"
                          disabled={submittingReply}
                          onPress={() => {
                            setReplyingReviewId(null);
                            setReplyText('');
                          }}
                          style={{ flex: 1 }}
                        />
                      </View>
                    </View>
                  )}
                </View>
              );
            })}

            {/* Pagination Load More */}
            {pagination.page < pagination.totalPages && (
              <View style={s.loadMoreContainer}>
                <SecondaryButton
                  label={loadingMore ? 'Loading More...' : 'Load More Reviews'}
                  disabled={loadingMore}
                  onPress={handleLoadMore}
                />
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  backIcon: {
    fontSize: 20,
    color: colors.ink,
    fontWeight: '700'
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: 12
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.ink
  },
  headerSubtitle: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2
  },
  clearSalonFilterBtn: {
    backgroundColor: colors.goldSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.gold
  },
  clearSalonFilterText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gold
  },
  content: {
    padding: 16,
    paddingBottom: 40
  },

  // Summary Banner
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16
  },
  summaryLeftCol: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 16,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    minWidth: 110
  },
  overallRatingNum: {
    fontSize: 38,
    fontWeight: '800',
    color: colors.ink,
    lineHeight: 44
  },
  starsRow: {
    flexDirection: 'row',
    marginTop: 2
  },
  summaryStar: {
    fontSize: 15,
    marginHorizontal: 1
  },
  starActive: {
    color: '#F59E0B'
  },
  starInactive: {
    color: '#D1D5DB'
  },
  summaryTotalCount: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '600',
    marginTop: 6
  },
  verifiedBadgePill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radius.xs,
    marginTop: 8
  },
  verifiedBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#065F46'
  },

  // Distribution Bars
  distributionCol: {
    flex: 1,
    paddingLeft: 14,
    justifyContent: 'center',
    gap: 4
  },
  distRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    borderRadius: radius.xs
  },
  distRowSelected: {
    backgroundColor: colors.goldSoft
  },
  distStarLabel: {
    width: 26,
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink
  },
  distBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: radius.pill,
    overflow: 'hidden',
    marginHorizontal: 8
  },
  distBarFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: radius.pill
  },
  distCountLabel: {
    width: 20,
    fontSize: 10,
    fontWeight: '600',
    color: colors.muted,
    textAlign: 'right'
  },

  // Search Box
  searchContainer: {
    marginBottom: 12
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    height: 44
  },
  searchIcon: {
    fontSize: 18,
    color: colors.muted,
    marginRight: 8
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.ink
  },
  clearSearchBtn: {
    padding: 6
  },
  clearSearchText: {
    fontSize: 13,
    color: colors.muted
  },

  // Filter Chips
  filtersSection: {
    marginBottom: 16
  },
  chipsRow: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  chipActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted
  },
  chipTextActive: {
    color: '#FFFCF7',
    fontWeight: '700'
  },
  chipDivider: {
    width: 1,
    height: 20,
    backgroundColor: colors.border,
    marginHorizontal: 4
  },

  // Review Cards List
  reviewsList: {
    gap: 14
  },
  reviewCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: colors.border
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.gold
  },
  custInfoCol: {
    flex: 1
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  custNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink
  },
  verifiedBookingBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs
  },
  verifiedBookingText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#065F46'
  },
  ratingDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4
  },
  miniStarsRow: {
    flexDirection: 'row'
  },
  miniStar: {
    fontSize: 12
  },
  ratingScoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
    marginLeft: 2
  },
  bulletDot: {
    fontSize: 10,
    color: colors.muted,
    marginHorizontal: 2
  },
  dateText: {
    fontSize: 11,
    color: colors.muted
  },

  // Meta Badges
  metaChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    marginBottom: 10
  },
  metaSalonBadge: {
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.border
  },
  metaSalonText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink
  },
  metaServiceBadge: {
    backgroundColor: colors.goldSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.xs
  },
  metaServiceText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.gold
  },

  commentText: {
    fontSize: 13,
    color: colors.ink,
    lineHeight: 20,
    fontStyle: 'italic'
  },

  // Owner Reply
  ownerReplyContainer: {
    marginTop: 14,
    padding: 14,
    backgroundColor: '#FAF6F0',
    borderRadius: radius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold
  },
  ownerReplyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  ownerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  ownerReplyBadgeTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  ownerBadgeVerified: {
    fontSize: 9,
    fontWeight: '800',
    backgroundColor: colors.goldSoft,
    color: colors.gold,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.xs
  },
  ownerReplyDate: {
    fontSize: 10,
    color: colors.muted
  },
  ownerReplyBody: {
    fontSize: 12,
    color: colors.charcoal,
    lineHeight: 18
  },
  editReplyBtn: {
    alignSelf: 'flex-start',
    marginTop: 8
  },
  editReplyBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gold
  },

  // Reply Trigger
  replyToReviewTrigger: {
    marginTop: 12,
    paddingVertical: 8,
    alignItems: 'flex-start'
  },
  replyToReviewTriggerText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gold
  },

  // Reply Form Box
  replyFormBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border
  },
  replyFormLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 8
  },
  replyInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    padding: 10,
    fontSize: 13,
    color: colors.ink,
    minHeight: 70,
    textAlignVertical: 'top'
  },
  charCountText: {
    fontSize: 10,
    color: colors.muted,
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 10
  },
  replyFormActions: {
    flexDirection: 'row'
  },

  // State Boxes
  centerBox: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingText: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 12
  },
  errorIcon: {
    fontSize: 32,
    marginBottom: 8
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink
  },
  errorBody: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 20
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 30,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    marginTop: 10
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 10
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.ink
  },
  emptyBody: {
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    paddingHorizontal: 16
  },
  loadMoreContainer: {
    marginTop: 10,
    marginBottom: 20
  }
});
