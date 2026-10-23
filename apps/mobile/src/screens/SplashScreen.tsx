import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { welcomeImages } from '../constants/images';
import { colors, radius } from '../constants/theme';

const SLIDE_INTERVAL = 4500;
const ANIM_DURATION = 900;

export function SplashScreen({ onContinue }: { onContinue: () => void }) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState(1);
  const [reduceMotion, setReduceMotion] = useState(false);

  // Animated values for smooth right-to-left transition
  const slideAnim = useRef(new Animated.Value(0)).current; // 0 -> 1 progress
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => { });
  }, []);

  useEffect(() => {
    const runTransition = () => {
      const incoming = (currentIndex + 1) % welcomeImages.length;
      setNextIndex(incoming);

      slideAnim.setValue(0);
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: reduceMotion ? 400 : ANIM_DURATION,
        useNativeDriver: true
      }).start(() => {
        setCurrentIndex(incoming);
        slideAnim.setValue(0);
      });
    };

    timerRef.current = setTimeout(runTransition, SLIDE_INTERVAL);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentIndex, reduceMotion, slideAnim]);

  // Current image slides slightly to the left (-screenWidth * 0.25)
  const currentTranslateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -screenWidth * 0.25]
  });

  // Current image fades out slightly
  const currentOpacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.2]
  });

  // Next image slides in smoothly from the right (screenWidth -> 0)
  const nextTranslateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [screenWidth, 0]
  });

  // Next image fades in (0 -> 1)
  const nextOpacity = slideAnim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0, 0.7, 1]
  });

  return (
    <View style={s.container}>
      {/* Background Layer 1: Current Active Slide */}
      <Animated.View
        style={[
          s.imageLayer,
          {
            width: screenWidth,
            height: screenHeight,
            opacity: reduceMotion ? 1 : currentOpacity,
            transform: reduceMotion ? [] : [{ translateX: currentTranslateX }]
          }
        ]}
      >
        <Image
          source={welcomeImages[currentIndex]}
          style={s.image}
          resizeMode="cover"
        />
      </Animated.View>

      {/* Background Layer 2: Incoming Slide from Right */}
      {!reduceMotion && (
        <Animated.View
          style={[
            s.imageLayer,
            {
              width: screenWidth,
              height: screenHeight,
              opacity: nextOpacity,
              transform: [{ translateX: nextTranslateX }]
            }
          ]}
        >
          <Image
            source={welcomeImages[nextIndex]}
            style={s.image}
            resizeMode="cover"
          />
        </Animated.View>
      )}

      {/* Seamless Continuous Gradient Overlay - No abrupt half-screen cuts */}
      <Svg
        width="100%"
        height="100%"
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Defs>
          <LinearGradient id="landingGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#0E0B09" stopOpacity="0.42" />
            <Stop offset="20%" stopColor="#0E0B09" stopOpacity="0.08" />
            <Stop offset="50%" stopColor="#0E0B09" stopOpacity="0.12" />
            <Stop offset="75%" stopColor="#0E0B09" stopOpacity="0.55" />
            <Stop offset="100%" stopColor="#0E0B09" stopOpacity="0.82" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#landingGrad)" />
      </Svg>

      {/* Foreground Content */}
      <View style={s.content}>
        {/* Header Branding */}
        <View style={s.header}>
          <Text style={s.brand}>Book My Salon</Text>
          <Text style={s.tag}>BEAUTY & APPOINTMENT BOOKING</Text>
        </View>

        {/* Bottom Hero & Actions */}
        <View style={s.footer}>
          {/* Progress / Slide Indicators */}
          <View style={s.indicatorRow}>
            {welcomeImages.map((_, idx) => (
              <View
                key={idx}
                style={[
                  s.indicatorDot,
                  idx === currentIndex && s.indicatorDotActive
                ]}
              />
            ))}
          </View>

          <Text style={s.title}>Your next salon{`\n`}visit starts here</Text>
          <Text style={s.copy}>
            Discover salons, explore beauty services and book your appointment with ease.
          </Text>

          <Pressable
            onPress={onContinue}
            style={({ pressed }) => [s.button, pressed && s.buttonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Get Started with Book My Salon"
          >
            <Text style={s.btnText}>Get Started  →</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0E0B09'
  },
  imageLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0
  },
  image: {
    width: '100%',
    height: '100%'
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 26,
    paddingTop: 68,
    paddingBottom: 40,
    zIndex: 5
  },
  header: {
    marginTop: 4
  },
  brand: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6
  },
  tag: {
    fontSize: 10,
    letterSpacing: 2,
    color: '#F4EBDD',
    fontWeight: '700',
    marginTop: 6,
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4
  },
  footer: {
    marginBottom: 6
  },
  indicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16
  },
  indicatorDot: {
    width: 6,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.45)'
  },
  indicatorDotActive: {
    width: 22,
    backgroundColor: colors.gold,
    borderRadius: 2
  },
  title: {
    fontSize: 38,
    lineHeight: 44,
    letterSpacing: -1.2,
    color: '#FFFFFF',
    fontWeight: '800',
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8
  },
  copy: {
    fontSize: 15,
    lineHeight: 22,
    color: '#F4EBDD',
    marginTop: 12,
    maxWidth: 320,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6
  },
  button: {
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 26,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }]
  },
  btnText: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2
  }
});