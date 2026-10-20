import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import {
  Coordinates,
  CustomerLocationState,
  geocodeCity,
  isValidCoordinate,
  normalizeCityName
} from '../utils/location';

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

  getCachedLocation(): CustomerLocationState | null {
    return this.cachedLocation;
  }

  clearCachedLocation(): void {
    this.cachedLocation = null;
    void this.persistLocation(null);
  }
}

export const locationService = new MobileLocationService();
