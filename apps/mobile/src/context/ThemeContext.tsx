import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { darkColors, lightColors, ThemeColors } from '../constants/theme';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ActiveTheme = 'light' | 'dark';

export interface ThemeContextType {
  themeMode: ThemeMode;
  activeTheme: ActiveTheme;
  isDark: boolean;
  colors: ThemeColors;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
}

const THEME_STORAGE_KEY = 'bms_theme_mode';

const ThemeContext = createContext<ThemeContextType>({
  themeMode: 'light',
  activeTheme: 'light',
  isDark: false,
  colors: lightColors,
  setThemeMode: async () => { }
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
  };

  // Enforce consistent Violet & White Light Theme
  const activeTheme: ActiveTheme = 'light';
  const isDark = false;
  const currentColors = lightColors;

  return (
    <ThemeContext.Provider
      value={{
        themeMode: 'light',
        activeTheme,
        isDark,
        colors: currentColors,
        setThemeMode
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
