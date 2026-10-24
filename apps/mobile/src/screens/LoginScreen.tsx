import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AuthSession from 'expo-auth-session';
import { AppHeader } from '../components/AppHeader';
import { InputField } from '../components/InputField';
import { PrimaryButton } from '../components/PrimaryButton';
import { SecondaryButton } from '../components/SecondaryButton';
import { colors, radius } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useFormField } from '../hooks/useFormField';
import { dialogService } from '../services/dialog.service';
import { UserRole } from '../types';
import { isEmail } from '../utils/validation';
import { openTermsUrl, openPrivacyUrl } from '../utils/legal';
import { EmailOtpVerificationModal } from '../components/EmailOtpVerificationModal';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  '802872702930-0phsd8fcqd5m98efqcu7u5d89g6mblpk.apps.googleusercontent.com';

const GOOGLE_ANDROID_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ||
  '802872702930-rlgjt273qg6edfgvb8ehib0po9thflpj.apps.googleusercontent.com';

function classifyOAuthFailure(code?: string, message?: string): string {
  const details = `${code || ''} ${message || ''}`.toLowerCase();
  if (details.includes('redirect_uri_mismatch')) return 'redirect_mismatch';
  if (details.includes('state_mismatch')) return 'state_mismatch';
  if (details.includes('access_denied')) return 'provider_denied';
  return 'oauth_provider_or_request_error';
}

