import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { BottomTabBar, CustomerTabKey } from '../components/BottomTabBar';
import { PrimaryButton, SecondaryButton } from '../components/Buttons';
import { images } from '../constants/images';
import { colors, radius, typography } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { BookingModal } from '../components/BookingModal';
import { LogoutConfirmModal } from '../components/LogoutConfirmModal';
import { LocationPickerModal } from '../components/LocationPickerModal';
import { ChangePasswordModal } from '../components/ChangePasswordModal';
import { authService } from '../services/auth.service';
import { salonService } from '../services/salon.service';
import { notificationService } from '../services/notification.service';
import { locationService } from '../services/location.service';
import {
  calculateHaversineDistance,
  CustomerLocationState,
  extractCoordinates,
  formatDistance,
  KNOWN_CITY_COORDINATES,
  normalizeSalonLocation
} from '../utils/location';
import { AppointmentData, CustomerOffer, NotificationItem, Salon, SalonOffer, Service } from '../types';
import { isValidPhone, normalizePhone } from '../utils/validation';
import { CustomerBookingsScreen } from './customer/CustomerBookingsScreen';
import { CustomerFavoritesScreen } from './customer/CustomerFavoritesScreen';
import { CustomerHomeScreen } from './customer/CustomerHomeScreen';
import { CustomerNotificationsScreen } from './customer/CustomerNotificationsScreen';
import { CustomerSearchScreen } from './customer/CustomerSearchScreen';
import { SalonDetailsScreen } from './customer/SalonDetailsScreen';
import { SalonListScreen } from './customer/SalonListScreen';
import { ServiceListScreen } from './customer/ServiceListScreen';
import { OfferDetailsScreen } from './customer/OfferDetailsScreen';
import { CustomerProfileScreen } from './customer/CustomerProfileScreen';
import { CustomerSettingsScreen } from './customer/CustomerSettingsScreen';
import { ProfileAppointmentsScreen } from './customer/ProfileAppointmentsScreen';
import { ProfileFavoritesScreen } from './customer/ProfileFavoritesScreen';
import { ProfileSalonAreaScreen } from './customer/ProfileSalonAreaScreen';
import { PublicReviewsScreen } from './PublicReviewsScreen';

export type SubView =
  | 'NONE'
  | 'SALON_DETAILS'
  | 'SERVICE_LIST'
  | 'SALON_LIST'
  | 'NOTIFICATIONS'
  | 'OFFER_DETAILS'
  | 'PUBLIC_REVIEWS'
  | 'SETTINGS'
  | 'PROFILE_APPOINTMENTS'
  | 'PROFILE_FAVORITES'
  | 'PROFILE_SALON_AREA';

export type OfferOrigin = 'notifications' | 'discover' | 'search' | 'direct';

export interface CustomerNavStackItem {
  tab: CustomerTabKey;
  subView: SubView;
  selectedSalon?: Salon | null;
  reviewSalonFilter?: { id?: string; name?: string };
  selectedOffer?: CustomerOffer | null;
  selectedOfferId?: string | null;
  offerOrigin?: OfferOrigin;
}

