import { Linking, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { dialogService } from '../services/dialog.service';

/**
 * Returns the public base URL for BookMy Salon legal documentation.
 * 1. Checks EXPO_PUBLIC_LEGAL_URL (for production deployment, e.g. https://your-domain.vercel.app)
 * 2. Fallback to API host derived from EXPO_PUBLIC_API_BASE_URL (e.g. http://10.224.9.47:4000)
 * 3. Default to emulator/localhost:4000
 */
function getLegalBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_LEGAL_URL) {
    return process.env.EXPO_PUBLIC_LEGAL_URL.replace(/\/+$/, '');
  }

  const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (apiBase) {
    return apiBase.replace(/\/api(\/v1)?\/?$/, '');
  }

  const defaultHost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
  return `http://${defaultHost}:4000`;
}

export const LEGAL_BASE_URL = getLegalBaseUrl();
export const TERMS_URL = `${LEGAL_BASE_URL}/terms`;
export const PRIVACY_URL = `${LEGAL_BASE_URL}/privacy`;

/**
 * Opens a legal document URL using Android Chrome Custom Tabs (via expo-web-browser)
 * or falls back to standard system browser Linking.openURL.
 */
export async function openLegalUrl(url: string, title?: string): Promise<void> {
  try {
    const supported = await Linking.canOpenURL(url).catch(() => true);
    if (supported) {
      try {
        await WebBrowser.openBrowserAsync(url, {
          toolbarColor: '#0B0907',
          controlsColor: '#C69232',
          showTitle: true
        });
        return;
      } catch {
        await Linking.openURL(url);
        return;
      }
    }
    dialogService.showError('Unable to Open Link', `Please visit:\n${url}`);
  } catch {
    dialogService.showError(
      'Unable to Open Link',
      `Could not open the legal page in browser.\nURL: ${url}`
    );
  }
}

export const openTermsUrl = () => openLegalUrl(TERMS_URL, 'Terms & Conditions');
export const openPrivacyUrl = () => openLegalUrl(PRIVACY_URL, 'Privacy Policy');
