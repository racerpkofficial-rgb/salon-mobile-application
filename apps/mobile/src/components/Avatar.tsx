import React, { useState, useEffect } from 'react';
import {
  Image,
  StyleProp,
  Text,
  View,
  ViewStyle,
  ImageStyle,
  TouchableOpacity
} from 'react-native';
import { colors } from '../constants/theme';
import { ImageViewerModal } from './ImageViewerModal';

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
  enablePreview?: boolean;
  previewTitle?: string;
  previewSubtitle?: string;
  onPress?: () => void;
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
  accessibilityLabel,
  enablePreview = true,
  previewTitle,
  previewSubtitle,
  onPress
}: AvatarProps) {
  const [hasError, setHasError] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);

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

  const handlePress = () => {
    if (onPress) {
      onPress();
      return;
    }
    if (showImage && enablePreview) {
      setPreviewVisible(true);
    }
  };

  const isClickable = Boolean(onPress || (showImage && enablePreview));

  const content = showImage ? (
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
  ) : (
    <Text
      style={{
        fontSize: Math.max(12, Math.round(size * 0.42)),
        fontWeight: '800',
        color: defaultText,
        textAlign: 'center',
        includeFontPadding: false
      }}
    >
      {initial}
    </Text>
  );

  return (
    <>
      {isClickable ? (
        <TouchableOpacity
          style={[containerStyle, style]}
          onPress={handlePress}
          activeOpacity={0.85}
          accessibilityRole="imagebutton"
          accessibilityLabel={accessibilityLabel || `${name || 'User'} profile photo. Tap to view full size.`}
        >
          {content}
        </TouchableOpacity>
      ) : (
        <View
          style={[containerStyle, style]}
          accessibilityRole="image"
          accessibilityLabel={accessibilityLabel || `${name || 'User'} avatar`}
        >
          {content}
        </View>
      )}

      {showImage && enablePreview && (
        <ImageViewerModal
          visible={previewVisible}
          imageUrl={cleanUri}
          title={previewTitle || name || 'Profile Photo'}
          subtitle={previewSubtitle}
          onClose={() => setPreviewVisible(false)}
        />
      )}
    </>
  );
}
