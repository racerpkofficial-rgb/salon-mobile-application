import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { LoadingState } from '../components/LoadingState';
import { SplashScreen } from '../screens/SplashScreen';
import { RoleSelectionScreen } from '../screens/RoleSelectionScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { VerifyOtpScreen } from '../screens/VerifyOtpScreen';
import { ResetPasswordScreen } from '../screens/ResetPasswordScreen';
import { DiscoverScreen } from '../screens/DiscoverScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { AdminDashboardScreen } from '../screens/AdminDashboardScreen';
import { colors } from '../constants/theme';

export function RootNavigator() {
  const { route, role, navigate, chooseRole } = useApp();
  const { user, ready } = useAuth();
  const [preload, setPreload] = useState<{ name?: string; email?: string } | null>(null);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState('');

  if (!ready) return <LoadingState />;

  if (user) {
    if (user.role === 'CUSTOMER') {
      return (
        <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
          <DiscoverScreen />
        </SafeAreaView>
      );
    }

    if (user.role === 'SUPER_ADMIN') {
      return (
        <SafeAreaView style={s.safe} edges={['top', 'bottom', 'left', 'right']}>
          <AdminDashboardScreen />
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
        <DashboardScreen role={user.role} />
      </SafeAreaView>
    );
  }

  let screen;
  if (route === 'SPLASH') {
    screen = <SplashScreen onContinue={() => navigate('ROLE_SELECTION')} />;
  } else if (route === 'ROLE_SELECTION') {
    screen = (
      <RoleSelectionScreen
        onBack={() => navigate('SPLASH')}
        onSelect={(r) => {
          chooseRole(r);
          navigate('LOGIN');
        }}
      />
    );
  } else if (route === 'LOGIN') {
    screen = (
      <LoginScreen
        role={role || 'CUSTOMER'}
        onBack={() => navigate('ROLE_SELECTION')}
        onSwitchRole={(targetRole) => {
          chooseRole(targetRole);
        }}
        onRegister={(data) => {
          setPreload(data || null);
          navigate(role === 'SALON_OWNER' ? 'OWNER_REGISTER' : 'CUSTOMER_REGISTER');
        }}
        onForgotPassword={(email) => {
          setForgotEmail(email || '');
          navigate('FORGOT_PASSWORD');
        }}
      />
    );
  } else if (route === 'FORGOT_PASSWORD') {
    screen = (
      <ForgotPasswordScreen
        role={role || 'CUSTOMER'}
        initialEmail={forgotEmail}
        onBack={() => navigate('LOGIN')}
        onSuccess={(email) => {
          setForgotEmail(email);
          navigate('VERIFY_OTP');
        }}
      />
    );
  } else if (route === 'VERIFY_OTP') {
    screen = (
      <VerifyOtpScreen
        email={forgotEmail}
        role={role || 'CUSTOMER'}
        onBack={() => navigate('FORGOT_PASSWORD')}
        onSuccess={(token) => {
          setResetToken(token);
          navigate('RESET_PASSWORD');
        }}
      />
    );
  } else if (route === 'RESET_PASSWORD') {
    screen = (
      <ResetPasswordScreen
        resetToken={resetToken}
        onBack={() => navigate('LOGIN')}
        onSuccess={() => {
          setResetToken('');
          setForgotEmail('');
          navigate('LOGIN');
        }}
      />
    );
  } else if (route === 'CUSTOMER_REGISTER') {
    screen = (
      <RegisterScreen
        role="CUSTOMER"
        initialName={preload?.name}
        initialEmail={preload?.email}
        onBack={() => {
          setPreload(null);
          navigate('LOGIN');
        }}
      />
    );
  } else {
    screen = (
      <RegisterScreen
        role="SALON_OWNER"
        initialName={preload?.name}
        initialEmail={preload?.email}
        onBack={() => {
          setPreload(null);
          navigate('LOGIN');
        }}
      />
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom', 'left', 'right']}>
      {screen}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background
  }
});