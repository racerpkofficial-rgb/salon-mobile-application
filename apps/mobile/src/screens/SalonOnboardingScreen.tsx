import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { AppHeader } from '../components/AppHeader';
import { InputField } from '../components/InputField';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, radius } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { dialogService } from '../services/dialog.service';
import { salonService } from '../services/salon.service';
import { SalonOwnerData } from '../types';
import { extractCoordinates } from '../utils/location';
import { isValidPhone, normalizePhone } from '../utils/validation';

interface SalonOnboardingScreenProps {
  onBack: () => void;
  onSuccess: (salon: SalonOwnerData) => void;
  existingSalon?: SalonOwnerData | null;
}

export function SalonOnboardingScreen({
  onBack,
  onSuccess,
  existingSalon
}: SalonOnboardingScreenProps) {
  const { token, user } = useAuth();

  // Initialize strictly from existing registered data or user profile, NEVER fake example data
  const [salonName, setSalonName] = useState(
    existingSalon?.salonName || ''
  );
  const [description, setDescription] = useState(
    existingSalon?.description || ''
  );
  const [phone, setPhone] = useState(
    existingSalon?.phone || user?.phone || ''
  );
  const [email, setEmail] = useState(
    existingSalon?.email || user?.email || ''
  );
  const [address, setAddress] = useState(
    existingSalon?.address || ''
  );
  const [city, setCity] = useState(
    existingSalon?.city || ''
  );

  // Real salon images (0-8 photos, exclude any legacy default stock images)
  const [images, setImages] = useState<string[]>(
    (existingSalon?.images || [])
      .filter((img) => typeof img === 'string' && img.trim().length > 0 && !img.includes('images.unsplash.com'))
      .slice(0, 8)
  );
  const [uploadingImage, setUploadingImage] = useState(false);
  const [loading, setLoading] = useState(false);

  const valid =
    salonName.trim().length >= 2 &&
    phone.trim().length >= 8 &&
    isValidPhone(phone.trim()) &&
    email.trim().includes('@') &&
    address.trim().length >= 3 &&
    city.trim().length >= 2;

  const handlePickImages = async () => {
    if (images.length >= 8) {
      dialogService.showWarning('Maximum Limit Reached', 'You can upload up to 8 photos for your salon.');
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        dialogService.showWarning(
          'Permission Needed',
          'Please allow camera roll access in your device settings to select salon photos.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        allowsMultipleSelection: true,
        selectionLimit: 8 - images.length,
        quality: 0.8,
        base64: true
      });

      if (result.canceled || !result.assets?.length) return;

      const assetsToUpload = result.assets.slice(0, 8 - images.length);
      setUploadingImage(true);

      const newlyUploadedUrls: string[] = [];

      for (const asset of assetsToUpload) {
        // Validate file size (max 5MB)
        if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
          dialogService.showWarning('File Skipped', `${asset.fileName || 'An image'} exceeds the 5MB size limit.`);
          continue;
        }

        // Validate format
        if (asset.mimeType) {
          const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
          if (!allowed.includes(asset.mimeType.toLowerCase())) {
            dialogService.showWarning('Invalid Format', 'Supported formats: JPEG, PNG, WebP.');
            continue;
          }
        }

        const mime = asset.mimeType || 'image/jpeg';
        const base64Data = asset.base64
          ? `data:${mime};base64,${asset.base64}`
          : asset.uri;

        if (token) {
          try {
            const uploadRes = await salonService.uploadSalonImage(token, base64Data, mime);
            const savedUrl = uploadRes.secureUrl || uploadRes.url;
            if (savedUrl) {
              newlyUploadedUrls.push(savedUrl);
            }
          } catch (uploadErr) {
            dialogService.showError(
              'Upload Error',
              uploadErr instanceof Error ? uploadErr.message : 'Failed to upload photo.'
            );
          }
        }
      }

      if (newlyUploadedUrls.length > 0) {
        setImages((prev) => [...prev, ...newlyUploadedUrls].slice(0, 8));
      }
    } catch (e) {
      dialogService.showError('Gallery Error', e instanceof Error ? e.message : 'Could not open image gallery.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!valid || !token) return;
    setLoading(true);
    try {
      const res = await salonService.registerOwnerSalon(token, {
        salonName: salonName.trim(),
        description: description.trim(),
        phone: normalizePhone(phone.trim()),
        email: email.trim().toLowerCase(),
        address: address.trim(),
        city: city.trim(),
        location: extractCoordinates(existingSalon) || undefined,
        images: images.slice(0, 8),
        services: existingSalon?.services?.length
          ? existingSalon.services.map((s) => ({
              name: s.name,
              price: typeof s.price === 'number' ? s.price : Number(s.price) || 0,
              durationMinutes: s.durationMinutes,
              category: s.category,
              description: s.description
            }))
          : []
      });

      dialogService.showSuccess(
        'Salon Details Saved',
        'Your salon details have been updated successfully.',
        { confirmText: 'Continue', onConfirm: () => onSuccess(res.salon) }
      );
    } catch (e) {
      dialogService.showError(
        'Registration Error',
        e instanceof Error ? e.message : 'Please check your inputs and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.page}>
      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <AppHeader title="Salon Details & Onboarding" onBack={onBack} />

        <Text style={s.eyebrow}>
          {existingSalon ? 'MANAGE ATELIER PROFILE' : 'STEP 1 OF 2 • SALON PROFILE'}
        </Text>
        <Text style={s.title}>
          {existingSalon ? 'Edit your salon details.' : 'Set up your salon profile.'}
        </Text>
        <Text style={s.copy}>
          Provide accurate salon contact and location information for customer discovery. All updates reflect directly in your official profile.
        </Text>

        <View style={s.form}>
          <InputField
            label="Salon Name *"
            value={salonName}
            onChangeText={setSalonName}
            placeholder="e.g. NÉA House of Beauty"
          />

          <InputField
            label="Tagline & Description (Optional)"
            value={description}
            onChangeText={setDescription}
            placeholder="Describe your specialties & ambience (optional)"
          />

          {/* Salon Photos Upload Section */}
          <View style={s.photoSection}>
            <View style={s.photoHeaderRow}>
              <View>
                <Text style={s.sectionLabel}>Salon Photos (Optional)</Text>
                <Text style={s.sectionSubtitle}>
                  Add up to 8 photos of your salon interior, styling chairs & ambience.
                </Text>
              </View>
              <Text style={s.photoCounter}>{images.length}/8</Text>
            </View>

            {/* Thumbnail Previews */}
            {images.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.thumbScroll}
              >
                {images.map((imgUrl, idx) => (
                  <View key={idx} style={s.thumbWrap}>
                    <Image source={{ uri: imgUrl }} style={s.thumbImage} />
                    <Pressable
                      onPress={() => handleRemoveImage(idx)}
                      style={s.removeBtn}
                      hitSlop={6}
                    >
                      <Text style={s.removeBtnText}>✕</Text>
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            )}

            {/* Upload Button */}
            {images.length < 8 && (
              <Pressable
                onPress={handlePickImages}
                disabled={uploadingImage}
                style={[s.uploadBtn, uploadingImage && { opacity: 0.6 }]}
              >
                {uploadingImage ? (
                  <View style={s.uploadLoadingRow}>
                    <ActivityIndicator size="small" color={colors.gold} />
                    <Text style={s.uploadBtnText}>Uploading photo...</Text>
                  </View>
                ) : (
                  <Text style={s.uploadBtnText}>
                    📷 {images.length === 0 ? '+ Upload Salon Photos' : '+ Add More Photos'}
                  </Text>
                )}
              </Pressable>
            )}
          </View>

          <InputField
            label="Primary Contact Phone *"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="+91 98765 43210"
          />
          <InputField
            label="Business Contact Email *"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="contact@yoursalon.com"
          />
          <InputField
            label="Street Address *"
            value={address}
            onChangeText={setAddress}
            placeholder="Building, street, neighborhood"
          />
          <InputField
            label="City *"
            value={city}
            onChangeText={setCity}
            placeholder="e.g. Bengaluru, Mumbai, Delhi"
          />

          <View style={s.btnWrap}>
            <PrimaryButton
              label={existingSalon ? 'Save Profile Changes' : 'Save & Continue to Plans →'}
              loading={loading}
              disabled={!valid || loading}
              onPress={handleSubmit}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 22, paddingTop: 30, paddingBottom: 40 },
  eyebrow: { color: colors.gold, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginTop: 15 },
  title: { fontSize: 32, lineHeight: 37, letterSpacing: -1, color: colors.ink, fontWeight: '700', marginTop: 8 },
  copy: { color: colors.muted, lineHeight: 22, marginTop: 8, fontSize: 14 },
  form: { marginTop: 24 },
  photoSection: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 16,
    marginBottom: 16
  },
  photoHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
    maxWidth: 240
  },
  photoCounter: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gold,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm
  },
  thumbScroll: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 8
  },
  thumbWrap: {
    width: 72,
    height: 72,
    borderRadius: radius.sm,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border
  },
  thumbImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover'
  },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center'
  },
  removeBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800'
  },
  uploadBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.gold,
    borderStyle: 'dashed',
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#FAF7F2'
  },
  uploadLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  uploadBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gold
  },
  btnWrap: { marginTop: 24, paddingBottom: 20 }
});
