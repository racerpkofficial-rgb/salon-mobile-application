import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { AppHeader } from './AppHeader';
import { colors, radius, typography } from '../constants/theme';

interface InAppLegalViewerModalProps {
  visible: boolean;
  url: string;
  title: string;
  onClose: () => void;
}

export function InAppLegalViewerModal({
  visible,
  url,
  title,
  onClose
}: InAppLegalViewerModalProps) {
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Hardware Android back button interceptor
  useEffect(() => {
    if (!visible) return;

    const onHardwareBack = () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      onClose();
      return true; // Strictly prevent app exit
    };

    const backSub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => backSub.remove();
  }, [visible, canGoBack, onClose]);

  const handleNavigationChange = (navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={() => {
        if (canGoBack && webViewRef.current) {
          webViewRef.current.goBack();
        } else {
          onClose();
        }
      }}
    >
      <View style={s.container}>
        <AppHeader
          title={title}
          onBack={() => {
            if (canGoBack && webViewRef.current) {
              webViewRef.current.goBack();
            } else {
              onClose();
            }
          }}
        />

        <View style={s.subbar}>
          <Text style={s.subbarUrl} numberOfLines={1}>
            {url}
          </Text>
        </View>

        {hasError ? (
          <View style={s.errorContainer}>
            <Text style={s.errorIcon}>⚠️</Text>
            <Text style={s.errorTitle}>Unable to Load Legal Document</Text>
            <Text style={s.errorDesc}>
              Please verify your internet connection. You can retry loading or return to the registration form.
            </Text>
            <Pressable
              style={s.retryButton}
              onPress={() => {
                setHasError(false);
                webViewRef.current?.reload();
              }}
            >
              <Text style={s.retryButtonText}>Retry Loading</Text>
            </Pressable>
            <Pressable style={s.closeButton} onPress={onClose}>
              <Text style={s.closeButtonText}>Return to Form</Text>
            </Pressable>
          </View>
        ) : (
          <WebView
            ref={webViewRef}
            source={{ uri: url }}
            style={s.webview}
            startInLoadingState
            onNavigationStateChange={handleNavigationChange}
            onError={() => setHasError(true)}
            renderLoading={() => (
              <View style={s.loadingContainer}>
                <ActivityIndicator size="large" color={colors.gold} />
                <Text style={s.loadingText}>Loading {title}...</Text>
                <Text style={s.loadingSub}>Secure connection to Book My Salon</Text>
              </View>
            )}
            javaScriptEnabled
            domStorageEnabled
            scalesPageToFit
          />
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  subbar: {
    paddingHorizontal: 20,
    paddingVertical: 6,
    backgroundColor: colors.surfaceWarm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight
  },
  subbarUrl: {
    fontSize: 11,
    color: colors.muted,
    fontFamily: typography.caption.letterSpacing ? undefined : 'System'
  },
  webview: {
    flex: 1,
    backgroundColor: colors.background
  },
  loadingContainer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 10
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink
  },
  loadingSub: {
    marginTop: 6,
    fontSize: 12,
    color: colors.muted
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center'
  },
  errorDesc: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 24
  },
  retryButton: {
    backgroundColor: colors.gold,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: radius.md,
    marginBottom: 12,
    minWidth: 180,
    alignItems: 'center'
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14
  },
  closeButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 180,
    alignItems: 'center'
  },
  closeButtonText: {
    color: colors.ink,
    fontWeight: '600',
    fontSize: 13
  }
});
