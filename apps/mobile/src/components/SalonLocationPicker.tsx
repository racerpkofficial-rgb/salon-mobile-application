import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import {
  AlertCircle,
  Building2,
  Check,
  Compass,
  Crosshair,
  MapPin,
  Navigation,
  RefreshCw,
  Search
} from 'lucide-react-native';
import { colors, radius, typography } from '../constants/theme';
import { dialogService } from '../services/dialog.service';
import {
  GeocodedAddressResult,
  locationService
} from '../services/location.service';
import { Coordinates, isValidCoordinate, normalizeCityName } from '../utils/location';
import { SalonMapPreview } from './SalonMapPreview';

export interface SalonLocationData {
  address: string;
  city: string;
  state?: string;
  postalCode?: string;
  coordinates: Coordinates;
  isConfirmedPremises: boolean;
}

interface SalonLocationPickerProps {
  initialAddress?: string;
  initialCity?: string;
  initialCoordinates?: Coordinates | null;
  onLocationChange: (data: SalonLocationData | null) => void;
  required?: boolean;
}

type TabOption = 'CURRENT_LOCATION' | 'ENTER_ADDRESS';

export function SalonLocationPicker({
  initialAddress = '',
  initialCity = '',
  initialCoordinates = null,
  onLocationChange,
  required = true
}: SalonLocationPickerProps) {
  // Option selection tab
  const [activeTab, setActiveTab] = useState<TabOption>('CURRENT_LOCATION');

  // Option 2 Form state
  const [street, setStreet] = useState(initialAddress);
  const [area, setArea] = useState('');
  const [city, setCity] = useState(initialCity);
  const [stateVal, setStateVal] = useState('');
  const [postalCode, setPostalCode] = useState('');

  // Status / Loading
  const [detectingGps, setDetectingGps] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Ambiguous candidates state
  const [candidates, setCandidates] = useState<GeocodedAddressResult[]>([]);

  // Pending location awaiting explicit confirmation
  const [pendingLocation, setPendingLocation] = useState<{
    address: string;
    city: string;
    state?: string;
    postalCode?: string;
    coordinates: Coordinates;
  } | null>(null);

  // Confirmed location state
  const [confirmedLocation, setConfirmedLocation] = useState<SalonLocationData | null>(() => {
    if (
      initialCoordinates &&
      isValidCoordinate(initialCoordinates.latitude, initialCoordinates.longitude) &&
      (initialAddress.trim().length > 0 || initialCity.trim().length > 0)
    ) {
      return {
        address: initialAddress.trim(),
        city: initialCity.trim(),
        coordinates: initialCoordinates,
        isConfirmedPremises: true
      };
    }
    return null;
  });

  // Keep form in sync when parent initial props change
  useEffect(() => {
    if (initialAddress && !street) {
      setStreet(initialAddress);
    }
    if (initialCity && !city) {
      setCity(initialCity);
    }
  }, [initialAddress, initialCity]);

  // Option 1: Use Current Location
  const handleUseCurrentLocation = async () => {
    setDetectingGps(true);
    setErrorMessage(null);

    try {
      const res = await locationService.getSalonPremisesCurrentLocation();

      if (res.success && res.coords) {
        setPendingLocation({
          address: res.formattedAddress,
          city: res.city || city || '',
          state: res.state || stateVal || '',
          postalCode: res.postalCode || postalCode || '',
          coordinates: res.coords
        });
        setCandidates([]);
      } else {
        const errorMsg =
          res.message || 'Could not retrieve GPS coordinates. Please enter your salon address below.';
        setErrorMessage(errorMsg);

        if (res.errorType === 'PERMISSION_DENIED') {
          dialogService.showWarning(
            'Location Permission Required',
            'Location permission was denied. You can enter your salon address below instead.'
          );
          setActiveTab('ENTER_ADDRESS');
        } else if (res.errorType === 'SERVICES_DISABLED') {
          dialogService.showInfo(
            'GPS Disabled',
            'Location services (GPS) are turned off. Please turn on GPS or enter your salon address below.'
          );
          setActiveTab('ENTER_ADDRESS');
        } else {
          dialogService.showInfo('Location Unavailable', errorMsg);
          setActiveTab('ENTER_ADDRESS');
        }
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to detect current location.';
      setErrorMessage(msg);
      dialogService.showError('Location Error', msg);
    } finally {
      setDetectingGps(false);
    }
  };

  // Option 2: Geocode Typed Salon Address
  const handleGeocodeAddress = async () => {
    const cleanStreet = street.trim();
    const cleanCity = city.trim();

    if (!cleanStreet && !cleanCity) {
      setErrorMessage('Please enter your salon address and city.');
      dialogService.showWarning(
        'Address Required',
        'Please enter at least your salon street address and city.'
      );
      return;
    }

    setGeocoding(true);
    setErrorMessage(null);
    setCandidates([]);

    try {
      const res = await locationService.geocodeSalonAddress({
        street: cleanStreet,
        area: area.trim(),
        city: cleanCity,
        state: stateVal.trim(),
        postalCode: postalCode.trim()
      });

      if (res.success) {
        if (res.isMultiple) {
          // Multiple matching candidates found - require explicit user selection
          setCandidates(res.results);
        } else {
          // Exactly one unambiguous match
          const item = res.result;
          setPendingLocation({
            address: item.formattedAddress,
            city: item.city || cleanCity,
            state: item.state || stateVal,
            postalCode: item.postalCode || postalCode,
            coordinates: item.coordinates
          });
        }
      } else {
        setErrorMessage(res.message);
        dialogService.showInfo('Address Not Found', res.message);
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to resolve address coordinates.';
      setErrorMessage(msg);
      dialogService.showError('Geocoding Error', msg);
    } finally {
      setGeocoding(false);
    }
  };

  // Select candidate from ambiguous results list
  const handleSelectCandidate = (candidate: GeocodedAddressResult) => {
    setPendingLocation({
      address: candidate.formattedAddress,
      city: candidate.city || city,
      state: candidate.state || stateVal,
      postalCode: candidate.postalCode || postalCode,
      coordinates: candidate.coordinates
    });
    setCandidates([]);
  };

  // Location Confirmation: Explicit confirmation by owner
  const handleConfirmLocation = () => {
    if (!pendingLocation) return;

    const confirmed: SalonLocationData = {
      address: pendingLocation.address,
      city: normalizeCityName(pendingLocation.city) || pendingLocation.city,
      state: pendingLocation.state,
      postalCode: pendingLocation.postalCode,
      coordinates: pendingLocation.coordinates,
      isConfirmedPremises: true
    };

    setConfirmedLocation(confirmed);
    setPendingLocation(null);
    setCandidates([]);
    onLocationChange(confirmed);

    dialogService.showSuccess(
      'Location Confirmed',
      'Your physical salon premises location has been confirmed and locked.'
    );
  };

  // Change Location: Reset and choose again
  const handleChangeLocation = () => {
    setConfirmedLocation(null);
    setPendingLocation(null);
    setCandidates([]);
    setErrorMessage(null);
    onLocationChange(null);
  };

  // ==========================================
  // VIEW 1: Confirmed State
  // ==========================================
  if (confirmedLocation) {
    return (
      <View style={s.container}>
        <View style={s.headerRow}>
          <View style={s.titleRow}>
            <MapPin size={16} color={colors.gold} />
            <Text style={s.sectionTitle}>PERMANENT SALON LOCATION</Text>
          </View>
          <View style={s.confirmedBadge}>
            <Check size={12} color="#059669" />
            <Text style={s.confirmedBadgeText}>Confirmed</Text>
          </View>
        </View>

        <View style={s.confirmedCard}>
          {/* Map Preview */}
          <SalonMapPreview coordinates={confirmedLocation.coordinates} height={170} />

          {/* Resolved Address */}
          <View style={s.confirmedDetails}>
            <Text style={s.confirmedAddressLabel}>VERIFIED SALON PREMISES</Text>
            <Text style={s.confirmedAddressText}>{confirmedLocation.address}</Text>
            <Text style={s.confirmedCityText}>
              {confirmedLocation.city}
              {confirmedLocation.state ? `, ${confirmedLocation.state}` : ''}
              {confirmedLocation.postalCode ? ` - ${confirmedLocation.postalCode}` : ''}
            </Text>

            <View style={s.confirmedLockNote}>
              <Check size={13} color="#059669" />
              <Text style={s.confirmedLockText}>
                Saved as your permanent physical salon location for discovery and directions.
              </Text>
            </View>
          </View>

          {/* Change Location Action */}
          <Pressable
            style={s.changeBtn}
            onPress={handleChangeLocation}
            accessibilityRole="button"
            accessibilityLabel="Change Salon Location"
          >
            <RefreshCw size={13} color={colors.gold} />
            <Text style={s.changeBtnText}>Change Location</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ==========================================
  // VIEW 2: Confirmation Step (Pending verification)
  // ==========================================
  if (pendingLocation) {
    return (
      <View style={s.container}>
        <View style={s.headerRow}>
          <View style={s.titleRow}>
            <Compass size={16} color={colors.gold} />
            <Text style={s.sectionTitle}>CONFIRM SALON LOCATION</Text>
          </View>
          {required && (
            <View style={s.requiredBadge}>
              <Text style={s.requiredText}>* Required</Text>
            </View>
          )}
        </View>

        <Text style={s.helperText}>
          Please verify that the map preview pin and readable address accurately pinpoint your salon premises before confirming:
        </Text>

        {/* Map Preview with Pin */}
        <SalonMapPreview coordinates={pendingLocation.coordinates} height={190} />

        {/* Resolved readable address */}
        <View style={s.previewAddressCard}>
          <Text style={s.previewAddressLabel}>RESOLVED SALON ADDRESS</Text>
          <Text style={s.previewAddressText}>{pendingLocation.address}</Text>
          <Text style={s.previewCityText}>
            {pendingLocation.city}
            {pendingLocation.state ? `, ${pendingLocation.state}` : ''}
            {pendingLocation.postalCode ? ` - ${pendingLocation.postalCode}` : ''}
          </Text>

          <View style={s.lockNoticeRow}>
            <Text style={s.lockNoticeText}>
              📍 Stored as your permanent salon location. It will not change when your phone moves.
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={s.confirmActionsCol}>
          <Pressable
            style={s.confirmBtn}
            onPress={handleConfirmLocation}
            accessibilityRole="button"
            accessibilityLabel="Confirm Salon Location"
          >
            <Check size={16} color="#FFFFFF" />
            <Text style={s.confirmBtnText}>Confirm Salon Location</Text>
          </Pressable>

          <Pressable
            style={s.changeLocationAction}
            onPress={handleChangeLocation}
            accessibilityRole="button"
            accessibilityLabel="Change Location"
          >
            <RefreshCw size={14} color={colors.gold} />
            <Text style={s.changeLocationActionText}>Change Location</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ==========================================
  // VIEW 3: Multiple Matching Addresses (Ambiguity resolution)
  // ==========================================
  if (candidates.length > 0) {
    return (
      <View style={s.container}>
        <View style={s.headerRow}>
          <View style={s.titleRow}>
            <MapPin size={16} color={colors.gold} />
            <Text style={s.sectionTitle}>SELECT SALON ADDRESS</Text>
          </View>
        </View>

        <Text style={s.helperText}>
          Multiple matching locations were found. Please tap the one that corresponds to your exact salon premises:
        </Text>

        <View style={s.candidatesList}>
          {candidates.map((cand, idx) => (
            <Pressable
              key={cand.id || String(idx)}
              style={s.candidateCard}
              onPress={() => handleSelectCandidate(cand)}
              accessibilityRole="button"
              accessibilityLabel={`Select address ${cand.formattedAddress}`}
            >
              <View style={s.candidatePinWrap}>
                <MapPin size={18} color={colors.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.candidateAddressText}>{cand.formattedAddress}</Text>
                {cand.city ? (
                  <Text style={s.candidateCityText}>
                    {cand.city}
                    {cand.state ? `, ${cand.state}` : ''}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={s.retryAddressBtn}
          onPress={() => setCandidates([])}
          accessibilityRole="button"
          accessibilityLabel="Edit Address"
        >
          <Text style={s.retryAddressBtnText}>None of these / Edit Address</Text>
        </Pressable>
      </View>
    );
  }

  // ==========================================
  // VIEW 4: Main 2 Options View
  // ==========================================
  return (
    <View style={s.container}>
      <View style={s.headerRow}>
        <View style={s.titleRow}>
          <MapPin size={16} color={colors.gold} />
          <Text style={s.sectionTitle}>SALON PHYSICAL LOCATION</Text>
        </View>
        {required && (
          <View style={s.requiredBadge}>
            <Text style={s.requiredText}>* Required</Text>
          </View>
        )}
      </View>

      <Text style={s.helperText}>
        Set your salon's permanent business location. Customers will find your salon within 5 km and 10 km, and receive accurate driving directions:
      </Text>

      {/* Two Option Tabs */}
      <View style={s.tabRow}>
        <Pressable
          style={[s.tab, activeTab === 'CURRENT_LOCATION' && s.tabActive]}
          onPress={() => {
            setActiveTab('CURRENT_LOCATION');
            setErrorMessage(null);
          }}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'CURRENT_LOCATION' }}
        >
          <Crosshair
            size={14}
            color={activeTab === 'CURRENT_LOCATION' ? colors.ink : colors.muted}
          />
          <Text
            style={[
              s.tabText,
              activeTab === 'CURRENT_LOCATION' && s.tabTextActive
            ]}
          >
            Use Current Location
          </Text>
        </Pressable>

        <Pressable
          style={[s.tab, activeTab === 'ENTER_ADDRESS' && s.tabActive]}
          onPress={() => {
            setActiveTab('ENTER_ADDRESS');
            setErrorMessage(null);
          }}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'ENTER_ADDRESS' }}
        >
          <Building2
            size={14}
            color={activeTab === 'ENTER_ADDRESS' ? colors.ink : colors.muted}
          />
          <Text
            style={[
              s.tabText,
              activeTab === 'ENTER_ADDRESS' && s.tabTextActive
            ]}
          >
            Enter Salon Address
          </Text>
        </Pressable>
      </View>

      {/* OPTION 1: Use Current Location */}
      {activeTab === 'CURRENT_LOCATION' && (
        <View style={s.optionContent}>
          <View style={s.presenceNoticeBox}>
            <Text style={s.presenceNoticeIcon}>📍</Text>
            <Text style={s.presenceNoticeText}>
              Please select this option <Text style={{ fontWeight: '700', color: colors.ink }}>only if you are currently physically present at your salon premises</Text>.
            </Text>
          </View>

          <Pressable
            style={[s.primaryActionBtn, detectingGps && s.btnDisabled]}
            onPress={handleUseCurrentLocation}
            disabled={detectingGps}
            accessibilityRole="button"
            accessibilityLabel="Use Current Location"
          >
            {detectingGps ? (
              <>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={s.primaryActionBtnText}>Detecting Salon Location...</Text>
              </>
            ) : (
              <>
                <Navigation size={16} color="#FFFFFF" />
                <Text style={s.primaryActionBtnText}>Use Current Location</Text>
              </>
            )}
          </Pressable>

          {errorMessage && (
            <View style={s.errorCard}>
              <AlertCircle size={15} color={colors.danger} />
              <View style={{ flex: 1 }}>
                <Text style={s.errorCardText}>{errorMessage}</Text>
                <Pressable
                  onPress={() => setActiveTab('ENTER_ADDRESS')}
                  hitSlop={8}
                  style={{ marginTop: 4 }}
                >
                  <Text style={s.errorSwitchText}>👉 Switch to "Enter Salon Address"</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      )}

      {/* OPTION 2: Enter Salon Address */}
      {activeTab === 'ENTER_ADDRESS' && (
        <View style={s.optionContent}>
          <Text style={s.formSubHeader}>
            Enter the complete address of your salon premises:
          </Text>

          {/* Street Address */}
          <View style={s.inputWrap}>
            <Text style={s.inputLabel}>Street Address, Building, Shop No. *</Text>
            <TextInput
              style={s.textInput}
              value={street}
              onChangeText={setStreet}
              placeholder="e.g. Shop 12, 10th Cross, Royal Complex"
              placeholderTextColor={colors.subtle}
            />
          </View>

          {/* Area / Locality */}
          <View style={s.inputWrap}>
            <Text style={s.inputLabel}>Area / Locality / Landmark</Text>
            <TextInput
              style={s.textInput}
              value={area}
              onChangeText={setArea}
              placeholder="e.g. Cantonment / Near Central Bus Stand"
              placeholderTextColor={colors.subtle}
            />
          </View>

          {/* City & State Row */}
          <View style={s.twoColRow}>
            <View style={[s.inputWrap, { flex: 1.2 }]}>
              <Text style={s.inputLabel}>City *</Text>
              <TextInput
                style={s.textInput}
                value={city}
                onChangeText={setCity}
                placeholder="e.g. Tiruchirappalli"
                placeholderTextColor={colors.subtle}
              />
            </View>

            <View style={[s.inputWrap, { flex: 1 }]}>
              <Text style={s.inputLabel}>State</Text>
              <TextInput
                style={s.textInput}
                value={stateVal}
                onChangeText={setStateVal}
                placeholder="e.g. Tamil Nadu"
                placeholderTextColor={colors.subtle}
              />
            </View>
          </View>

          {/* Postal Code */}
          <View style={s.inputWrap}>
            <Text style={s.inputLabel}>Postal / PIN Code</Text>
            <TextInput
              style={s.textInput}
              value={postalCode}
              onChangeText={setPostalCode}
              placeholder="e.g. 620001"
              placeholderTextColor={colors.subtle}
              keyboardType="numeric"
            />
          </View>

          {/* Action button */}
          <Pressable
            style={[s.primaryActionBtn, geocoding && s.btnDisabled]}
            onPress={handleGeocodeAddress}
            disabled={geocoding}
            accessibilityRole="button"
            accessibilityLabel="Locate Salon Address on Map"
          >
            {geocoding ? (
              <>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={s.primaryActionBtnText}>Locating Salon Address...</Text>
              </>
            ) : (
              <>
                <Search size={16} color="#FFFFFF" />
                <Text style={s.primaryActionBtnText}>Locate Salon on Map</Text>
              </>
            )}
          </Pressable>

          {errorMessage && (
            <View style={s.errorCard}>
              <AlertCircle size={15} color={colors.danger} />
              <Text style={s.errorCardText}>{errorMessage}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    marginVertical: 12,
    padding: 16,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.gold,
    letterSpacing: 1.2
  },
  requiredBadge: {
    backgroundColor: colors.goldSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill
  },
  requiredText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.gold
  },
  helperText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
    marginBottom: 14
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    backgroundColor: colors.surfaceWarm,
    padding: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: radius.xs
  },
  tabActive: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted
  },
  tabTextActive: {
    color: colors.ink,
    fontWeight: '700'
  },
  optionContent: {
    marginTop: 2
  },
  presenceNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.surfaceWarm,
    padding: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14
  },
  presenceNoticeIcon: {
    fontSize: 14
  },
  presenceNoticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.gold,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: radius.sm
  },
  primaryActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3
  },
  btnDisabled: {
    opacity: 0.65
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.dangerSoft,
    padding: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    marginTop: 10
  },
  errorCardText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: colors.danger
  },
  errorSwitchText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gold,
    marginTop: 2
  },
  formSubHeader: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 12
  },
  inputWrap: {
    marginBottom: 10
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
    marginBottom: 4
  },
  textInput: {
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xs,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: colors.ink
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 10
  },
  candidatesList: {
    gap: 8,
    marginBottom: 12
  },
  candidateCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.border
  },
  candidatePinWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2
  },
  candidateAddressText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    color: colors.ink
  },
  candidateCityText: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2
  },
  retryAddressBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceWarm
  },
  retryAddressBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted
  },
  previewAddressCard: {
    backgroundColor: colors.surfaceWarm,
    padding: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 12,
    marginBottom: 14
  },
  previewAddressLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.muted,
    marginBottom: 4
  },
  previewAddressText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    lineHeight: 18
  },
  previewCityText: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2
  },
  lockNoticeRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  lockNoticeText: {
    fontSize: 11,
    color: colors.muted,
    lineHeight: 15,
    fontStyle: 'italic'
  },
  confirmActionsCol: {
    gap: 10
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.gold,
    paddingVertical: 13,
    borderRadius: radius.sm
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3
  },
  changeLocationAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.sm,
    backgroundColor: 'transparent'
  },
  changeLocationActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gold
  },
  confirmedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EBF1EC',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill
  },
  confirmedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669'
  },
  confirmedCard: {
    gap: 12
  },
  confirmedDetails: {
    backgroundColor: colors.surfaceWarm,
    padding: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#D4E2D6'
  },
  confirmedAddressLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#059669',
    marginBottom: 4
  },
  confirmedAddressText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    lineHeight: 18
  },
  confirmedCityText: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2
  },
  confirmedLockNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#EBF1EC'
  },
  confirmedLockText: {
    fontSize: 11,
    color: '#059669',
    flex: 1
  },
  changeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceWarm
  },
  changeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gold
  }
});
