import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { AppHeader } from '../components/AppHeader';
import { PrimaryButton, SecondaryButton } from '../components/Buttons';
import { colors, radius } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { dialogService } from '../services/dialog.service';
import { salonService } from '../services/salon.service';
import { SalonOwnerData, SubscriptionData } from '../types';
import { OFFICIAL_SUPPORT_EMAIL, openSupportEmail } from '../utils/support';

interface SubscriptionStatusScreenProps {
  onBack: () => void;
  onChangePlan: () => void;
}

export function SubscriptionStatusScreen({
  onBack,
  onChangePlan
}: SubscriptionStatusScreenProps) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [salonData, setSalonData] = useState<SalonOwnerData | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);

  const fetchStatus = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await salonService.getOwnerSalon(token);
      if (res.hasSalon && res.salon) {
        setSalonData(res.salon);
      }
      const subRes = await salonService.getOwnerSubscriptionStatus(token);
      if (subRes.subscription) {
        setSubscription(subRes.subscription);
      }
    } catch (e) {
      dialogService.showError('Status Error', e instanceof Error ? e.message : 'Failed to retrieve subscription status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchStatus();
  }, [token]);

  const isPendingApproval = salonData?.status === 'PENDING_APPROVAL';
  const isApproved = salonData?.status === 'ACTIVE';
  const isRejected = salonData?.status === 'REJECTED';
  const isSuspended = salonData?.status === 'SUSPENDED';

  return (
    <View style={s.page}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <AppHeader title="Subscription & Review" onBack={onBack} />

        {loading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator size="large" color={colors.gold} />
            <Text style={s.loadingText}>Fetching partner review status...</Text>
          </View>
        ) : (
          <>
            {/* Prominent Review Notice Requirement */}
            {isPendingApproval && (
              <View style={s.reviewAlert}>
                <View style={s.alertHeader}>
                  <Text style={s.alertIcon}>⏳</Text>
                  <Text style={s.alertTitle}>Your salon registration is under review.</Text>
                </View>
                <Text style={s.alertBody}>
                  Our administrative compliance team is currently reviewing your salon credentials, service offerings, and physical location details.
                </Text>
                <View style={s.alertNoticeBox}>
                  <Text style={s.alertNoticeText}>
                    🔒 Platform Security: Customers cannot discover or book appointments at your salon until a Super Administrator reviews and approves your account.
                  </Text>
                </View>
              </View>
            )}

            {isApproved && (
              <View style={[s.reviewAlert, s.approvedAlert]}>
                <View style={s.alertHeader}>
                  <Text style={s.alertIcon}>✓</Text>
                  <Text style={[s.alertTitle, s.approvedTitle]}>Salon is Live & Discoverable!</Text>
                </View>
                <Text style={s.alertBody}>
                  Congratulations! Your salon profile has been verified and approved by the Book My Salon platform administration. Customers can now discover your salon and book services.
                </Text>
              </View>
            )}

            {isRejected && (
              <View style={[s.reviewAlert, s.rejectedAlert]}>
                <View style={s.alertHeader}>
                  <Text style={s.alertIcon}>⚠️</Text>
                  <Text style={[s.alertTitle, s.rejectedTitle]}>Registration Requires Correction</Text>
                </View>
                <Text style={[s.alertBody, s.rejectedBody]}>
                  Administrative Notice: {salonData?.rejectionReason || 'Please review guidelines and update your profile.'}
                </Text>
                <Text style={[s.alertBody, { marginTop: 6 }]}>
                  Please update your salon details and submit them again for administrator approval.
                </Text>
              </View>
            )}

            {isSuspended && (
              <View style={[s.reviewAlert, s.suspendedAlert]}>
                <View style={s.alertHeader}>
                  <Text style={s.alertIcon}>⛔</Text>
                  <Text style={[s.alertTitle, s.suspendedTitle]}>Account Suspended</Text>
                </View>
                <Text style={s.alertBody}>
                  Your salon has been suspended by platform administration. Contact support at {OFFICIAL_SUPPORT_EMAIL} to restore active listing status.
                </Text>
                <Pressable
                  onPress={() => {
                    void openSupportEmail({
                      role: 'SALON_OWNER',
                      customSubject: 'Book My Salon - Account Suspension Appeal',
                      customBody: `Hello Book My Salon Administration,\n\nSalon: ${salonData?.salonName || 'My Salon'}\nCity: ${salonData?.city || ''}\nPhone: ${salonData?.phone || ''}\n\nOur salon listing is currently suspended. Please assist in reviewing our account status:\n---\n`
                    });
                  }}
                  style={{
                    marginTop: 10,
                    backgroundColor: colors.surfaceWarm,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: radius.sm,
                    alignSelf: 'flex-start',
                    borderWidth: 1,
                    borderColor: colors.border
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.espresso }}>
                    ✉️ Email Support Desk
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Status Badges Card */}
            <View style={s.statusCard}>
              <Text style={s.cardLabel}>MEMBERSHIP HEALTH</Text>

              <View style={s.statusRow}>
                <Text style={s.statusLabel}>Salon Verification Status:</Text>
                <View
                  style={[
                    s.pill,
                    isPendingApproval
                      ? s.pillWarning
                      : isApproved
                      ? s.pillSuccess
                      : isRejected
                      ? s.pillDanger
                      : isSuspended
                      ? s.pillNeutral
                      : s.pillDefault
                  ]}
                >
                  <Text
                    style={[
                      s.pillText,
                      isPendingApproval
                        ? s.pillTextWarning
                        : isApproved
                        ? s.pillTextSuccess
                        : isRejected
                        ? s.pillTextDanger
                        : isSuspended
                        ? s.pillTextNeutral
                        : s.pillTextDefault
                    ]}
                  >
                    {salonData?.status?.replace('_', ' ') || 'PENDING SETUP'}
                  </Text>
                </View>
              </View>

              <View style={s.statusRow}>
                <Text style={s.statusLabel}>Partner Subscription:</Text>
                <View
                  style={[
                    s.pill,
                    subscription?.status === 'ACTIVE' ? s.pillSuccess : s.pillDefault
                  ]}
                >
                  <Text
                    style={[
                      s.pillText,
                      subscription?.status === 'ACTIVE' ? s.pillTextSuccess : s.pillTextDefault
                    ]}
                  >
                    {subscription?.status || 'PENDING'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Active Subscription Details */}
            {subscription ? (
              <View style={s.detailsCard}>
                <View style={s.detailsHeader}>
                  <View>
                    <Text style={s.planName}>{subscription.plan} Plan</Text>
                    <Text style={s.planCycle}>
                      Billed {subscription.billingCycle.toLowerCase()} (₹{subscription.amount})
                    </Text>
                  </View>
                  <View style={s.activeBadge}>
                    <Text style={s.activeBadgeText}>ACTIVE</Text>
                  </View>
                </View>

                <View style={s.divider} />

                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Transaction ID</Text>
                  <Text style={s.infoVal}>{subscription.transactionId}</Text>
                </View>

                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Payment Method</Text>
                  <Text style={s.infoVal}>{subscription.paymentMethod.replace('_', ' ')}</Text>
                </View>

                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Valid From</Text>
                  <Text style={s.infoVal}>
                    {new Date(subscription.startDate).toLocaleDateString()}
                  </Text>
                </View>

                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Renews / Valid Until</Text>
                  <Text style={[s.infoVal, { fontWeight: '700' }]}>
                    {new Date(subscription.endDate).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={s.noSubCard}>
                <Text style={s.noSubTitle}>No Active Subscription Found</Text>
                <Text style={s.noSubBody}>
                  Select a subscription plan to complete your salon onboarding and start taking customer appointments.
                </Text>
                <View style={{ marginTop: 14 }}>
                  <PrimaryButton label="Select Subscription Plan" onPress={onChangePlan} />
                </View>
              </View>
            )}

            {/* Salon Profile Details */}
            {salonData && (
              <View style={s.detailsCard}>
                <Text style={s.cardLabel}>REGISTERED SALON PROFILE</Text>
                <Text style={s.salonName}>{salonData.salonName}</Text>
                <Text style={s.salonDesc}>{salonData.description}</Text>

                <View style={s.divider} />

                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>City & Area</Text>
                  <Text style={s.infoVal}>{salonData.city} • {salonData.address}</Text>
                </View>
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Contact</Text>
                  <Text style={s.infoVal}>{salonData.phone}</Text>
                </View>
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Configured Services</Text>
                  <Text style={s.infoVal}>{salonData.services?.length || 0} active</Text>
                </View>
              </View>
            )}

            {/* Actions */}
            <View style={s.actions}>
              <PrimaryButton label="Upgrade / Change Plan" onPress={onChangePlan} />
              <View style={{ height: 10 }} />
              <SecondaryButton label="Refresh Status" onPress={() => void fetchStatus()} />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 22, paddingTop: 30, paddingBottom: 40 },
  loadingWrap: { paddingVertical: 80, alignItems: 'center' },
  loadingText: { color: colors.muted, marginTop: 14, fontSize: 14 },

  reviewAlert: {
    backgroundColor: '#FFFBEB',
    borderRadius: radius.lg,
    padding: 20,
    marginTop: 18,
    borderWidth: 1.5,
    borderColor: '#FCD34D'
  },
  approvedAlert: {
    backgroundColor: '#ECFDF5',
    borderColor: '#6EE7B7'
  },
  rejectedAlert: {
    backgroundColor: '#FEF2F2',
    borderColor: '#F87171'
  },
  suspendedAlert: {
    backgroundColor: '#F3F4F6',
    borderColor: '#9CA3AF'
  },
  alertHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  alertIcon: { fontSize: 22, marginRight: 10 },
  alertTitle: { fontSize: 16, fontWeight: '800', color: '#92400E', flex: 1 },
  approvedTitle: { color: '#065F46' },
  rejectedTitle: { color: '#991B1B' },
  suspendedTitle: { color: '#1F2937' },
  alertBody: { fontSize: 13, color: '#78350F', lineHeight: 20 },
  rejectedBody: { color: '#B91C1C', fontWeight: '700' },
  alertNoticeBox: {
    marginTop: 12,
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: radius.sm
  },
  alertNoticeText: { fontSize: 12, fontWeight: '700', color: '#92400E', lineHeight: 18 },

  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 20,
    marginTop: 18,
    borderWidth: 1,
    borderColor: colors.border
  },
  cardLabel: { fontSize: 11, fontWeight: '700', color: colors.gold, letterSpacing: 1.2, marginBottom: 12 },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  statusLabel: { fontSize: 13, color: colors.muted },
  pill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.pill },
  pillDefault: { backgroundColor: colors.background },
  pillWarning: { backgroundColor: '#FEF3C7' },
  pillSuccess: { backgroundColor: '#D1FAE5' },
  pillDanger: { backgroundColor: '#FEE2E2' },
  pillNeutral: { backgroundColor: '#E5E7EB' },
  pillText: { fontSize: 11, fontWeight: '800' },
  pillTextDefault: { color: colors.muted },
  pillTextWarning: { color: '#92400E' },
  pillTextSuccess: { color: '#065F46' },
  pillTextDanger: { color: '#991B1B' },
  pillTextNeutral: { color: '#374151' },

  detailsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 20,
    marginTop: 18,
    borderWidth: 1,
    borderColor: colors.border
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  planName: { fontSize: 20, fontWeight: '700', color: colors.ink },
  planCycle: { fontSize: 12, color: colors.muted, marginTop: 3 },
  activeBadge: {
    backgroundColor: colors.goldSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill
  },
  activeBadgeText: { fontSize: 10, fontWeight: '800', color: colors.gold },

  divider: { height: 1, backgroundColor: colors.border, marginVertical: 14 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  infoLabel: { fontSize: 12, color: colors.muted },
  infoVal: { fontSize: 12, fontWeight: '600', color: colors.ink, maxWidth: '65%', textAlign: 'right' },

  salonName: { fontSize: 18, fontWeight: '700', color: colors.ink },
  salonDesc: { fontSize: 12, color: colors.muted, lineHeight: 18, marginTop: 4 },

  noSubCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 20,
    marginTop: 18,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center'
  },
  noSubTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  noSubBody: { fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: 6, lineHeight: 19 },

  actions: { marginTop: 24, paddingBottom: 20 }
});
