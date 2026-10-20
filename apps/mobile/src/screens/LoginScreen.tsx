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
import { OFFICIAL_SUPPORT_EMAIL } from '../utils/support';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  '802872702930-0phsd8fcqd5m98efqcu7u5d89g6mblpk.apps.googleusercontent.com';

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
  const processedTokenRef = useRef<string | null>(null);

  const cleanEmail = email.value.trim();
  const valid = isEmail(cleanEmail) && password.value.length > 0;
  const isCustomer = role === 'CUSTOMER';
  const isOwner = role === 'SALON_OWNER';
  const isAdmin = role === 'SUPER_ADMIN';
  const showGoogleLogin = isCustomer || isOwner;

  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'book-my-salon',
    path: 'oauthredirect'
  });

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    webClientId: GOOGLE_CLIENT_ID,
    androidClientId: GOOGLE_CLIENT_ID,
    iosClientId: GOOGLE_CLIENT_ID,
    redirectUri,
    responseType: AuthSession.ResponseType.IdToken,
    scopes: ['openid', 'profile', 'email']
  });

  useEffect(() => {
    if (!response) return;

    if (response.type === 'cancel' || response.type === 'dismiss') {
      setGoogleLoading(false);
      return;
    }

    if (response.type === 'error') {
      setGoogleLoading(false);
      const errorMsg =
        response.error?.message ||
        (response.params as any)?.error_description ||
        'Google authentication could not be completed.';
      dialogService.showError('Google Sign-In Failed', errorMsg);
      return;
    }

    if (response.type === 'success') {
      const idToken = response.params?.id_token || (response as any).authentication?.idToken;

      if (!idToken) {
        setGoogleLoading(false);
        dialogService.showError(
          'Authentication Error',
          'Google did not return a valid identification token. Please try again.'
        );
        return;
      }

      if (processedTokenRef.current === idToken) return;
      processedTokenRef.current = idToken;

      (async () => {
        setGoogleLoading(true);
        try {
          const res = await auth.googleLogin(idToken, role);

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
      })();
    }
  }, [response, auth, role, onRegister, onSwitchRole]);

  const handleGoogleSignIn = async () => {
    if (googleLoading || loading) return;

    if (!request) {
      dialogService.showInfo(
        'Google Sign-In Initializing',
        'Authentication service is initializing. Please tap again in a moment.'
      );
      return;
    }

    setGoogleLoading(true);
    try {
      const res = await promptAsync();
      if (res.type === 'cancel' || res.type === 'dismiss') {
        setGoogleLoading(false);
      } else if (res.type === 'error') {
        setGoogleLoading(false);
        dialogService.showError(
          'Google Sign-In Failed',
          res.error?.message || 'Authentication was interrupted.'
        );
      }
    } catch (err: any) {
      setGoogleLoading(false);
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
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
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
        <Text style={s.legal}>
          By continuing, you agree to Book My Salon’s Terms and Privacy Policy.
        </Text>
      </ScrollView>
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
  legal: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 29
  }
});