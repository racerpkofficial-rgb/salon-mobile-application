/**
 * Phone number validation and normalization utility.
 * Supports configurable country code with India (+91) by default.
 */
export function normalizePhoneNumber(rawPhone: string, defaultCountryCode = '+91'): string {
  if (!rawPhone || typeof rawPhone !== 'string') {
    throw new Error('Mobile number is required');
  }

  // Remove whitespace, hyphens, dots, parentheses
  const cleaned = rawPhone.trim().replace(/[\s\-\(\)\.]/g, '');

  if (!cleaned) {
    throw new Error('Mobile number is required');
  }

  // Check if standard 10-digit Indian mobile number (starts with 6, 7, 8, 9)
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return `${defaultCountryCode}${cleaned}`;
  }

  // Check if 11-digit starting with 0 (e.g. 09876543210)
  if (/^0[6-9]\d{9}$/.test(cleaned)) {
    return `${defaultCountryCode}${cleaned.slice(1)}`;
  }

  // Check if already prefixed with +91
  if (/^\+91[6-9]\d{9}$/.test(cleaned)) {
    return cleaned;
  }

  // Check if starts with 91 followed by 10 digits
  if (/^91[6-9]\d{9}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  // General international E.164 mobile number (+ followed by 8-15 digits)
  if (/^\+[1-9]\d{7,14}$/.test(cleaned)) {
    return cleaned;
  }

  throw new Error('Invalid mobile number. Please provide a valid 10-digit mobile number (e.g. +91 98765 43210)');
}

export function isValidPhoneNumber(rawPhone: string): boolean {
  try {
    normalizePhoneNumber(rawPhone);
    return true;
  } catch {
    return false;
  }
}