export function LoginScreen({
  role,
  onBack,
  onRegister,
  onSwitchRole,
  onForgotPassword
}: {
  role: UserRole;
  onBack: () => void;
  onRegister: (preload?: { name?: string; email?: string }) => void;
  onSwitchRole?: (targetRole: UserRole) => void;
  onForgotPassword?: (initialEmail?: string) => void;
}) {
  const auth = useAuth();
  const email = useFormField();
  const password = useFormField();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const processedTokenRef = useRef<string | null>(null);

  const cleanEmail = email.value.trim();
  const valid = isEmail(cleanEmail) && password.value.length > 0;
  const isCustomer = role === 'CUSTOMER';
  const isOwner = role === 'SALON_OWNER';
  const isAdmin = role === 'SUPER_ADMIN';
  const showGoogleLogin = isCustomer || isOwner;

  const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  const standaloneRedirectUri = AuthSession.makeRedirectUri({
    native: 'com.aurelia.salonbooking:/oauthredirect',
    scheme: 'book-my-salon',
    path: 'oauthredirect'
  });
  const redirectUri = standaloneRedirectUri;

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: GOOGLE_WEB_CLIENT_ID,
    webClientId: GOOGLE_WEB_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID || GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_WEB_CLIENT_ID,
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    shouldAutoExchangeCode: true,
    selectAccount: true,
    scopes: ['openid', 'profile', 'email']
  });

  const handleCompletedIdToken = async (idToken: string) => {
    if (processedTokenRef.current === idToken) return;
    processedTokenRef.current = idToken;

    setGoogleLoading(true);
    try {
      console.log('[OAuth Diagnostic] Submitting Google ID token to backend for role:', role);
      const res = await auth.googleLogin(idToken, role);
      console.log('[OAuth Diagnostic] Backend Google login response received successfully', {
        needsOnboarding: res?.needsOnboarding,
        hasUser: Boolean(res?.user)
      });

      if (res?.needsOnboarding) {
        dialogService.alert(
          'Salon Registration Required',
          'Your Google account is verified! Please complete your salon atelier details and upload identity proof to submit for Super Admin approval.',
          [
            {
              text: 'Complete Registration',
              onPress: () => {
                onRegister({
                  name: res.name || '',
                  email: res.email || ''
                });
              }
            },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
        return;
      }
    } catch (e: any) {
      processedTokenRef.current = null;
      const code = e?.code;
      const msg = e instanceof Error ? e.message : 'Please check your credentials and try again.';

      console.error('[OAuth Diagnostic] Backend Google verification failed:', {
        code,
        status: e?.status,
        message: msg
      });

      if (
        code === 'SALON_OWNER_CREDENTIALS' ||
        msg.includes('salon account') ||
        msg.includes('Salon Owner login')
      ) {
        dialogService.alert(
          'Salon Owner account required',
          'These credentials belong to a salon account. Please use the Salon Owner login.',
          [
            { text: 'OK', style: 'cancel' },
            ...(onSwitchRole
              ? [
                  {
                    text: 'Switch to Salon Owner',
                    onPress: () => onSwitchRole('SALON_OWNER')
                  }
                ]
              : [])
          ]
        );
      } else if (
        code === 'CUSTOMER_CREDENTIALS' ||
        msg.includes('customer account') ||
        msg.includes('Customer login')
      ) {
        dialogService.alert(
          'Customer account required',
          'These credentials belong to a customer account. Please use Customer login.',
          [
            { text: 'OK', style: 'cancel' },
            ...(onSwitchRole
              ? [
                  {
                    text: 'Switch to Customer',
                    onPress: () => onSwitchRole('CUSTOMER')
                  }
                ]
              : [])
          ]
        );
      } else if (code === 'ROLE_MISMATCH') {
        dialogService.alert(
          'Role Mismatch',
          msg,
          [
            { text: 'OK', style: 'cancel' },
            ...(onSwitchRole
              ? [
                  {
                    text: role === 'CUSTOMER' ? 'Switch to Salon Owner' : 'Switch to Customer',
                    onPress: () => onSwitchRole(role === 'CUSTOMER' ? 'SALON_OWNER' : 'CUSTOMER')
                  }
                ]
              : [])
          ]
        );
      } else if (code === 'ACCOUNT_INACTIVE' || msg.includes('inactive')) {
        dialogService.showWarning(
          'Account Inactive',
          'Your account is currently inactive. Please contact support.'
        );
      } else if (e?.status === 503 || code === 'SERVER_MISCONFIGURED' || msg.includes('not configured')) {
        dialogService.showWarning(
          'Service Unavailable',
          'Google Sign-In is currently not configured on the server. Please sign in with email and password.'
        );
      } else if (code === 'AUDIENCE_MISMATCH') {
        dialogService.showError(
          'Configuration Error',
          'Google token verification failed due to client ID mismatch. Please ensure GOOGLE_ANDROID_CLIENT_ID is configured on the server.'
        );
      } else if (code === 'TOKEN_EXPIRED') {
        dialogService.showError(
          'Session Expired',
          'Google authentication token has expired. Please try signing in again.'
        );
      } else if (code === 'INVALID_TOKEN' || e?.status === 401) {
        dialogService.showError(
          'Authentication Failed',
          'Google token verification failed or expired. Please try signing in again.'
        );
      } else if (e?.status === 0 || msg.includes('Unable to connect')) {
        dialogService.showError(
          'Connection Error',
          'Unable to reach Book My Salon servers. Please check your internet connection.'
        );
      } else {
        dialogService.showError('Google Sign-In Failed', msg);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  useEffect(() => {
    if (!response) return;

    if (response.type === 'cancel' || response.type === 'dismiss') {
      console.log('[OAuth Diagnostic] User cancelled or dismissed Google Sign-In prompt.');
      setGoogleLoading(false);
      return;
    }

    if (response.type === 'error') {
      setGoogleLoading(false);
      const errorCode = (response.params as any)?.error || response.error?.code;
      const errorDesc =
        (response.params as any)?.error_description ||
        response.error?.message ||
        'Google authentication could not be completed.';

      console.error('[OAuth Diagnostic] Google Sign-In error received:', {
        category: classifyOAuthFailure(errorCode, errorDesc),
        errorCode,
        redirectUri
      });

      let userMsg = errorDesc;
      if (
        errorCode === 'invalid_request' ||
        errorDesc.includes('invalid_request') ||
        errorDesc.includes('Custom URI scheme')
      ) {
        userMsg =
          'OAuth Error 400 (invalid_request): Custom URI scheme is not enabled for your Android client in Google Cloud Console.\n\nFix: In Google Cloud Console -> Credentials -> Your Android Client ID -> Advanced settings -> Enable "Custom URI scheme" and Save.';
      } else if (errorCode === 'redirect_uri_mismatch' || errorDesc.includes('redirect_uri_mismatch')) {
        userMsg =
          'OAuth redirect URI mismatch (Error 400). Verify the Android OAuth client uses package "com.aurelia.salonbooking" and the SHA-1 fingerprint for this build.';
      } else if (errorCode === 'invalid_client' || errorDesc.includes('invalid_client')) {
        userMsg =
          'Invalid OAuth Client ID. Please verify the Web/Android client ID in Google Cloud Console.';
      }

      dialogService.showError('Google Sign-In Failed', userMsg);
      return;
    }

    if (response.type === 'success') {
      console.log('[OAuth Diagnostic] Google OAuth authorization response received:', {
        type: response.type,
        hasParamsIdToken: Boolean(response.params?.id_token),
        hasAuthIdToken: Boolean((response as any).authentication?.idToken),
        hasCode: Boolean(response.params?.code)
      });

      const idToken = response.params?.id_token || (response as any).authentication?.idToken;

      if (!idToken) {
        // If an authorization code was returned, wait for the hook's automatic PKCE token exchange to complete
        if (response.params?.code && !(response as any).authentication) {
          console.log('[OAuth Diagnostic] Auth code received. Waiting for hook automatic token exchange to fulfill idToken...');
          return;
        }

        setGoogleLoading(false);
        dialogService.showError(
          'Authentication Error',
          'Google did not return a valid identification token. Please try again.'
        );
        return;
      }

      void handleCompletedIdToken(idToken);
    }
  }, [response, auth, role, onRegister, onSwitchRole, request, redirectUri]);

  const handleGoogleSignIn = async () => {
    if (googleLoading || loading) return;

    if (isExpoGo) {
      console.warn('[OAuth Diagnostic] Google OAuth is unsupported in Expo Go for this app scheme.');
      dialogService.showInfo(
        'Development Build Required',
        'Google Sign-In cannot complete in Expo Go because OAuth must redirect to this app’s custom Android scheme. Run an EAS development build or `npx expo run:android`; Expo Go remains available for testing the rest of the app.'
      );
      return;
    }

    if (!isExpoGo && Platform.OS === 'android' && !GOOGLE_ANDROID_CLIENT_ID) {
      console.warn(
        '[OAuth Diagnostic] EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID is unset. Android standalone APKs require an Android OAuth Client ID configured in Google Cloud Console with SHA-1.'
      );
    }

    if (!request) {
      console.warn('[OAuth Diagnostic] Google AuthRequest is not ready yet:', { redirectUri });
      dialogService.showInfo(
        'Google Sign-In Initializing',
        'Authentication service is initializing. Please tap again in a moment.'
      );
      return;
    }

    setGoogleLoading(true);
    try {
      console.log('[OAuth Diagnostic] Launching Google authentication flow:', {
        environment: 'Development build / Standalone',
        clientIdType: Platform.OS === 'android' ? 'Android Client ID' : 'Web Client ID',
        redirectUri: request?.redirectUri,
        responseType: request?.responseType,
        platform: Platform.OS
      });

      const res = await promptAsync();
      if (res.type === 'cancel' || res.type === 'dismiss') {
        console.log('[OAuth Diagnostic] promptAsync was cancelled or dismissed');
        setGoogleLoading(false);
      } else if (res.type === 'error') {
        setGoogleLoading(false);
        const errMsg =
          res.error?.message ||
          (res.params as any)?.error_description ||
          'Authentication was interrupted.';
        console.error('[OAuth Diagnostic] promptAsync returned error:', {
          category: classifyOAuthFailure(res.error?.code, errMsg),
          code: res.error?.code,
          redirectUri
        });
        dialogService.showError('Google Sign-In Failed', errMsg);
      }
    } catch (err: any) {
      setGoogleLoading(false);
      console.error('[OAuth Diagnostic] promptAsync threw exception:', {
        name: err?.name,
        category: classifyOAuthFailure(undefined, err?.message),
        message:
          typeof err?.message === 'string'
            ? err.message.replace(/https?:\/\/\S+/gi, '[url]').slice(0, 160)
            : 'No error message'
      });
      dialogService.showError(
        'Google Sign-In Error',
        err instanceof Error ? err.message : 'Unable to launch Google Sign-In.'
      );
    }
  };

  const submit = async () => {
    if (!valid || loading || googleLoading) return;
    setLoading(true);
    try {
      await auth.login(cleanEmail, password.value, role);
    } catch (e: any) {
      const code = e?.code;
      const msg = e instanceof Error ? e.message : 'Please check your credentials and try again.';

      if (code === 'EMAIL_NOT_VERIFIED' || msg.includes('verify your email')) {
        setUnverifiedEmail(cleanEmail);
        setOtpModalVisible(true);
        return;
      }

      if (
        code === 'SALON_OWNER_CREDENTIALS' ||
        msg.includes('salon account') ||
        msg.includes('Salon Owner login')
      ) {
        dialogService.alert(
          'Customer account required',
          'These credentials belong to a salon account. Please use the Salon Owner login.',
          [
            { text: 'OK', style: 'cancel' },
            ...(onSwitchRole
              ? [{ text: 'Switch to Salon Owner', onPress: () => onSwitchRole('SALON_OWNER') }]
              : [])
          ]
        );
      } else if (
        code === 'CUSTOMER_CREDENTIALS' ||
        msg.includes('customer account') ||
        msg.includes('Customer login')
      ) {
        dialogService.alert(
          'Salon Owner account required',
          'These credentials belong to a customer account. Please use Customer login.',
          [
            { text: 'OK', style: 'cancel' },
            ...(onSwitchRole ? [{ text: 'Switch to Customer', onPress: () => onSwitchRole('CUSTOMER') }] : [])
          ]
        );
      } else {
        dialogService.showError('Unable to sign in', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.page}>
      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <AppHeader title="Sign in" onBack={onBack} />
        <Text style={s.eyebrow}>
          {isAdmin
            ? 'PLATFORM ADMINISTRATION'
            : isCustomer
              ? 'FOR BEAUTY LOVERS'
              : 'FOR SALON PARTNERS'}
        </Text>
        <Text style={s.title}>Welcome back.</Text>
        <Text style={s.copy}>
          {isAdmin
            ? 'Secure access for approved platform administrators.'
            : isCustomer
              ? 'Sign in to continue your personal beauty journey.'
              : 'Sign in to manage your salon appointments and atelier.'}
        </Text>
        <View style={s.form}>
          <InputField
            label="Email address"
            value={email.value}
            onChangeText={email.setValue}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@example.com"
          />
          <InputField
            label="Password"
            value={password.value}
            onChangeText={password.setValue}
            isPassword
            placeholder="Your password"
          />
          <Pressable
            onPress={() => {
              if (isAdmin) {
                dialogService.showInfo(
                  'Admin Password Recovery',
                  'Password recovery for Administrator accounts is restricted. Please contact system administration.'
                );
                return;
              }
              onForgotPassword?.(cleanEmail);
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Forgot password"
          >
            <Text style={s.forgot}>Forgot password?</Text>
          </Pressable>
          {!isAdmin && (
            <View style={s.legalLinks}>
              <Text style={s.legalIntro}>Read our policies:</Text>
              <Pressable
                onPress={() => void openTermsUrl()}
                accessibilityRole="link"
                accessibilityLabel="Open Terms & Conditions"
                hitSlop={8}
              >
                <Text style={s.legalLink}>Terms & Conditions</Text>
              </Pressable>
              <Text style={s.legalSeparator}>·</Text>
              <Pressable
                onPress={() => void openPrivacyUrl()}
                accessibilityRole="link"
                accessibilityLabel="Open Privacy Policy"
                hitSlop={8}
              >
                <Text style={s.legalLink}>Privacy Policy</Text>
              </Pressable>
            </View>
          )}
          <PrimaryButton
            label="Sign in"
            loading={loading}
            disabled={!valid || loading || googleLoading}
            onPress={() => void submit()}
          />

          {showGoogleLogin && (
            <>
              <View style={s.divider}>
                <View style={s.line} />
                <Text style={s.or}>OR CONTINUE WITH</Text>
                <View style={s.line} />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Continue with Google"
                accessibilityState={{ disabled: loading || googleLoading }}
                disabled={loading || googleLoading}
                onPress={() => void handleGoogleSignIn()}
                style={({ pressed }) => [
                  s.googleBtn,
                  (loading || googleLoading) && s.disabled,
                  pressed && s.googleBtnPressed
                ]}
              >
                {googleLoading ? (
                  <View style={s.googleBtnContent}>
                    <ActivityIndicator color={colors.espresso} size="small" />
                    <Text style={s.googleBtnText}>Signing in with Google...</Text>
                  </View>
                ) : (
                  <View style={s.googleBtnContent}>
                    <View style={s.googleBadge}>
                      <Text style={s.googleBadgeLetter}>G</Text>
                    </View>
                    <Text style={s.googleBtnText}>Continue with Google</Text>
                  </View>
                )}
              </Pressable>
            </>
          )}

          {!isAdmin && (
            <>
              <View style={s.divider}>
                <View style={s.line} />
                <Text style={s.or}>OR</Text>
                <View style={s.line} />
              </View>
              <SecondaryButton
                label="Create a new account"
                disabled={loading || googleLoading}
                onPress={() => onRegister()}
              />
            </>
          )}
        </View>
      </ScrollView>

      {/* 6-Digit Email OTP Verification Modal */}
      <EmailOtpVerificationModal
        visible={otpModalVisible}
        email={unverifiedEmail}
        onSuccess={async (res) => {
          setOtpModalVisible(false);
          await auth.completeOtpVerification(res);
          dialogService.showSuccess('Email Verified', 'Your email address has been verified. Welcome back!');
        }}
        onClose={() => setOtpModalVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 22, paddingBottom: 34 },
  eyebrow: {
    color: colors.gold,
    letterSpacing: 1.4,
    fontWeight: '700',
    fontSize: 11,
    marginTop: 35
  },
  title: {
    color: colors.ink,
    fontWeight: '700',
    fontSize: 34,
    letterSpacing: -1,
    marginTop: 9
  },
  copy: { color: colors.muted, lineHeight: 22, marginTop: 10 },
  form: { marginTop: 38 },
  legalLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 4
  },
  legalIntro: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 20
  },
  legalLink: {
    color: colors.espresso,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
    textDecorationLine: 'underline'
  },
  legalSeparator: {
    color: colors.muted,
    fontSize: 14
  },
  forgot: {
    alignSelf: 'flex-end',
    color: colors.ink,
    fontWeight: '700',
    fontSize: 13,
    marginTop: -5,
    marginBottom: 24
  },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 11, marginVertical: 20 },
  line: { height: 1, backgroundColor: colors.border, flex: 1 },
  or: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  googleBtn: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    elevation: 1,
    shadowColor: colors.espresso,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3
  },
  googleBtnPressed: {
    backgroundColor: colors.surfaceWarm,
    transform: [{ scale: 0.99 }]
  },
  googleBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10
  },
  googleBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center'
  },
  googleBadgeLetter: {
    fontSize: 16,
    fontWeight: '800',
    color: '#4285F4',
    marginTop: Platform.OS === 'android' ? -2 : 0
  },
  googleBtnText: {
    color: colors.espresso,
    fontWeight: '600',
    fontSize: 15,
    letterSpacing: 0.2
  },
  disabled: {
    opacity: 0.5
  },
});