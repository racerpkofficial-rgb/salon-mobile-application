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
import { MapPin, X, AlertTriangle } from 'lucide-react-native';
import { colors, radius, typography } from '../constants/theme';
import { SalonLocationData, SalonLocationPicker } from './SalonLocationPicker';
import { dialogService } from '../services/dialog.service';
import { salonService } from '../services/salon.service';
import { SalonOwnerData } from '../types';
import { Coordinates, isValidCoordinate } from '../utils/location';

interface EditSalonLocationModalProps {
  visible: boolean;
  onClose: () => void;
  salon: SalonOwnerData | null;
  token?: string | null;
  onLocationSaved?: (updatedSalon: SalonOwnerData) => void;
}

export function EditSalonLocationModal({
  visible,
  onClose,
  salon,
  token,
  onLocationSaved
}: EditSalonLocationModalProps) {
  const [address, setAddress] = useState(salon?.address || '');
  const [city, setCity] = useState(salon?.city || '');
  const [locationData, setLocationData] = useState<SalonLocationData | null>(null);
  const [saving, setSaving] = useState(false);

  const initialCoords: Coordinates | null =
    salon?.location && isValidCoordinate(salon.location.latitude, salon.location.longitude)
      ? { latitude: salon.location.latitude, longitude: salon.location.longitude }
      : null;

  const handleSave = async () => {
    if (!token) {
      dialogService.showError('Authentication Required', 'Please sign in to update salon location.');
      return;
    }

    if (!locationData || !locationData.coordinates || !locationData.isConfirmedPremises) {
      dialogService.showWarning(
        'Confirmation Required',
        'Please verify and confirm your permanent physical salon coordinates before saving.'
      );
      return;
    }

    const cleanAddress = (locationData.address || address).trim();
    const cleanCity = (locationData.city || city).trim();

    if (cleanAddress.length < 3) {
      dialogService.showError('Invalid Address', 'Salon address must have at least 3 characters.');
      return;
    }
    if (cleanCity.length < 2) {
      dialogService.showError('Invalid City', 'City must have at least 2 characters.');
      return;
    }

    dialogService.showConfirm(
      'Confirm Relocation',
      `Are you sure you want to permanently update the physical premises location of "${salon?.salonName || 'your salon'}" to:\n\n📍 ${cleanAddress}, ${cleanCity}\n\nCustomers within 5 km and 10 km radius searches will discover your salon at this new location.`,
      async () => {
        setSaving(true);
        try {
          const res = await salonService.updateSalonLocation(token, {
            address: cleanAddress,
            city: cleanCity,
            location: locationData.coordinates,
            confirmedPremises: true
          });

          dialogService.showSuccess(
            'Location Updated',
            'Your salon premises location has been updated successfully.'
          );

          if (onLocationSaved && res.salon) {
            onLocationSaved(res.salon);
          }
          onClose();
        } catch (err: any) {
          dialogService.showError(
            'Update Failed',
            err?.message || 'Failed to update salon location. Please try again.'
          );
        } finally {
          setSaving(false);
        }
      },
      undefined,
      'Confirm & Save',
      'Cancel'
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        <View style={s.modalContainer}>
          {/* Header */}
          <View style={s.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MapPin size={20} color={colors.gold} />
              <Text style={s.title}>Edit Salon Location</Text>
            </View>
            <Pressable onPress={onClose} style={s.closeBtn} hitSlop={10}>
              <X size={20} color={colors.ink} />
            </Pressable>
          </View>

          <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
            {/* Caution Banner */}
            <View style={s.cautionCard}>
              <AlertTriangle size={18} color="#D97706" />
              <Text style={s.cautionText}>
                The registered coordinates represent your physical salon premises. They are stored permanently and will never change with your phone's live GPS movements.
              </Text>
            </View>

            {/* Current Registered Location Info */}
            <View style={s.currentLocationCard}>
              <Text style={s.currentLabel}>CURRENT REGISTERED LOCATION</Text>
              <Text style={s.currentAddress}>{salon?.address || 'No address specified'}</Text>
              <Text style={s.currentCity}>{salon?.city || ''}</Text>
              {initialCoords ? (
                <Text style={s.currentCoords}>
                  📍 Verified Permanent Location Active
                </Text>
              ) : (
                <Text style={s.currentCoordsMissing}>⚠️ No coordinates currently saved</Text>
              )}
            </View>

            {/* Permanent Location Picker Component */}
            <SalonLocationPicker
              initialAddress={salon?.address || ''}
              initialCity={salon?.city || ''}
              initialCoordinates={initialCoords}
              onLocationChange={setLocationData}
              required
            />
          </ScrollView>

          {/* Footer Actions */}
          <View style={s.footer}>
            <Pressable style={s.cancelBtn} onPress={onClose} disabled={saving}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[s.saveBtn, saving && s.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.ink} />
              ) : (
                <Text style={s.saveBtnText}>Save New Location</Text>
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
    maxHeight: '92%',
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.ink
  },
  closeBtn: {
    padding: 4
  },
  scroll: {
    maxHeight: 520
  },
  content: {
    padding: 20
  },
  cautionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(217, 119, 6, 0.08)',
    padding: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.3)',
    marginBottom: 16
  },
  cautionText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: '#D97706'
  },
  currentLocationCard: {
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16
  },
  currentLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.gold,
    letterSpacing: 1,
    marginBottom: 4
  },
  currentAddress: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
    marginBottom: 2
  },
  currentCity: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 4
  },
  currentCoords: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '600'
  },
  currentCoordsMissing: {
    fontSize: 11,
    color: colors.muted,
    fontStyle: 'italic'
  },
  inputGroup: {
    marginBottom: 12
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 6,
    letterSpacing: 0.5
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.ink
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink
  },
  saveBtn: {
    flex: 2,
    backgroundColor: colors.gold,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md
  },
  saveBtnDisabled: {
    opacity: 0.6
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink
  }
});
