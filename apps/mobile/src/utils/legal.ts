import { Linking } from 'react-native';
import { dialogService } from '../services/dialog.service';

export const TERMS_URL =
  'https://salon-mobile-application-web-racerpkofficial-9813.vercel.app/terms';
export const PRIVACY_URL =
  'https://salon-mobile-application-web-racerpkofficial-9813.vercel.app/privacy';

/**
 * Opens a legal document directly in the user's external default web browser (e.g. Chrome).
 * This ensures the mobile application activity and navigation stack state are completely preserved
 * in the background. When the user returns to the app, they resume on the exact same screen without
 * back-press interception, app closure, or unwanted resets.
 */
export async function openLegalUrl(url: string): Promise<void> {
  try {
    const canOpen = await Linking.canOpenURL(url).catch(() => true);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      dialogService.showError(
        'Unable to Open Link',
        `No default browser was found to open this legal document.\nURL: ${url}`
      );
    }
  } catch (err) {
    dialogService.showError(
      'Unable to Open Link',
      `Could not launch browser for legal page.\nURL: ${url}`
    );
  }
}

export const openTermsUrl = () => openLegalUrl(TERMS_URL);
export const openPrivacyUrl = () => openLegalUrl(PRIVACY_URL);
