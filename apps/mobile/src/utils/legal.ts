import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { dialogService } from '../services/dialog.service';

export const TERMS_URL =
  'https://salon-mobile-application-web-racerpkofficial-9813.vercel.app/terms';
export const PRIVACY_URL =
  'https://salon-mobile-application-web-racerpkofficial-9813.vercel.app/privacy';

/**
 * Opens a legal document in a browser, falling back to the system URL handler.
 */
export async function openLegalUrl(url: string): Promise<void> {
  try {
    try {
      await WebBrowser.openBrowserAsync(url, {
        toolbarColor: '#0B0907',
        controlsColor: '#C69232',
        showTitle: true
      });
    } catch {
      await Linking.openURL(url);
    }
  } catch {
    dialogService.showError(
      'Unable to Open Link',
      `Could not open the legal page in browser.\nURL: ${url}`
    );
  }
}

export const openTermsUrl = () => openLegalUrl(TERMS_URL);
export const openPrivacyUrl = () => openLegalUrl(PRIVACY_URL);
