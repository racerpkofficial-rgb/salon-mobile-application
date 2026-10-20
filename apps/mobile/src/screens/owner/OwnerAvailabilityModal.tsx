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
import { colors, radius } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { dialogService } from '../../services/dialog.service';
import { salonService } from '../../services/salon.service';
import { SalonOwnerData, WorkingHours } from '../../types';

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

interface OwnerAvailabilityModalProps {
  visible: boolean;
  salon: SalonOwnerData | null;
  onClose: () => void;
  onSaved: (updatedHours: WorkingHours, updatedUnavailable: string[]) => void;
}

export function OwnerAvailabilityModal({
  visible,
  salon,
  onClose,
  onSaved
}: OwnerAvailabilityModalProps) {
  const { token } = useAuth();

  const [openTime, setOpenTime] = useState('09:00');
  const [closeTime, setCloseTime] = useState('20:00');
  const [slotInterval, setSlotInterval] = useState(30);
  const [daysOpen, setDaysOpen] = useState<string[]>(DAYS_OF_WEEK);
  const [unavailableDates, setUnavailableDates] = useState<string[]>([]);
  const [newDateInput, setNewDateInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && token) {
      void loadAvailability();
    }
  }, [visible, token]);

  const loadAvailability = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await salonService.getSalonAvailability(token);
      if (res.workingHours) {
        setOpenTime(res.workingHours.openTime || '09:00');
        setCloseTime(res.workingHours.closeTime || '20:00');
        setSlotInterval(res.workingHours.slotIntervalMinutes || 30);
        setDaysOpen(res.workingHours.daysOpen || DAYS_OF_WEEK);
      }
      setUnavailableDates(res.unavailableDates || []);
    } catch {
      // Fallback to salon props
      if (salon?.workingHours) {
        setOpenTime(salon.workingHours.openTime || '09:00');
        setCloseTime(salon.workingHours.closeTime || '20:00');
        setSlotInterval(salon.workingHours.slotIntervalMinutes || 30);
        setDaysOpen(salon.workingHours.daysOpen || DAYS_OF_WEEK);
      }
      setUnavailableDates(salon?.unavailableDates || []);
    } finally {
      setLoading(false);
    }
  };

  const toggleDay = (day: string) => {
    setDaysOpen((prev) => {
      if (prev.includes(day)) {
        if (prev.length <= 1) {
          dialogService.showWarning('Operating Days', 'At least one operating day must remain active.');
          return prev;
        }
        return prev.filter((d) => d !== day);
      } else {
        return [...prev, day];
      }
    });
  };

  const handleAddUnavailableDate = () => {
    const trimmed = newDateInput.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      dialogService.showError('Invalid Format', 'Please enter date in YYYY-MM-DD format (e.g. 2026-12-25).');
      return;
    }

    if (unavailableDates.includes(trimmed)) {
      dialogService.showWarning('Duplicate Date', 'This date is already marked as unavailable.');
      return;
    }

    setUnavailableDates((prev) => [...prev, trimmed].sort());
    setNewDateInput('');
  };

  const handleRemoveDate = (date: string) => {
    setUnavailableDates((prev) => prev.filter((d) => d !== date));
  };

  const handleSave = async () => {
    if (!token) return;

    // Validate times
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(openTime)) {
      dialogService.showError('Validation Error', 'Open time must be in HH:mm format (e.g. 09:00).');
      return;
    }

    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(closeTime)) {
      dialogService.showError('Validation Error', 'Close time must be in HH:mm format (e.g. 20:00).');
      return;
    }

    if (openTime >= closeTime) {
      dialogService.showError('Validation Error', 'Closing time must be later than opening time.');
      return;
    }

    const payloadWorkingHours: WorkingHours = {
      openTime,
      closeTime,
      slotIntervalMinutes: slotInterval,
      daysOpen
    };

    setSaving(true);
    try {
      const res = await salonService.updateSalonAvailability(token, {
        workingHours: payloadWorkingHours,
        unavailableDates
      });

      onSaved(res.workingHours, res.unavailableDates);
      dialogService.showSuccess('Preferences Saved', 'Salon operating hours and blackout dates have been updated.', {
        onConfirm: onClose
      });
    } catch (e) {
      dialogService.showError('Save Failed', e instanceof Error ? e.message : 'Could not save availability.');
    } finally {
      setSaving(false);
    }
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
              <Text style={s.eyebrow}>SALON OPERATING PREFERENCES</Text>
              <Text style={s.title}>Availability & Hours</Text>
              <Text style={s.subtitle}>
                Set opening times, operating days, and holiday blackout dates.
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={s.closeBtn}>
              <Text style={s.closeText}>✕</Text>
            </Pressable>
          </View>

          {loading ? (
            <View style={s.centerWrap}>
              <ActivityIndicator size="large" color={colors.gold} />
              <Text style={s.loadingText}>Loading current schedule...</Text>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={s.content}
            >
              {/* Working Hours Section */}
              <Text style={s.sectionTitle}>DAILY OPERATING HOURS</Text>

              <View style={s.timeRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Opening Time (HH:mm)</Text>
                  <TextInput
                    style={s.input}
                    value={openTime}
                    onChangeText={setOpenTime}
                    placeholder="09:00"
                    placeholderTextColor={colors.subtle}
                  />
                </View>

                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.fieldLabel}>Closing Time (HH:mm)</Text>
                  <TextInput
                    style={s.input}
                    value={closeTime}
                    onChangeText={setCloseTime}
                    placeholder="20:00"
                    placeholderTextColor={colors.subtle}
                  />
                </View>
              </View>

              {/* Slot Duration Interval */}
              <Text style={s.fieldLabel}>Booking Slot Interval</Text>
              <View style={s.intervalRow}>
                {[15, 30, 45, 60].map((interval) => (
                  <Pressable
                    key={interval}
                    onPress={() => setSlotInterval(interval)}
                    style={[
                      s.intervalChip,
                      slotInterval === interval && s.intervalChipActive
                    ]}
                  >
                    <Text
                      style={[
                        s.intervalChipText,
                        slotInterval === interval && s.intervalChipTextActive
                      ]}
                    >
                      {interval} mins
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Operating Days */}
              <Text style={[s.sectionTitle, { marginTop: 18 }]}>OPERATING DAYS</Text>
              <View style={s.daysWrap}>
                {DAYS_OF_WEEK.map((day) => {
                  const isOpen = daysOpen.includes(day);
                  return (
                    <Pressable
                      key={day}
                      onPress={() => toggleDay(day)}
                      style={[s.dayChip, isOpen && s.dayChipActive]}
                    >
                      <Text style={[s.dayChipText, isOpen && s.dayChipTextActive]}>
                        {isOpen ? `✓ ${day.slice(0, 3)}` : `✕ ${day.slice(0, 3)}`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Blackout / Unavailable Dates */}
              <Text style={[s.sectionTitle, { marginTop: 18 }]}>
                HOLIDAY & BLACKOUT DATES ({unavailableDates.length})
              </Text>
              <Text style={s.blackoutDesc}>
                Add specific dates when your salon will be closed (e.g. holidays, renovations).
              </Text>

              <View style={s.addDateRow}>
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  value={newDateInput}
                  onChangeText={setNewDateInput}
                  placeholder="YYYY-MM-DD (e.g. 2026-12-25)"
                  placeholderTextColor={colors.subtle}
                />
                <Pressable onPress={handleAddUnavailableDate} style={s.addDateBtn}>
                  <Text style={s.addDateBtnText}>+ Add Date</Text>
                </Pressable>
              </View>

              {unavailableDates.length > 0 ? (
                <View style={s.datesList}>
                  {unavailableDates.map((date) => (
                    <View key={date} style={s.dateTag}>
                      <Text style={s.dateTagText}>🚫 {date}</Text>
                      <Pressable
                        onPress={() => handleRemoveDate(date)}
                        hitSlop={8}
                        style={s.dateRemoveBtn}
                      >
                        <Text style={s.dateRemoveText}>✕</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={s.emptyDatesBox}>
                  <Text style={s.emptyDatesText}>No blackout dates currently scheduled.</Text>
                </View>
              )}

              {/* Save Button */}
              <Pressable
                onPress={handleSave}
                disabled={saving}
                style={[s.saveBtn, saving && { opacity: 0.7 }]}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={s.saveBtnText}>Save Availability Preferences</Text>
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
    maxHeight: '92%',
    minHeight: '70%',
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
  centerWrap: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: colors.muted
  },
  content: {
    paddingVertical: 16
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.gold,
    letterSpacing: 1.2,
    marginBottom: 8
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 6
  },
  timeRow: {
    flexDirection: 'row',
    marginBottom: 14
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.ink
  },
  intervalRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8
  },
  intervalChip: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 9,
    alignItems: 'center'
  },
  intervalChipActive: {
    backgroundColor: colors.espresso,
    borderColor: colors.espresso
  },
  intervalChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.subtle
  },
  intervalChipTextActive: {
    color: '#FFFFFF'
  },
  daysWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6
  },
  dayChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  dayChipActive: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32'
  },
  dayChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted
  },
  dayChipTextActive: {
    color: '#FFFFFF'
  },
  blackoutDesc: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 10,
    lineHeight: 18
  },
  addDateRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginBottom: 10
  },
  addDateBtn: {
    backgroundColor: colors.gold,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: radius.md
  },
  addDateBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12
  },
  datesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 6
  },
  dateTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: '#FFCDD2',
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6
  },
  dateTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C62828'
  },
  dateRemoveBtn: {
    marginLeft: 2
  },
  dateRemoveText: {
    fontSize: 12,
    color: '#C62828',
    fontWeight: '800'
  },
  emptyDatesBox: {
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: radius.md,
    alignItems: 'center',
    marginVertical: 4
  },
  emptyDatesText: {
    fontSize: 12,
    color: colors.subtle,
    fontStyle: 'italic'
  },
  saveBtn: {
    backgroundColor: colors.espresso,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: 22,
    marginBottom: 20
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14
  }
});
