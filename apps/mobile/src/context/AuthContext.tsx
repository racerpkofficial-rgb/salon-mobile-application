import * as SecureStore from 'expo-secure-store';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { getCurrentUser } from '../api/client';
import {
  authService,
  CustomerRegistrationPayload,
  SalonOwnerRegistrationPayload
} from '../services/auth.service';
import { locationService } from '../services/location.service';
import { AuthResponse, AuthUser, GoogleAuthResponse, UserRole } from '../types';

const TOKEN_KEY = 'aurelia.auth.token';

type RegisterData = CustomerRegistrationPayload | SalonOwnerRegistrationPayload;

type State = {
  user: AuthUser | null;
  token: string | null;
  ready: boolean;
  login: (email: string, password: string, role?: UserRole) => Promise<void>;
  googleLogin: (idToken: string, role?: UserRole) => Promise<GoogleAuthResponse>;
  register: (
    role: Extract<UserRole, 'CUSTOMER' | 'SALON_OWNER'>,
    data: any
  ) => Promise<AuthResponse>;
  updateUser: (updated: AuthUser) => void;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
};

const C = createContext<State | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const save = async (result: AuthResponse) => {
    await SecureStore.setItemAsync(TOKEN_KEY, result.token);
    setToken(result.token);
    setUser(result.user);
    return result;
  };

  const refreshUser = async () => {
    if (!token) return;
    try {
      const res = await authService.getProfile(token);
      if (res?.user) {
        setUser(res.user);
      }
    } catch {
      // quiet fallback
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync(TOKEN_KEY);
        if (saved) {
          const result = await getCurrentUser(saved);
          setToken(saved);
          setUser(result.user);
        }
      } catch {
        await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
        setToken(null);
        setUser(null);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      ready,
      login: async (email: string, password: string, role?: UserRole) => {
        const res = await authService.login(email, password, role);
        await save(res);
      },
      googleLogin: async (idToken: string, role?: UserRole) => {
        const res = await authService.googleLogin(idToken, role);
        if (res.token && res.user) {
          await save({ token: res.token, user: res.user, salon: res.salon });
        }
        return res;
      },
      register: async (
        role: Extract<UserRole, 'CUSTOMER' | 'SALON_OWNER'>,
        data: any
      ) => {
        const res =
          role === 'CUSTOMER'
            ? await authService.registerCustomer(data)
            : await authService.registerOwner(data);
        await save(res);
        return res;
      },
      updateUser: (updated: AuthUser) => setUser(updated),
      refreshUser,
      logout: async () => {
        try {
          if (token) await authService.logout(token).catch(() => {});
        } finally {
          locationService.clearCachedLocation();
          await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
          setToken(null);
          setUser(null);
        }
      }
    }),
    [user, token, ready]
  );

  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useAuth() {
  const v = useContext(C);
  if (!v) throw new Error('AuthProvider required');
  return v;
}