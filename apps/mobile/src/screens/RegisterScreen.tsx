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
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { AppHeader } from '../components/AppHeader';
import { InAppLegalViewerModal } from '../components/InAppLegalViewerModal';
import { EmailOtpVerificationModal } from '../components/EmailOtpVerificationModal';
import { PrimaryButton } from '../components/PrimaryButton';
import { PasswordValidationGroup } from '../components/PasswordValidationGroup';
import { SalonLocationPicker, SalonLocationData } from '../components/SalonLocationPicker';
import { colors, radius, typography } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/auth.service';
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

export interface DocumentCategory {
  id: string;
  title: string;
  desc: string;
  icon: string;
  badge: string;
}

const SUPPORTED_DOCUMENT_TYPES: DocumentCategory[] = [
  {
    id: 'gst_certificate',
    title: 'GST Certificate',
    desc: 'PDF, JPG, PNG (≤10MB)',
    icon: '📜',
    badge: 'Recommended'
  },
  {
    id: 'business_pan',
    title: 'Business PAN Card',
    desc: 'PDF, JPG, PNG (≤10MB)',
    icon: '💳',
    badge: 'Accepted'
  },
  {
    id: 'trade_license',
    title: 'Municipal Trade License',
    desc: 'PDF, JPG, PNG (≤10MB)',
    icon: '🏛️',
    badge: 'Accepted'
  },
  {
    id: 'establishment_certificate',
    title: 'Shop & Establishment',
    desc: 'PDF, JPG, PNG (≤10MB)',
    icon: '🏢',
    badge: 'Accepted'
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
  const [salonLocationData, setSalonLocationData] = useState<SalonLocationData | null>(null);
  const [identityProof, setIdentityProof] = useState<IdentityProof | null>(null);

  // Document Picker Modal & Real Upload States
  const [docCategory, setDocCategory] = useState<string>('GST Registration Certificate');
  const [docModalVisible, setDocModalVisible] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [docError, setDocError] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

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

  // Salon Owner specific validation: Require permanent salon location coordinates and explicit confirmation
  const isOwnerValid =
    role === 'CUSTOMER' ||
    (salonName.trim().length >= 2 &&
      Boolean(identityProof) &&
      Boolean(salonLocationData?.coordinates) &&
      Boolean(salonLocationData?.isConfirmedPremises) &&
      (salonLocationData?.address || address.trim()).length >= 3 &&
      (salonLocationData?.city || city.trim()).length >= 2);

  const isFormValid =
    cleanName.length >= 2 &&
    isEmailValid &&
    isPhoneValid &&
    passwordStrength.isValid &&
    passwordsMatch &&
    isOwnerValid &&
    agreedToTerms;

  const handlePickAndUploadDocument = async (categoryTitle: string) => {
    let cachedFile: File | null = null;
    let uploadStage = 'document-picker';
    try {
      setDocError(null);
      const pickerResult = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'],
        copyToCacheDirectory: true
      });

      if (pickerResult.canceled || !pickerResult.assets || pickerResult.assets.length === 0) {
        return;
      }

      const file = pickerResult.assets[0];
      if (!file.uri) {
        throw new Error('Unable to resolve the selected document location. Please try again.');
      }

      const filename = (file.name || 'document.pdf').trim();
      const extension = filename.toLowerCase().slice(filename.lastIndexOf('.'));
      const extensionMime: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.pdf': 'application/pdf'
      };
      const mimeType =
        file.mimeType &&
        ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'].includes(
          file.mimeType.toLowerCase()
        )
          ? file.mimeType.toLowerCase()
          : extensionMime[extension] || '';

      // 1. Format validation
      const allowedMime = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      const allowedExts = ['.jpg', '.jpeg', '.png', '.pdf'];
      const isMimeOk = allowedMime.includes(mimeType.toLowerCase());
      const isExtOk = allowedExts.includes(extension);

      const extensionMatchesMime =
        (!extension || isExtOk) &&
        (!extensionMime[extension] ||
          extensionMime[extension] === mimeType ||
          (extensionMime[extension] === 'image/jpeg' && mimeType === 'image/jpg'));

      if ((!isMimeOk && !isExtOk) || !extensionMatchesMime) {
        setDocError('Unsupported document format. Allowed formats: PDF, JPG, PNG');
        dialogService.showError(
          'Invalid File Format',
          'Please upload an official PDF document or a clear JPG/PNG photo.'
        );
        return;
      }

      if (!filename.trim() || !mimeType) {
        throw new Error('The selected document is missing its filename or file type.');
      }

      uploadStage = 'selected-file-validation';
      let selectedFile: File;
      let selectedSize: number;
      let selectedFileExists: boolean;
      try {
        selectedFile = new File(file.uri);
        selectedFileExists = selectedFile.exists;
        selectedSize = selectedFile.size;
      } catch (fileError: any) {
        console.warn('[Document Upload Diagnostic] Could not read selected file', {
          name: fileError?.name || 'UnknownError'
        });
        throw new Error('Unable to read the selected document. Please select it again.');
      }
      if (!selectedFileExists) {
        throw new Error('The selected document is no longer available. Please select it again.');
      }
      if (!Number.isFinite(selectedSize) || selectedSize <= 0) {
        setDocError('The selected document is empty.');
        dialogService.showError(
          'Invalid Document',
          'Please choose a non-empty PDF, JPG, or PNG document.'
        );
        return;
      }

      if (selectedSize > 10 * 1024 * 1024) {
        setDocError('File exceeds 10MB limit. Please upload a smaller file.');
        dialogService.showError(
          'File Too Large',
          'Document size exceeds the 10MB limit. Please choose a smaller file.'
        );
        return;
      }

      setDocModalVisible(false);
      setUploadingDoc(true);
      setUploadProgress(25);

      uploadStage = 'cache-copy';
      const cachedFilename = `identity-document-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 10)}${extension}`;
      cachedFile = new File(Paths.cache, cachedFilename);
      try {
        await selectedFile.copy(cachedFile);
      } catch (copyError: any) {
        console.warn('[Document Upload Diagnostic] Could not copy selected file to app cache', {
          name: copyError?.name || 'UnknownError'
        });
        throw new Error('Unable to prepare the selected document for upload. Please select it again.');
      }
      if (!cachedFile.exists || cachedFile.size !== selectedSize) {
        throw new Error('Unable to prepare the selected document for upload. Please select it again.');
      }

      const uploadMetadata = { filename, fileType: mimeType, fileSize: selectedSize };
      uploadStage = 'signature-request';
      const signature = await authService.createDocumentUploadSignature(uploadMetadata);
      setUploadProgress(55);

      uploadStage = 'cloudinary-upload';
      const cloudinaryUpload = await authService.uploadDocumentToCloudinary(
        cachedFile.uri,
        filename,
        mimeType,
        signature
      );
      setUploadProgress(85);

      uploadStage = 'upload-confirmation';
      const uploadRes = await authService.confirmDocumentUpload({
        publicId: cloudinaryUpload.public_id,
        ...uploadMetadata
      });
      if (!uploadRes.url || !uploadRes.filename || !uploadRes.fileType) {
        throw new Error('The server did not confirm the document upload. Please try again.');
      }

      setUploadProgress(100);
      setIdentityProof({
        url: uploadRes.url,
        filename: uploadRes.filename,
        fileType: uploadRes.fileType,
        fileSize: uploadRes.fileSize || selectedSize,
        uploadedAt: new Date().toISOString()
      });
      setDocCategory(categoryTitle);
      dialogService.showSuccess(
        'Document Uploaded',
        `${filename} has been securely uploaded and attached for verification.`
      );
    } catch (err: any) {
      console.error('[Document Upload Diagnostic] Error:', {
        stage: uploadStage,
        name: err?.name,
        status: err?.status,
        code: err?.code
      });
      const userMessage = err instanceof Error ? err.message : 'Unable to upload document. Please try again.';
      setDocError(userMessage);
      dialogService.showError('Upload Failed', userMessage);
    } finally {
      try {
        if (cachedFile?.exists) {
          cachedFile.delete();
        }
      } catch (cleanupError: any) {
        console.warn('[Document Upload Diagnostic] Unable to remove temporary cache file', {
          name: cleanupError?.name || 'UnknownError'
        });
      }
      setUploadingDoc(false);
      setUploadProgress(0);
    }
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
        const res = await auth.register('CUSTOMER', {
          name: cleanName,
          email: cleanEmail,
          password,
          confirmPassword,
          phone: cleanPhone ? normalizePhone(cleanPhone) : undefined
        });

        if (res.requiresVerification) {
          setRegisteredEmail(cleanEmail);
          setOtpModalVisible(true);
        }
      } else {
        await auth.register('SALON_OWNER', {
          name: cleanName,
          email: cleanEmail,
          phone: normalizePhone(cleanPhone),
          password,
          confirmPassword,
          salonName: salonName.trim(),
          address: salonLocationData?.address || address.trim(),
          city: salonLocationData?.city || city.trim(),
          location: salonLocationData?.coordinates,
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
        <AppHeader
          title={role === 'CUSTOMER' ? 'Create Customer Account' : 'Register Your Salon'}
          onBack={onBack}
        />

        <View style={s.badgeWrap}>
          <Text style={s.eyebrow}>
            {role === 'CUSTOMER' ? 'CUSTOMER REGISTRATION' : 'SALON OWNER REGISTRATION'}
          </Text>
        </View>

        <Text style={s.title}>
          {role === 'CUSTOMER' ? 'Create Customer Account' : 'Register Your Salon'}
        </Text>
        <Text style={s.copy}>
          {role === 'CUSTOMER'
            ? 'Create your free account to discover salons and book appointments.'
            : 'Submit your salon details to join Book My Salon.'}
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

              {/* Permanent Physical Salon Premises Location Picker (Option 1: Current Location, Option 2: Enter Salon Address) */}
              <SalonLocationPicker
                initialAddress={address}
                initialCity={city}
                initialCoordinates={salonLocationData?.coordinates}
                onLocationChange={(locData) => {
                  setSalonLocationData(locData);
                  if (locData?.address) setAddress(locData.address);
                  if (locData?.city) setCity(locData.city);
                }}
                required
              />

              {/* Simplified Business Verification Section */}
              <View style={s.fieldGroup}>
                <View style={s.labelRow}>
                  <Text style={s.verificationHeader}>Business Verification</Text>
                  <View style={s.requiredBadge}>
                    <Text style={s.requiredBadgeText}>* Required</Text>
                  </View>
                </View>

                <Text style={s.verificationSub}>
                  Upload one valid document to verify your salon.
                </Text>

                {/* Supported Document Types Quick Badges */}
                <View style={s.docTypesChipRow}>
                  {SUPPORTED_DOCUMENT_TYPES.map((d) => (
                    <View key={d.id} style={s.docChip}>
                      <Text style={s.docChipText}>{d.icon} {d.title}</Text>
                    </View>
                  ))}
                </View>

                {identityProof ? (
                  <View style={s.docCard}>
                    <View style={s.docIconBox}>
                      <Text style={s.docIcon}>
                        {identityProof.filename.toLowerCase().endsWith('.pdf') ? '📕' : '🖼️'}
                      </Text>
                    </View>
                    <View style={{ flex: 1, marginHorizontal: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <Text style={s.docCategoryTag}>{docCategory}</Text>
                        <View style={s.verifiedTag}>
                          <Text style={s.verifiedTagText}>✓ Uploaded & Attached</Text>
                        </View>
                      </View>
                      <Text style={s.docFilename} numberOfLines={1}>
                        {identityProof.filename}
                      </Text>
                      <Text style={s.docMeta}>
                        {identityProof.fileType.split('/')[1]?.toUpperCase() || 'DOCUMENT'} •{' '}
                        {Math.round((identityProof.fileSize || 0) / 1024)} KB
                      </Text>
                    </View>
                    <View style={s.docActions}>
                      <Pressable
                        onPress={() => setDocModalVisible(true)}
                        style={s.replaceBtn}
                        accessibilityRole="button"
                        accessibilityLabel="Replace Document"
                      >
                        <Text style={s.replaceBtnText}>Replace</Text>
                      </Pressable>
                      <Pressable
                        onPress={handleRemoveDocument}
                        style={s.removeBtn}
                        accessibilityRole="button"
                        accessibilityLabel="Remove Document"
                      >
                        <Text style={s.removeBtnText}>✕</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    style={s.simplifiedUploadBox}
                    onPress={() => setDocModalVisible(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Attach Verification Document"
                  >
                    <View style={s.uploadIconBox}>
                      <Text style={{ fontSize: 22 }}>📁</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={s.simplifiedUploadTitle}>Attach Verification Document</Text>
                      <Text style={s.simplifiedUploadSub}>PDF, JPG, or PNG up to 10MB</Text>
                    </View>
                    <View style={s.uploadActionPill}>
                      <Text style={s.uploadActionPillText}>Select File</Text>
                    </View>

                    {uploadingDoc && (
                      <View style={s.progressBarWrap}>
                        <View style={[s.progressBar, { width: `${uploadProgress}%` }]} />
                        <Text style={s.progressText}>
                          Uploading document... {uploadProgress}%
                        </Text>
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

          {/* Mandatory Agreement Checkbox with Inline Legal Links */}
          <View style={s.agreementRow}>
            <Pressable
              style={s.checkboxWrap}
              onPress={() => setAgreedToTerms((prev) => !prev)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: agreedToTerms }}
              accessibilityLabel="I agree to the Terms & Conditions and Privacy Policy"
              hitSlop={8}
            >
              <View style={[s.checkbox, agreedToTerms && s.checkboxChecked]}>
                {agreedToTerms && <Text style={s.checkmark}>✓</Text>}
              </View>
            </Pressable>

            <Text style={s.agreementText}>
              <Text onPress={() => setAgreedToTerms((prev) => !prev)}>I agree to the </Text>
              <Text
                style={s.agreementLink}
                onPress={() => void openTermsUrl()}
                accessibilityRole="link"
                accessibilityLabel="Open Terms & Conditions"
              >
                Terms & Conditions
              </Text>
              <Text onPress={() => setAgreedToTerms((prev) => !prev)}> and </Text>
              <Text
                style={s.agreementLink}
                onPress={() => void openPrivacyUrl()}
                accessibilityRole="link"
                accessibilityLabel="Open Privacy Policy"
              >
                Privacy Policy
              </Text>
              <Text onPress={() => setAgreedToTerms((prev) => !prev)}>.</Text>
            </Text>
          </View>

          {/* Primary Action Button */}
          <PrimaryButton
            label={role === 'CUSTOMER' ? 'Create Customer Account' : 'Register Your Salon'}
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

      {/* Business Verification Document Picker Modal */}
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
            <Text style={s.modalTitle}>Business Verification</Text>
            <Text style={s.modalSubtitle}>
              Select document type to upload from your device:
            </Text>

            <View style={s.docOptionsList}>
              {SUPPORTED_DOCUMENT_TYPES.map((doc) => (
                <Pressable
                  key={doc.id}
                  style={s.docOptionItem}
                  onPress={() => handlePickAndUploadDocument(doc.title)}
                  accessibilityRole="button"
                  accessibilityLabel={`Upload ${doc.title}`}
                >
                  <View style={s.docOptionIcon}>
                    <Text style={{ fontSize: 20 }}>{doc.icon}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={s.docOptionHeader}>
                      <Text style={s.docOptionTitle}>{doc.title}</Text>
                      <View style={s.docBadge}>
                        <Text style={s.docBadgeText}>{doc.badge}</Text>
                      </View>
                    </View>
                    <Text style={s.docOptionMeta}>{doc.desc}</Text>
                  </View>
                  <Text style={s.docOptionChevron}>→</Text>
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

      {/* 6-Digit Email OTP Verification Modal */}
      <EmailOtpVerificationModal
        visible={otpModalVisible}
        email={registeredEmail}
        onSuccess={async (res) => {
          setOtpModalVisible(false);
          await auth.completeOtpVerification(res);
          dialogService.showSuccess(
            'Email Verified!',
            'Your email address has been verified. Welcome to Book My Salon!'
          );
        }}
        onClose={() => setOtpModalVisible(false)}
      />
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

  // Business Verification styling
  verificationHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.espresso
  },
  verificationSub: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 3,
    marginBottom: 8
  },
  requiredBadge: {
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill
  },
  requiredBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.danger
  },
  docTypesChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10
  },
  docChip: {
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xs,
    paddingHorizontal: 7,
    paddingVertical: 3
  },
  docChipText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: colors.espresso
  },
  simplifiedUploadBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.gold,
    borderRadius: radius.md,
    padding: 14,
    backgroundColor: colors.goldSoft
  },
  uploadIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border
  },
  simplifiedUploadTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.espresso
  },
  simplifiedUploadSub: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2
  },
  uploadActionPill: {
    backgroundColor: colors.gold,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.sm
  },
  uploadActionPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  verifiedTag: {
    backgroundColor: colors.successSoft,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill
  },
  verifiedTagText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: colors.success
  },
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
  uploadFormatBadge: {
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border
  },
  uploadFormatText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.goldDark
  },
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
  docCategoryTag: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.goldDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2
  },
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
  docOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2
  },
  docBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: colors.goldSoft,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border
  },
  docBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.goldDark
  },
  docOptionTitle: { fontSize: 13, fontWeight: '700', color: colors.espresso, flex: 1, marginRight: 6 },
  docOptionMeta: { fontSize: 11, color: colors.muted, marginTop: 2 },
  docUploadActionBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: colors.gold,
    borderRadius: radius.sm
  },
  docUploadActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  docOptionSelect: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.goldDark,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  docOptionChevron: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.gold,
    marginLeft: 8
  },
  modalCancelBtn: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 10
  },
  modalCancelText: { fontSize: 14, fontWeight: '700', color: colors.muted },
  agreementRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 18,
    marginBottom: 20,
    paddingHorizontal: 2
  },
  checkboxWrap: {
    paddingTop: 1,
    paddingRight: 12,
    minWidth: 38,
    minHeight: 38,
    justifyContent: 'flex-start',
    alignItems: 'flex-start'
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkboxChecked: {
    backgroundColor: colors.gold,
    borderColor: colors.gold
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 16
  },
  agreementText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: colors.ink
  },
  agreementLink: {
    color: colors.gold,
    fontWeight: '700',
    textDecorationLine: 'underline'
  }
});