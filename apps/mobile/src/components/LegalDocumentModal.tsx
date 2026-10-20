import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { colors, radius, typography } from '../constants/theme';
import { OFFICIAL_SUPPORT_EMAIL, openSupportEmail } from '../utils/support';
import { openPrivacyUrl, openTermsUrl } from '../utils/legal';

export type LegalDocType = 'PRIVACY_POLICY' | 'TERMS_AND_CONDITIONS';

interface LegalDocumentModalProps {
  visible: boolean;
  type: LegalDocType;
  onClose: () => void;
}

export function LegalDocumentModal({
  visible,
  type,
  onClose
}: LegalDocumentModalProps) {
  const isPrivacy = type === 'PRIVACY_POLICY';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={s.backdrop}>
        <View style={s.modalCard}>
          {/* Header */}
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.eyebrow}>OFFICIAL LEGAL DOCUMENTATION</Text>
              <Text style={s.title}>
                {isPrivacy ? 'Privacy & Data Policy' : 'Terms & Conditions'}
              </Text>
              <Text style={s.subtitle}>
                Book My Salon Platform • Effective Date: October 2026
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={s.closeBtn}>
              <Text style={s.closeText}>✕</Text>
            </Pressable>
          </View>

          {/* Scrollable Content */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.content}
          >
            {isPrivacy ? (
              <>
                <Text style={s.intro}>
                  At Book My Salon, we value the trust you place in our luxury salon discovery
                  and appointment reservation platform. This policy outlines how your data is collected,
                  secured, and utilized.
                </Text>

                <View style={s.section}>
                  <Text style={s.heading}>1. Information We Collect</Text>
                  <Text style={s.paragraph}>
                    • Account Information: Name, verified email address, mobile number, and password hash.{'\n'}
                    • Profile Data: Customer avatar, delivery address, city, and salon preferences.{'\n'}
                    • Booking Records: Appointment dates, selected treatments, salon atelier locations, and special notes.{'\n'}
                    • Location Information: Precise GPS coordinates (when permission is granted) to compute proximity to nearby salons.{'\n'}
                    • Technical Details: Device FCM push notification tokens for status alerts.
                  </Text>
                </View>

                <View style={s.section}>
                  <Text style={s.heading}>2. How Your Data is Used</Text>
                  <Text style={s.paragraph}>
                    • Facilitating salon reservations and real-time confirmations.{'\n'}
                    • Transmitting booking alerts, reminders, and exclusive salon promotions according to your notification settings.{'\n'}
                    • Protecting platform security, authenticating sessions via encrypted JWT, and preventing fraudulent account access.
                  </Text>
                </View>

                <View style={s.section}>
                  <Text style={s.heading}>3. Zero Data Selling & Third-Party Sharing</Text>
                  <Text style={s.paragraph}>
                    Book My Salon does not sell, rent, or trade your personal data to advertisers.
                    Data is shared exclusively with verified salon partners when you book an appointment,
                    and with PCI-DSS compliant payment gateways (Razorpay) for authorized transactions.
                  </Text>
                </View>

                <View style={s.section}>
                  <Text style={s.heading}>4. User Rights & Account Deletion</Text>
                  <Text style={s.paragraph}>
                    You maintain the right to view, correct, or delete your personal data at any time.
                    Self-service account deletion is accessible under Settings → Security & Privacy.
                    Upon confirmation, all active sessions and device tokens are permanently terminated.
                  </Text>
                </View>

                <View style={s.section}>
                  <Text style={s.heading}>5. Security Infrastructure</Text>
                  <Text style={s.paragraph}>
                    All communications are encrypted via HTTPS / TLS 1.3. User passwords are
                    hashed using industry-standard bcrypt with cryptographic salt rounds. Authentication tokens
                    are stored locally in hardware-backed Android SecureStore.
                  </Text>
                </View>
              </>
            ) : (
              <>
                <Text style={s.intro}>
                  Welcome to Book My Salon. These Terms and Conditions govern your access to and use
                  of our mobile application, customer booking service, and salon partner network.
                </Text>

                <View style={s.section}>
                  <Text style={s.heading}>1. User Accounts & Eligibility</Text>
                  <Text style={s.paragraph}>
                    • You must be at least 18 years of age or possess legal parental consent to create an account.{'\n'}
                    • You agree to provide accurate, up-to-date contact details (name, email, and mobile number).{'\n'}
                    • You are solely responsible for maintaining the confidentiality of your credentials.
                  </Text>
                </View>

                <View style={s.section}>
                  <Text style={s.heading}>2. Booking & Cancellation Terms</Text>
                  <Text style={s.paragraph}>
                    • Appointments booked through the application represent a mutual scheduling commitment between you and the salon.{'\n'}
                    • Salon partners reserve the right to accept or decline appointment requests depending on chair availability.{'\n'}
                    • If you cannot attend your scheduled appointment, please cancel or notify the salon at least 2 hours in advance.
                  </Text>
                </View>

                <View style={s.section}>
                  <Text style={s.heading}>3. Salon Partner Standards</Text>
                  <Text style={s.paragraph}>
                    • Salon partners must hold valid commercial business credentials and maintain sanitary salon environments.{'\n'}
                    • Prices displayed on the platform are determined directly by salon ateliers.{'\n'}
                    • Book My Salon conducts verification reviews but is not liable for individual treatment outcomes.
                  </Text>
                </View>

                <View style={s.section}>
                  <Text style={s.heading}>4. Promotional Offers & Discounts</Text>
                  <Text style={s.paragraph}>
                    • Offers published on the platform are valid only within their stated start and expiration dates.{'\n'}
                    • Promotional discounts cannot be combined with other conflicting salon coupons unless explicitly stated.
                  </Text>
                </View>

                <View style={s.section}>
                  <Text style={s.heading}>5. Platform Availability & Amendments</Text>
                  <Text style={s.paragraph}>
                    Book My Salon continuously updates its platform features. We reserve the right
                    to update these terms periodically. Continued use of the service constitutes acceptance
                    of any updated provisions.
                  </Text>
                </View>
              </>
            )}

            <Pressable
              onPress={() => {
                void openSupportEmail({
                  customSubject: 'Book My Salon - Legal & Privacy Desk Inquiry'
                });
              }}
              style={s.footerNotice}
            >
              <Text style={s.footerNoticeText}>
                Questions? Contact our legal & support desk at {OFFICIAL_SUPPORT_EMAIL}
              </Text>
            </Pressable>
          </ScrollView>

          {/* Close & External Web Action Buttons */}
          <View style={s.actionRow}>
            <Pressable
              onPress={() => {
                if (isPrivacy) {
                  void openPrivacyUrl();
                } else {
                  void openTermsUrl();
                }
              }}
              style={s.webLinkBtn}
            >
              <Text style={s.webLinkBtnText}>🌐 Open Public Web Page</Text>
            </Pressable>
            <Pressable onPress={onClose} style={s.doneBtn}>
              <Text style={s.doneBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 12, 10, 0.72)',
    justifyContent: 'flex-end'
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    minHeight: '65%',
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 24
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 14
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.gold,
    letterSpacing: 1.2
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink,
    marginTop: 2
  },
  subtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center'
  },
  closeText: {
    fontSize: 16,
    color: colors.ink,
    fontWeight: '700'
  },
  content: {
    paddingVertical: 16
  },
  intro: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.espresso,
    marginBottom: 16,
    fontStyle: 'italic'
  },
  section: {
    marginBottom: 16
  },
  heading: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 6
  },
  paragraph: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.subtle
  },
  footerNotice: {
    marginTop: 10,
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    alignItems: 'center'
  },
  footerNoticeText: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '600'
  },
  actionRow: {
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    gap: 10
  },
  webLinkBtn: {
    flex: 1.2,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.gold,
    paddingVertical: 13,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  webLinkBtnText: {
    color: colors.goldDark,
    fontWeight: '700',
    fontSize: 12
  },
  doneBtn: {
    flex: 0.8,
    backgroundColor: colors.espresso,
    paddingVertical: 13,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13
  }
});
