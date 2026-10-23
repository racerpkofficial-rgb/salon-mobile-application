import { Linking } from 'react-native';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { dialogService } from './dialog.service';
import {
  calculateHaversineDistance,
  Coordinates,
  CustomerLocationState,
  geocodeCity,
  isValidCoordinate,
  normalizeCityName
} from '../utils/location';

export interface GeocodedAddressResult {
  id: string;
  coordinates: Coordinates;
  formattedAddress: string;
  city: string;
  state?: string;
  postalCode?: string;
}

export type SalonGeocodeResponse =
  | { success: true; isMultiple: false; result: GeocodedAddressResult }
  | { success: true; isMultiple: true; results: GeocodedAddressResult[] }
  | { success: false; errorType: 'NOT_FOUND' | 'ERROR'; message: string };

export type SalonPremisesLocationResponse =
  | {
      success: true;
      coords: Coordinates;
      formattedAddress: string;
      city?: string;
      state?: string;
      postalCode?: string;
      address?: string; // Backwards-compatible alias
    }
  | {
      success: false;
      errorType: 'PERMISSION_DENIED' | 'SERVICES_DISABLED' | 'GPS_UNAVAILABLE' | 'ERROR';
      message: string;
      coords?: undefined;
      address?: undefined;
    };

const STORAGE_KEY = 'aurelia_saved_customer_location';

class MobileLocationService {
  private cachedLocation: CustomerLocationState | null = null;
  private hasInitialized = false;

  /**
   * Restores persisted location from secure store on startup.
   */
  async initLocation(): Promise<CustomerLocationState | null> {
    if (this.hasInitialized && this.cachedLocation) {
      return this.cachedLocation;
    }
    this.hasInitialized = true;
    try {
      const savedStr = await SecureStore.getItemAsync(STORAGE_KEY);
      if (savedStr) {
        const parsed: CustomerLocationState = JSON.parse(savedStr);
        if (parsed && (parsed.coords || parsed.city)) {
          this.cachedLocation = parsed;
          return parsed;
        }
      }
    } catch {
      // quiet fallback
    }
    return null;
  }

