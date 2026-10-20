import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { AppHeader } from '../components/AppHeader';
import { PrimaryButton } from '../components/PrimaryButton';
import { PasswordValidationGroup } from '../components/PasswordValidationGroup';
import { colors, radius, typography } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { dialogService } from '../services/dialog.service';
import { IdentityProof, UserRole } from '../types';
import {
  checkPasswordStrength,
  isEmail,
  isStrongPassword,
  isValidPhone,
  normalizePhone
} from '../utils/validation';
import { openTermsUrl, openPrivacyUrl } from '../utils/legal';

interface RegisterScreenProps {
  role: Extract<UserRole, 'CUSTOMER' | 'SALON_OWNER'>;
  onBack: () => void;
  initialName?: string;
  initialEmail?: string;
}

const SAMPLE_DOCS: Array<{ filename: string; fileType: string; fileSize: number; label: string }> = [
  {
    filename: 'gst_certificate.pdf',
    fileType: 'application/pdf',
    fileSize: 245000,
    label: 'GST Registration Certificate (PDF)'
  },
  {
    filename: 'business_pan_card.png',
    fileType: 'image/png',
    fileSize: 420000,
    label: 'Proprietor Business PAN Card (PNG)'
  },
  {
    filename: 'trade_license.pdf',
    fileType: 'application/pdf',
    fileSize: 310000,
    label: 'Municipal Trade License (PDF)'
  },
  {
    filename: 'salon_establishment_certificate.jpg',
    fileType: 'image/jpeg',
    fileSize: 580000,
    label: 'Salon Shop & Establishment Reg (JPG)'
  }
];

