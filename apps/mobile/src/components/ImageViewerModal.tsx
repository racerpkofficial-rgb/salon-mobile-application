import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Image,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  ActivityIndicator,
  Animated,
  PanResponder,
  StatusBar,
  BackHandler,
  Dimensions,
  Platform
} from 'react-native';
import { X, RotateCcw, Image as ImageIcon } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

interface ImageViewerModalProps {
  visible: boolean;
  imageUrl?: string | null;
  title?: string;
  subtitle?: string;
  onClose: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export function ImageViewerModal({
  visible,
  imageUrl,
  title,
  subtitle,
  onClose
}: ImageViewerModalProps) {
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Animated values for zoom & pan
  const scale = useRef(new Animated.Value(1)).current;
  const panX = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;

  // Track live numbers to avoid drift
  const currentScale = useRef(1);
  const currentPan = useRef({ x: 0, y: 0 });
  const initialTouchDistance = useRef<number | null>(null);
  const lastTap = useRef<number>(0);

  useEffect(() => {
    const scaleListener = scale.addListener((v) => {
      currentScale.current = v.value;
    });
    const panXListener = panX.addListener((v) => {
      currentPan.current.x = v.value;
    });
    const panYListener = panY.addListener((v) => {
      currentPan.current.y = v.value;
    });

    return () => {
      scale.removeListener(scaleListener);
      panX.removeListener(panXListener);
      panY.removeListener(panYListener);
    };
  }, [scale, panX, panY]);

  // Reset transforms whenever visibility changes or new image opens
  useEffect(() => {
    if (visible) {
      setLoading(true);
      setError(false);
      resetZoomAndPan(false);
    }
  }, [visible, imageUrl]);

  // Handle Android hardware back button
  useEffect(() => {
    if (!visible) return;
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => backHandler.remove();
  }, [visible, onClose]);

  const resetZoomAndPan = (animated = true) => {
    currentScale.current = 1;
    currentPan.current = { x: 0, y: 0 };

    if (!animated) {
      scale.setValue(1);
      panX.setValue(0);
      panY.setValue(0);
      return;
    }

    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 7
      }),
      Animated.spring(panX, {
        toValue: 0,
        useNativeDriver: true,
        friction: 7
      }),
      Animated.spring(panY, {
        toValue: 0,
        useNativeDriver: true,
        friction: 7
      })
    ]).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        return Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3;
      },
      onPanResponderGrant: () => {
        initialTouchDistance.current = null;
      },
      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;

        // Two-finger pinch-to-zoom
        if (touches && touches.length >= 2) {
          const t1 = touches[0];
          const t2 = touches[1];
          const distance = Math.hypot(t2.pageX - t1.pageX, t2.pageY - t1.pageY);

          if (initialTouchDistance.current === null) {
            initialTouchDistance.current = distance;
          } else if (initialTouchDistance.current > 0) {
            const rawScale = (distance / initialTouchDistance.current) * currentScale.current;
            const clampedScale = Math.min(Math.max(rawScale, 0.8), 4.0);
            scale.setValue(clampedScale);
          }
        } else if (currentScale.current > 1) {
          // Panning when zoomed in
          const maxPan = (currentScale.current - 1) * (SCREEN_WIDTH / 2);
          const newX = Math.min(Math.max(currentPan.current.x + gestureState.dx, -maxPan), maxPan);
          const newY = Math.min(Math.max(currentPan.current.y + gestureState.dy, -maxPan), maxPan);
          panX.setValue(newX);
          panY.setValue(newY);
        }
      },
      onPanResponderRelease: () => {
        initialTouchDistance.current = null;

        // Handle double-tap to toggle 1x / 2.5x
        const now = Date.now();
        if (now - lastTap.current < 280) {
          if (currentScale.current > 1.2) {
            resetZoomAndPan(true);
          } else {
            Animated.parallel([
              Animated.spring(scale, {
                toValue: 2.2,
                useNativeDriver: true,
                friction: 6
              }),
              Animated.spring(panX, {
                toValue: 0,
                useNativeDriver: true,
                friction: 6
              }),
              Animated.spring(panY, {
                toValue: 0,
                useNativeDriver: true,
                friction: 6
              })
            ]).start();
            currentScale.current = 2.2;
            currentPan.current = { x: 0, y: 0 };
          }
          lastTap.current = 0;
          return;
        }
        lastTap.current = now;

        // If pinched below 1x, spring back smoothly
        if (currentScale.current < 1) {
          resetZoomAndPan(true);
        }
      }
    })
  ).current;

  if (!visible) return null;

  const validUri = typeof imageUrl === 'string' && imageUrl.trim().length > 0 ? imageUrl.trim() : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <View style={styles.backdrop}>
        {/* Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            accessibilityLabel="Close image preview"
            accessibilityRole="button"
            activeOpacity={0.8}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.titleContainer}>
            {Boolean(title) && (
              <Text style={styles.titleText} numberOfLines={1}>
                {title}
              </Text>
            )}
            {Boolean(subtitle) && (
              <Text style={styles.subtitleText} numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </View>

          {/* Reset Zoom Button */}
          <TouchableOpacity
            style={styles.resetButton}
            onPress={() => resetZoomAndPan(true)}
            accessibilityLabel="Reset zoom"
            accessibilityRole="button"
            activeOpacity={0.8}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <RotateCcw size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Backdrop Tap dismiss area (behind image) */}
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        {/* Image Container with Gestures - NOTE: NO overflow: 'hidden' to prevent Android RenderNode black clipping */}
        <View style={styles.imageViewerContainer} {...panResponder.panHandlers}>
          {/* Subtle loading spinner behind the image, not covering it */}
          {loading && !error && (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={colors.gold || '#B08D57'} />
            </View>
          )}

          {Boolean(validUri) && !error ? (
            <Animated.View
              style={[
                styles.animatedImageWrapper,
                {
                  transform: [
                    { scale },
                    { translateX: panX },
                    { translateY: panY }
                  ]
                }
              ]}
            >
              <Image
                source={{ uri: validUri! }}
                style={styles.fullImage}
                resizeMode="contain"
                onLoadStart={() => setLoading(true)}
                onLoadEnd={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setError(true);
                }}
              />
            </Animated.View>
          ) : (
            <View style={styles.errorContainer}>
              <ImageIcon size={56} color="#A89B8F" />
              <Text style={styles.errorText}>Photo unavailable</Text>
              <Text style={styles.errorSubtext}>The image could not be loaded</Text>
            </View>
          )}
        </View>

        {/* Footer Hint */}
        <View style={styles.footer} pointerEvents="none">
          <Text style={styles.footerHint}>Pinch or double-tap to zoom • Tap outside to close</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(12, 10, 8, 0.96)',
    justifyContent: 'space-between'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 12 : 54,
    paddingBottom: 14,
    zIndex: 20
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  resetButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  titleContainer: {
    flex: 1,
    paddingHorizontal: 16,
    alignItems: 'center'
  },
  titleText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3
  },
  subtitleText: {
    fontSize: 12,
    color: '#D1C7BD',
    marginTop: 2
  },
  imageViewerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
    // Intentionally no overflow: 'hidden' to prevent Android RenderNode black clipping
  },
  animatedImageWrapper: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.74,
    alignItems: 'center',
    justifyContent: 'center'
  },
  fullImage: {
    width: '100%',
    height: '100%'
  },
  loadingBox: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center'
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  errorText: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF'
  },
  errorSubtext: {
    marginTop: 4,
    fontSize: 12,
    color: '#A89B8F'
  },
  footer: {
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingTop: 12,
    alignItems: 'center',
    zIndex: 20
  },
  footerHint: {
    fontSize: 12,
    color: '#B8A58C',
    letterSpacing: 0.2
  }
});
