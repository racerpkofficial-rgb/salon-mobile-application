import { Router } from 'express';
import { Salon } from '../models/Salon.js';
import { SalonOffer } from '../models/SalonOffer.js';
import { Service } from '../models/Service.js';
import {
  calculateHaversineDistance,
  escapeRegex,
  formatDistance,
  getCitySearchPattern,
  isValidCoordinate,
  isValidRadius
} from '../utils/location.js';
import { getBookableSalonFilter, isSalonBookable, sanitizeSalonImages, sanitizeSalonDescription } from '../utils/salon.js';

const router = Router();

// GET /api/v1/salons/offers - Active promotional offers for customer discovery
router.get('/offers', async (_req, res, next) => {
  try {
    const now = new Date();
    // Query real active SalonOffer records created by salon owners
    const offers = await SalonOffer.find({
      isActive: true,
      status: { $nin: ['EXPIRED', 'INACTIVE', 'DELETED'] },
      startDate: { $lte: now },
      endDate: { $gte: now }
    })
      .populate(
        'salonId',
        'salonName description phone address city location images services status subscriptionStatus'
      )
      .sort({ createdAt: -1 })
      .lean();

    const salonIds = offers.map((o) => (o.salonId as any)?._id || o.salonId);
    const standaloneServices = await Service.find({ salonId: { $in: salonIds }, isActive: true }).lean();

    // Enforce business rules: only show offers from active approved salons with valid subscriptions
    const validOffers = offers
      .filter((o) => {
        const salon = o.salonId as any;
        return salon && isSalonBookable(salon);
      })
      .map((o) => {
        const salon = o.salonId as any;
        const discountLabel =
          o.discountType === 'PERCENTAGE'
            ? `${o.discountValue}% OFF`
            : `₹${o.discountValue} OFF`;

        let originalPrice: number | undefined = undefined;
        let discountAmount: number | undefined = undefined;
        let finalPrice: number | undefined = undefined;
        let applicableServiceName: string | undefined = undefined;

        if (o.applicableService) {
          const appSvc =
            salon.services?.find(
              (s: any) =>
                s._id?.toString() === o.applicableService ||
                s.id?.toString() === o.applicableService ||
                s.name?.toLowerCase() === o.applicableService.toLowerCase()
            ) ||
            standaloneServices.find(
              (s: any) =>
                s.salonId?.toString() === salon._id?.toString() &&
                (s._id?.toString() === o.applicableService ||
                  s.name?.toLowerCase() === o.applicableService.toLowerCase())
            );

          if (appSvc && appSvc.price) {
            originalPrice = Number(appSvc.price);
            applicableServiceName = appSvc.name;
            if (o.discountType === 'FIXED') {
              discountAmount = Math.min(originalPrice, o.discountValue || 0);
            } else {
              const pct = Math.min(100, Math.max(0, o.discountValue || 0));
              discountAmount = Math.round((originalPrice * pct) / 100);
            }
            finalPrice = Math.max(0, originalPrice - discountAmount);
          }
        }

        const salonImages = sanitizeSalonImages(salon.images);
        const salonDesc = sanitizeSalonDescription(salon.description);

        return {
          _id: o._id.toString(),
          id: o._id.toString(),
          salonId: salon._id.toString(),
          title: o.title,
          description: o.description,
          discountType: o.discountType,
          discountValue: o.discountValue,
          discountPercent: o.discountType === 'PERCENTAGE' ? o.discountValue : undefined,
          discountLabel,
          applicableService: o.applicableService,
          applicableServiceName,
          originalPrice,
          discountAmount,
          finalPrice,
          startDate: o.startDate ? o.startDate.toISOString() : undefined,
          endDate: o.endDate.toISOString(),
          validUntil: o.endDate.toISOString(),
          image: o.image || salonImages[0] || undefined,
          isActive: o.isActive,
          salonName: salon.salonName,
          salonAddress: salon.address,
          salonCity: salon.city,
          salonImage: salonImages[0] || undefined,
          salon: {
            id: salon._id.toString(),
            _id: salon._id.toString(),
            name: salon.salonName,
            salonName: salon.salonName,
            description: salonDesc,
            location: salon.city ? `${salon.city} • ${salon.address}` : salon.address,
            city: salon.city,
            address: salon.address,
            images: salonImages,
            services: salon.services
          }
        };
      });

    res.json({ data: validOffers });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/salons - Filter and search approved active salons
router.get('/', async (req, res, next) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const city = typeof req.query.city === 'string' ? req.query.city.trim() : '';
    const service = typeof req.query.service === 'string' ? req.query.service.trim() : '';
    const radiusParam = typeof req.query.radius === 'string' ? parseFloat(req.query.radius) : undefined;

    // Enforce strict business rule: active approved salons with valid partner subscription
    const filter: Record<string, any> = getBookableSalonFilter();

    if (city && city.toLowerCase() !== 'all') {
      const cityPattern = getCitySearchPattern(city);
      const qCityPattern = query ? getCitySearchPattern(query) : '';
      if (!qCityPattern || qCityPattern === escapeRegex(query.toLowerCase()) || qCityPattern === cityPattern) {
        filter.city = { $regex: cityPattern, $options: 'i' };
      }
    }

    if (service && service.toLowerCase() !== 'all') {
      const escapedService = escapeRegex(service);
      filter.$or = [
        { 'services.name': { $regex: escapedService, $options: 'i' } },
        { 'services.category': { $regex: escapedService, $options: 'i' } }
      ];
    }

    if (query) {
      const escapedQuery = escapeRegex(query);
      const qRegex = { $regex: escapedQuery, $options: 'i' };
      const cityPattern = getCitySearchPattern(query);
      const cityRegex = { $regex: cityPattern, $options: 'i' };

      // Also search active unexpired offers matching query (title, description, or applicableService)
      const now = new Date();
      const matchingOffers = await SalonOffer.find({
        isActive: true,
        status: { $nin: ['EXPIRED', 'INACTIVE', 'DELETED'] },
        startDate: { $lte: now },
        endDate: { $gte: now },
        $or: [
          { title: qRegex },
          { description: qRegex },
          { applicableService: qRegex }
        ]
      })
        .select('salonId')
        .lean();

      const matchingOfferSalonIds = matchingOffers.map((mo) => mo.salonId);

      const qConditions: any[] = [
        { salonName: qRegex },
        { city: cityRegex },
        { address: qRegex },
        { description: qRegex },
        { 'services.name': qRegex },
        { 'services.category': qRegex }
      ];

      if (matchingOfferSalonIds.length > 0) {
        qConditions.push({ _id: { $in: matchingOfferSalonIds } });
      }

      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: qConditions }];
        delete filter.$or;
      } else {
        filter.$or = qConditions;
      }
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const skip = (page - 1) * limit;

    const hasLat = req.query.lat !== undefined;
    const hasLng = req.query.lng !== undefined;
    const userLat = hasLat ? parseFloat(req.query.lat as string) : undefined;
    const userLng = hasLng ? parseFloat(req.query.lng as string) : undefined;

    if (hasLat || hasLng) {
      if (!hasLat || !hasLng) {
        return res.status(400).json({
          message: 'Both latitude and longitude must be supplied together.'
        });
      }
      if (!isValidCoordinate(userLat, userLng)) {
        return res.status(400).json({
          message: 'Invalid latitude or longitude coordinate supplied.'
        });
      }
    }

    const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy.trim().toLowerCase() : '';
    const hasUserCoords = isValidCoordinate(userLat, userLng);

    // Validate radius parameter if supplied
    if (radiusParam !== undefined) {
      if (!isValidRadius(radiusParam)) {
        return res.status(400).json({
          message: 'Invalid radius parameter. Radius must be a valid number between 0.1 km and 100 km.'
        });
      }
      if (!hasUserCoords) {
        return res.status(400).json({
          message: 'Customer latitude and longitude are required when filtering by search radius.'
        });
      }
    }

    // Query bookable active salons
    let salonsQuery = Salon.find(filter)
      .select('salonName description phone address city location locationPoint images services status subscriptionStatus createdAt ownerId rating reviews')
      .populate('ownerId', 'name avatar')
      .sort({ createdAt: -1 });

    // When radius search is active, we must compute distance and filter before paginating
    const isRadiusSearch = hasUserCoords && typeof radiusParam === 'number' && radiusParam > 0;

    let salons: any[];
    let total: number;

    if (isRadiusSearch) {
      // Fetch all eligible salons matching category/city/search to filter strictly by radius
      const allMatching = await salonsQuery.lean();

      // Compute distances and strictly exclude salons without coordinates or outside radius
      const withDistance = allMatching
        .map((s) => {
          const hasSalonCoords = isValidCoordinate(s.location?.latitude, s.location?.longitude);
          if (!hasSalonCoords) {
            return null; // strictly excluded from radius searches
          }
          const distanceKm = calculateHaversineDistance(
            userLat,
            userLng,
            s.location!.latitude,
            s.location!.longitude
          );
          if (distanceKm === null || distanceKm > radiusParam) {
            return null;
          }
          return {
            ...s,
            _distanceKm: distanceKm,
            _formattedDistance: formatDistance(distanceKm)
          };
        })
        .filter((s): s is NonNullable<typeof s> => s !== null);

      // Sort nearest first by calculated straight-line distance
      withDistance.sort((a, b) => a._distanceKm - b._distanceKm);

      total = withDistance.length;
      salons = withDistance.slice(skip, skip + limit);
    } else {
      [total, salons] = await Promise.all([
        Salon.countDocuments(filter),
        salonsQuery.skip(skip).limit(limit).lean()
      ]);
    }

    // Fetch active offers for these salons to attach to response
    const salonIds = salons.map((s) => s._id);
    const now = new Date();
    const activeOffers = await SalonOffer.find({
      salonId: { $in: salonIds },
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now }
    })
      .sort({ createdAt: -1 })
      .lean();

    const offersBySalon = new Map<string, any[]>();
    for (const off of activeOffers) {
      const sid = off.salonId.toString();
      if (!offersBySalon.has(sid)) offersBySalon.set(sid, []);
      offersBySalon.get(sid)!.push({
        ...off,
        _id: off._id.toString(),
        id: off._id.toString(),
        salonId: sid,
        discountPercent: off.discountType === 'PERCENTAGE' ? off.discountValue : undefined,
        discountLabel:
          off.discountType === 'PERCENTAGE' ? `${off.discountValue}% OFF` : `₹${off.discountValue} OFF`,
        validUntil: off.endDate.toISOString(),
        endDate: off.endDate.toISOString()
      });
    }

    // Map to normalized frontend shape with real distance calculation
    let data = salons.map((s, index) => {
      const minPrice = s.services?.length
        ? Math.min(
          ...s.services.map((x: any) =>
            typeof x.price === 'number' ? x.price : Number(x.price) || 0
          )
        )
        : null;

      const hasSalonCoords = isValidCoordinate(s.location?.latitude, s.location?.longitude);
      let distanceKm: number | null = s._distanceKm ?? null;
      let distance: string = s._formattedDistance ?? 'Distance unavailable';

      if (distanceKm === null && hasUserCoords && hasSalonCoords) {
        distanceKm = calculateHaversineDistance(
          userLat,
          userLng,
          s.location!.latitude,
          s.location!.longitude
        );
        distance = formatDistance(distanceKm);
      }

      const reviewCount = typeof s.reviews === 'number' && s.reviews > 0 ? s.reviews : 0;
      const averageRating = reviewCount > 0 && typeof s.rating === 'number' && s.rating > 0
        ? Number(s.rating.toFixed(1))
        : null;

      const realImages = sanitizeSalonImages(s.images);
      const realDescription = sanitizeSalonDescription(s.description);
      const { email: _unusedEmail, _distanceKm, _formattedDistance, ...safeSalon } = s as any;

      return {
        ...safeSalon,
        id: s._id.toString(),
        name: s.salonName,
        location: s.city ? `${s.city} • ${s.address}` : s.address,
        coordinates: s.location,
        description: realDescription,
        rating: averageRating,
        reviews: reviewCount,
        averageRating,
        reviewCount,
        startingPrice: minPrice !== null && minPrice > 0 ? `From ₹${minPrice}` : '',
        distance,
        distanceKm,
        image: realImages[0] || undefined,
        images: realImages,
        offers: offersBySalon.get(s._id.toString()) || []
      };
    });

    if (!isRadiusSearch && (hasUserCoords || sortBy === 'nearest')) {
      data = data.sort((a, b) => {
        if (a.distanceKm !== null && b.distanceKm !== null) {
          return a.distanceKm - b.distanceKm;
        }
        if (a.distanceKm !== null && b.distanceKm === null) return -1;
        if (a.distanceKm === null && b.distanceKm !== null) return 1;
        return 0;
      });
    }

    res.json({
      count: data.length,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/salons/:id - Detailed salon view
router.get('/:id', async (req, res, next) => {
  try {
    const salon = await Salon.findOne({
      _id: req.params.id,
      status: 'ACTIVE',
      subscriptionStatus: 'ACTIVE'
    })
      .select('-email -identityProof')
      .populate('ownerId', 'name avatar')
      .lean();

    if (!salon) {
      return res.status(404).json({
        message: 'Salon not found or awaiting administrator approval'
      });
    }

    const userLat = typeof req.query.lat === 'string' ? parseFloat(req.query.lat) : undefined;
    const userLng = typeof req.query.lng === 'string' ? parseFloat(req.query.lng) : undefined;
    const hasUserCoords = isValidCoordinate(userLat, userLng);
    const hasSalonCoords = isValidCoordinate(salon.location?.latitude, salon.location?.longitude);

    let distanceKm: number | null = null;
    let distance = 'Distance unavailable';
    if (hasUserCoords && hasSalonCoords) {
      distanceKm = calculateHaversineDistance(
        userLat,
        userLng,
        salon.location!.latitude,
        salon.location!.longitude
      );
      distance = formatDistance(distanceKm);
    }

    const minPrice = salon.services?.length
      ? Math.min(
        ...salon.services.map((x) =>
          typeof x.price === 'number' ? x.price : Number(x.price) || 0
        )
      )
      : null;
    const startingPrice = minPrice !== null && minPrice > 0 ? `From ₹${minPrice}` : '';

    const now = new Date();
    const activeOffers = await SalonOffer.find({
      salonId: salon._id,
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now }
    })
      .sort({ createdAt: -1 })
      .lean();

    const formattedOffers = activeOffers.map((off) => ({
      ...off,
      _id: off._id.toString(),
      id: off._id.toString(),
      salonId: salon._id.toString(),
      discountPercent: off.discountType === 'PERCENTAGE' ? off.discountValue : undefined,
      discountLabel:
        off.discountType === 'PERCENTAGE' ? `${off.discountValue}% OFF` : `₹${off.discountValue} OFF`,
      validUntil: off.endDate.toISOString(),
      endDate: off.endDate.toISOString()
    }));

    const reviewCount = typeof salon.reviews === 'number' && salon.reviews > 0 ? salon.reviews : 0;
    const averageRating = reviewCount > 0 && typeof salon.rating === 'number' && salon.rating > 0
      ? Number(salon.rating.toFixed(1))
      : null;

    const realImages = sanitizeSalonImages(salon.images);
    const realDescription = sanitizeSalonDescription(salon.description);
    const { email: _unusedEmail, ...safeSalon } = salon as any;

    return res.json({
      data: {
        ...safeSalon,
        id: salon._id.toString(),
        name: salon.salonName,
        location: salon.city ? `${salon.city} • ${salon.address}` : salon.address,
        coordinates: salon.location,
        description: realDescription,
        rating: averageRating,
        reviews: reviewCount,
        averageRating,
        reviewCount,
        startingPrice,
        distance,
        distanceKm,
        image: realImages[0] || undefined,
        images: realImages,
        offers: formattedOffers
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