const INITIAL_FEATURED_SALONS: Salon[] = [
  {
    id: 'init_1',
    _id: 'init_1',
    name: 'NÉA House of Beauty',
    salonName: 'NÉA House of Beauty',
    location: 'Indiranagar, Bengaluru',
    city: 'Bengaluru',
    address: '100 Feet Road, Indiranagar',
    coordinates: { latitude: 12.9784, longitude: 77.6408 },
    phone: '+91 80 4123 4567',
    description:
      'Artisanal hair styling, botanical scalp rituals, and French balayage in a serene garden sanctuary.',
    rating: 4.9,
    reviews: 248,
    startingPrice: 'From ₹700',
    image: images.salon,
    images: [
      images.salon,
      'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=800&q=80'
    ],
    services: [
      {
        name: 'Botanical Hair Ritual',
        category: 'Hair',
        price: 1800,
        durationMinutes: 60,
        description: 'Deep conditioning and botanical shine therapy'
      },
      {
        name: 'French Luxe Balayage',
        category: 'Color',
        price: 4500,
        durationMinutes: 120,
        description: 'Hand-painted dimensional multidimensional balayage'
      },
      {
        name: 'Restorative Haircut & Blowdry',
        category: 'Hair',
        price: 950,
        durationMinutes: 45,
        description: 'Precision haircut with organic scalp massage and finish'
      }
    ],
    status: 'ACTIVE',
    subscriptionStatus: 'ACTIVE'
  },
  {
    id: 'init_2',
    _id: 'init_2',
    name: 'Mysa Skin & Wellness Studio',
    salonName: 'Mysa Skin & Wellness Studio',
    location: 'Koramangala, Bengaluru',
    city: 'Bengaluru',
    address: '5th Block, Koramangala',
    coordinates: { latitude: 12.9352, longitude: 77.6245 },
    phone: '+91 80 4987 6543',
    description:
      'Nordic-inspired skin studio specializing in lymphatic drainage facials, LED phototherapy, and bridal glow treatments.',
    rating: 4.8,
    reviews: 189,
    startingPrice: 'From ₹900',
    image: images.hero,
    images: [
      images.hero,
      'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80'
    ],
    services: [
      {
        name: 'Glow Hydra-Facial Ritual',
        category: 'Skin',
        price: 2800,
        durationMinutes: 60,
        description: 'Deep pore infusion with hyaluronic acid and antioxidant therapy'
      },
      {
        name: 'Bridal Radiant Illuminator',
        category: 'Bridal',
        price: 5200,
        durationMinutes: 90,
        description: 'Complete skin resurfacing and bridal luminosity ritual'
      },
      {
        name: 'Lymphatic Detox Head Spa',
        category: 'Spa',
        price: 1600,
        durationMinutes: 45,
        description: 'Tension release scalp treatment with aromatherapy'
      }
    ],
    status: 'ACTIVE',
    subscriptionStatus: 'ACTIVE'
  },
  {
    id: 'init_3',
    _id: 'init_3',
    name: 'Aura Royale Salon & Spa',
    salonName: 'Aura Royale Salon & Spa',
    location: 'Thillai Nagar, Tiruchirappalli',
    city: 'Tiruchirappalli',
    address: '11th Cross, Thillai Nagar Main Road',
    coordinates: { latitude: 10.8267, longitude: 78.6853 },
    phone: '+91 431 278 9100',
    description:
      'Bespoke bridal styling, traditional herbal hair care, and holistic wellness spa in Tiruchirappalli.',
    rating: 4.9,
    reviews: 142,
    startingPrice: 'From ₹800',
    image: images.salon,
    images: [
      images.salon,
      'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80'
    ],
    services: [
      {
        name: 'Royal Herbal Scalp Spa',
        category: 'Spa',
        price: 1500,
        durationMinutes: 60,
        description: 'Traditional herbal oil bath ritual and tension relief'
      },
      {
        name: 'Bridal Kanjeevaram Makeover',
        category: 'Bridal',
        price: 8500,
        durationMinutes: 180,
        description: 'Complete South Indian bridal makeover and saree draping'
      }
    ],
    status: 'ACTIVE',
    subscriptionStatus: 'ACTIVE'
  }
];

