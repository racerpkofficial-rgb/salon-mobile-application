import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { StatusBadge } from '../../components/StatusBadge';
import { Avatar } from '../../components/Avatar';
import { colors, radius } from '../../constants/theme';
import { AppointmentData, AppointmentStatus } from '../../types';

interface OwnerAppointmentHistoryScreenProps {
  appointments: AppointmentData[];
  onViewDetails: (appointment: AppointmentData) => void;
  onBack: () => void;
}

type FilterType = 'ALL' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';

export function OwnerAppointmentHistoryScreen({
  appointments,
  onViewDetails,
  onBack
}: OwnerAppointmentHistoryScreenProps) {
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [search, setSearch] = useState('');

  // Filter history records
  const historyList = useMemo(() => {
    return appointments.filter((app) => {
      // Exclude pending from history if needed, or include all
      if (filter !== 'ALL' && app.status !== filter) return false;

      if (search.trim()) {
        const term = search.toLowerCase();
        const cust = (app.customerId?.name || '').toLowerCase();
        const serv = (app.serviceId?.name || '').toLowerCase();
        return cust.includes(term) || serv.includes(term);
      }
      return true;
    });
  }, [appointments, filter, search]);

  const totalCompletedRevenue = useMemo(() => {
    return appointments
      .filter((a) => a.status === 'COMPLETED')
      .reduce((sum, a) => sum + (a.serviceId?.price || 0), 0);
  }, [appointments]);

  const completedCount = useMemo(
    () => appointments.filter((a) => a.status === 'COMPLETED').length,
    [appointments]
  );

  return (
    <View style={s.page}>
      {/* Top Header */}
      <View style={s.topBar}>
        <Pressable onPress={onBack} style={s.iconButton}>
          <Text style={s.backIcon}>←</Text>
        </Pressable>
        <View style={s.titleWrap}>
          <Text style={s.topTitle}>Appointment History</Text>
          <Text style={s.topSubtitle}>Full historical record and audit ledger</Text>
        </View>
      </View>

      {/* KPI Cards Row */}
      <View style={s.kpiRow}>
        <View style={s.kpiCard}>
          <Text style={s.kpiLabel}>Total Completed</Text>
          <Text style={s.kpiVal}>{completedCount}</Text>
        </View>
        <View style={s.kpiCard}>
          <Text style={s.kpiLabel}>Earned Revenue</Text>
          <Text style={[s.kpiVal, s.kpiGold]}>₹{totalCompletedRevenue}</Text>
        </View>
      </View>

      {/* Search Input */}
      <View style={s.searchWrap}>
        <TextInput
          style={s.searchInput}
          placeholder="🔍 Search client or service name..."
          placeholderTextColor="#999"
          value={search}
          onChangeText={setSearch}
        />
        {!!search && (
          <Pressable onPress={() => setSearch('')} style={s.clearBtn}>
            <Text style={s.clearText}>✕</Text>
          </Pressable>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={s.tabsWrap}>
        {(['ALL', 'COMPLETED', 'REJECTED', 'CANCELLED'] as FilterType[]).map((tab) => {
          const isActive = filter === tab;
          return (
            <Pressable
              key={tab}
              onPress={() => setFilter(tab)}
              style={[s.tabItem, isActive && s.tabItemActive]}
            >
              <Text style={[s.tabText, isActive && s.tabTextActive]}>{tab}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Appointments List */}
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {historyList.length === 0 ? (
          <View style={s.emptyWrap}>
            <Text style={s.emptyIcon}>📂</Text>
            <Text style={s.emptyTitle}>No Records Found</Text>
            <Text style={s.emptySubtitle}>No appointment entries match the current filter or search criteria.</Text>
          </View>
        ) : (
          historyList.map((app, index) => {
            const customerName = app.customerId?.name || 'Customer';
            const customerAvatar = (app.customerId as any)?.avatar;
            const serviceName = app.serviceId?.name || 'Service';
            const price = app.serviceId?.price ?? 0;

            return (
              <Pressable
                key={`${app._id}-${index}`}
                onPress={() => onViewDetails(app)}
                style={s.historyCard}
              >
                <View style={s.cardTop}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <Avatar
                      uri={customerAvatar}
                      name={customerName}
                      size={38}
                      borderColor={colors.gold}
                      borderWidth={1}
                      backgroundColor={colors.goldSoft}
                      textColor={colors.ink}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={s.customerName}>{customerName}</Text>
                      <Text style={s.serviceTitle}>{serviceName}</Text>
                    </View>
                  </View>
                  <StatusBadge status={app.status} />
                </View>

                <View style={s.cardBottom}>
                  <Text style={s.timeInfo}>
                    📅 {app.appointmentDate} • ⏰ {app.startTime} – {app.endTime}
                  </Text>
                  <Text style={s.priceText}>₹{price}</Text>
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
  page: {
    flex: 1,
    backgroundColor: colors.surface
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  backIcon: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.ink
  },
  titleWrap: {
    flex: 1
  },
  topTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink
  },
  topSubtitle: {
    fontSize: 12,
    color: colors.slate,
    marginTop: 2
  },
  kpiRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  kpiCard: {
    flex: 1,
    backgroundColor: colors.sand,
    padding: 12,
    borderRadius: radius.md
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.slate,
    textTransform: 'uppercase',
    marginBottom: 4
  },
  kpiVal: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.ink
  },
  kpiGold: {
    color: colors.goldDark
  },
  searchWrap: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    position: 'relative'
  },
  searchInput: {
    backgroundColor: colors.sand,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.ink
  },
  clearBtn: {
    position: 'absolute',
    right: 28,
    top: 22
  },
  clearText: {
    fontSize: 14,
    color: colors.slate,
    fontWeight: '700'
  },
  tabsWrap: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8
  },
  tabItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.sand
  },
  tabItemActive: {
    backgroundColor: colors.ink
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.slate
  },
  tabTextActive: {
    color: '#FFFFFF'
  },
  content: {
    padding: 16,
    paddingBottom: 40
  },
  emptyWrap: {
    paddingVertical: 60,
    alignItems: 'center',
    paddingHorizontal: 30
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 6
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.slate,
    textAlign: 'center',
    lineHeight: 18
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10
  },
  customerName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink
  },
  serviceTitle: {
    fontSize: 13,
    color: colors.slate,
    marginTop: 2
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    paddingTop: 8
  },
  timeInfo: {
    fontSize: 12,
    color: colors.slate
  },
  priceText: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.goldDark
  }
});
