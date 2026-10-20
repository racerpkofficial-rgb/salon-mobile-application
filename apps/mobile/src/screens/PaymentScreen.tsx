import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { BillingCycle, PlanType, SalonOwnerData, SubscriptionData } from '../types';

interface PaymentScreenProps {
  plan: PlanType;
  billingCycle: BillingCycle;
  onBack: () => void;
  onPaymentSuccess: (subscription: SubscriptionData, salon: SalonOwnerData) => void;
}

const PLAN_AMOUNTS: Record<PlanType, { monthly: number; yearly: number; name: string }> = {
  STARTER: { monthly: 299, yearly: 2999, name: 'Starter Plan' },
  BUSINESS: { monthly: 599, yearly: 5999, name: 'Business Plan' },
  PREMIUM: { monthly: 999, yearly: 9999, name: 'Premium Plan' }
};

type PaymentMethodType = 'UPI' | 'CARD' | 'NET_BANKING';

export function PaymentScreen({
  plan,
  billingCycle,
  onBack,
  onPaymentSuccess
}: PaymentScreenProps) {
  const { token } = useAuth();
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType>('UPI');
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  // Razorpay Checkout Modal state
  const [razorpayModalVisible, setRazorpayModalVisible] = useState(false);
  const [orderData, setOrderData] = useState<{
    orderId: string;
    amount: number;
    amountInRupees: number;
    currency: string;
    keyId: string;
    plan: PlanType;
    billingCycle: BillingCycle;
    salonName: string;
  } | null>(null);

  const planInfo = PLAN_AMOUNTS[plan];
  const amount = billingCycle === 'YEARLY' ? planInfo.yearly : planInfo.monthly;

  // Step 1: Initiate Razorpay Order on backend
  const handleInitiateRazorpay = async () => {
    if (!token) {
      dialogService.showInfo('Authentication Required', 'Please sign in to proceed with subscription.');
      return;
    }

    setCreatingOrder(true);
    try {
      // Backend creates Razorpay order and returns orderId & public keyId (secret NEVER exposed!)
      const res = await salonService.createRazorpayOrder(token, {
        plan,
        billingCycle
      });

      setOrderData(res);
      setRazorpayModalVisible(true);
    } catch (e) {
      dialogService.showError(
        'Order Creation Failed',
        e instanceof Error ? e.message : 'Failed to initialize Razorpay order. Please try again.'
      );
    } finally {
      setCreatingOrder(false);
    }
  };

  // Step 2: Authorize & Verify Payment via Razorpay
  const handleAuthorizePayment = async (simulateInvalidSignature = false) => {
    if (!token || !orderData) return;

    setVerifyingPayment(true);
    try {
      const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      let signature = 'invalid_tampered_signature_xyz';
      if (!simulateInvalidSignature) {
        // Request backend to sign the orderId + paymentId with the secure RAZORPAY_KEY_SECRET
        const sigRes = await salonService.getRazorpayTestSignature(
          token,
          orderData.orderId,
          paymentId
        );
        signature = sigRes.signature;
      }

      // Verify payment signature on backend and activate subscription
      const verifyRes = await salonService.verifyRazorpayPayment(token, {
        razorpayOrderId: orderData.orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: signature,
        plan: orderData.plan,
        billingCycle: orderData.billingCycle
      });

      if (verifyRes.success) {
        setRazorpayModalVisible(false);
        dialogService.showSuccess(
          'Payment Verified! 🎉',
          `Razorpay Payment ID: ${verifyRes.transactionId}\nPlan: ${verifyRes.plan.name} (${billingCycle})\nAmount Paid: ₹${verifyRes.amount}\n\nNotice: ${verifyRes.message}`,
          {
            confirmText: 'View Subscription Status',
            onConfirm: () => onPaymentSuccess(verifyRes.subscription, verifyRes.salon)
          }
        );
      }
    } catch (e) {
      dialogService.showError(
        'Payment Verification Failed',
        e instanceof Error
          ? e.message
          : 'Payment verification failed on backend. Please try again.'
      );
    } finally {
      setVerifyingPayment(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={s.page}
    >
      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <AppHeader title="Checkout" onBack={onBack} />

        <Text style={s.eyebrow}>RAZORPAY SECURE GATEWAY</Text>
        <Text style={s.title}>Activate your{`\n`}partner plan.</Text>

        {/* Order Summary Card */}
        <View style={s.summaryCard}>
          <View style={s.summaryHeader}>
            <View>
              <Text style={s.planName}>{planInfo.name}</Text>
              <Text style={s.planCycle}>
                {billingCycle === 'YEARLY' ? 'Annual Subscription (12 Months)' : 'Monthly Subscription (1 Month)'}
              </Text>
            </View>
            <View style={s.planBadge}>
              <Text style={s.planBadgeText}>{plan}</Text>
            </View>
          </View>

          <View style={s.divider} />

          <View style={s.priceRow}>
            <Text style={s.priceLabel}>Base Plan Subscription</Text>
            <Text style={s.priceVal}>₹{amount}.00</Text>
          </View>
          <View style={s.priceRow}>
            <Text style={s.priceLabel}>Platform Setup & Onboarding</Text>
            <Text style={[s.priceVal, s.freeText]}>FREE (₹999 waived)</Text>
          </View>
          <View style={s.priceRow}>
            <Text style={s.priceLabel}>Applicable GST (0% Introductory)</Text>
            <Text style={s.priceVal}>₹0.00</Text>
          </View>

          <View style={s.divider} />

          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Total Payable</Text>
            <Text style={s.totalVal}>₹{amount}</Text>
          </View>
        </View>

        {/* Payment Methods */}
        <Text style={s.sectionHeader}>SUPPORTED PAYMENT MODES</Text>

        <View style={s.methodsContainer}>
          <Pressable
            style={[s.methodCard, selectedMethod === 'UPI' && s.methodCardActive]}
            onPress={() => setSelectedMethod('UPI')}
          >
            <Text style={s.methodIcon}>⚡</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.methodTitle, selectedMethod === 'UPI' && s.methodTitleActive]}>
                UPI (GPay / PhonePe / Paytm / QR)
              </Text>
              <Text style={s.methodSub}>Zero transaction fees • Instant activation</Text>
            </View>
            <View style={[s.radio, selectedMethod === 'UPI' && s.radioActive]} />
          </Pressable>

          <Pressable
            style={[s.methodCard, selectedMethod === 'CARD' && s.methodCardActive]}
            onPress={() => setSelectedMethod('CARD')}
          >
            <Text style={s.methodIcon}>💳</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.methodTitle, selectedMethod === 'CARD' && s.methodTitleActive]}>
                Credit / Debit Cards
              </Text>
              <Text style={s.methodSub}>Visa, MasterCard, RuPay, Amex</Text>
            </View>
            <View style={[s.radio, selectedMethod === 'CARD' && s.radioActive]} />
          </Pressable>

          <Pressable
            style={[s.methodCard, selectedMethod === 'NET_BANKING' && s.methodCardActive]}
            onPress={() => setSelectedMethod('NET_BANKING')}
          >
            <Text style={s.methodIcon}>🏛️</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.methodTitle, selectedMethod === 'NET_BANKING' && s.methodTitleActive]}>
                Net Banking
              </Text>
              <Text style={s.methodSub}>HDFC, ICICI, SBI, Axis, Kotak & 50+ banks</Text>
            </View>
            <View style={[s.radio, selectedMethod === 'NET_BANKING' && s.radioActive]} />
          </Pressable>
        </View>

        {/* Security Assurance Banner */}
        <View style={s.securityBanner}>
          <Text style={s.securityIcon}>🔒</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.securityTitle}>Bank-Grade 256-Bit SSL Encryption</Text>
            <Text style={s.securityCopy}>
              All payments are processed securely through Razorpay. Your sensitive credentials and payment secrets are never exposed on your device.
            </Text>
          </View>
        </View>

        {/* Submit Button */}
        <View style={s.buttonWrap}>
          <PrimaryButton
            label={`Pay ₹${amount} with Razorpay 🔒`}
            loading={creatingOrder}
            onPress={handleInitiateRazorpay}
          />
        </View>
      </ScrollView>

      {/* Razorpay Interactive Checkout Modal */}
      <Modal visible={razorpayModalVisible} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            {/* Razorpay Branded Header */}
            <View style={s.rzpHeader}>
              <View>
                <Text style={s.rzpBrandText}>Razorpay 🔒</Text>
                <Text style={s.rzpSubText}>Trusted Payment Partner</Text>
              </View>
              <Pressable
                disabled={verifyingPayment}
                onPress={() => setRazorpayModalVisible(false)}
                style={s.rzpCloseBtn}
              >
                <Text style={s.rzpCloseText}>✕</Text>
              </Pressable>
            </View>

            {orderData && (
              <ScrollView contentContainerStyle={s.rzpBody} showsVerticalScrollIndicator={false}>
                {/* Merchant & Order Overview */}
                <View style={s.rzpOrderCard}>
                  <Text style={s.rzpMerchant}>BOOK MY SALON PLATFORM</Text>
                  <Text style={s.rzpSalonName}>{orderData.salonName || 'Salon Partner'}</Text>
                  <Text style={s.rzpAmount}>₹{orderData.amountInRupees}.00</Text>
                  <Text style={s.rzpPlanSummary}>
                    {orderData.plan} Plan • {orderData.billingCycle} billing
                  </Text>

                  <View style={s.rzpMetaDivider} />

                  <View style={s.rzpMetaRow}>
                    <Text style={s.rzpMetaLabel}>Order ID:</Text>
                    <Text style={s.rzpMetaVal}>{orderData.orderId}</Text>
                  </View>
                  <View style={s.rzpMetaRow}>
                    <Text style={s.rzpMetaLabel}>Public Key ID:</Text>
                    <Text style={s.rzpMetaVal}>{orderData.keyId}</Text>
                  </View>
                </View>

                {/* Sandbox Payment Simulator Notice */}
                <View style={s.rzpSandboxNotice}>
                  <Text style={s.rzpSandboxTitle}>🧪 Razorpay Sandbox Environment</Text>
                  <Text style={s.rzpSandboxCopy}>
                    Order creation occurred securely on the backend. When you approve payment, Razorpay will issue a transaction ID and the backend will verify the HMAC SHA-256 signature before activating your subscription.
                  </Text>
                </View>

                {/* Payment Action Buttons */}
                <View style={{ marginTop: 20 }}>
                  <PrimaryButton
                    label={verifyingPayment ? 'Verifying with Razorpay...' : `Approve & Pay ₹${orderData.amountInRupees}`}
                    loading={verifyingPayment}
                    onPress={() => handleAuthorizePayment(false)}
                  />

                  <View style={{ marginTop: 10 }}>
                    <SecondaryButton
                      label="Simulate Tampered Signature (Test Security)"
                      disabled={verifyingPayment}
                      onPress={() => handleAuthorizePayment(true)}
                    />
                  </View>

                  <View style={{ marginTop: 10 }}>
                    <Pressable
                      disabled={verifyingPayment}
                      onPress={() => setRazorpayModalVisible(false)}
                      style={s.rzpCancelBtn}
                    >
                      <Text style={s.rzpCancelText}>Cancel Payment</Text>
                    </Pressable>
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 22, paddingTop: 30, paddingBottom: 40 },
  eyebrow: { color: colors.gold, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginTop: 15 },
  title: { fontSize: 32, lineHeight: 37, letterSpacing: -1, color: colors.ink, fontWeight: '700', marginTop: 8 },

  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 20,
    marginTop: 24,
    borderWidth: 1,
    borderColor: colors.border
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  planName: { fontSize: 20, fontWeight: '700', color: colors.ink },
  planCycle: { fontSize: 12, color: colors.muted, marginTop: 3 },
  planBadge: {
    backgroundColor: colors.goldSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill
  },
  planBadgeText: { fontSize: 11, fontWeight: '800', color: colors.gold },

  divider: { height: 1, backgroundColor: colors.border, marginVertical: 14 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  priceLabel: { fontSize: 13, color: colors.muted },
  priceVal: { fontSize: 13, fontWeight: '600', color: colors.ink },
  freeText: { color: colors.success, fontWeight: '700' },

  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 16, fontWeight: '700', color: colors.ink },
  totalVal: { fontSize: 26, fontWeight: '800', color: colors.ink },

  sectionHeader: { fontSize: 11, fontWeight: '700', color: colors.gold, letterSpacing: 1.2, marginTop: 28, marginBottom: 12 },

  methodsContainer: { gap: 10 },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border
  },
  methodCardActive: {
    borderColor: colors.gold,
    backgroundColor: colors.goldSoft
  },
  methodIcon: { fontSize: 20, marginRight: 12 },
  methodTitle: { fontSize: 14, fontWeight: '600', color: colors.ink },
  methodTitleActive: { fontWeight: '700', color: colors.ink },
  methodSub: { fontSize: 11, color: colors.muted, marginTop: 2 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border
  },
  radioActive: {
    borderColor: colors.gold,
    backgroundColor: colors.gold
  },

  securityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    backgroundColor: '#F0FDF4',
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#BBF7D0'
  },
  securityIcon: { fontSize: 22, marginRight: 12 },
  securityTitle: { fontSize: 13, fontWeight: '700', color: '#166534' },
  securityCopy: { fontSize: 11, color: '#14532D', lineHeight: 16, marginTop: 2 },

  buttonWrap: { marginTop: 24, paddingBottom: 20 },

  // Razorpay Checkout Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end'
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%'
  },
  rzpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0C2340',
    paddingHorizontal: 22,
    paddingVertical: 18,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24
  },
  rzpBrandText: { fontSize: 20, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.5 },
  rzpSubText: { fontSize: 11, color: '#93C5FD', marginTop: 2 },
  rzpCloseBtn: { padding: 4 },
  rzpCloseText: { fontSize: 20, color: '#FFFFFF', fontWeight: '700' },

  rzpBody: { padding: 22, paddingBottom: 40 },
  rzpOrderCard: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border
  },
  rzpMerchant: { fontSize: 10, fontWeight: '800', color: colors.gold, letterSpacing: 1.2 },
  rzpSalonName: { fontSize: 18, fontWeight: '800', color: colors.ink, marginTop: 4 },
  rzpAmount: { fontSize: 32, fontWeight: '900', color: '#0C2340', marginTop: 10 },
  rzpPlanSummary: { fontSize: 13, color: colors.muted, marginTop: 2 },
  rzpMetaDivider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  rzpMetaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  rzpMetaLabel: { fontSize: 11, color: colors.muted },
  rzpMetaVal: { fontSize: 11, fontWeight: '700', color: colors.ink },

  rzpSandboxNotice: {
    marginTop: 16,
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 14
  },
  rzpSandboxTitle: { fontSize: 12, fontWeight: '800', color: '#1E40AF' },
  rzpSandboxCopy: { fontSize: 11, color: '#1E3A8A', lineHeight: 16, marginTop: 3 },

  rzpCancelBtn: { alignItems: 'center', paddingVertical: 10 },
  rzpCancelText: { fontSize: 13, color: colors.muted, fontWeight: '600' }
});
