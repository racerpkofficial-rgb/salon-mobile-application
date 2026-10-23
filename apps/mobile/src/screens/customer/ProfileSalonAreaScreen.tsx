import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import {
  ArrowLeft,
  MapPin,
  Crosshair,
  Check,
  AlertCircle,
  Home,
  Compass,
  Navigation
} from 'lucide-react-native';
import { colors, radius, typography } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/auth.service';
import { dialogService } from '../../services/dialog.service';
import { locationService } from '../../services/location.service';
import { CustomerLocationState } from '../../utils/location';

interface ProfileSalonAreaScreenProps {
  customerLocation?: CustomerLocationState;
  onUpdateCustomerLocation: (loc: CustomerLocationState) => void;
  onOpenLocationPicker?: () => void;
  onBack: () => void;
}

export function ProfileSalonAreaScreen({
  customerLocation,
  onUpdateCustomerLocation,
  onOpenLocationPicker,
  onBack
}: ProfileSalonAreaScreenProps) {
  const { user, token, updateUser } = useAuth();

  const [detectingGps, setDetectingGps] = useState(false);
  const [homeAddress, setHomeAddress] = useState(user?.address || '');
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressSavedSuccess, setAddressSavedSuccess] = useState(false);

  const [selectedRadius, setSelectedRadius] = useState<number>(user?.searchRadius || 10);
  const [savingRadius, setSavingRadius] = useState(false);
  const [radiusSavedSuccess, setRadiusSavedSuccess] = useState(false);

  // On-demand GPS Detection
  const handleDetectGps = async () => {
    setDetectingGps(true);
    try {
      const hasPermission = await locationService.requestPermission();
      if (!hasPermission) {
        dialogService.showWarning(
          'Location Permission Required',
          'Book My Salon could not access device GPS because location permission was denied. You can select your preferred city manually below without needing GPS permissions.'
        );
        return;
      }

      const gpsLoc = await locationService.getDeviceLocation();
      if (gpsLoc) {
        onUpdateCustomerLocation(gpsLoc);
        dialogService.showSuccess('GPS Location Active', `Successfully detected location: ${gpsLoc.label}`);
      } else {
        dialogService.showInfo('GPS Unavailable', 'Could not detect GPS coordinates. Please select your preferred city manually.');
      }
    } catch (e: any) {
      dialogService.showError('Location Error', e instanceof Error ? e.message : 'Failed to detect GPS location.');
    } finally {
      setDetectingGps(false);
    }
  };

  // Manual city selection
  const handleSelectCity = async (cityName: string) => {
    const canonical = cityName === 'All Cities' ? 'All' : cityName;
    const newLoc = locationService.setManualCityLocation(canonical);
    onUpdateCustomerLocation(newLoc);

    if (token) {
      try {
        const res = await authService.updateProfile(token, {
          city: canonical === 'All' ? undefined : canonical
        });
        if (res.user) {
          updateUser(res.user);
        }
      } catch {
        // quiet fallback
      }
    }
    dialogService.showSuccess('Preferred City Updated', `Discovery location set to: ${cityName}`);
  };

  // Save Home Address
  const handleSaveAddress = async () => {
    if (!token) return;
    const trimmed = homeAddress.trim();
    setSavingAddress(true);
    setAddressSavedSuccess(false);
    try {
      const res = await authService.updateProfile(token, {
        address: trimmed || undefined
      });
      if (res.user) {
        updateUser(res.user);
      }
      setAddressSavedSuccess(true);
      dialogService.showSuccess('Address Saved', 'Your home address preference has been saved.');
      setTimeout(() => setAddressSavedSuccess(false), 3000);
    } catch (e: any) {
      dialogService.showError('Save Failed', e instanceof Error ? e.message : 'Could not save home address.');
    } finally {
      setSavingAddress(false);
    }
  };

  // Select and save Search Radius
  const handleSelectRadius = async (radiusKm: number) => {
    setSelectedRadius(radiusKm);
    if (!token) return;
    setSavingRadius(true);
    setRadiusSavedSuccess(false);
    try {
      const res = await authService.updateProfile(token, {
        searchRadius: radiusKm
      });
      if (res.user) {
        updateUser(res.user);
      }
      setRadiusSavedSuccess(true);
      dialogService.showSuccess('Search Radius Saved', `Preferred salon search radius set to ${radiusKm} km.`);
      setTimeout(() => setRadiusSavedSuccess(false), 3000);
    } catch (e: any) {
      dialogService.showError('Update Failed', e instanceof Error ? e.message : 'Could not save search radius.');
    } finally {
      setSavingRadius(false);
    }
  };

  return (
    <View style={s.page}>
      {/* Header with Back button */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Return to Profile"
            onPress={onBack}
            style={s.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={20} color={colors.espresso} />
          </Pressable>
          <View style={{ marginLeft: 12 }}>
            <Text style={s.eyebrow}>LOCATION & AREA PREFERENCES</Text>
            <Text style={s.title}>My Salon Area</Text>
          </View>
        </View>

        <View style={s.radiusBadge}>
          <Text style={s.radiusBadgeText}>{selectedRadius} km</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.subtitle}>
          Configure your location preferences, home address, and discovery radius for tailored salon recommendations.
        </Text>

        {/* 1. Current GPS Location Status Card */}
        <View style={s.sectionBox}>
          <Text style={s.sectionLabel}>CURRENT LOCATION & GPS STATUS</Text>
          <View style={s.locationStatusRow}>
            <View style={s.gpsBadgeWrap}>
              <Text style={s.gpsBadgeText}>
                {customerLocation?.isGps ? '🎯 GPS DETECTED' : '📍 MANUAL / PREFERRED'}
              </Text>
            </View>
            <Text style={s.locationStatusLabel} numberOfLines={1}>
              {customerLocation?.label || user?.city || 'No location set'}
            </Text>
          </View>

          {customerLocation?.coords && (
            <Text style={s.coordsText}>
              Coordinates: {customerLocation.coords.latitude.toFixed(4)}, {customerLocation.coords.longitude.toFixed(4)}
            </Text>
          )}

          <Pressable
            onPress={handleDetectGps}
            disabled={detectingGps}
            style={s.detectGpsBtn}
          >
            {detectingGps ? (
              <ActivityIndicator size="small" color={colors.espresso} style={{ marginRight: 8 }} />
            ) : (
              <Crosshair size={16} color={colors.espresso} style={{ marginRight: 8 }} />
            )}
            <Text style={s.detectGpsBtnText}>
              {detectingGps ? 'Detecting Device GPS...' : 'Detect My GPS Location'}
            </Text>
          </Pressable>
          <Text style={s.permissionFootnote}>
            Location permission is only requested when you tap detect. If denied, you can freely pick your city manually below.
          </Text>
        </View>

        {/* 2. Preferred City Selection */}
        <View style={s.sectionBox}>
          <Text style={s.sectionLabel}>PREFERRED CITY FOR SALON DISCOVERY</Text>
          <Text style={s.sectionSub}>
            Select your preferred city to browse verified salons, services, and exclusive regional offers:
          </Text>

          <View style={s.cityChipsWrap}>
            {['Bengaluru', 'Tiruchirappalli', 'Chennai', 'Mumbai', 'Delhi', 'All Cities'].map((city) => {
              const currentCity = user?.city || customerLocation?.city || '';
              const isSelected =
                city === 'All Cities'
                  ? !currentCity || currentCity.toLowerCase() === 'all'
                  : currentCity.toLowerCase().includes(city.toLowerCase());

              return (
                <Pressable
                  key={city}
                  onPress={() => handleSelectCity(city)}
                  style={[s.cityChip, isSelected && s.cityChipActive]}
                >
                  <Text style={[s.cityChipText, isSelected && s.cityChipTextActive]}>
                    {city}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {onOpenLocationPicker && (
            <Pressable onPress={onOpenLocationPicker} style={s.otherCityBtn}>
              <Text style={s.otherCityBtnText}>Select Other City / Search More ▾</Text>
            </Pressable>
          )}
        </View>

        {/* 3. Saved Home / Delivery Address */}
        <View style={s.sectionBox}>
          <Text style={s.sectionLabel}>SAVED HOME ADDRESS</Text>
          <Text style={s.sectionSub}>
            Your home street address for booking confirmations, mobile services, and personalized care:
          </Text>

          <TextInput
            style={s.addressTextInput}
            value={homeAddress}
            onChangeText={setHomeAddress}
            placeholder="Enter street name, building, apartment, or landmark..."
            placeholderTextColor={colors.subtle}
            multiline
          />

          <Pressable
            onPress={handleSaveAddress}
            disabled={savingAddress}
            style={[s.saveAddressBtn, addressSavedSuccess && s.saveAddressBtnSuccess]}
          >
            {savingAddress ? (
              <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 6 }} />
            ) : addressSavedSuccess ? (
              <Check size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            ) : (
              <Home size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            )}
            <Text style={s.saveAddressBtnText}>
              {savingAddress ? 'Saving Address...' : addressSavedSuccess ? 'Address Saved ✓' : 'Save Home Address'}
            </Text>
          </Pressable>
        </View>

        {/* 4. Preferred Salon Search Radius */}
        <View style={[s.sectionBox, { marginBottom: 20 }]}>
          <Text style={s.sectionLabel}>PREFERRED SALON SEARCH RADIUS</Text>
          <Text style={s.sectionSub}>
            Show verified luxury salons within this maximum distance during nearby discovery:
          </Text>

          <View style={s.radiusOptionsRow}>
            {([5, 10, 25] as const).map((r) => {
              const isSelected = selectedRadius === r;
              return (
                <Pressable
                  key={r}
                  onPress={() => handleSelectRadius(r)}
                  disabled={savingRadius}
                  style={[s.radiusCard, isSelected && s.radiusCardActive]}
                >
                  <Text style={[s.radiusValue, isSelected && s.radiusValueActive]}>
                    {r} km
                  </Text>
                  <Text style={[s.radiusLabel, isSelected && s.radiusLabelActive]}>
                    {r === 5
                      ? 'Tight Neighborhood'
                      : r === 10
                        ? 'Standard City Area'
                        : 'Wide Regional Area'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={s.radiusPersistNote}>
            ✓ Your search radius preference is saved persistently to your profile and applies to Discover results without breaking GPS detection.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.goldDark
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.espresso,
    letterSpacing: -0.4,
    marginTop: 1
  },
  radiusBadge: {
    backgroundColor: colors.surfaceWarm,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border
  },
  radiusBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.espresso
  },
  content: {
    padding: 20,
    paddingBottom: 40
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 19,
    marginBottom: 16
  },
  sectionBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 2,
    shadowColor: colors.espresso,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4
  },
  sectionLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: colors.goldDark,
    marginBottom: 4
  },
  sectionSub: {
    fontSize: 12.5,
    color: colors.muted,
    marginBottom: 12,
    lineHeight: 18
  },
  locationStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    gap: 8
  },
  gpsBadgeWrap: {
    backgroundColor: '#EBF4FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#BEE3F8'
  },
  gpsBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2B6CB0'
  },
  locationStatusLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.espresso,
    flex: 1
  },
  coordsText: {
    fontSize: 11,
    color: colors.muted,
    fontFamily: 'monospace',
    marginBottom: 8
  },
  detectGpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceWarm,
    paddingVertical: 11,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 6
  },
  detectGpsBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.espresso
  },
  permissionFootnote: {
    fontSize: 11,
    color: colors.subtle,
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 15
  },
  cityChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8
  },
  cityChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.border
  },
  cityChipActive: {
    backgroundColor: colors.espresso,
    borderColor: colors.espresso
  },
  cityChipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.espresso
  },
  cityChipTextActive: {
    color: '#E6C98D'
  },
  otherCityBtn: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginTop: 4
  },
  otherCityBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.goldDark
  },
  addressTextInput: {
    backgroundColor: colors.surfaceWarm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    minHeight: 56,
    textAlignVertical: 'top',
    fontSize: 13,
    color: colors.espresso,
    marginBottom: 10
  },
  saveAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.espresso,
    paddingVertical: 11,
    borderRadius: radius.sm
  },
  saveAddressBtnSuccess: {
    backgroundColor: '#2E7D32'
  },
  saveAddressBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  radiusOptionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8
  },
  radiusCard: {
    flex: 1,
    backgroundColor: colors.surfaceWarm,
    borderRadius: radius.sm,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border
  },
  radiusCardActive: {
    backgroundColor: '#382622',
    borderColor: '#E6C98D'
  },
  radiusValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.espresso
  },
  radiusValueActive: {
    color: '#E6C98D'
  },
  radiusLabel: {
    fontSize: 9.5,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 2
  },
  radiusLabelActive: {
    color: '#D4C4B7'
  },
  radiusPersistNote: {
    fontSize: 11,
    color: colors.goldDark,
    fontWeight: '500',
    marginTop: 6,
    lineHeight: 16
  }
});
