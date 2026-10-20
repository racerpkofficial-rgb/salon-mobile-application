import React, { useState, useEffect } from 'react';
import {
  Image,
  StyleProp,
  Text,
  View,
  ViewStyle,
  ImageStyle
} from 'react-native';
import { colors } from '../constants/theme';

export interface AvatarProps {
  uri?: string | null;
  name?: string | null;
  size?: number;
  borderColor?: string;
  borderWidth?: number;
  backgroundColor?: string;
  textColor?: string;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  accessibilityLabel?: string;
}

export function Avatar({
  uri,
  name,
  size = 40,
  borderColor,
  borderWidth = 0,
  backgroundColor,
  textColor,
  style,
  imageStyle,
  accessibilityLabel
}: AvatarProps) {
  const [hasError, setHasError] = useState(false);

  // Automatically reset error status when uri updates (e.g. photo uploaded or changed)
  useEffect(() => {
    setHasError(false);
  }, [uri]);

  const cleanUri = typeof uri === 'string' ? uri.trim() : '';
  const showImage = Boolean(cleanUri && !hasError);

  const initial = (name || '').trim().charAt(0).toUpperCase() || '✦';
  const defaultBg = backgroundColor || colors.goldSoft || '#2A241C';
  const defaultText = textColor || colors.ink || '#FFFFFF';

  const containerStyle: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: defaultBg,
    ...(borderColor && borderWidth
      ? { borderColor, borderWidth }
      : borderWidth
      ? { borderWidth }
      : {})
  };

  if (showImage) {
    return (
      <View
        style={[containerStyle, style]}
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel || `${name || 'User'} profile photo`}
      >
        <Image
          source={{ uri: cleanUri }}
          style={[
            {
              width: size,
              height: size,
              borderRadius: size / 2
            },
            imageStyle
          ]}
          resizeMode="cover"
          onError={() => setHasError(true)}
        />
      </View>
    );
  }

  // Fallback to default avatar (circular initial badge)
  const fontSize = Math.max(12, Math.round(size * 0.42));

  return (
    <View
      style={[containerStyle, style]}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel || `${name || 'User'} avatar`}
    >
      <Text
        style={{
          fontSize,
          fontWeight: '800',
          color: defaultText,
          textAlign: 'center',
          includeFontPadding: false
        }}
      >
        {initial}
      </Text>
    </View>
  );
}