export function RegisterScreen({ role, onBack, initialName, initialEmail }: RegisterScreenProps) {
  const auth = useAuth();

  // Common Fields
  const [name, setName] = useState(initialName || '');
  const [email, setEmail] = useState(initialEmail || '');

  React.useEffect(() => {
    if (initialName && !name) setName(initialName);
    if (initialEmail && !email) setEmail(initialEmail);
  }, [initialName, initialEmail]);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Salon Owner Fields
  const [salonName, setSalonName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [identityProof, setIdentityProof] = useState<IdentityProof | null>(null);

  // Document Picker Modal & Progress States
  const [docModalVisible, setDocModalVisible] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [docError, setDocError] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [loading, setLoading] = useState(false);

  // Validation evaluations
  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();
  const cleanPhone = phone.trim();
  const passwordStrength = checkPasswordStrength(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const isEmailValid = isEmail(cleanEmail);

  // Phone validation
  const isPhoneValid =
    role === 'SALON_OWNER'
      ? isValidPhone(cleanPhone)
      : cleanPhone.length === 0 || isValidPhone(cleanPhone);

  // Salon Owner specific validation
  const isOwnerValid =
    role === 'CUSTOMER' ||
    (salonName.trim().length >= 2 &&
      address.trim().length >= 3 &&
      city.trim().length >= 2 &&
      Boolean(identityProof));

  const isFormValid =
    cleanName.length >= 2 &&
    isEmailValid &&
    isPhoneValid &&
    passwordStrength.isValid &&
    passwordsMatch &&
    isOwnerValid &&
    agreedToTerms;

  const handleSelectDocument = (doc: typeof SAMPLE_DOCS[0]) => {
    setDocError(null);
    setDocModalVisible(false);
    setUploadingDoc(true);
    setUploadProgress(15);

    // Simulate luxury secure upload progress with validation
    const timer1 = setTimeout(() => setUploadProgress(65), 250);
    const timer2 = setTimeout(() => {
      setUploadProgress(100);
      setUploadingDoc(false);
      setIdentityProof({
        url: `https://docs.aureliabeaute.internal/secure/id-docs/${Date.now()}_${doc.filename}`,
        filename: doc.filename,
        fileType: doc.fileType,
        fileSize: doc.fileSize,
        uploadedAt: new Date().toISOString()
      });
    }, 550);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  };

  const handleRemoveDocument = () => {
    setIdentityProof(null);
    setUploadProgress(0);
    setDocError(null);
  };

  const handleSubmit = async () => {
    if (!isFormValid || loading) return;

    setLoading(true);
    try {
      if (role === 'CUSTOMER') {
        await auth.register('CUSTOMER', {
          name: cleanName,
          email: cleanEmail,
          password,
          confirmPassword,
          phone: cleanPhone ? normalizePhone(cleanPhone) : undefined
        });
      } else {
        await auth.register('SALON_OWNER', {
          name: cleanName,
          email: cleanEmail,
          phone: normalizePhone(cleanPhone),
          password,
          confirmPassword,
          salonName: salonName.trim(),
          address: address.trim(),
          city: city.trim(),
          identityProof: identityProof!
        });
      }
    } catch (e) {
      dialogService.showError(
        'Registration Failed',
        e instanceof Error ? e.message : 'Please check your information and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={s.page}
    >
      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AppHeader title="Create account" onBack={onBack} />

        <View style={s.badgeWrap}>
          <Text style={s.eyebrow}>
            {role === 'CUSTOMER' ? 'YOUR BEAUTY, YOUR TIME' : 'VERIFIED SALON PARTNER'}
          </Text>
        </View>

        <Text style={s.title}>
          {role === 'CUSTOMER' ? 'A little time for you.' : 'Register your luxury atelier.'}
        </Text>
        <Text style={s.copy}>
          {role === 'CUSTOMER'
            ? 'Create your customer account with private credentials to book appointments seamlessly.'
            : 'Register your salon profile with official business verification. Upon registration, your salon will be submitted for Super Admin approval.'}
        </Text>

        <View style={s.form}>
          {/* 1. Full Name */}
          <View style={s.fieldGroup}>
            <Text style={s.label}>
              {role === 'SALON_OWNER' ? 'Owner full name *' : 'Full name *'}
            </Text>
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Claire Dupont"
              placeholderTextColor={colors.subtle}
              autoCapitalize="words"
            />
            {name.length > 0 && cleanName.length < 2 && (
              <Text style={s.fieldError}>Name must have at least 2 characters</Text>
            )}
          </View>

          {/* 2. Email Address */}
          <View style={s.fieldGroup}>
            <Text style={s.label}>Email address *</Text>
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.subtle}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            {email.length > 0 && !isEmailValid && (
              <Text style={s.fieldError}>Please enter a valid email address</Text>
            )}
          </View>

          {/* 3. Mobile Number */}
          <View style={s.fieldGroup}>
            <View style={s.labelRow}>
              <Text style={s.label}>
                {role === 'SALON_OWNER' ? 'Mobile number (Required) *' : 'Mobile number (Optional)'}
              </Text>
              <Text style={s.hintTag}>+91 India</Text>
            </View>
            <View style={s.phoneRow}>
              <View style={s.countryCodeBox}>
                <Text style={s.countryCodeText}>🇮🇳 +91</Text>
              </View>
              <TextInput
                style={[s.input, s.phoneInput]}
                value={phone}
                onChangeText={setPhone}
                placeholder="10-digit mobile number"
                placeholderTextColor={colors.subtle}
                keyboardType="phone-pad"
                maxLength={15}
              />
            </View>
            {phone.length > 0 && !isValidPhone(cleanPhone) && (
              <Text style={s.fieldError}>
                Enter a valid 10-digit mobile number (e.g. 98765 43210)
              </Text>
            )}
          </View>

          {/* 4. Salon Details (Owner Only) */}
          {role === 'SALON_OWNER' && (
            <>
              <View style={s.sectionDivider}>
                <Text style={s.sectionDividerText}>ATELIER & LOCATION DETAILS</Text>
              </View>

              <View style={s.fieldGroup}>
                <Text style={s.label}>Salon name *</Text>
                <TextInput
                  style={s.input}
                  value={salonName}
                  onChangeText={setSalonName}
                  placeholder="e.g. Maison de Beauté"
                  placeholderTextColor={colors.subtle}
                />
              </View>

              <View style={s.fieldGroup}>
                <Text style={s.label}>Salon address *</Text>
                <TextInput
                  style={s.input}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Street, locality, landmark"
                  placeholderTextColor={colors.subtle}
                />
              </View>

              <View style={s.fieldGroup}>
                <Text style={s.label}>City *</Text>
                <TextInput
                  style={s.input}
                  value={city}
                  onChangeText={setCity}
                  placeholder="e.g. Bengaluru, Mumbai"
                  placeholderTextColor={colors.subtle}
                />
              </View>

              {/* Identity Proof Document Field */}
              <View style={s.fieldGroup}>
                <View style={s.labelRow}>
                  <Text style={s.label}>Identity proof document *</Text>
                  <Text style={s.hintTag}>JPG, PNG, PDF (≤10MB)</Text>
                </View>

                {identityProof ? (
                  <View style={s.docCard}>
                    <View style={s.docIconBox}>
                      <Text style={s.docIcon}>📄</Text>
                    </View>
                    <View style={{ flex: 1, marginHorizontal: 10 }}>
                      <Text style={s.docFilename} numberOfLines={1}>
                        {identityProof.filename}
                      </Text>
                      <Text style={s.docMeta}>
                        {identityProof.fileType} • {Math.round((identityProof.fileSize || 0) / 1024)} KB
                      </Text>
                      <Text style={s.docVerified}>✓ Document attached & encrypted</Text>
                    </View>
                    <View style={s.docActions}>
                      <Pressable
                        onPress={() => setDocModalVisible(true)}
                        style={s.replaceBtn}
                      >
                        <Text style={s.replaceBtnText}>Replace</Text>
                      </Pressable>
                      <Pressable onPress={handleRemoveDocument} style={s.removeBtn}>
                        <Text style={s.removeBtnText}>✕</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    style={s.uploadBox}
                    onPress={() => setDocModalVisible(true)}
                  >
                    <Text style={s.uploadIcon}>📑</Text>
                    <Text style={s.uploadTitle}>Select / Upload Identity Proof</Text>
                    <Text style={s.uploadSubtitle}>
                      Attach GST Certificate, Trade License, PAN, or Registration
                    </Text>
                    {uploadingDoc && (
                      <View style={s.progressBarWrap}>
                        <View style={[s.progressBar, { width: `${uploadProgress}%` }]} />
                        <Text style={s.progressText}>Encrypting & validating... {uploadProgress}%</Text>
                      </View>
                    )}
                  </Pressable>
                )}

                {docError && <Text style={s.fieldError}>{docError}</Text>}
              </View>
            </>
          )}

          {/* 5. Password & Confirm Password */}
          <View style={s.sectionDivider}>
            <Text style={s.sectionDividerText}>SECURITY CREDENTIALS</Text>
          </View>

          <PasswordValidationGroup
            password={password}
            onPasswordChange={setPassword}
            confirmPassword={confirmPassword}
            onConfirmPasswordChange={setConfirmPassword}
          />

          {/* Legal Terms & Privacy Consent Checkbox */}
          <View style={s.consentRow}>
            <Pressable
              style={s.checkboxPressable}
              onPress={() => setAgreedToTerms((prev) => !prev)}
              accessible={true}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: agreedToTerms }}
              accessibilityLabel="I agree to the Terms & Conditions and acknowledge the Privacy Policy"
            >
              <View style={[s.checkbox, agreedToTerms && s.checkboxChecked]}>
                {agreedToTerms && <Text style={s.checkmark}>✓</Text>}
              </View>
              <View style={s.consentTextContainer}>
                <Text style={s.consentText}>
                  I agree to the{' '}
                  <Text
                    style={s.consentLink}
                    onPress={(e) => {
                      e.stopPropagation();
                      void openTermsUrl();
                    }}
                  >
                    Terms & Conditions
                  </Text>{' '}
                  and acknowledge the{' '}
                  <Text
                    style={s.consentLink}
                    onPress={(e) => {
                      e.stopPropagation();
                      void openPrivacyUrl();
                    }}
                  >
                    Privacy Policy
                  </Text>
                  .
                </Text>
              </View>
            </Pressable>
          </View>

          {/* Primary Action Button */}
          <PrimaryButton
            label={role === 'CUSTOMER' ? 'Create free account' : 'Submit partner registration'}
            loading={loading}
            disabled={!isFormValid || loading}
            onPress={() => void handleSubmit()}
          />
        </View>

        {/* Informational Footer Note */}
        <View style={s.note}>
          <Text style={s.noteTitle}>
            {role === 'CUSTOMER' ? 'Always Free for Clients' : 'Super Admin Verification'}
          </Text>
          <Text style={s.noteCopy}>
            {role === 'CUSTOMER'
              ? 'Customers never pay platform fees. Your profile details can be edited anytime under Settings.'
              : 'Newly registered salons remain in PENDING_APPROVAL status. Identity documents are secured privately and reviewed by the platform Super Admin.'}
          </Text>
        </View>
      </ScrollView>

      {/* Document Selection Modal */}
      <Modal
        visible={docModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDocModalVisible(false)}
      >
        <Pressable
          style={s.modalBackdrop}
          onPress={() => setDocModalVisible(false)}
        >
          <Pressable style={s.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={s.modalTitle}>Select Identity Proof Document</Text>
            <Text style={s.modalSubtitle}>
              Please select a valid official government or business identity proof document for verification.
            </Text>

            <View style={s.docOptionsList}>
              {SAMPLE_DOCS.map((doc, idx) => (
                <Pressable
                  key={idx}
                  style={s.docOptionItem}
                  onPress={() => handleSelectDocument(doc)}
                >
                  <View style={s.docOptionIcon}>
                    <Text style={{ fontSize: 18 }}>
                      {doc.fileType.includes('pdf') ? '📕' : '🖼️'}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={s.docOptionTitle}>{doc.label}</Text>
                    <Text style={s.docOptionMeta}>
                      {doc.filename} • {Math.round(doc.fileSize / 1024)} KB
                    </Text>
                  </View>
                  <Text style={s.docOptionSelect}>Attach</Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={() => setDocModalVisible(false)}
              style={s.modalCancelBtn}
            >
              <Text style={s.modalCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 22, paddingBottom: 40 },
  badgeWrap: { marginTop: 20 },
  eyebrow: {
    color: colors.gold,
    letterSpacing: 1.4,
    fontWeight: '800',
    fontSize: 11
  },
  title: {
    color: colors.espresso,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.8,
    fontWeight: '800',
    marginTop: 8
  },
  copy: {
    color: colors.muted,
    lineHeight: 21,
    marginTop: 8,
    fontSize: 13
  },
  form: { marginTop: 24 },
  fieldGroup: { marginBottom: 16 },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  label: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.espresso,
    letterSpacing: 0.2
  },
  hintTag: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '600'
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    color: colors.espresso,
    fontSize: 14
  },
  inputError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft
  },
  fieldError: {
    color: colors.danger,
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600'
  },

  // Phone input styling
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  countryCodeBox: {
    height: 50,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.champagne,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8
  },
  countryCodeText: {
    color: colors.espresso,
    fontSize: 13,
    fontWeight: '700'
  },
  phoneInput: {
    flex: 1
  },

  // Section divider
  sectionDivider: {
    marginTop: 12,
    marginBottom: 16,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  sectionDividerText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.gold
  },

  // Document upload styling
  uploadBox: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.gold,
    borderRadius: radius.md,
    padding: 18,
    backgroundColor: colors.goldSoft,
    alignItems: 'center'
  },
  uploadIcon: { fontSize: 28, marginBottom: 6 },
  uploadTitle: { fontSize: 14, fontWeight: '700', color: colors.espresso },
  uploadSubtitle: { fontSize: 11, color: colors.muted, marginTop: 4, textAlign: 'center' },
  progressBarWrap: {
    width: '100%',
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    marginTop: 12,
    overflow: 'hidden'
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.gold
  },
  progressText: {
    fontSize: 10,
    color: colors.goldDark,
    fontWeight: '700',
    marginTop: 4,
    alignSelf: 'center'
  },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.successBorder,
    borderRadius: radius.md
  },
  docIconBox: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: colors.successSoft,
    justifyContent: 'center',
    alignItems: 'center'
  },
  docIcon: { fontSize: 18 },
  docFilename: { fontSize: 13, fontWeight: '700', color: colors.espresso },
  docMeta: { fontSize: 11, color: colors.muted, marginTop: 2 },
  docVerified: { fontSize: 11, color: colors.success, fontWeight: '700', marginTop: 2 },
  docActions: { flexDirection: 'row', alignItems: 'center' },
  replaceBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: colors.champagne,
    borderRadius: radius.sm,
    marginRight: 6
  },
  replaceBtnText: { fontSize: 11, fontWeight: '700', color: colors.espresso },
  removeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm
  },
  removeBtnText: { fontSize: 11, fontWeight: '800', color: colors.danger },

  // Password toggle
  passwordWrap: {
    position: 'relative',
    justifyContent: 'center'
  },
  passwordInput: {
    paddingRight: 65
  },
  toggleBtn: {
    position: 'absolute',
    right: 14,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center'
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.goldDark
  },

  // Strength tags & meters
  strengthTag: {
    fontSize: 11,
    fontWeight: '700'
  },
  strengthTagWeak: { color: colors.danger },
  strengthTagFair: { color: colors.warning },
  strengthTagStrong: { color: colors.success },

  meterBarWrap: {
    flexDirection: 'row',
    height: 4,
    marginTop: 8,
    gap: 4
  },
  meterSegment: {
    flex: 1,
    backgroundColor: colors.border,
    borderRadius: 2
  },
  meterSegmentDanger: { backgroundColor: colors.danger },
  meterSegmentFair: { backgroundColor: colors.warning },
  meterSegmentSuccess: { backgroundColor: colors.success },

  // Rules list
  rulesList: {
    marginTop: 10,
    padding: 10,
    backgroundColor: colors.surfaceWarm,
    borderRadius: radius.sm,
    gap: 4
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  ruleCheck: {
    fontSize: 11,
    color: colors.subtle,
    width: 16,
    fontWeight: '700'
  },
  ruleCheckDone: {
    color: colors.success
  },
  ruleText: {
    fontSize: 11,
    color: colors.muted
  },
  ruleTextDone: {
    color: colors.espresso,
    fontWeight: '600'
  },

  matchTag: {
    fontSize: 11,
    fontWeight: '700'
  },
  matchTagMatch: { color: colors.success },
  matchTagMismatch: { color: colors.danger },

  // Notes
  note: {
    marginTop: 24,
    padding: 16,
    backgroundColor: colors.goldSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border
  },
  noteTitle: { color: colors.espresso, fontWeight: '700', fontSize: 13 },
  noteCopy: { color: colors.muted, lineHeight: 19, fontSize: 12, marginTop: 4 },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.espresso },
  modalSubtitle: { fontSize: 12, color: colors.muted, marginTop: 4, lineHeight: 17 },
  docOptionsList: { marginTop: 16, gap: 10 },
  docOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceWarm
  },
  docOptionIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.champagne,
    justifyContent: 'center',
    alignItems: 'center'
  },
  docOptionTitle: { fontSize: 13, fontWeight: '700', color: colors.espresso },
  docOptionMeta: { fontSize: 11, color: colors.muted, marginTop: 2 },
  docOptionSelect: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.goldDark,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  modalCancelBtn: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 10
  },
  modalCancelText: { fontSize: 14, fontWeight: '700', color: colors.muted },
  consentRow: {
    marginTop: 14,
    marginBottom: 16,
    paddingHorizontal: 2
  },
  checkboxPressable: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2
  },
  checkboxChecked: {
    backgroundColor: colors.gold,
    borderColor: colors.gold
  },
  checkmark: {
    color: '#0B0907',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 16
  },
  consentTextContainer: {
    flex: 1
  },
  consentText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted
  },
  consentLink: {
    color: colors.goldDark,
    fontWeight: '700',
    textDecorationLine: 'underline'
  }
});