export function DiscoverScreen() {
  const { user, token, logout, updateUser } = useAuth();

  // Navigation Stack architecture preserving history across all screens and tabs
  const [navStack, setNavStack] = useState<CustomerNavStackItem[]>([
    { tab: 'Discover', subView: 'NONE' }
  ]);

  const currentNav = navStack[navStack.length - 1] || { tab: 'Discover', subView: 'NONE' };
  const activeTab: CustomerTabKey = currentNav.tab;
  const subView: SubView = currentNav.subView;
  const selectedSalon: Salon | null = currentNav.selectedSalon || null;
  const reviewSalonFilter = currentNav.reviewSalonFilter;
  const selectedOffer: CustomerOffer | null = currentNav.selectedOffer || null;
  const selectedOfferId: string | null = currentNav.selectedOfferId || null;
  const offerOrigin: OfferOrigin = currentNav.offerOrigin || 'discover';

  // Booking Modal states
  const [bookingModalVisible, setBookingModalVisible] = useState(false);
  const [bookingSalon, setBookingSalon] = useState<Salon | null>(null);
  const [bookingService, setBookingService] = useState<Service | null>(null);
  const [bookingOffer, setBookingOffer] = useState<CustomerOffer | SalonOffer | null>(null);

  // Customer Location state - single source of truth; never defaults to Bangalore
  const [customerLocation, setCustomerLocation] = useState<CustomerLocationState>(() => {
    const cached = locationService.getCachedLocation();
    if (cached) return cached;
    if (user?.city) {
      return locationService.setManualCityLocation(user.city);
    }
    return {
      coords: null,
      label: 'Locating...',
      isGps: false,
      city: ''
    };
  });
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  // Navigation Stack Controls
  const handleSelectTab = (targetTab: string) => {
    const validTab = (['Discover', 'Search', 'Bookings', 'Saved', 'Profile'].includes(targetTab)
      ? targetTab
      : 'Discover') as CustomerTabKey;
    setNavStack((prev) => {
      const top = prev[prev.length - 1];
      if (top && top.tab === validTab && top.subView === 'NONE') {
        return prev;
      }
      return [...prev, { tab: validTab, subView: 'NONE' }];
    });
  };

  const handleGoBack = useCallback((): boolean => {
    if (showLocationPicker) {
      setShowLocationPicker(false);
      return true;
    }
    if (bookingModalVisible) {
      setBookingModalVisible(false);
      return true;
    }
    if (navStack.length > 1) {
      setNavStack((prev) => prev.slice(0, prev.length - 1));
      return true;
    }
    if (navStack.length === 1 && navStack[0].tab !== 'Discover') {
      setNavStack([{ tab: 'Discover', subView: 'NONE' }]);
      return true;
    }
    return false;
  }, [showLocationPicker, bookingModalVisible, navStack]);

  // Filter & Search states
  const [selectedCity, setSelectedCity] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchInitialQuery, setSearchInitialQuery] = useState('');

  // Data states
  const [dbSalons, setDbSalons] = useState<Salon[]>([]);
  const [offers, setOffers] = useState<CustomerOffer[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const handleOpenBooking = (
    salon: Salon,
    service?: Service | null,
    offer?: CustomerOffer | SalonOffer | null
  ) => {
    setBookingSalon(salon ? normalizeSalonLocation(salon) : salon);
    setBookingService(service || null);
    setBookingOffer(offer || null);
    setBookingModalVisible(true);
  };

  const handleOpenOfferDetails = (
    offer: CustomerOffer | null,
    offerId?: string,
    origin: OfferOrigin = 'discover'
  ) => {
    setNavStack((prev) => {
      const top = prev[prev.length - 1];
      return [
        ...prev,
        {
          tab: top ? top.tab : 'Discover',
          subView: 'OFFER_DETAILS',
          selectedOffer: offer,
          selectedOfferId: offerId || offer?._id || offer?.id || null,
          offerOrigin: origin
        }
      ];
    });
  };

  // Notification states
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const loadNotifications = async () => {
    if (!token) return;
    setLoadingNotifications(true);
    try {
      const res = await notificationService.getNotifications(token);
      setNotifications(res.data || []);
      setUnreadNotificationsCount(res.unreadCount || 0);
    } catch {
      // quiet fallback
    } finally {
      setLoadingNotifications(false);
    }
  };


  // Fetch approved active salons and platform offers from API
  const loadData = async (loc?: CustomerLocationState) => {
    setLoading(true);
    try {
      const activeLoc = loc !== undefined ? loc : customerLocation;
      const lat = activeLoc?.coords?.latitude;
      const lng = activeLoc?.coords?.longitude;
      const city =
        activeLoc?.city && activeLoc.city.toLowerCase() !== 'all' && activeLoc.city.toLowerCase() !== 'all cities'
          ? activeLoc.city
          : undefined;

      const [salonsRes, offersRes] = await Promise.all([
        salonService
          .getSalons({
            lat,
            lng,
            city: activeLoc?.isGps ? undefined : city,
            radius: user?.searchRadius
          })
          .catch(() => ({ data: [] })),
        salonService.getActiveOffers().catch(() => ({ data: [] }))
      ]);

      if (salonsRes?.data) {
        setDbSalons((salonsRes.data || []).map((s) => normalizeSalonLocation(s)));
      }
      if (offersRes?.data) {
        setOffers(offersRes.data);
      }
    } catch {
      // quiet fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      // 1. Restore saved location from SecureStore
      const savedLoc = await locationService.initLocation();
      let activeLoc = savedLoc;
      if (!activeLoc && user?.city) {
        activeLoc = locationService.setManualCityLocation(user.city);
      }

      if (activeLoc && isMounted) {
        setCustomerLocation(activeLoc);
        void loadData(activeLoc);
      }

      // 2. Try obtaining high-accuracy device GPS position
      try {
        const gpsLoc = await locationService.getDeviceLocation();
        if (gpsLoc && isMounted) {
          setCustomerLocation(gpsLoc);
          void loadData(gpsLoc);
          return;
        }
      } catch {
        // quiet fallback
      }

      // 3. If GPS failed/denied, never stay stuck on "Locating..."
      if (isMounted) {
        setCustomerLocation((prev) => {
          if (prev.coords) return prev;
          return {
            coords: null,
            label: 'Select City Manually',
            isGps: false,
            city: ''
          };
        });
        if (!activeLoc) {
          void loadData();
        }
      }
    };

    void initialize();
    if (token) void loadNotifications();

    return () => {
      isMounted = false;
    };
  }, [token, user?.city]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      return handleGoBack();
    });
    return () => sub.remove();
  }, [handleGoBack]);

  // Real approved database salons; fallback to curated showcase only if DB is empty
  const allSalons: Salon[] = useMemo(() => {
    if (dbSalons.length > 0) {
      return dbSalons;
    }
    return INITIAL_FEATURED_SALONS;
  }, [dbSalons]);

  // Enrich with accurate customer-to-salon straight-line distance and sort nearest first
  const salonsWithDistances: Salon[] = useMemo(() => {
    const mapped = allSalons.map((raw) => {
      const s = normalizeSalonLocation(raw);
      const sCoords = extractCoordinates(s) || s.coordinates;

      let distance = 'Distance unavailable';
      let distanceKm: number | null = null;

      if (
        customerLocation?.coords &&
        sCoords?.latitude &&
        sCoords?.longitude
      ) {
        distanceKm = calculateHaversineDistance(
          customerLocation.coords.latitude,
          customerLocation.coords.longitude,
          sCoords.latitude,
          sCoords.longitude
        );
        distance = formatDistance(distanceKm);
      } else if (s.distance && s.distance !== 'Distance unavailable') {
        distance = s.distance;
      }

      return {
        ...s,
        coordinates: sCoords,
        distance,
        distanceKm: distanceKm ?? undefined,
        offers: s.offers && s.offers.length > 0 ? s.offers : []
      };
    });

    if (customerLocation?.coords) {
      mapped.sort((a, b) => {
        if (typeof a.distanceKm === 'number' && typeof b.distanceKm === 'number') {
          return a.distanceKm - b.distanceKm;
        }
        if (typeof a.distanceKm === 'number') return -1;
        if (typeof b.distanceKm === 'number') return 1;
        return 0;
      });
    }

    return mapped;
  }, [allSalons, customerLocation, offers]);

  // Handle Favorites Toggle
  const handleToggleFavorite = useCallback((salon: Salon) => {
    const salonId = (salon.id || salon._id || '').toString();
    setFavorites((prev) => {
      if (prev.includes(salonId)) {
        return prev.filter((id) => id !== salonId);
      } else {
        return [...prev, salonId];
      }
    });
  }, []);

  // Get list of favorite salons
  const favoriteSalons = salonsWithDistances.filter((s) => {
    const sId = (s.id || s._id || '').toString();
    return favorites.includes(sId);
  });

  // Action handlers with stable references to prevent unnecessary child re-renders
  const handleSelectSalon = useCallback((salon: Salon) => {
    const normalized = salon ? normalizeSalonLocation(salon) : salon;
    setNavStack((prev) => {
      const top = prev[prev.length - 1];
      return [
        ...prev,
        {
          tab: top ? top.tab : 'Discover',
          subView: 'SALON_DETAILS',
          selectedSalon: normalized
        }
      ];
    });
  }, []);

  const handleViewServiceList = useCallback((salon: Salon) => {
    setNavStack((prev) => {
      const top = prev[prev.length - 1];
      return [
        ...prev,
        {
          tab: top ? top.tab : 'Discover',
          subView: 'SERVICE_LIST',
          selectedSalon: salon
        }
      ];
    });
  }, []);

  const handleViewSalonReviews = useCallback((salonId: string, salonName: string) => {
    setNavStack((prev) => {
      const top = prev[prev.length - 1];
      return [
        ...prev,
        {
          tab: top ? top.tab : 'Discover',
          subView: 'PUBLIC_REVIEWS',
          selectedSalon,
          reviewSalonFilter: { id: salonId, name: salonName }
        }
      ];
    });
  }, [selectedSalon]);

  const handleOpenGlobalReviews = useCallback(() => {
    setNavStack((prev) => {
      const top = prev[prev.length - 1];
      return [
        ...prev,
        {
          tab: top ? top.tab : 'Discover',
          subView: 'PUBLIC_REVIEWS',
          reviewSalonFilter: undefined
        }
      ];
    });
  }, []);

  const handleViewAllSalons = useCallback(() => {
    setNavStack((prev) => {
      const top = prev[prev.length - 1];
      return [
        ...prev,
        {
          tab: top ? top.tab : 'Discover',
          subView: 'SALON_LIST'
        }
      ];
    });
  }, []);

  const handleOpenNotifications = useCallback(() => {
    void loadNotifications();
    setNavStack((prev) => {
      const top = prev[prev.length - 1];
      return [
        ...prev,
        {
          tab: top ? top.tab : 'Discover',
          subView: 'NOTIFICATIONS'
        }
      ];
    });
  }, [token]);

  const handleOpenSettings = useCallback(() => {
    setNavStack((prev) => [
      ...prev,
      {
        tab: 'Profile',
        subView: 'SETTINGS'
      }
    ]);
  }, []);

  const handleOpenProfileAppointments = useCallback(() => {
    setNavStack((prev) => [
      ...prev,
      {
        tab: 'Profile',
        subView: 'PROFILE_APPOINTMENTS'
      }
    ]);
  }, []);

  const handleOpenProfileFavorites = useCallback(() => {
    setNavStack((prev) => [
      ...prev,
      {
        tab: 'Profile',
        subView: 'PROFILE_FAVORITES'
      }
    ]);
  }, []);

  const handleOpenProfileSalonArea = useCallback(() => {
    setNavStack((prev) => [
      ...prev,
      {
        tab: 'Profile',
        subView: 'PROFILE_SALON_AREA'
      }
    ]);
  }, []);

  const handleOpenSearch = useCallback((initialQuery = '') => {
    setSearchInitialQuery(initialQuery);
    setNavStack((prev) => [
      ...prev,
      { tab: 'Search', subView: 'NONE' }
    ]);
  }, []);

  const handleOpenProfileTab = useCallback(() => {
    handleSelectTab('Profile');
  }, []);

  const handleSelectOfferDiscover = useCallback((off: CustomerOffer) => {
    handleOpenOfferDetails(off, undefined, 'discover');
  }, []);

  const handleOpenLocationPicker = useCallback(() => {
    setShowLocationPicker(true);
  }, []);

  // Handle opening notification target
  const handleSelectNotification = (item: NotificationItem) => {
    // 1. If notification relates to an offer:
    const offerId = ((item.offerId as any)?._id || item.offerId || item.data?.offerId || '').toString();
    const isOffer =
      item.type === 'OFFER_PUBLISHED' ||
      Boolean(offerId) ||
      item.targetScreen === 'OfferDetails' ||
      item.data?.targetScreen === 'OfferDetails';

    if (isOffer && offerId) {
      const matched = offers.find((o) => (o._id || o.id || '').toString() === offerId);
      handleOpenOfferDetails(matched || null, offerId, 'notifications');
      return;
    }

    // 2. If notification relates to booking:
    if (item.appointmentId || item.data?.appointmentId || item.type.includes('BOOKING')) {
      handleSelectTab('Bookings');
      return;
    }

    // 3. If notification has salonId:
    const sId = ((item.salonId as any)?._id || item.salonId || item.data?.salonId || '').toString();
    if (sId) {
      const target = allSalons.find(
        (s) => (s.id || s._id || '').toString() === sId
      );
      if (target) {
        handleSelectSalon(target);
        return;
      }
    }
  };

  // Stack view and Tab router
  const renderActiveContent = () => {
    if (subView === 'SETTINGS') {
      return (
        <CustomerSettingsScreen
          onBack={handleGoBack}
          onNavigateTab={(targetTab) => handleSelectTab(targetTab as CustomerTabKey)}
          favoritesCount={favorites.length}
          customerLocation={customerLocation}
          onUpdateLocation={(loc) => {
            setCustomerLocation(loc);
            void loadData(loc);
          }}
          onOpenReviews={handleOpenGlobalReviews}
        />
      );
    }

    if (subView === 'PROFILE_APPOINTMENTS') {
      return (
        <ProfileAppointmentsScreen
          onBack={handleGoBack}
        />
      );
    }

    if (subView === 'PROFILE_FAVORITES') {
      return (
        <ProfileFavoritesScreen
          favoriteSalons={favoriteSalons}
          onToggleFavorite={handleToggleFavorite}
          onSelectSalon={handleSelectSalon}
          onBack={handleGoBack}
        />
      );
    }

    if (subView === 'PROFILE_SALON_AREA') {
      return (
        <ProfileSalonAreaScreen
          customerLocation={customerLocation}
          onUpdateCustomerLocation={(loc) => {
            setCustomerLocation(loc);
            void loadData(loc);
          }}
          onOpenLocationPicker={() => setShowLocationPicker(true)}
          onBack={handleGoBack}
        />
      );
    }

    if (subView === 'NOTIFICATIONS') {
      return (
        <CustomerNotificationsScreen
          notifications={notifications}
          loading={loadingNotifications}
          onRefresh={loadNotifications}
          onMarkRead={async (id) => {
            if (!token) return;
            await notificationService.markAsRead(token, id);
            setNotifications((prev) =>
              prev.map((n) => (n._id === id || n.id === id ? { ...n, isRead: true } : n))
            );
            setUnreadNotificationsCount((c) => Math.max(0, c - 1));
          }}
          onMarkAllRead={async () => {
            if (!token) return;
            await notificationService.markAllAsRead(token);
            setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
            setUnreadNotificationsCount(0);
          }}
          onSelectNotification={handleSelectNotification}
          onBack={handleGoBack}
        />
      );
    }

    if (subView === 'OFFER_DETAILS') {
      return (
        <OfferDetailsScreen
          offerId={selectedOfferId || undefined}
          initialOffer={selectedOffer}
          allSalons={allSalons}
          onBookOffer={(salon, offer, service) => {
            handleOpenBooking(salon, service || null, offer);
          }}
          onBack={handleGoBack}
        />
      );
    }

    if (subView === 'PUBLIC_REVIEWS') {
      return (
        <PublicReviewsScreen
          initialSalonId={reviewSalonFilter?.id}
          initialSalonName={reviewSalonFilter?.name}
          onBack={handleGoBack}
        />
      );
    }

    if (subView === 'SALON_DETAILS' && selectedSalon) {
      const salonId = (selectedSalon.id || selectedSalon._id || '').toString();
      return (
        <SalonDetailsScreen
          salon={selectedSalon}
          isFavorite={favorites.includes(salonId)}
          onToggleFavorite={handleToggleFavorite}
          onViewServiceList={handleViewServiceList}
          onBookService={handleOpenBooking}
          onViewAllReviews={handleViewSalonReviews}
          onBack={handleGoBack}
        />
      );
    }

    if (subView === 'SERVICE_LIST' && selectedSalon) {
      return (
        <ServiceListScreen
          salon={selectedSalon}
          onBack={handleGoBack}
          onBookService={handleOpenBooking}
        />
      );
    }

    if (subView === 'SALON_LIST') {
      return (
        <SalonListScreen
          salons={salonsWithDistances}
          initialCity={selectedCity}
          initialCategory={selectedCategory}
          onSelectSalon={handleSelectSalon}
          favorites={favorites}
          onToggleFavorite={handleToggleFavorite}
          onBack={handleGoBack}
          customerLocation={customerLocation}
        />
      );
    }

    // Tab Views - Non-blocking tab switches
    if (activeTab === 'Discover') {
      if (loading && salonsWithDistances.length === 0) {
        return (
          <View style={s.centerWrap}>
            <ActivityIndicator size="large" color={colors.gold} />
            <Text style={s.loadingText}>Loading verified luxury salons...</Text>
          </View>
        );
      }
      return (
        <CustomerHomeScreen
          salons={salonsWithDistances}
          offers={offers}
          selectedCity={selectedCity}
          onSelectCity={setSelectedCity}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          onOpenSearch={handleOpenSearch}
          onSelectSalon={handleSelectSalon}
          onViewAllSalons={handleViewAllSalons}
          favorites={favorites}
          onToggleFavorite={handleToggleFavorite}
          onOpenProfile={handleOpenProfileTab}
          onOpenReviews={handleOpenGlobalReviews}
          onSelectOffer={handleSelectOfferDiscover}
          unreadNotificationsCount={unreadNotificationsCount}
          onOpenNotifications={handleOpenNotifications}
          customerLocation={customerLocation}
          onOpenLocationPicker={handleOpenLocationPicker}
        />
      );
    }

    if (activeTab === 'Search') {
      return (
        <CustomerSearchScreen
          salons={salonsWithDistances}
          initialQuery={searchInitialQuery}
          initialCity={customerLocation?.city || selectedCity || 'All'}
          initialCategory={selectedCategory}
          onSelectSalon={handleSelectSalon}
          onSelectOffer={(off) => handleOpenOfferDetails(off, undefined, 'search')}
          favorites={favorites}
          onToggleFavorite={handleToggleFavorite}
          onBack={handleGoBack}
          customerLocation={customerLocation}
          onOpenLocationPicker={() => setShowLocationPicker(true)}
        />
      );
    }

    if (activeTab === 'Bookings') {
      return <CustomerBookingsScreen onExplore={() => handleSelectTab('Discover')} />;
    }

    if (activeTab === 'Saved') {
      return (
        <CustomerFavoritesScreen
          favoriteSalons={favoriteSalons}
          onSelectSalon={handleSelectSalon}
          onToggleFavorite={handleToggleFavorite}
          onExplore={() => handleSelectTab('Discover')}
        />
      );
    }

    // Customer Profile View
    return (
      <CustomerProfileScreen
        onOpenSettings={handleOpenSettings}
        onNavigateTab={(targetTab) => handleSelectTab(targetTab as CustomerTabKey)}
        favoritesCount={favorites.length}
        customerLocation={customerLocation}
        onOpenAppointments={handleOpenProfileAppointments}
        onOpenFavorites={handleOpenProfileFavorites}
        onOpenSalonArea={handleOpenProfileSalonArea}
        onOpenReviews={handleOpenGlobalReviews}
      />
    );
  };

  return (
    <View style={s.page}>
      {renderActiveContent()}

      {/* Persistent Bottom Tab Bar - Rendered on root navigation tabs */}
      {subView === 'NONE' && (
        <BottomTabBar activeTab={activeTab} onSelectTab={handleSelectTab} />
      )}

      {/* Appointment Booking Flow Modal */}
      {bookingSalon && (
        <BookingModal
          visible={bookingModalVisible}
          salon={bookingSalon}
          initialService={bookingService}
          initialOffer={bookingOffer}
          onClose={() => setBookingModalVisible(false)}
          onBookingSuccess={() => {
            setBookingModalVisible(false);
            setNavStack((prev) => [...prev, { tab: 'Bookings', subView: 'NONE' }]);
          }}
        />
      )}

      {/* Customer Location Picker Modal */}
      <LocationPickerModal
        visible={showLocationPicker}
        currentLocation={customerLocation}
        onClose={() => setShowLocationPicker(false)}
        onSelectLocation={(loc) => {
          setCustomerLocation(loc);
          setSelectedCity(loc.city || 'All');
          void loadData(loc);
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  centerWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: colors.muted, marginTop: 14, fontSize: 13 },
  profileContent: { padding: 22, paddingTop: 16, paddingBottom: 30 },

  eyebrow: { fontSize: 11, letterSpacing: 1.5, fontWeight: '800', color: colors.gold },
  title: {
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -1,
    color: colors.ink,
    fontWeight: '800',
    marginTop: 6
  },
  copy: { color: colors.muted, lineHeight: 20, marginTop: 8, fontSize: 13 },
  card: {
    marginVertical: 24,
    padding: 20,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg
  },
  cardLabel: { fontSize: 11, letterSpacing: 1.2, fontWeight: '800', color: colors.gold },
  name: { color: colors.ink, fontSize: 20, fontWeight: '800', marginTop: 10 },
  email: { color: colors.muted, marginTop: 4, fontSize: 13 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.goldSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 14
  },
  badgeText: { fontSize: 11, fontWeight: '800', color: colors.ink },
  serverBox: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#ECFDF5',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#A7F3D0'
  },
  serverText: { fontSize: 12, color: '#065F46', fontWeight: '600' },
  out: { marginTop: 12 },

  profileFieldRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 10
  },
  profileFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
    width: 115
  },
  profileFieldValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.espresso,
    flex: 1
  },
  emptyFieldText: {
    color: colors.subtle,
    fontStyle: 'italic',
    fontWeight: '500'
  },
  editProfileBtn: {
    marginTop: 16,
    paddingVertical: 10,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    alignItems: 'center'
  },
  editProfileBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.espresso
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: 22,
    maxHeight: '80%'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  modalTitle: { ...typography.title, color: colors.espresso },
  modalCloseText: { fontSize: 18, color: colors.muted, fontWeight: '700' },
  modalField: { marginBottom: 14 },
  modalLabel: { fontSize: 12, fontWeight: '700', color: colors.espresso, marginBottom: 4 },
  modalInput: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    fontSize: 13,
    color: colors.espresso,
    backgroundColor: '#FFFFFF'
  },
  modalSaveBtn: {
    marginTop: 10,
    height: 48,
    backgroundColor: colors.espresso,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalSaveBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' }
});