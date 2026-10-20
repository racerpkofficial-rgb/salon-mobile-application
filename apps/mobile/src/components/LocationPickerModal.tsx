import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { colors, radius } from '../constants/theme';
import { dialogService } from '../services/dialog.service';
import { locationService } from '../services/location.service';
import { CustomerLocationState } from '../utils/location';

interface LocationPickerModalProps {
  visible: boolean;
  currentLocation: CustomerLocationState;
  onClose: () => void;
  onSelectLocation: (loc: CustomerLocationState) => void;
}

const AVAILABLE_CITIES = [
  { city: 'All Cities', state: 'All Destinations', tag: 'Browse All' },
  { city: 'Tiruchirappalli', state: 'Tamil Nadu', tag: 'Featured' },
  { city: 'Bengaluru', state: 'Karnataka', tag: 'Hub' },
  { city: 'Chennai', state: 'Tamil Nadu' },
  { city: 'Mumbai', state: 'Maharashtra' },
  { city: 'Delhi', state: 'NCR' },
  { city: 'Hyderabad', state: 'Telangana' },
  { city: 'Coimbatore', state: 'Tamil Nadu' }
];

export function LocationPickerModal({
  visible,
  currentLocation,
  onClose,
  onSelectLocation
}: LocationPickerModalProps) {
  const [detectingGps, setDetectingGps] = useState(false);

  const handleUseGps = async () => {
    setDetectingGps(true);
    try {
      const loc = await locationService.getDeviceLocation();
      if (loc) {
        onSelectLocation(loc);
        onClose();
      } else {
        dialogService.showInfo(
          'Location Unavailable',
          'Could not access GPS coordinates. Please select your city manually from the list below.'
        );
      }
    } catch {
      dialogService.showError(
        'GPS Detection Error',
        'Unable to retrieve device location. Please select a city manually.'
      );
    } finally {
      setDetectingGps(false);
    }
  };

  const handleSelectCity = (cityName: string) => {
    if (cityName === 'All Cities' || cityName === 'All') {
      const loc: CustomerLocationState = {
        coords: null,
        label: 'All Destinations',
        isGps: false,
        city: 'All'
      };
      void locationService.persistLocation(loc);
      onSelectLocation(loc);
      onClose();
      return;
    }
    const loc = locationService.setManualCityLocation(cityName);
    onSelectLocation(loc);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={s.backdrop}>
        <View style={s.card}>
          {/* Header */}
          <View style={s.header}>
            <View>
              <Text style={s.eyebrow}>LOCATION SETTINGS</Text>
              <Text style={s.title}>Select Your Location</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={s.closeBtn}>
              <Text style={s.closeText}>✕</Text>
            </Pressable>
          </View>

          <Text style={s.explanation}>
            Straight-line distances to verified salons are calculated from your selected location.
          </Text>

          {/* GPS Button */}
          <Pressable
            style={[s.gpsBtn, currentLocation.isGps && s.gpsBtnActive]}
            onPress={handleUseGps}
            disabled={detectingGps}
          >
            {detectingGps ? (
              <ActivityIndicator size="small" color="#B08D57" />
            ) : (
              <Text style={s.gpsIcon}>🎯</Text>
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.gpsTitle}>Use Current Location (GPS)</Text>
              <Text style={s.gpsSubtitle}>
                {detectingGps ? 'Detecting device coordinates...' : 'High accuracy device position'}
              </Text>
            </View>
            {currentLocation.isGps && <Text style={s.checkMark}>✓</Text>}
          </Pressable>

          <View style={s.dividerRow}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>OR CHOOSE CITY</Text>
            <View style={s.dividerLine} />
          </View>

          {/* City Selection List */}
          <ScrollView style={s.cityList} showsVerticalScrollIndicator={false}>
            {AVAILABLE_CITIES.map((item) => {
              const isSelected =
                !currentLocation.isGps &&
                (item.city === 'All Cities'
                  ? currentLocation.city?.toLowerCase() === 'all' || currentLocation.label === 'All Destinations'
                  : currentLocation.city?.toLowerCase() === item.city.toLowerCase());

              return (
                <Pressable
                  key={item.city}
                  style={[s.cityRow, isSelected && s.cityRowActive]}
                  onPress={() => handleSelectCity(item.city)}
                >
                  <Text style={s.cityPin}>📍</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.cityName, isSelected && s.cityNameActive]}>
                      {item.city}
                    </Text>
                    <Text style={s.cityState}>{item.state} • Manual</Text>
                  </View>
                  {item.tag && !isSelected && (
                    <View style={s.cityTag}>
                      <Text style={s.cityTagText}>{item.tag}</Text>
                    </View>
                  )}
                  {isSelected && <Text style={s.checkMark}>✓</Text>}
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Footer note */}
          <View style={s.footer}>
            <Text style={s.footerNote}>
              Note: Distances are displayed as approximate straight-line metrics.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(48, 35, 31, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  card: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '85%',
    backgroundColor: '#FFFCF7',
    borderRadius: radius.xl || 24,
    padding: 22,
    borderWidth: 1,
    borderColor: '#EFE7DA',
    shadowColor: '#30231F',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B08D57',
    letterSpacing: 1.2
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#30231F',
    letterSpacing: -0.3,
    marginTop: 2
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F4EBDD',
    justifyContent: 'center',
    alignItems: 'center'
  },
  closeText: {
    fontSize: 14,
    color: '#30231F',
    fontWeight: '700'
  },
  explanation: {
    fontSize: 13,
    color: '#6E6259',
    lineHeight: 18,
    marginBottom: 16
  },
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4EBDD',
    borderRadius: radius.md || 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E8DFD0'
  },
  gpsBtnActive: {
    borderColor: '#B08D57',
    backgroundColor: '#FBF5EC'
  },
  gpsIcon: {
    fontSize: 20
  },
  gpsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#30231F'
  },
  gpsSubtitle: {
    fontSize: 12,
    color: '#8A7A6E',
    marginTop: 1
  },
  checkMark: {
    fontSize: 16,
    color: '#B08D57',
    fontWeight: '800'
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
    gap: 10
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#EFE7DA'
  },
  dividerText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#A89B8F',
    letterSpacing: 1
  },
  cityList: {
    maxHeight: 220
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.sm || 10,
    marginBottom: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0E8DC',
    gap: 10
  },
  cityRowActive: {
    borderColor: '#B08D57',
    backgroundColor: '#FDFBF7'
  },
  cityPin: {
    fontSize: 16
  },
  cityName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#30231F'
  },
  cityNameActive: {
    color: '#B08D57'
  },
  cityState: {
    fontSize: 11,
    color: '#8A7A6E'
  },
  cityTag: {
    backgroundColor: '#F4EBDD',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  cityTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B08D57'
  },
  footer: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EFE7DA'
  },
  footerNote: {
    fontSize: 11,
    color: '#A89B8F',
    textAlign: 'center',
    fontStyle: 'italic'
  }
});
