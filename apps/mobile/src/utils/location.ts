/**
 * Mobile Location & Haversine Distance Utilities
 * Book My Salon Application
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface CustomerLocationState {
  coords: Coordinates | null;
  label: string; // e.g. "Current Location (GPS)" or "Tiruchirappalli (Manual)"
  isGps: boolean;
  city?: string;
}

// Known coordinates for Indian cities (latitude, longitude in decimal degrees)
export const KNOWN_CITY_COORDINATES: Record<string, Coordinates> = {
  bengaluru: { latitude: 12.9716, longitude: 77.5946 },
  bangalore: { latitude: 12.9716, longitude: 77.5946 },
  tiruchirappalli: { latitude: 10.7905, longitude: 78.7047 },
  trichy: { latitude: 10.7905, longitude: 78.7047 },
  chennai: { latitude: 13.0827, longitude: 80.2707 },
  mumbai: { latitude: 19.076, longitude: 72.8777 },
  delhi: { latitude: 28.6139, longitude: 77.209 },
  'new delhi': { latitude: 28.6139, longitude: 77.209 },
  hyderabad: { latitude: 17.385, longitude: 78.4867 },
  kolkata: { latitude: 22.5726, longitude: 88.3639 },
  pune: { latitude: 18.5204, longitude: 73.8567 },
  coimbatore: { latitude: 11.0168, longitude: 76.9558 },
  madurai: { latitude: 9.9252, longitude: 78.1198 },
  salem: { latitude: 11.6643, longitude: 78.146 },
  kochi: { latitude: 9.9312, longitude: 76.2673 },
  cochin: { latitude: 9.9312, longitude: 76.2673 },
  mysuru: { latitude: 12.2958, longitude: 76.6394 },
  mysore: { latitude: 12.2958, longitude: 76.6394 },
  mangalore: { latitude: 12.9141, longitude: 74.856 },
  thiruvananthapuram: { latitude: 8.5241, longitude: 76.9366 },
  trivandrum: { latitude: 8.5241, longitude: 76.9366 },
  goa: { latitude: 15.4909, longitude: 73.8278 },
  panaji: { latitude: 15.4909, longitude: 73.8278 },
  ahmedabad: { latitude: 23.0225, longitude: 72.5714 },
  jaipur: { latitude: 26.9124, longitude: 75.7873 },
  lucknow: { latitude: 26.8467, longitude: 80.9462 },
  chandigarh: { latitude: 30.7333, longitude: 76.7794 }
};

export const POPULAR_CITIES = [
  'All',
  'Bengaluru',
  'Tiruchirappalli',
  'Chennai',
  'Mumbai',
  'Delhi',
  'Hyderabad',
  'Coimbatore'
];

export const CITY_ALIASES: Record<string, string[]> = {
  tiruchirappalli: ['tiruchirappalli', 'trichy', 'tiruchy', 'tiruchirapalli'],
  bengaluru: ['bengaluru', 'bangalore'],
  chennai: ['chennai', 'madras'],
  mumbai: ['mumbai', 'bombay'],
  kolkata: ['kolkata', 'calcutta'],
  kochi: ['kochi', 'cochin'],
  mysuru: ['mysuru', 'mysore'],
  thiruvananthapuram: ['thiruvananthapuram', 'trivandrum'],
  panaji: ['panaji', 'goa'],
  delhi: ['delhi', 'new delhi']
};

/**
 * Normalizes city names to canonical storage value.
 * e.g. "Trichy", "Tiruchy", "tiruchirapalli" -> "Tiruchirappalli"
 * "Bangalore" -> "Bengaluru"
 */
export function normalizeCityName(cityName?: string | null): string {
  if (!cityName || typeof cityName !== 'string') return '';
  const trimmed = cityName.trim().toLowerCase();
  for (const [canonical, aliases] of Object.entries(CITY_ALIASES)) {
    if (canonical === trimmed || aliases.includes(trimmed)) {
      return canonical === 'tiruchirappalli'
        ? 'Tiruchirappalli'
        : canonical === 'bengaluru'
        ? 'Bengaluru'
        : canonical.charAt(0).toUpperCase() + canonical.slice(1);
    }
  }
  return cityName.trim();
}

export function escapeRegex(input?: string | null): string {
  if (!input || typeof input !== 'string') return '';
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Generates regex search pattern matching city variations.
 * e.g. searching "Trichy" matches both "Trichy" and "Tiruchirappalli".
 */
export function getCitySearchPattern(input?: string | null): string {
  if (!input || typeof input !== 'string') return '';
  const trimmed = input.trim().toLowerCase();
  for (const [canonical, aliases] of Object.entries(CITY_ALIASES)) {
    const isDirectMatch = canonical === trimmed || aliases.includes(trimmed);
    const isSubMatch = trimmed.length >= 3 && (canonical.includes(trimmed) || aliases.some((a) => a.includes(trimmed) || trimmed.includes(a)));
    if (isDirectMatch || isSubMatch) {
      return `(${[canonical, ...aliases].map(escapeRegex).join('|')})`;
    }
  }
  return escapeRegex(trimmed);
}

/**
 * Validates latitude and longitude ranges.
 */
export function isValidCoordinate(latitude?: number | null, longitude?: number | null): boolean {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return false;
  if (isNaN(latitude) || isNaN(longitude)) return false;
  if (latitude < -90 || latitude > 90) return false;
  if (longitude < -180 || longitude > 180) return false;
  if (latitude === 0 && longitude === 0) return false;
  return true;
}

/**
 * Geocodes a city name to known coordinates.
 */
export function geocodeCity(city?: string | null): Coordinates | null {
  if (!city || typeof city !== 'string') return null;
  const normalized = city.trim().toLowerCase();
  for (const [canonical, aliases] of Object.entries(CITY_ALIASES)) {
    if (canonical === normalized || aliases.includes(normalized)) {
      return KNOWN_CITY_COORDINATES[canonical] || KNOWN_CITY_COORDINATES[normalized] || null;
    }
  }
  return KNOWN_CITY_COORDINATES[normalized] || null;
}

/**
 * Calculates Haversine straight-line distance in kilometres between two coordinates.
 * Formula:
 * a = sin²(Δlat/2) + cos(lat1) * cos(lat2) * sin²(Δlon/2)
 * c = 2 * atan2(√a, √(1-a))
 * d = R * c (R = 6371 km)
 */
export function calculateHaversineDistance(
  lat1?: number | null,
  lon1?: number | null,
  lat2?: number | null,
  lon2?: number | null
): number | null {
  if (!isValidCoordinate(lat1, lon1) || !isValidCoordinate(lat2, lon2)) {
    return null;
  }

  const R = 6371; // Earth's mean radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2! - lat1!);
  const dLon = toRad(lon2! - lon1!);
  const rLat1 = toRad(lat1!);
  const rLat2 = toRad(lat2!);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const clampedA = Math.max(0, Math.min(1, a));
  const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));
  const distance = R * c;

  return Math.max(0, Number(distance.toFixed(2)));
}

