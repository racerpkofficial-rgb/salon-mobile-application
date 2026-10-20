import { Linking } from 'react-native';
import { dialogService } from '../services/dialog.service';

export const OFFICIAL_SUPPORT_EMAIL = 'bookmysalonadmin@gmail.com';
export const OFFICIAL_SUPPORT_PHONE = '+91 80 4123 4567';

export interface EmailSupportOptions {
  role?: 'CUSTOMER' | 'SALON_OWNER' | 'SUPER_ADMIN';
  userName?: string;
  userEmail?: string;
  customSubject?: string;
  customBody?: string;
}

/**
 * Opens the device's default mail client pre-addressed to bookmysalonadmin@gmail.com.
 * Pre-fills role-specific subject and helpful body without exposing sensitive secrets.
 * Displays a fallback alert if no email app is available.
 */
export async function openSupportEmail(options: EmailSupportOptions = {}): Promise<void> {
  const isOwner = options.role === 'SALON_OWNER';
  const defaultSubject = isOwner
    ? 'Book My Salon - Salon Owner Support'
    : 'Book My Salon - Customer Support';

  const subject = options.customSubject || defaultSubject;
  const roleLabel = isOwner ? 'Salon Owner / Partner' : 'Customer';

  let body = options.customBody;
  if (!body) {
    const userLine = options.userName ? `Name: ${options.userName}\n` : '';
    const emailLine = options.userEmail ? `Account Email: ${options.userEmail}\n` : '';

    body =
      `Hello Book My Salon Support Team,\n\n` +
      `User Role: ${roleLabel}\n` +
      userLine +
      emailLine +
      `\nPlease describe your inquiry, feedback, or issue below:\n` +
      `----------------------------------------\n\n`;
  }

  const mailtoUrl = `mailto:${OFFICIAL_SUPPORT_EMAIL}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;

  try {
    const canOpen = await Linking.canOpenURL(mailtoUrl);
    if (canOpen) {
      await Linking.openURL(mailtoUrl);
      return;
    }

    // Fallback if Linking.canOpenURL is false
    dialogService.showInfo(
      'Email Support',
      `No default email app was detected on your device.\n\nPlease email our support desk directly at:\n${OFFICIAL_SUPPORT_EMAIL}`
    );
  } catch {
    // Fallback if opening URL threw an error
    dialogService.showInfo(
      'Email Support',
      `Could not open email application.\n\nPlease reach out directly to:\n${OFFICIAL_SUPPORT_EMAIL}`
    );
  }
}

/**
 * Initiates a phone call to the official helpline.
 */
export async function callSupportPhone(): Promise<void> {
  const telUrl = 'tel:+918041234567';
  try {
    const canOpen = await Linking.canOpenURL(telUrl);
    if (canOpen) {
      await Linking.openURL(telUrl);
      return;
    }
    dialogService.showInfo('Customer Care', `Call our helpline directly at:\n${OFFICIAL_SUPPORT_PHONE}`);
  } catch {
    dialogService.showInfo('Customer Care', `Call our helpline directly at:\n${OFFICIAL_SUPPORT_PHONE}`);
  }
}
