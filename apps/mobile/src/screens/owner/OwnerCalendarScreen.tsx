import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { StatusBadge } from '../../components/StatusBadge';
import { colors, radius } from '../../constants/theme';
import { AppointmentData } from '../../types';

interface OwnerCalendarScreenProps {
  appointments: AppointmentData[];
  onViewDetails: (appointment: AppointmentData) => void;
  onBack: () => void;
}

export function OwnerCalendarScreen({
  appointments,
  onViewDetails,
  onBack
}: OwnerCalendarScreenProps) {
  // Generate dates for next 14 days
  const calendarDates = useMemo(() => {
    const list: { dateStr: string; dayName: string; dayNum: number }[] = [];
    const now = new Date();
    for (let i = -2; i < 14; i++) {
      const d = new Date();
      d.setDate(now.getDate() + i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      list.push({ dateStr, dayName, dayNum: d.getDate() });
    }
    return list;
  }, []);

  const todayStr = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Group appointments by date
  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, AppointmentData[]>();
    for (const app of appointments) {
      const existing = map.get(app.appointmentDate) || [];
      existing.push(app);
      map.set(app.appointmentDate, existing);
    }
    return map;
  }, [appointments]);

  const selectedDayAppointments = useMemo(() => {
    const list = appointmentsByDate.get(selectedDate) || [];
    return [...list].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [appointmentsByDate, selectedDate]);

  const projectedRevenue = selectedDayAppointments.reduce(
    (sum, a) => sum + (a.status !== 'REJECTED' && a.status !== 'CANCELLED' ? (a.serviceId?.price || 0) : 0),
    0
  );

  return (
    <View style={s.page}>
      {/* Top Header */}
      <View style={s.topBar}>
        <Pressable onPress={onBack} style={s.iconButton}>
          <Text style={s.backIcon}>←</Text>
        </Pressable>
        <View style={s.titleWrap}>
          <Text style={s.topTitle}>Salon Schedule</Text>
          <Text style={s.topSubtitle}>Interactive Calendar & Daily Agenda</Text>
        </View>
      </View>

      {/* Horizontal Date Picker Strip */}
      <View style={s.dateStrip}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.dateStripContent}
        >
          {calendarDates.map((item) => {
            const isSelected = item.dateStr === selectedDate;
            const isToday = item.dateStr === todayStr;
            const count = appointmentsByDate.get(item.dateStr)?.length || 0;

            return (
              <Pressable
                key={item.dateStr}
                onPress={() => setSelectedDate(item.dateStr)}
                style={[
                  s.datePill,
                  isSelected && s.datePillSelected,
                  isToday && !isSelected && s.datePillToday
                ]}
              >
                <Text style={[s.dayNameText, isSelected && s.dayNameTextSelected]}>
                  {item.dayName}
                </Text>
                <Text style={[s.dayNumText, isSelected && s.dayNumTextSelected]}>
                  {item.dayNum}
                </Text>
                {count > 0 ? (
                  <View style={[s.dotIndicator, isSelected && s.dotIndicatorSelected]}>
                    <Text style={[s.dotCountText, isSelected && s.dotCountTextSelected]}>
                      {count}
                    </Text>
                  </View>
                ) : (
                  <View style={s.emptyDot} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Selected Date Summary Header */}
      <View style={s.daySummaryBar}>
        <View>
          <Text style={s.daySummaryDate}>📅 {selectedDate}</Text>
          <Text style={s.daySummaryCount}>
            {selectedDayAppointments.length} appointment{selectedDayAppointments.length === 1 ? '' : 's'} scheduled
          </Text>
        </View>
        <View style={s.revenueChip}>
          <Text style={s.revenueChipLabel}>Projected</Text>
          <Text style={s.revenueChipVal}>₹{projectedRevenue}</Text>
        </View>
      </View>

      {/* Agenda Timeline List */}
      <ScrollView contentContainerStyle={s.agendaContent} showsVerticalScrollIndicator={false}>
        {selectedDayAppointments.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={s.emptyIcon}>☀️</Text>
            <Text style={s.emptyTitle}>Open Schedule</Text>
            <Text style={s.emptySubtitle}>
              No appointments are booked for {selectedDate}. All working hours are open for incoming customer bookings.
            </Text>
          </View>
        ) : (
          selectedDayAppointments.map((app, index) => {
            const customerName = app.customerId?.name || 'Customer';
            const serviceName = app.serviceId?.name || 'Service';
            const price = app.serviceId?.price ?? 0;
            const duration = app.serviceId?.duration || 30;

            return (
              <Pressable
                key={`${app._id}-${index}`}
                onPress={() => onViewDetails(app)}
                style={s.timelineCard}
              >
                {/* Time Column */}
                <View style={s.timeCol}>
                  <Text style={s.startTimeText}>{app.startTime}</Text>
                  <Text style={s.endTimeText}>{app.endTime}</Text>
                  <Text style={s.durationText}>{duration}m</Text>
                </View>

                {/* Vertical Divider Indicator */}
                <View
                  style={[
                    s.timelineBar,
                    app.status === 'CONFIRMED' && s.barConfirmed,
                    app.status === 'PENDING' && s.barPending,
                    app.status === 'COMPLETED' && s.barCompleted
                  ]}
                />

                {/* Details Column */}
                <View style={s.cardBody}>
                  <View style={s.cardTopRow}>
                    <Text style={s.customerName}>{customerName}</Text>
                    <StatusBadge status={app.status} />
                  </View>
                  <Text style={s.serviceTitle}>{serviceName}</Text>
                  <View style={s.cardBottomRow}>
                    <Text style={s.priceText}>₹{price}</Text>
                    <Text style={s.tapHint}>Tap to view →</Text>
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
  dateStrip: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  dateStripContent: {
    paddingHorizontal: 12,
    gap: 8
  },
  datePill: {
    width: 58,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center'
  },
  datePillSelected: {
    backgroundColor: colors.ink
  },
  datePillToday: {
    borderWidth: 1.5,
    borderColor: colors.gold
  },
  dayNameText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.slate,
    marginBottom: 4,
    textTransform: 'uppercase'
  },
  dayNameTextSelected: {
    color: '#E0E0E0'
  },
  dayNumText: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.ink,
    marginBottom: 4
  },
  dayNumTextSelected: {
    color: '#FFFFFF'
  },
  dotIndicator: {
    backgroundColor: colors.gold,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill
  },
  dotIndicatorSelected: {
    backgroundColor: '#FFFFFF'
  },
  dotCountText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  dotCountTextSelected: {
    color: colors.ink
  },
  emptyDot: {
    height: 14
  },
  daySummaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8F8F8',
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  daySummaryDate: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink
  },
  daySummaryCount: {
    fontSize: 12,
    color: colors.slate,
    marginTop: 2
  },
  revenueChip: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'flex-end'
  },
  revenueChipLabel: {
    fontSize: 10,
    color: colors.slate,
    textTransform: 'uppercase',
    fontWeight: '700'
  },
  revenueChipVal: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.goldDark
  },
  agendaContent: {
    padding: 16,
    paddingBottom: 40
  },
  emptyState: {
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
  timelineCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1
  },
  timeCol: {
    width: 65,
    justifyContent: 'center',
    alignItems: 'center'
  },
  startTimeText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink
  },
  endTimeText: {
    fontSize: 12,
    color: colors.slate
  },
  durationText: {
    fontSize: 11,
    color: colors.goldDark,
    fontWeight: '700',
    marginTop: 4
  },
  timelineBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginHorizontal: 12
  },
  barConfirmed: {
    backgroundColor: '#2A6F3F'
  },
  barPending: {
    backgroundColor: colors.gold
  },
  barCompleted: {
    backgroundColor: '#3730A3'
  },
  cardBody: {
    flex: 1
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  customerName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink
  },
  serviceTitle: {
    fontSize: 13,
    color: colors.slate,
    marginBottom: 8
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  priceText: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.goldDark
  },
  tapHint: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.slate
  }
});
