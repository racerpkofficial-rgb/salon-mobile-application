import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { WebView } from 'react-native-webview';
import { MapPin } from 'lucide-react-native';
import { colors, radius } from '../constants/theme';
import { Coordinates, isValidCoordinate } from '../utils/location';

interface SalonMapPreviewProps {
  coordinates?: Coordinates | null;
  height?: number;
  interactive?: boolean;
}

export function SalonMapPreview({
  coordinates,
  height = 180,
  interactive = false
}: SalonMapPreviewProps) {
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const isValid =
    Boolean(coordinates) &&
    isValidCoordinate(coordinates?.latitude, coordinates?.longitude);

  const mapHtml = useMemo(() => {
    if (!isValid || !coordinates) return '';

    const lat = coordinates.latitude;
    const lng = coordinates.longitude;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body, #map { width:100%; height:100%; background:#FAF6F0; overflow:hidden; }
    .gold-pin {
      width: 26px;
      height: 26px;
      background: #B08D57;
      border: 2.5px solid #FFFFFF;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 4px 10px rgba(48,35,31,0.4);
      position: relative;
    }
    .gold-pin::after {
      content: '';
      position: absolute;
      width: 8px;
      height: 8px;
      background: #FFFFFF;
      border-radius: 50%;
      top: 6.5px;
      left: 6.5px;
    }
    .leaflet-control-attribution { display: none !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    try {
      var map = L.map('map', {
        center: [${lat}, ${lng}],
        zoom: 16,
        zoomControl: false,
        attributionControl: false,
        dragging: ${interactive ? 'true' : 'false'},
        touchZoom: ${interactive ? 'true' : 'false'},
        scrollWheelZoom: false,
        doubleClickZoom: false
      });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(map);
      var pin = L.divIcon({
        className: 'gold-pin-wrap',
        html: '<div class="gold-pin"></div>',
        iconSize: [26, 26],
        iconAnchor: [13, 26]
      });
      L.marker([${lat}, ${lng}], { icon: pin }).addTo(map);
    } catch(e) {}
  </script>
</body>
</html>
    `;
  }, [coordinates?.latitude, coordinates?.longitude, isValid, interactive]);

  if (!isValid) {
    return (
      <View style={[s.container, { height }, s.placeholderContainer]}>
        <MapPin size={24} color={colors.subtle} />
        <Text style={s.placeholderText}>Map preview available after location is selected</Text>
      </View>
    );
  }

  return (
    <View style={[s.container, { height }]}>
      {hasError ? (
        <View style={[s.fallbackContainer, { height }]}>
          <View style={s.pinCircle}>
            <MapPin size={22} color={colors.gold} />
          </View>
          <Text style={s.fallbackTitle}>Location Pinpoint Verified</Text>
          <Text style={s.fallbackSub}>Map preview offline</Text>
        </View>
      ) : (
        <>
          <WebView
            originWhitelist={['*']}
            source={{ html: mapHtml }}
            style={s.webview}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            scrollEnabled={false}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            onLoadEnd={() => setLoading(false)}
            onError={() => {
              setHasError(true);
              setLoading(false);
            }}
          />

          {loading && (
            <View style={s.loadingOverlay}>
              <ActivityIndicator size="small" color={colors.gold} />
              <Text style={s.loadingText}>Rendering map...</Text>
            </View>
          )}
        </>
      )}

      {/* Map Badge */}
      <View style={s.badge}>
        <MapPin size={11} color={colors.ink} />
        <Text style={s.badgeText}>Map Preview</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative'
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent'
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(250, 246, 240, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  loadingText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255, 252, 247, 0.94)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.ink
  },
  fallbackContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: colors.surfaceWarm
  },
  pinCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.gold
  },
  fallbackTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 2
  },
  fallbackSub: {
    fontSize: 11,
    color: colors.muted
  },
  placeholderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8
  },
  placeholderText: {
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center'
  }
});
