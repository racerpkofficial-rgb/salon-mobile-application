import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton, SecondaryButton } from './Buttons';

import { colors, radius } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { appointmentService } from '../services/appointment.service';
import { dialogService } from '../services/dialog.service';
import { offerService } from '../services/offer.service';
import { salonService } from '../services/salon.service';
import { AppointmentData, CustomerOffer, Salon, SalonOffer, Service, TimeSlot } from '../types';
import { formatLocation } from '../utils/location';
import {
  calculateServicePriceWithOffer,
  getBestOfferForService,
  isOfferApplicableToService
} from '../utils/offer';

interface BookingModalProps {
  visible: boolean;
  salon: Salon;
  initialService?: Service | null;
  initialOffer?: CustomerOffer | SalonOffer | null;
  onClose: () => void;
  onBookingSuccess: (appointment: AppointmentData) => void;
}

function deduplicateOffers(
  offers: Array<CustomerOffer | SalonOffer>
): Array<CustomerOffer | SalonOffer> {
  const seen = new Set<string>();
  const result: Array<CustomerOffer | SalonOffer> = [];
  for (const off of offers) {
    if (!off) continue;
    const id = ((off as any)._id || off.id || (off as any).code || '').toString();
    if (!id) {
      result.push(off);
      continue;
    }
    if (!seen.has(id)) {
      seen.add(id);
      result.push(off);
    }
  }
  return result;
}

