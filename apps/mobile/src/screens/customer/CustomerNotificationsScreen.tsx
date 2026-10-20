import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { colors, radius } from '../../constants/theme';
import { NotificationItem, NotificationType } from '../../types';

interface CustomerNotificationsScreenProps {
  notifications: NotificationItem[];
  loading: boolean;
  onRefresh: () => void;
  onMarkRead: (id: string) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onSelectNotification: (item: NotificationItem) => void;
  onBack: () => void;
}

export function CustomerNotificationsScreen({
  notifications,
  loading,
  onRefresh,
  onMarkRead,
  onMarkAllRead,
  onSelectNotification,
  onBack
}: CustomerNotificationsScreenProps) {
  const [filter, setFilter] = useState<'ALL' | 'UNREAD' | 'OFFERS' | 'BOOKINGS'>('ALL');
  const [markingAll, setMarkingAll] = useState(false);

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'OFFER_PUBLISHED':
        return '🔥';
      case 'BOOKING_ACCEPTED':
      case 'BOOKING_CONFIRMED':
        return '✓';
      case 'BOOKING_REJECTED':
        return '✕';
      case 'BOOKING_REQUEST_SENT':
        return '⏳';
      case 'APPOINTMENT_REMINDER':
        return '⏰';
      case 'SUBSCRIPTION_STATUS':
        return '💳';
      case 'SALON_APPROVED':
        return '🎉';
      case 'SALON_REJECTED':
        return '⚠️';
      default:
        return '🔔';
    }
  };

  const getIconBg = (type: NotificationType) => {
    switch (type) {
      case 'OFFER_PUBLISHED':
        return colors.goldSoft;
      case 'BOOKING_ACCEPTED':
      case 'BOOKING_CONFIRMED':
      case 'SALON_APPROVED':
        return colors.successSoft;
      case 'BOOKING_REJECTED':
      case 'SALON_REJECTED':
        return colors.dangerSoft;
      case 'BOOKING_REQUEST_SENT':
        return colors.surfaceWarm;
      case 'APPOINTMENT_REMINDER':
        return colors.goldLight;
      default:
        return colors.surfaceWarm;
    }
  };

  const handleItemPress = async (item: NotificationItem) => {
    if (!item.isRead) {
      void onMarkRead(item._id || item.id || '');
    }
    onSelectNotification(item);
  };

  const handleMarkAll = async () => {
    setMarkingAll(true);
    try {
      await onMarkAllRead();
    } finally {
      setMarkingAll(false);
    }
  };

  const filteredList = notifications.filter((n) => {
    if (filter === 'UNREAD') return !n.isRead;
    if (filter === 'OFFERS') return n.type === 'OFFER_PUBLISHED';
    if (filter === 'BOOKINGS')
      return (
        n.type === 'BOOKING_ACCEPTED' ||
        n.type === 'BOOKING_CONFIRMED' ||
        n.type === 'BOOKING_REJECTED' ||
        n.type === 'BOOKING_REQUEST_SENT' ||
        n.type === 'APPOINTMENT_REMINDER'
      );
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <View style={s.page}>
      {/* Header Bar */}
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backBtn}>
          <Text style={s.backText}>← Back</Text>
        </Pressable>
        <View style={s.headerTitleWrap}>
          <Text style={s.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={s.headerBadge}>
              <Text style={s.headerBadgeText}>{unreadCount} new</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 ? (
          <Pressable disabled={markingAll} onPress={handleMarkAll} style={s.markAllBtn}>
            <Text style={s.markAllText}>{markingAll ? '...' : 'Mark all read'}</Text>
          </Pressable>
        ) : (
          <Pressable onPress={onRefresh} style={s.markAllBtn}>
            <Text style={s.markAllText}>↻ Refresh</Text>
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Filter Chips */}
        <View style={s.filterRow}>
          {(['ALL', 'UNREAD', 'OFFERS', 'BOOKINGS'] as const).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setFilter(tab)}
              style={[s.filterPill, filter === tab && s.filterPillActive]}
            >
              <Text style={[s.filterPillText, filter === tab && s.filterPillTextActive]}>
                {tab === 'ALL'
                  ? `All (${notifications.length})`
                  : tab === 'UNREAD'
                  ? `Unread (${unreadCount})`
                  : tab === 'OFFERS'
                  ? '🔥 Offers'
                  : '📅 Bookings'}
              </Text>
            </Pressable>
          ))}
        </View>

        {loading ? (
          <View style={s.centerWrap}>
            <ActivityIndicator size="large" color={colors.gold} />
            <Text style={s.loadingText}>Fetching notification history...</Text>
          </View>
        ) : filteredList.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyIcon}>🔔</Text>
            <Text style={s.emptyTitle}>No Notifications</Text>
            <Text style={s.emptyBody}>
              {filter === 'UNREAD'
                ? "You're all caught up! No unread messages."
                : filter === 'OFFERS'
                ? 'No promotional offers published yet.'
                : 'Your booking updates, salon offers, and reminders will appear here.'}
            </Text>
          </View>
        ) : (
          filteredList.map((item, index) => {
            const icon = getNotificationIcon(item.type);
            const iconBg = getIconBg(item.type);
            const isOffer = item.type === 'OFFER_PUBLISHED';
            const dateStr = item.createdAt
              ? new Date(item.createdAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit'
                })
              : '';

            return (
              <Pressable
                key={`${item._id || item.id}-${index}`}
                onPress={() => handleItemPress(item)}
                style={[s.notifCard, !item.isRead && s.notifCardUnread]}
              >
                <View style={[s.iconBox, { backgroundColor: iconBg }]}>
                  <Text style={s.iconText}>{icon}</Text>
                </View>

                <View style={s.bodyWrap}>
                  <View style={s.titleRow}>
                    <Text style={[s.notifTitle, !item.isRead && s.notifTitleBold]}>
                      {item.title}
                    </Text>
                    {!item.isRead && <View style={s.unreadDot} />}
                  </View>

                  <Text style={s.notifMessage}>{item.message}</Text>

                  <View style={s.footerRow}>
                    <Text style={s.notifTime}>{dateStr}</Text>
                    {isOffer ? (
                      item.isOfferExpired ? (
                        <Text style={[s.actionLink, { color: colors.muted, fontWeight: '600' }]}>Offer Expired</Text>
                      ) : (
                        <Text style={s.actionLink}>View Offer →</Text>
                      )
                    ) : item.type.includes('BOOKING') ? (
                      <Text style={s.actionLink}>View Booking →</Text>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,

    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  backBtn: { paddingVertical: 6, paddingRight: 8 },
  backText: { color: colors.gold, fontSize: 13, fontWeight: '700' },
  headerTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.ink },
  headerBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill
  },
  headerBadgeText: { fontSize: 11, fontWeight: '800', color: '#B45309' },
  markAllBtn: { paddingVertical: 6, paddingLeft: 8 },
  markAllText: { fontSize: 12, fontWeight: '700', color: colors.gold },

  content: { padding: 18, paddingBottom: 40 },
  filterRow: { flexDirection: 'row', marginBottom: 16, gap: 8 },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  filterPillActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  filterPillText: { fontSize: 12, fontWeight: '700', color: colors.muted },
  filterPillTextActive: { color: '#FFFFFF' },

  centerWrap: { padding: 40, alignItems: 'center' },
  loadingText: { color: colors.muted, marginTop: 12, fontSize: 13 },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 20
  },
  emptyIcon: { fontSize: 36, marginBottom: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.ink },
  emptyBody: {
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18
  },

  notifCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1
  },
  notifCardUnread: {
    borderColor: colors.gold,
    backgroundColor: '#FFFDF9'
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14
  },
  iconText: { fontSize: 20 },
  bodyWrap: { flex: 1 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  notifTitle: { fontSize: 14, fontWeight: '700', color: colors.ink, flex: 1 },
  notifTitleBold: { fontWeight: '800', color: '#111827' },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gold,
    marginLeft: 6
  },
  notifMessage: { fontSize: 13, color: colors.muted, lineHeight: 18, marginTop: 4 },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8
  },
  notifTime: { fontSize: 11, color: '#9CA3AF' },
  actionLink: { fontSize: 11, fontWeight: '700', color: colors.gold }
});
