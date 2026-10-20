export interface PasswordStrengthResult {
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
  isValid: boolean;
  score: number; // 0 to 5
  label: 'Weak' | 'Fair' | 'Good' | 'Strong' | 'Very Strong';
}

export function checkPasswordStrength(password: string): PasswordStrengthResult {
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>_\-\\\/+=~`\[\]]/.test(password);

  const checks = [hasMinLength, hasUppercase, hasLowercase, hasNumber, hasSpecialChar];
  const score = checks.filter(Boolean).length;
  const isValid = score === 5;

  let label: PasswordStrengthResult['label'] = 'Weak';
  if (score === 5) {
    label = password.length >= 12 ? 'Very Strong' : 'Strong';
  } else if (score >= 4) {
    label = 'Good';
  } else if (score >= 3) {
    label = 'Fair';
  }

  return {
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecialChar,
    isValid,
    score,
    label
  };
}

export const isStrongPassword = (value: string): boolean => {
  return checkPasswordStrength(value).isValid;
};

export const isEmail = (value: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
};

export function isValidPhone(phone: string): boolean {
  if (!phone) return false;
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  if (/^[6-9]\d{9}$/.test(cleaned)) return true;
  if (/^0[6-9]\d{9}$/.test(cleaned)) return true;
  if (/^\+91[6-9]\d{9}$/.test(cleaned)) return true;
  if (/^91[6-9]\d{9}$/.test(cleaned)) return true;
  if (/^\+[1-9]\d{7,14}$/.test(cleaned)) return true;
  return false;
}

export function normalizePhone(rawPhone: string, defaultCode = '+91'): string {
  const cleaned = rawPhone.trim().replace(/[\s\-\(\)\.]/g, '');
  if (/^[6-9]\d{9}$/.test(cleaned)) return `${defaultCode}${cleaned}`;
  if (/^0[6-9]\d{9}$/.test(cleaned)) return `${defaultCode}${cleaned.slice(1)}`;
  if (/^\+91[6-9]\d{9}$/.test(cleaned)) return cleaned;
  if (/^91[6-9]\d{9}$/.test(cleaned)) return `+${cleaned}`;
  if (/^\+[1-9]\d{7,14}$/.test(cleaned)) return cleaned;
  return rawPhone;
}