export function BookingModal({
  visible,
  salon,
  initialService = null,
  initialOffer = null,
  onClose,
  onBookingSuccess
}: BookingModalProps) {
  const { token } = useAuth();

  const [salonServices, setSalonServices] = useState<Service[]>(salon.services || []);
  const [loadingServices, setLoadingServices] = useState(false);
  const [slotErrorMessage, setSlotErrorMessage] = useState<string | null>(null);

  const [availableOffers, setAvailableOffers] = useState<Array<CustomerOffer | SalonOffer>>(() => {
    const list: Array<CustomerOffer | SalonOffer> = [];
    if (initialOffer) list.push(initialOffer);
    if (salon.offers && salon.offers.length > 0) list.push(...salon.offers);
    return deduplicateOffers(list);
  });

  const salonId = (salon.id || salon._id || '').toString();

  // Load real salon-specific standalone services if empty on salon object
  useEffect(() => {
    if (visible && salonId && (!salonServices || salonServices.length === 0)) {
      setLoadingServices(true);
      salonService
        .getSalonServices(salonId)
        .then((res) => {
          if (res?.data && res.data.length > 0) {
            setSalonServices(res.data);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingServices(false));
    }
  }, [visible, salonId]);

  // Load and synchronize active salon offers from backend and props
  useEffect(() => {
    if (!visible) return;

    const baseList: Array<CustomerOffer | SalonOffer> = [];
    if (initialOffer) baseList.push(initialOffer);
    if (salon.offers && salon.offers.length > 0) baseList.push(...salon.offers);
    setAvailableOffers(deduplicateOffers(baseList));

    if (salonId) {
      offerService
        .getSalonOffers(salonId)
        .then((res) => {
          if (res?.data && Array.isArray(res.data)) {
            const combined: Array<CustomerOffer | SalonOffer> = [
              ...(initialOffer ? [initialOffer] : []),
              ...(res.data as Array<CustomerOffer | SalonOffer>)
            ];
            setAvailableOffers(deduplicateOffers(combined));
          }
        })
        .catch(() => {});
    }
  }, [visible, salonId, initialOffer, salon.offers]);

  // Determine initial service
  const getPreselectedService = (): Service | null => {
    if (initialService) return initialService;
    const targetService = initialOffer?.applicableService;
    const currentServices = salonServices.length > 0 ? salonServices : salon.services || [];
    if (targetService && targetService !== 'ALL') {
      const match = currentServices.find(
        (s) =>
          s.id === targetService ||
          (s as any)._id === targetService ||
          s.name.toLowerCase() === targetService.toLowerCase()
      );
      if (match) return match;
    }
    return currentServices.length > 0 ? currentServices[0] : null;
  };

  const [selectedService, setSelectedService] = useState<Service | null>(getPreselectedService);

  // Generate next 14 booking days
  const dateOptions = (() => {
    const list = [];
    const now = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      const iso = d.toISOString().split('T')[0];
      const dayName =
        i === 0
          ? 'Today'
          : i === 1
          ? 'Tomorrow'
          : d.toLocaleDateString('en-US', { weekday: 'short' });
      const monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      list.push({ iso, dayName, monthDay });
    }
    return list;
  })();

  const [selectedDate, setSelectedDate] = useState(dateOptions[0].iso);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [customerNote, setCustomerNote] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [createdAppointment, setCreatedAppointment] = useState<AppointmentData | null>(null);

  // Selected Offer State: tracks which eligible offer is applied
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(() => {
    if (initialOffer) return ((initialOffer as any)._id || initialOffer.id || '').toString();
    return null;
  });

  // Re-sync on modal open or when services/offers change
  useEffect(() => {
    if (visible) {
      const pre = getPreselectedService();
      if (pre) setSelectedService(pre);
      if (initialOffer) {
        setSelectedOfferId(((initialOffer as any)._id || initialOffer.id || '').toString());
      }
    }
  }, [initialService, initialOffer, visible, salonServices.length]);

  // Find all offers eligible for the currently selected service
  const eligibleOffers = useMemo(() => {
    if (!selectedService) return [];
    const matched = availableOffers.filter((o) => isOfferApplicableToService(o, selectedService));
    return deduplicateOffers(matched);
  }, [availableOffers, selectedService]);

  // Automatically update selected offer when selectedService changes
  useEffect(() => {
    if (!selectedService) {
      setSelectedOfferId(null);
      return;
    }

    // If an offer is already chosen, check if it's still eligible for this new service
    const currentStillEligible = eligibleOffers.some(
      (o) => ((o as any)._id || o.id || '').toString() === selectedOfferId
    );

    if (currentStillEligible) {
      // Keep it
      return;
    }

    // If initial offer was explicitly passed and is eligible, pick it
    if (initialOffer && isOfferApplicableToService(initialOffer, selectedService)) {
      setSelectedOfferId(((initialOffer as any)._id || initialOffer.id || '').toString());
      return;
    }

    // Otherwise auto-select the best available eligible offer
    if (eligibleOffers.length > 0) {
      const best = getBestOfferForService(selectedService, eligibleOffers);
      if (best.appliedOffer) {
        setSelectedOfferId(
          ((best.appliedOffer as any)._id || best.appliedOffer.id || '').toString()
        );
      } else {
        setSelectedOfferId(null);
      }
    } else {
      setSelectedOfferId(null);
    }
  }, [selectedService?.name, selectedService?.id, eligibleOffers.length]);

  // Resolve applied offer object
  const appliedOffer = useMemo(() => {
    if (!selectedOfferId) return null;
    return (
      eligibleOffers.find(
        (o) => ((o as any)._id || o.id || '').toString() === selectedOfferId
      ) || null
    );
  }, [selectedOfferId, eligibleOffers]);

  // Calculate pricing
  const pricing = useMemo(() => {
    return calculateServicePriceWithOffer(selectedService, appliedOffer);
  }, [selectedService, appliedOffer]);

  const { originalPrice, discountAmount, finalPrice, hasDiscount, discountLabel } = pricing;

  // Fetch real-time continuous availability whenever date or service changes
  const loadAvailability = async () => {
    if (!salonId || !selectedDate) return;

    setLoadingSlots(true);
    setSlotErrorMessage(null);
    setSelectedTime(null);
    try {
      const svcId = selectedService?.id || (selectedService as any)?._id || selectedService?.name;
      const duration =
        selectedService?.durationMinutes || (selectedService as any)?.duration || 30;

      const res = await appointmentService.getAvailability(
        salonId,
        selectedDate,
        svcId,
        duration
      );
      if (res?.slots) {
        setSlots(res.slots);
        if (res.slots.length === 0) {
          setSlotErrorMessage('No slots available on this date. Salon may be closed on this day.');
        } else if (res.availableSlotsCount === 0) {
          setSlotErrorMessage(
            'All appointment slots are occupied on this date. Please select another date.'
          );
        }
      } else {
        setSlots([]);
        setSlotErrorMessage('No slots available on this date.');
      }
    } catch (err: any) {
      setSlots([]);
      const msg = err instanceof Error ? err.message : 'No slots available on this date.';
      setSlotErrorMessage(msg);
    } finally {
      setLoadingSlots(false);
    }
  };

  useEffect(() => {
    if (visible && selectedService) {
      void loadAvailability();
    }
  }, [visible, selectedDate, selectedService?.name, selectedService?.id]);

  // Handle final booking submission
  const handleConfirmBooking = async () => {
    if (!token) {
      dialogService.showInfo('Sign In Required', 'Please sign in to complete your appointment booking.');
      return;
    }
    if (!selectedService) {
      dialogService.showWarning('Select Service', 'Please pick a treatment service.');
      return;
    }
    if (!selectedTime) {
      dialogService.showWarning('Select Time Slot', 'Please select an available appointment time.');
      return;
    }

    const sId = (salon.id || salon._id || '').toString();
    const serviceId = (
      selectedService.id ||
      (selectedService as any)._id ||
      selectedService.name
    ).toString();
    const offerId = appliedOffer
      ? ((appliedOffer as any)._id || appliedOffer.id)?.toString()
      : undefined;

    setBookingLoading(true);
    try {
      const res = await appointmentService.bookAppointment(token, {
        salonId: sId,
        serviceId,
        offerId,
        appointmentDate: selectedDate,
        startTime: selectedTime,
        customerNote: customerNote.trim()
      });

      setCreatedAppointment(res.appointment);
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : 'Failed to book appointment';
      dialogService.showError('Booking Error', msg);
    } finally {
      setBookingLoading(false);
    }
  };

  const selectedSlot = slots.find((s) => s.startTime === selectedTime);
  const durationMinutes =
    selectedService?.durationMinutes || (selectedService as any)?.duration || 30;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={s.modalPage} edges={['top', 'bottom', 'left', 'right']}>
        {/* Modal Top Bar */}
        <View style={s.topBar}>
          <Pressable onPress={onClose} style={s.closeBtn}>
            <Text style={s.closeText}>✕ Close</Text>
          </Pressable>
          <Text style={s.modalTitle}>
            {createdAppointment ? 'Booking Confirmed' : 'Book Appointment'}
          </Text>
          <View style={{ width: 50 }} />
        </View>

        {createdAppointment ? (
          /* Step 6: Booking Request Sent Success State */
          <ScrollView contentContainerStyle={s.successContent}>
            <View style={s.successCard}>
              <View style={s.successIconCircle}>
                <Text style={s.checkMark}>✓</Text>
              </View>

              <Text style={s.successHeading}>Booking Request Sent</Text>
              <Text style={s.waitingBanner}>Waiting for salon confirmation.</Text>

              <Text style={s.successCopy}>
                Your appointment request has been submitted directly to{' '}
                <Text style={{ fontWeight: '800', color: colors.ink }}>
                  {salon.name || salon.salonName}
                </Text>
                . The salon team reviews bookings and will confirm your slot shortly.
              </Text>

              <View style={s.receiptBox}>
                <View style={s.receiptRow}>
                  <Text style={s.rLabel}>Status</Text>
                  <View style={s.pendingBadge}>
                    <Text style={s.pendingBadgeText}>PENDING APPROVAL</Text>
                  </View>
                </View>
                <View style={s.receiptRow}>
                  <Text style={s.rLabel}>Salon</Text>
                  <Text style={s.rVal}>{salon.name || salon.salonName}</Text>
                </View>
                <View style={s.receiptRow}>
                  <Text style={s.rLabel}>Treatment</Text>
                  <Text style={s.rVal}>
                    {createdAppointment.serviceName || selectedService?.name}
                  </Text>
                </View>
                <View style={s.receiptRow}>
                  <Text style={s.rLabel}>Date</Text>
                  <Text style={s.rVal}>{createdAppointment.appointmentDate}</Text>
                </View>
                <View style={s.receiptRow}>
                  <Text style={s.rLabel}>Time Slot</Text>
                  <Text style={s.rVal}>
                    {createdAppointment.startTime} - {createdAppointment.endTime} (
                    {durationMinutes} mins)
                  </Text>
                </View>

                <View style={s.receiptDivider} />

                {/* Price Breakdown in Receipt */}
                <View style={s.receiptRow}>
                  <Text style={s.rLabel}>Standard Treatment Price</Text>
                  <Text
                    style={[
                      s.rVal,
                      createdAppointment.discountAmount && createdAppointment.discountAmount > 0
                        ? s.strikethroughPrice
                        : null
                    ]}
                  >
                    ₹{createdAppointment.originalPrice ?? originalPrice}
                  </Text>
                </View>

                {Boolean(
                  createdAppointment.discountAmount && createdAppointment.discountAmount > 0
                ) && (
                  <View style={s.receiptRow}>
                    <Text style={[s.rLabel, { color: colors.gold, fontWeight: '700' }]}>
                      Offer Discount ({discountLabel || 'Applied'})
                    </Text>
                    <Text style={[s.rVal, { color: colors.gold, fontWeight: '700' }]}>
                      -₹{createdAppointment.discountAmount}
                    </Text>
                  </View>
                )}

                <View style={s.receiptRow}>
                  <Text style={[s.rLabel, { fontWeight: '800', color: colors.ink }]}>
                    Total Payable at Salon
                  </Text>
                  <Text
                    style={[
                      s.rVal,
                      { color: colors.goldDark, fontWeight: '800', fontSize: 16 }
                    ]}
                  >
                    ₹{createdAppointment.totalPrice ?? finalPrice}
                  </Text>
                </View>
              </View>

              <View style={{ marginTop: 24, width: '100%' }}>
                <PrimaryButton
                  label="View in My Bookings →"
                  onPress={() => {
                    onBookingSuccess(createdAppointment);
                    onClose();
                  }}
                />
                <View style={{ marginTop: 10 }}>
                  <SecondaryButton label="Done" onPress={onClose} />
                </View>
              </View>
            </View>
          </ScrollView>
        ) : (
          /* Step 1–5: Booking Configuration Flow */
          <ScrollView
            contentContainerStyle={s.formContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Salon Context Header */}
            <View style={s.salonHeader}>
              <Text style={s.contextEyebrow}>BOOKING DESTINATION</Text>
              <Text style={s.contextSalonName}>{salon.name || salon.salonName}</Text>
              <Text style={s.contextLocation}>
                📍 {formatLocation(salon.location, salon.city, salon.address)}
              </Text>
            </View>

            {/* Step 1: Select Service */}
            <View style={s.stepSection}>
              <View style={s.stepHeader}>
                <Text style={s.stepNumber}>1</Text>
                <Text style={s.stepTitle}>Select Service</Text>
              </View>

              {loadingServices ? (
                <View style={s.slotLoadingWrap}>
                  <ActivityIndicator size="small" color={colors.gold} />
                  <Text style={s.slotLoadingText}>Loading salon services menu...</Text>
                </View>
              ) : salonServices.length === 0 ? (
                <View style={s.noSlotsBox}>
                  <Text style={s.noSlotsText}>Services not yet added by this salon</Text>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.serviceScroll}
                >
                  {salonServices.map((svc, idx) => {
                    const isSelected = selectedService?.name === svc.name;
                    const dur = svc.durationMinutes || (svc as any).duration || 30;
                    const svcPricing = getBestOfferForService(svc, availableOffers);

                    return (
                      <Pressable
                        key={String(svc.id || (svc as any)._id || svc.name || `svc-${idx}`)}
                        style={[s.svcCard, isSelected && s.svcCardActive]}
                        onPress={() => setSelectedService(svc)}
                      >
                        <View style={s.svcTopRow}>
                          <View style={[s.radioCircle, isSelected && s.radioCircleActive]}>
                            {isSelected && <View style={s.radioInner} />}
                          </View>
                          {svcPricing.hasDiscount ? (
                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={s.svcPriceStrikethrough}>
                                ₹{svcPricing.originalPrice}
                              </Text>
                              <Text style={s.svcPriceDiscounted}>
                                ₹{svcPricing.finalPrice}
                              </Text>
                            </View>
                          ) : (
                            <Text style={s.svcPrice}>₹{svc.price}</Text>
                          )}
                        </View>
                        <Text style={s.svcName} numberOfLines={2}>
                          {svc.name}
                        </Text>
                        <Text style={s.svcDuration}>⏱ {dur} mins continuous</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            {/* Step 2: Eligible Offers Selector */}
            {eligibleOffers.length > 0 && (
              <View style={s.stepSection}>
                <View style={s.stepHeader}>
                  <Text style={s.stepNumber}>2</Text>
                  <Text style={s.stepTitle}>Available Offers & Deals</Text>
                </View>

                <View style={s.offersSelectionWrap}>
                  {eligibleOffers.map((off, index) => {
                    const oId = ((off as any)._id || off.id || (off as any).code || '').toString();
                    const isOfferSelected = selectedOfferId === oId;
                    const oVal = off.discountValue ?? (off as any).discountPercent ?? 0;
                    const oBadge =
                      off.discountType === 'FIXED' ? `₹${oVal} OFF` : `${oVal}% OFF`;
                    const offerKey = oId
                      ? `booking-modal-offer-${salonId}-${oId}`
                      : `booking-modal-offer-${salonId}-${index}`;

                    return (
                      <Pressable
                        key={offerKey}
                        style={[s.offerSelectCard, isOfferSelected && s.offerSelectCardActive]}
                        onPress={() => {
                          if (isOfferSelected) {
                            setSelectedOfferId(null); // Toggle off
                          } else {
                            setSelectedOfferId(oId);
                          }
                        }}
                      >
                        <View style={s.offerSelectTop}>
                          <View style={s.offerBadgePill}>
                            <Text style={s.offerBadgeText}>{oBadge}</Text>
                          </View>
                          <Text style={s.offerApplyToggleText}>
                            {isOfferSelected ? '✓ Applied' : '+ Tap to Apply'}
                          </Text>
                        </View>
                        <Text style={s.offerSelectTitle}>{off.title}</Text>
                        <Text style={s.offerSelectDesc} numberOfLines={2}>
                          {off.description}
                        </Text>
                        {off.endDate ? (
                          <Text style={s.offerExpiryText}>
                            ⏱ Valid until{' '}
                            {new Date(off.endDate).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short'
                            })}
                          </Text>
                        ) : null}
                      </Pressable>
                    );
                  })}

                  {selectedOfferId && (
                    <Pressable
                      style={s.removeOfferBtn}
                      onPress={() => setSelectedOfferId(null)}
                    >
                      <Text style={s.removeOfferBtnText}>✕ Remove Applied Offer</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            )}

            {/* Step 3: Select Date */}
            <View style={s.stepSection}>
              <View style={s.stepHeader}>
                <Text style={s.stepNumber}>{eligibleOffers.length > 0 ? '3' : '2'}</Text>
                <Text style={s.stepTitle}>Select Date</Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.dateScroll}
              >
                {dateOptions.map((opt) => {
                  const isSelected = selectedDate === opt.iso;
                  return (
                    <Pressable
                      key={opt.iso}
                      style={[s.datePill, isSelected && s.datePillActive]}
                      onPress={() => setSelectedDate(opt.iso)}
                    >
                      <Text style={[s.dayName, isSelected && s.dayNameActive]}>
                        {opt.dayName}
                      </Text>
                      <Text style={[s.monthDay, isSelected && s.monthDayActive]}>
                        {opt.monthDay}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Step 4: View Available Times */}
            <View style={s.stepSection}>
              <View style={s.stepHeader}>
                <Text style={s.stepNumber}>{eligibleOffers.length > 0 ? '4' : '3'}</Text>
                <Text style={s.stepTitle}>Available Times</Text>
                <Text style={s.durationNote}>({durationMinutes}-min continuous slots)</Text>
              </View>

              {loadingSlots ? (
                <View style={s.slotLoadingWrap}>
                  <ActivityIndicator size="small" color={colors.gold} />
                  <Text style={s.slotLoadingText}>
                    Calculating real-time continuous availability...
                  </Text>
                </View>
              ) : slots.length === 0 ? (
                <View style={s.noSlotsBox}>
                  <Text style={s.noSlotsText}>
                    {slotErrorMessage || 'No appointments available for this date.'}
                  </Text>
                </View>
              ) : (
                <View style={s.slotsGrid}>
                  {slots.map((slot) => {
                    const isSelected = selectedTime === slot.startTime;
                    return (
                      <Pressable
                        key={slot.startTime}
                        disabled={!slot.isAvailable}
                        style={[
                          s.slotPill,
                          isSelected && s.slotPillActive,
                          !slot.isAvailable && s.slotPillDisabled
                        ]}
                        onPress={() => setSelectedTime(slot.startTime)}
                      >
                        <Text
                          style={[
                            s.slotTimeText,
                            isSelected && s.slotTimeTextActive,
                            !slot.isAvailable && s.slotTimeTextDisabled
                          ]}
                        >
                          {slot.startTime}
                        </Text>
                        <Text
                          style={[
                            s.slotSubText,
                            isSelected && s.slotSubTextActive,
                            !slot.isAvailable && s.slotSubTextDisabled
                          ]}
                        >
                          {slot.isAvailable ? 'Available' : 'Occupied'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Special Instructions Note */}
            <View style={s.stepSection}>
              <Text style={s.noteLabel}>Special Requests or Stylist Notes (Optional)</Text>
              <TextInput
                style={s.noteInput}
                placeholder="e.g. skin sensitivity, specific haircut style, or styling preferences"
                placeholderTextColor={colors.muted}
                value={customerNote}
                onChangeText={setCustomerNote}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Complete Price Breakdown Summary */}
            {selectedService && (
              <View style={s.summaryCard}>
                <Text style={s.summaryHeading}>COMPLETE PRICE BREAKDOWN</Text>

                <View style={s.summaryRow}>
                  <Text style={s.sumLabel}>Treatment</Text>
                  <Text style={s.sumVal}>{selectedService.name}</Text>
                </View>

                {selectedTime && (
                  <View style={s.summaryRow}>
                    <Text style={s.sumLabel}>Appointment Window</Text>
                    <Text style={s.sumVal}>
                      {selectedDate} at {selectedTime} - {selectedSlot?.endTime}
                    </Text>
                  </View>
                )}

                <View style={s.summaryRow}>
                  <Text style={s.sumLabel}>Estimated Duration</Text>
                  <Text style={s.sumVal}>{durationMinutes} minutes continuous</Text>
                </View>

                <View style={s.summaryDivider} />

                <View style={s.summaryRow}>
                  <Text style={s.sumLabel}>Original Treatment Price</Text>
                  <Text
                    style={[
                      s.sumVal,
                      hasDiscount && discountAmount > 0 ? s.strikethroughPrice : null
                    ]}
                  >
                    ₹{originalPrice}
                  </Text>
                </View>

                {hasDiscount && discountAmount > 0 ? (
                  <View style={s.summaryRow}>
                    <Text style={[s.sumLabel, { color: '#059669', fontWeight: '700' }]}>
                      Offer Discount ({discountLabel})
                    </Text>
                    <Text style={[s.sumVal, { color: '#059669', fontWeight: '800' }]}>
                      -₹{discountAmount}
                    </Text>
                  </View>
                ) : null}

                <View style={s.summaryDivider} />

                <View style={s.summaryRow}>
                  <Text style={[s.sumLabel, { fontWeight: '800', color: colors.ink }]}>
                    Final Payable at Salon
                  </Text>
                  <Text style={[s.sumVal, s.sumPrice]}>₹{finalPrice}</Text>
                </View>
              </View>
            )}

            <View style={{ marginTop: 20, marginBottom: 40 }}>
              <PrimaryButton
                label={
                  selectedTime
                    ? `Confirm Booking (₹${finalPrice})`
                    : 'Select Time Slot to Continue'
                }
                disabled={!selectedTime || bookingLoading}
                loading={bookingLoading}
                onPress={() => void handleConfirmBooking()}
              />
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  modalPage: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  closeBtn: { paddingVertical: 4 },
  closeText: { fontSize: 13, fontWeight: '700', color: colors.muted },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.ink },
  formContent: { padding: 20 },
  salonHeader: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20
  },
  contextEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.gold,
    letterSpacing: 1.2
  },
  contextSalonName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
    marginTop: 2
  },
  contextLocation: { fontSize: 12, color: colors.muted, marginTop: 2 },
  stepSection: { marginBottom: 22 },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8
  },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.ink,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 22
  },
  stepTitle: { fontSize: 16, fontWeight: '800', color: colors.ink },
  durationNote: { fontSize: 12, color: colors.muted },
  serviceScroll: { gap: 12, paddingVertical: 4 },
  svcCard: {
    width: 175,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    justifyContent: 'space-between'
  },
  svcCardActive: {
    borderColor: colors.gold,
    backgroundColor: '#FFFDF9'
  },
  svcTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  radioCircleActive: {
    borderColor: colors.gold
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.gold
  },
  svcPrice: { fontSize: 15, fontWeight: '800', color: colors.gold },
  svcPriceStrikethrough: {
    fontSize: 11,
    color: colors.muted,
    textDecorationLine: 'line-through',
    fontWeight: '600'
  },
  svcPriceDiscounted: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.goldDark
  },
  svcName: { fontSize: 13, fontWeight: '700', color: colors.ink, height: 36 },
  svcDuration: { fontSize: 11, color: colors.muted, marginTop: 4 },

  // Offers Selection
  offersSelectionWrap: { gap: 10 },
  offerSelectCard: {
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14
  },
  offerSelectCardActive: {
    borderColor: colors.goldDark,
    backgroundColor: '#FFFBEB'
  },
  offerSelectTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  offerBadgePill: {
    backgroundColor: colors.goldDark,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.xs
  },
  offerBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  offerApplyToggleText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.goldDark
  },
  offerSelectTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 2
  },
  offerSelectDesc: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 16
  },
  offerExpiryText: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 4
  },
  removeOfferBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 6
  },
  removeOfferBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626'
  },

  dateScroll: { gap: 10, paddingVertical: 4 },
  datePill: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    minWidth: 72
  },
  datePillActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink
  },
  dayName: { fontSize: 11, fontWeight: '700', color: colors.muted },
  dayNameActive: { color: colors.goldLight },
  monthDay: { fontSize: 13, fontWeight: '800', color: colors.ink, marginTop: 2 },
  monthDayActive: { color: '#FFFFFF' },
  slotLoadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 10
  },
  slotLoadingText: { fontSize: 12, color: colors.muted },
  noSlotsBox: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border
  },
  noSlotsText: { fontSize: 13, color: colors.muted, textAlign: 'center' },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  slotPill: {
    width: '31%',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center'
  },
  slotPillActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink
  },
  slotPillDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
    opacity: 0.6
  },
  slotTimeText: { fontSize: 13, fontWeight: '800', color: colors.ink },
  slotTimeTextActive: { color: '#FFFFFF' },
  slotTimeTextDisabled: { color: '#9CA3AF', textDecorationLine: 'line-through' },
  slotSubText: { fontSize: 9, color: colors.muted, marginTop: 2 },
  slotSubTextActive: { color: colors.goldLight },
  slotSubTextDisabled: { color: '#9CA3AF' },
  noteLabel: { fontSize: 12, fontWeight: '700', color: colors.ink, marginBottom: 8 },
  noteInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    fontSize: 13,
    color: colors.ink,
    textAlignVertical: 'top',
    height: 70
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10
  },
  summaryHeading: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.gold,
    marginBottom: 10
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4
  },
  sumLabel: { fontSize: 12, color: colors.muted },
  sumVal: { fontSize: 12, fontWeight: '700', color: colors.ink, textAlign: 'right' },
  sumPrice: { fontSize: 18, fontWeight: '800', color: colors.goldDark },
  successContent: { padding: 22, alignItems: 'center' },
  successCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    width: '100%',
    marginTop: 20
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ECFDF5',
    borderWidth: 2,
    borderColor: '#6EE7B7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  checkMark: { fontSize: 32, fontWeight: '800', color: '#059669' },
  successHeading: { fontSize: 24, fontWeight: '800', color: colors.ink },
  waitingBanner: {
    fontSize: 14,
    fontWeight: '800',
    color: '#D97706',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    marginVertical: 10
  },
  successCopy: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20
  },
  receiptBox: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: 16,
    gap: 8
  },
  receiptDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 6
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  rLabel: { fontSize: 12, color: colors.muted },
  rVal: { fontSize: 13, fontWeight: '700', color: colors.ink },
  pendingBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill
  },
  pendingBadgeText: { fontSize: 10, fontWeight: '800', color: '#92400E' },
  strikethroughPrice: {
    textDecorationLine: 'line-through',
    color: colors.muted
  }
});