/**
 * Formats a distance in kilometres into a user-friendly label.
 * Never produces a fake "0.8 km" when distance is unavailable.
 */
export function formatDistance(distanceKm: number | null): string {
  if (distanceKm === null || isNaN(distanceKm) || distanceKm < 0) {
    return 'Distance unavailable';
  }

  if (distanceKm < 1) {
    const metres = Math.round(distanceKm * 1000);
    return `${metres} m (approx straight-line)`;
  }

  if (distanceKm < 10) {
    return `${distanceKm.toFixed(1)} km (approx straight-line)`;
  }

  return `${Math.round(distanceKm)} km (approx straight-line)`;
}

/**
 * Safely extracts latitude and longitude from various object shapes:
 * - Direct Coordinates object: { latitude, longitude }
 * - Object with .coordinates: { coordinates: { latitude, longitude } }
 * - Object with .location (as coordinates): { location: { latitude, longitude } }
 * - Object with .coords (geolocation): { coords: { latitude, longitude } }
 */
export function extractCoordinates(source?: any): Coordinates | null {
  if (!source || typeof source !== 'object') return null;

  if (isValidCoordinate(source.latitude, source.longitude)) {
    return { latitude: Number(source.latitude), longitude: Number(source.longitude) };
  }
  if (source.coordinates && isValidCoordinate(source.coordinates.latitude, source.coordinates.longitude)) {
    return { latitude: Number(source.coordinates.latitude), longitude: Number(source.coordinates.longitude) };
  }
  if (
    source.location &&
    typeof source.location === 'object' &&
    isValidCoordinate(source.location.latitude, source.location.longitude)
  ) {
    return { latitude: Number(source.location.latitude), longitude: Number(source.location.longitude) };
  }
  if (source.coords && isValidCoordinate(source.coords.latitude, source.coords.longitude)) {
    return { latitude: Number(source.coords.latitude), longitude: Number(source.coords.longitude) };
  }
  return null;
}

/**
 * Formats coordinates into a safe human-readable GPS string.
 * Example: "Lat 10.7905, Long 78.7047"
 * Returns an empty string if coordinates are invalid or missing.
 */
export function formatCoordinates(
  coords?: Coordinates | { latitude?: number | null; longitude?: number | null } | any | null
): string {
  const extracted = extractCoordinates(coords);
  if (!extracted) return '';
  return `Lat ${extracted.latitude.toFixed(4)}, Long ${extracted.longitude.toFixed(4)}`;
}

/**
 * Guarantees a safe human-readable string for salon/user locations.
 * CRITICAL: NEVER returns an object. Always returns a string.
 *
 * @param location Can be string, coordinates object, or undefined.
 * @param city Optional city name.
 * @param address Optional street/area address.
 * @param fallback Optional fallback string (default: 'Partner Salon').
 */
export function formatLocation(
  location?: any,
  city?: string | null,
  address?: string | null,
  fallback: string = 'Partner Salon'
): string {
  if (typeof location === 'string' && location.trim().length > 0) {
    return location.trim();
  }

  const cleanCity = typeof city === 'string' ? city.trim() : '';
  const cleanAddress = typeof address === 'string' ? address.trim() : '';

  if (cleanCity && cleanAddress) {
    return `${cleanCity} • ${cleanAddress}`;
  }
  if (cleanCity) {
    return cleanCity;
  }
  if (cleanAddress) {
    return cleanAddress;
  }

  return fallback;
}

/**
 * Normalizes a salon object so that:
 * 1. salon.location is GUARANTEED to be a human-readable string (never an object { latitude, longitude }).
 * 2. salon.coordinates contains valid Coordinates { latitude, longitude } if available.
 */
export function normalizeSalonLocation<T extends Record<string, any>>(salon: T): T {
  if (!salon || typeof salon !== 'object') return salon;

  const coordinates = extractCoordinates(salon) || (salon.coordinates as Coordinates | undefined);
  const locationString = formatLocation(
    salon.location,
    salon.city,
    salon.address,
    salon.city || salon.address || 'Partner Salon'
  );

  return {
    ...salon,
    location: locationString,
    coordinates: coordinates || undefined
  } as T;
}

/**
 * Alias for calculateHaversineDistance to satisfy calculateDistance requirements.
 */
export const calculateDistance = calculateHaversineDistance;