  /**
   * Persists customer location state across app restarts.
   */
  async persistLocation(loc: CustomerLocationState | null): Promise<void> {
    try {
      if (loc) {
        await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(loc));
      } else {
        await SecureStore.deleteItemAsync(STORAGE_KEY);
      }
    } catch {
      // quiet fallback
    }
  }

  /**
   * Request device foreground location permission via Expo Location.
   */
  async requestPermission(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === Location.PermissionStatus.GRANTED;
    } catch {
      return false;
    }
  }

  /**
   * Attempt to get device GPS coordinates with high accuracy and reverse geocoding.
   * If permission is denied or location is disabled, safely returns null without crashing.
   */
  async getDeviceLocation(): Promise<CustomerLocationState | null> {
    try {
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        return null;
      }

      // Check if device location services are enabled
      const isEnabled = await Location.hasServicesEnabledAsync().catch(() => true);
      if (!isEnabled) {
        return null;
      }

      let position: Location.LocationObject | null = null;
      try {
        position = await Location.getLastKnownPositionAsync();
      } catch {
        // quiet fallback
      }

      if (!position) {
        position = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000))
        ]);
      }

      const lat = position?.coords?.latitude;
      const lon = position?.coords?.longitude;

      if (typeof lat === 'number' && typeof lon === 'number' && isValidCoordinate(lat, lon)) {
        let detectedCity: string | undefined = undefined;
        try {
          const [geo] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
          if (geo?.city || geo?.subregion || geo?.region) {
            detectedCity = normalizeCityName(geo.city || geo.subregion || geo.region || '');
          }
        } catch {
          // ignore reverse geocode error
        }

        const loc: CustomerLocationState = {
          coords: { latitude: lat, longitude: lon },
          label: detectedCity ? `${detectedCity} (GPS)` : 'Current Location (GPS)',
          isGps: true,
          city: detectedCity
        };
        this.cachedLocation = loc;
        void this.persistLocation(loc);
        return loc;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Set location manually from a selected city name.
   * Explicitly labeled as "(Manual)" and never pretended to be exact GPS.
   */
  setManualCityLocation(city: string): CustomerLocationState {
    const canonical = normalizeCityName(city) || city;
    const coords = geocodeCity(canonical);
    const loc: CustomerLocationState = {
      coords,
      label: `${canonical} (Manual)`,
      isGps: false,
      city: canonical
    };
    this.cachedLocation = loc;
    void this.persistLocation(loc);
    return loc;
  }

  /**
   * Set explicit custom coordinates (e.g. for testing Tiruchirappalli or Bengaluru).
   */
  setCustomCoordinates(
    coords: Coordinates,
    label: string,
    isGps = false
  ): CustomerLocationState {
    const loc: CustomerLocationState = {
      coords,
      label,
      isGps
    };
    this.cachedLocation = loc;
    void this.persistLocation(loc);
    return loc;
  }

  /**
   * Geocodes an address or landmark string to geographic coordinates.
   * If address geocoding fails, attempts fallback to the city coordinates.
   */
  async geocodeAddress(
    address: string,
    city?: string
  ): Promise<{ coords: Coordinates; formattedAddress?: string } | null> {
    try {
      const fullQuery = [address.trim(), city?.trim()].filter(Boolean).join(', ');
      if (!fullQuery) return null;

      const geocodeResults = await Location.geocodeAsync(fullQuery);
      if (geocodeResults && geocodeResults.length > 0) {
        const first = geocodeResults[0];
        if (isValidCoordinate(first.latitude, first.longitude)) {
          return {
            coords: {
              latitude: Number(first.latitude.toFixed(6)),
              longitude: Number(first.longitude.toFixed(6))
            },
            formattedAddress: fullQuery
          };
        }
      }

      // If full address fails, try geocoding city
      if (city && city.trim().length > 0) {
        const canonicalCity = normalizeCityName(city) || city.trim();
        const cityCoords = geocodeCity(canonicalCity);
        if (cityCoords) {
          return {
            coords: cityCoords,
            formattedAddress: `${address.trim() ? address.trim() + ', ' : ''}${canonicalCity}`
          };
        }
      }

      return null;
    } catch {
      // quiet fallback
      if (city) {
        const fallbackCoords = geocodeCity(city);
        if (fallbackCoords) {
          return { coords: fallbackCoords, formattedAddress: city };
        }
      }
      return null;
    }
  }

  /**
   * Reverse geocodes coordinates to a human-readable street and city.
   */
  async reverseGeocode(
    latitude: number,
    longitude: number
  ): Promise<{
    formattedAddress: string;
    city?: string;
    state?: string;
    postalCode?: string;
  } | null> {
    try {
      if (!isValidCoordinate(latitude, longitude)) return null;
      let results: Location.LocationGeocodedAddress[] = [];
      try {
        results = await Location.reverseGeocodeAsync({ latitude, longitude });
      } catch {
        results = [];
      }

      if (results && results.length > 0) {
        const r = results[0];
        const parts = [
          r.name,
          r.streetNumber,
          r.street,
          r.district,
          r.subregion,
          r.city,
          r.region,
          r.postalCode
        ]
          .filter(Boolean)
          .map((s) => s!.trim());
        const formatted = Array.from(new Set(parts)).join(', ');
        const detectedCity = normalizeCityName(r.city || r.subregion || r.region || '');
        return {
          formattedAddress: formatted || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
          city: detectedCity,
          state: r.region || undefined,
          postalCode: r.postalCode || undefined
        };
      }

      // Online fallback: OpenStreetMap Nominatim reverse geocoding
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`;
        const res = await Promise.race([
          fetch(url, { headers: { 'User-Agent': 'BookMySalonApp/1.0' } }),
          new Promise<Response>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 4000))
        ]);
        if (res.ok) {
          const data = await res.json();
          if (data && data.display_name) {
            const addr = data.address || {};
            const city =
              normalizeCityName(
                addr.city || addr.town || addr.municipality || addr.state_district || addr.county || ''
              ) || undefined;
            return {
              formattedAddress: data.display_name,
              city,
              state: addr.state || undefined,
              postalCode: addr.postcode || undefined
            };
          }
        }
      } catch {
        // Quiet fallback
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Dedicated helper for salon owners capturing the salon's permanent premises location.
   * Prompts for permission with clear intent and obtains current device GPS while on site.
   * Does NOT persist to customer location cache, preserving location independence.
   */
  async getSalonPremisesCurrentLocation(): Promise<SalonPremisesLocationResponse> {
    try {
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        return {
          success: false,
          errorType: 'PERMISSION_DENIED',
          message:
            'Location permission was denied. You can enter your salon address below instead.'
        };
      }

      const isEnabled = await Location.hasServicesEnabledAsync().catch(() => true);
      if (!isEnabled) {
        return {
          success: false,
          errorType: 'SERVICES_DISABLED',
          message:
            'Device location (GPS) is turned off. Please turn on GPS or enter your salon address below.'
        };
      }

      let position: Location.LocationObject | null = null;
      try {
        position = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000))
        ]);
      } catch {
        position = await Location.getLastKnownPositionAsync().catch(() => null);
      }

      if (!position) {
        position = await Location.getLastKnownPositionAsync().catch(() => null);
      }

      const lat = position?.coords?.latitude;
      const lon = position?.coords?.longitude;
      if (typeof lat !== 'number' || typeof lon !== 'number' || !isValidCoordinate(lat, lon)) {
        return {
          success: false,
          errorType: 'GPS_UNAVAILABLE',
          message:
            'Could not retrieve high-accuracy GPS coordinates. Please enter your salon address below.'
        };
      }

      const coords: Coordinates = {
        latitude: Number(lat.toFixed(6)),
        longitude: Number(lon.toFixed(6))
      };

      const rev = await this.reverseGeocode(lat, lon);
      const formattedAddress =
        rev?.formattedAddress ||
        `Salon Premises (Lat ${coords.latitude.toFixed(4)}, Long ${coords.longitude.toFixed(4)})`;

      return {
        success: true,
        coords,
        formattedAddress,
        address: formattedAddress, // Backwards compatibility
        city: rev?.city,
        state: rev?.state,
        postalCode: rev?.postalCode
      };
    } catch (err: any) {
      return {
        success: false,
        errorType: 'ERROR',
        message: err?.message || 'Failed to detect current location.'
      };
    }
  }

  /**
   * Geocodes salon address to coordinates.
   * If multiple matching candidates exist, returns them so the user can explicitly select one.
   * Never silently guesses or picks an inaccurate match.
   */
  async geocodeSalonAddress(
    addressInput:
      | {
          street: string;
          area?: string;
          city: string;
          state?: string;
          postalCode?: string;
        }
      | string
  ): Promise<SalonGeocodeResponse> {
    const rawQuery =
      typeof addressInput === 'string'
        ? addressInput.trim()
        : [
            addressInput.street,
            addressInput.area,
            addressInput.city,
            addressInput.state,
            addressInput.postalCode
          ]
            .map((s) => s?.trim())
            .filter(Boolean)
            .join(', ');

    if (!rawQuery || rawQuery.length < 3) {
      return {
        success: false,
        errorType: 'NOT_FOUND',
        message: 'Please enter a complete salon address including street and city.'
      };
    }

    const cityHint =
      typeof addressInput === 'object' && addressInput.city
        ? addressInput.city.trim()
        : '';

    const candidates: GeocodedAddressResult[] = [];

    // 1. Try Expo native geocoder
    try {
      const geoResults = await Location.geocodeAsync(rawQuery);
      if (geoResults && geoResults.length > 0) {
        for (let i = 0; i < Math.min(geoResults.length, 3); i++) {
          const item = geoResults[i];
          if (isValidCoordinate(item.latitude, item.longitude)) {
            const rev = await this.reverseGeocode(item.latitude, item.longitude);
            const resolvedCity = rev?.city || cityHint;
            candidates.push({
              id: `expo_${item.latitude.toFixed(5)}_${item.longitude.toFixed(5)}`,
              coordinates: {
                latitude: Number(item.latitude.toFixed(6)),
                longitude: Number(item.longitude.toFixed(6))
              },
              formattedAddress: rev?.formattedAddress || rawQuery,
              city: resolvedCity,
              state: rev?.state,
              postalCode: rev?.postalCode
            });
          }
        }
      }
    } catch {
      // Native geocoder failed or unavailable, fallback to Nominatim below
    }

    // 2. If Expo native geocoder returned no candidates, query OpenStreetMap Nominatim
    if (candidates.length === 0) {
      try {
        const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          rawQuery
        )}&format=json&addressdetails=1&limit=4`;
        const res = await Promise.race([
          fetch(nomUrl, { headers: { 'User-Agent': 'BookMySalonApp/1.0' } }),
          new Promise<Response>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ]);

        if (res.ok) {
          const nomList = await res.json();
          if (Array.isArray(nomList) && nomList.length > 0) {
            for (const item of nomList) {
              const lat = parseFloat(item.lat);
              const lon = parseFloat(item.lon);
              if (isValidCoordinate(lat, lon)) {
                const addr = item.address || {};
                const detectedCity =
                  normalizeCityName(
                    addr.city || addr.town || addr.municipality || addr.state_district || addr.county || ''
                  ) || cityHint;
                candidates.push({
                  id: `nom_${item.place_id || `${lat}_${lon}`}`,
                  coordinates: {
                    latitude: Number(lat.toFixed(6)),
                    longitude: Number(lon.toFixed(6))
                  },
                  formattedAddress: item.display_name || rawQuery,
                  city: detectedCity,
                  state: addr.state,
                  postalCode: addr.postcode
                });
              }
            }
          }
        }
      } catch {
        // Quiet fallback
      }
    }

    // Filter duplicates with near-identical coordinates (< 100 meters)
    const uniqueCandidates: GeocodedAddressResult[] = [];
    for (const cand of candidates) {
      const alreadyHas = uniqueCandidates.some((existing) => {
        const dist = calculateHaversineDistance(
          existing.coordinates.latitude,
          existing.coordinates.longitude,
          cand.coordinates.latitude,
          cand.coordinates.longitude
        );
        return dist !== null && dist < 0.1;
      });
      if (!alreadyHas) {
        uniqueCandidates.push(cand);
      }
    }

    if (uniqueCandidates.length === 0) {
      return {
        success: false,
        errorType: 'NOT_FOUND',
        message:
          'Could not find coordinates for this salon address. Please check spelling, add an area/postal code, and retry.'
      };
    }

    if (uniqueCandidates.length === 1) {
      return {
        success: true,
        isMultiple: false,
        result: uniqueCandidates[0]
      };
    }

    return {
      success: true,
      isMultiple: true,
      results: uniqueCandidates
    };
  }

  /**
   * Opens Google Maps (or browser / compatible maps app on Android)
   * with directions from customer current location to destination salon coordinates.
   */
  async openNavigationDirections(
    latitude: number,
    longitude: number,
    salonName?: string
  ): Promise<boolean> {
    if (!isValidCoordinate(latitude, longitude)) {
      dialogService.showInfo(
        'Location Unavailable',
        'Salon location is not available yet.'
      );
      return false;
    }

    // Official Google Maps Directions API URL.
    // Destination set to exact coordinates without origin defaults to device current location.
    const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

    try {
      const canOpen = await Linking.canOpenURL(url).catch(() => true);
      if (canOpen) {
        await Linking.openURL(url);
        return true;
      }
      await Linking.openURL(url);
      return true;
    } catch {
      dialogService.showError(
        'Directions Unavailable',
        'Unable to open external maps application. Please check your internet connection or install Google Maps.'
      );
      return false;
    }
  }

  getCachedLocation(): CustomerLocationState | null {
    return this.cachedLocation;
  }

  clearCachedLocation(): void {
    this.cachedLocation = null;
    void this.persistLocation(null);
  }
}

export const locationService = new MobileLocationService();

