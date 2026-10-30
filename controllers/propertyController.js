const Property = require('../models/Property');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { resolveGoogleMapsUrl } = require('../utils/googleMapsResolver');
const { recordProductAddition } = require('../services/announcementService');

/**
 * Property Intake Controller
 * Handles 94-question property submissions, paginated queries, details, and status updates.
 */

// @desc    Create a new property listing
// @route   POST /api/properties
// @access  Private (Authenticated User / Channel Partner)
const createProperty = asyncHandler(async (req, res) => {
  const userId = req.user?._id || req.auth?.id;
  if (!userId) {
    throw new ApiError(401, 'Authentication required to create a property listing');
  }

  const data = { ...req.body };

  // Remove forgeable fields
  delete data._id;
  delete data.status; // Always pending upon creation

  data.createdBy = userId;
  data.user = userId;
  data.status = 'pending';

  // Server-side enforcement of Channel Partner identity & in-house tagging
  if (req.user?.partnerName || req.auth?.partnerName) {
    data.channelPartnerName = req.user?.partnerName || req.auth?.partnerName;
  }
  if (req.user?.origin || req.auth?.origin) {
    data.origin = req.user?.origin || req.auth?.origin;
  } else if (req.user?.role === 'in_house' || req.auth?.role === 'in_house') {
    data.origin = 'in_house_project';
    data.channelPartnerName = 'One Vishwam';
  }

  // Handle uploaded files if passed via multipart
  const uploadedDocs = Array.isArray(data.documents) ? [...data.documents] : [];
  const uploadedImages = Array.isArray(data.images) ? [...data.images] : [];

  if (req.files && Array.isArray(req.files) && req.files.length > 0) {
    for (const file of req.files) {
      const fileUrl =
        file.path && file.path.startsWith('http')
          ? file.path
          : file.firebaseUrl || file.cloudinaryUrl || `/uploads/${file.filename}`;
      const mime = file.mimetype || file.type || '';

      uploadedDocs.push({
        url: fileUrl,
        filename: file.originalname || file.filename || 'Document',
        fileType: mime,
      });

      if (mime.startsWith('image/')) {
        uploadedImages.push(fileUrl);
      } else if (mime.includes('pdf')) {
        data.brochure = fileUrl;
        data.pdfUrl = fileUrl;
      }
    }
  }

  data.documents = uploadedDocs;
  if (uploadedImages.length > 0) {
    data.images = uploadedImages;
  }

  // Sync dual-compatibility fields from details
  const d = data.details || {};
  if (!data.title) {
    data.title = d.apartmentName || d.projectName || d.propertyName || `${data.propertyType} Property`;
  }
  if (!data.price) {
    data.price = d.expectedPrice || d.expectedPricePerAcre || '';
  }
  const incomingMapUrl = (
    data.mapUrl ||
    d.mapUrl ||
    ''
  ).trim();

  data.mapUrl = incomingMapUrl;
  if (d) d.mapUrl = incomingMapUrl;

  delete data.locationUrl;
  delete data.googleMapsUrl;
  delete data.googleMapUrl;
  delete data.mapEmbedUrl;
  delete data.resolvedLocationUrl;
  if (d) {
    delete d.locationUrl;
    delete d.googleMapsUrl;
    delete d.googleMapUrl;
    delete d.mapEmbedUrl;
    delete d.resolvedLocationUrl;
  }

  const property = await Property.create(data);
  const populated = await Property.findById(property._id).populate(
    'createdBy',
    'name fullName email phoneNumber profileImage avatar'
  );

  new ApiResponse(
    201,
    { property: populated || property },
    'Property listing submitted successfully. It is now pending admin approval.'
  ).send(res);
});

// @desc    Get paginated property listings with filters
// @route   GET /api/properties
// @access  Public / Private
const getProperties = asyncHandler(async (req, res) => {
  const { type, propertyType, status, city, area, search, sort = 'latest' } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const filter = {};

  // Status filtering: default to approved/active for public, or explicit query
  if (status) {
    filter.status = status;
  } else if (!req.auth || (req.auth.role !== 'admin' && req.auth.role !== 'super-admin')) {
    filter.status = { $in: ['approved', 'active', 'available'] };
  } else {
    filter.status = { $ne: 'deleted' };
  }

  // Property Type filter
  const targetType = type || propertyType;
  if (targetType && targetType !== 'all') {
    filter.propertyType = targetType;
  }

  // City & Area filter
  if (city && city !== 'all') {
    filter.city = city.toLowerCase();
  }
  if (area && area !== 'all') {
    filter.area = new RegExp(area.trim(), 'i');
  }

  // Search filter
  if (search && search.trim()) {
    const q = search.trim();
    filter.$or = [
      { title: { $regex: q, $options: 'i' } },
      { vendorName: { $regex: q, $options: 'i' } },
      { channelPartnerName: { $regex: q, $options: 'i' } },
      { 'details.propertyName': { $regex: q, $options: 'i' } },
      { 'details.projectName': { $regex: q, $options: 'i' } },
      { 'details.apartmentName': { $regex: q, $options: 'i' } },
    ];
  }

  // Sort orders
  const sortMap = {
    latest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    'price-low': { numericPrice: 1 },
    'price-high': { numericPrice: -1 },
  };
  const sortOption = sortMap[sort] || { createdAt: -1 };

  const [properties, total] = await Promise.all([
    Property.find(filter)
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'name fullName email phoneNumber profileImage avatar')
      .lean(),
    Property.countDocuments(filter),
  ]);

  const resolvePropertyLocality = (p) => {
    if (!p) return '';
    let locality = (p.locality || p.details?.locality || '').trim();
    if (locality && !/^bangalore$/i.test(locality) && !/^bengaluru$/i.test(locality)) {
      return locality;
    }
    const combined = `${p.title || ''} ${p.subtitle || ''} ${p.vendorName || ''} ${p.address || ''}`.toLowerCase();
    if (combined.includes('nelamangala') || combined.includes('bmrda')) return 'Nelamangala';
    if (combined.includes('kempegowda layout') || combined.includes('nada prabhu') || combined.includes('bda')) return 'Nada Prabhu Kempegowda Layout';
    if (combined.includes('kanakapura') || combined.includes('annanta') || combined.includes('avaana') || combined.includes('oraiyan')) return 'Kanakapura Road';
    if (combined.includes('begur') || combined.includes('bbmp enclave') || combined.includes('sp prime')) return 'Begur';
    if (combined.includes('electronic city') || combined.includes('e-city') || combined.includes('showroom')) return 'Electronic City';
    if (combined.includes('sarjapur')) return 'Sarjapur Road';
    if (combined.includes('whitefield') || combined.includes('fortuna')) return 'Whitefield';
    if (combined.includes('devanahalli') || combined.includes('artemis')) return 'Devanahalli';
    if (combined.includes('yelahanka')) return 'Yelahanka';
    if (combined.includes('thanisandra')) return 'Thanisandra';
    if (combined.includes('kengeri') || combined.includes('sampada')) return 'Kengeri';
    if (combined.includes('bidadi') || combined.includes('bhoo vaibhav')) return 'Bidadi';
    if (combined.includes('dobbaspet') || combined.includes('dhabaspet')) return 'Dobbaspet';
    if (combined.includes('gottigere') || combined.includes('vedanth')) return 'Gottigere';
    if (combined.includes('jigani')) return 'Jigani';
    return locality;
  };

  const formatResolvedLocation = (p) => {
    const address = (p.address || '').trim();
    const locality = resolvePropertyLocality(p);
    const rawCity = (p.city || p.details?.city || 'Bangalore').trim();
    const city = /^\d+$/.test(rawCity) ? 'Bangalore' : (/^bengaluru$/i.test(rawCity) ? 'Bangalore' : rawCity);
    const cleanAddr = address.toLowerCase();
    const isAddressJustCity = !address || cleanAddr === 'bangalore' || cleanAddr === 'bengaluru' || cleanAddr === city.toLowerCase();

    let resolvedLocation = address;
    if (!resolvedLocation || isAddressJustCity) {
      resolvedLocation = [locality, city].filter(Boolean).join(', ');
    } else if (locality && !resolvedLocation.toLowerCase().includes(locality.toLowerCase())) {
      resolvedLocation = `${locality}, ${resolvedLocation}`;
    }
    return resolvedLocation || locality || city || 'Bangalore';
  };

  const cleanPropertyOutput = (p) => {
    if (!p || typeof p !== 'object') return p;
    const cleanP = { ...p };

    // Remove legacy map duplicate keys
    delete cleanP.locationUrl;
    delete cleanP.googleMapsUrl;
    delete cleanP.googleMapUrl;
    delete cleanP.mapEmbedUrl;
    delete cleanP.resolvedLocationUrl;

    // Remove redundant user/lister aliases
    delete cleanP.user;
    delete cleanP.lister;
    if (cleanP.contributor?.listerId && cleanP.listerId === cleanP.contributor.listerId) {
      delete cleanP.listerId;
    }

    // Remove redundant media/virtual aliases
    delete cleanP.video;
    delete cleanP.videos;
    delete cleanP.brochure;
    delete cleanP.email;
    delete cleanP.rawPrice;
    delete cleanP.isPriority;

    // Clean details subdocument duplicates
    if (cleanP.details && typeof cleanP.details === 'object') {
      cleanP.details = { ...cleanP.details };
      delete cleanP.details.mapUrl;
      delete cleanP.details.locationUrl;
      delete cleanP.details.googleMapsUrl;
      delete cleanP.details.googleMapUrl;
      delete cleanP.details.mapEmbedUrl;
      delete cleanP.details.resolvedLocationUrl;

      if (cleanP.details.propertyName === cleanP.title) delete cleanP.details.propertyName;
      if (cleanP.details.expectedPrice === cleanP.price) delete cleanP.details.expectedPrice;
      if (cleanP.details.possessionStatus === cleanP.possessionStatus) delete cleanP.details.possessionStatus;
      if (cleanP.details.vendorName === cleanP.vendorName) delete cleanP.details.vendorName;
      if (cleanP.details.channelPartnerName === cleanP.channelPartnerName) delete cleanP.details.channelPartnerName;
      if (cleanP.details.approvalAuthority === cleanP.approval) delete cleanP.details.approvalAuthority;
    }

    // Remove subtitle if identical to vendorName or channelPartnerName
    if (cleanP.subtitle && (cleanP.subtitle === cleanP.vendorName || cleanP.subtitle === cleanP.channelPartnerName)) {
      delete cleanP.subtitle;
    }

    return cleanP;
  };

  const formattedProperties = properties.map((p) => {
    const loc = formatResolvedLocation(p);
    const resolvedLocality = resolvePropertyLocality(p);
    const locUrl = (
      p.mapUrl ||
      p.details?.mapUrl ||
      ''
    ).trim();

    const cleaned = cleanPropertyOutput(p);

    return {
      ...cleaned,
      location: loc,
      locality: resolvedLocality || p.locality,
      address: p.address || loc,
      mapUrl: locUrl,
    };
  });

  const totalPages = Math.ceil(total / limit) || 1;

  const response = new ApiResponse(
    200,
    {
      properties: formattedProperties,
      items: formattedProperties,
      total,
      totalPages,
      page,
      limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    'Properties fetched successfully'
  );

  if (!req.headers.authorization) {
    response.setCache(60, 120, 300);
  }

  response.send(res);
});

// @desc    Get single property by ID
// @route   GET /api/properties/:id
// @access  Public
const getPropertyById = asyncHandler(async (req, res) => {
  const property = await Property.findById(req.params.id)
    .populate('createdBy', 'name fullName email phoneNumber profileImage avatar');

  if (!property || property.status === 'deleted') {
    throw new ApiError(404, 'Property listing not found');
  }

  const pObj = property.toObject ? property.toObject({ virtuals: false }) : property;
  const loc = formatResolvedLocation(pObj);
  const resolvedLocality = resolvePropertyLocality(pObj);

  pObj.location = loc;
  pObj.locality = resolvedLocality || pObj.locality;
  if (!pObj.address || pObj.address.toLowerCase() === 'bangalore' || pObj.address.toLowerCase() === 'bengaluru') {
    pObj.address = loc;
  }
  const locUrl = (
    pObj.mapUrl ||
    pObj.details?.mapUrl ||
    ''
  ).trim();

  pObj.mapUrl = locUrl;
  const cleaned = cleanPropertyOutput(pObj);

  const response = new ApiResponse(200, { property: cleaned, item: cleaned }, 'Property fetched successfully');
  if (!req.headers.authorization) {
    response.setCache(60, 120, 300);
  }
  response.send(res);
});

// @desc    Update property listing status (Admin only)
// @route   PATCH /api/properties/:id/status
// @access  Private (Admin Only)
const updatePropertyStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const ALLOWED_ADMIN_STATUSES = ['approved', 'rejected', 'pending', 'changes-required'];

  if (!status || !ALLOWED_ADMIN_STATUSES.includes(status)) {
    throw new ApiError(
      400,
      `Invalid status. Must be one of: ${ALLOWED_ADMIN_STATUSES.join(', ')}`
    );
  }

  const property = await Property.findById(req.params.id);
  if (!property) {
    throw new ApiError(404, 'Property listing not found');
  }

  property.status = status;
  await property.save();

  if (status === 'approved') {
    recordProductAddition('properties', 1).catch((err) =>
      console.error('Failed to log property announcement:', err.message)
    );
  }

  new ApiResponse(
    200,
    { property },
    `Property status updated to "${status}" successfully`
  ).send(res);
});

// @desc    Resolve Google Maps URL to direct embed URL
// @route   GET /api/properties/resolve-map-url
// @access  Public
const resolveMapUrlController = asyncHandler(async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl || typeof targetUrl !== 'string') {
    throw new ApiError(400, 'url query parameter is required');
  }

  const result = await resolveGoogleMapsUrl(targetUrl);
  new ApiResponse(200, result, 'Google Maps URL resolved successfully').send(res);
});

module.exports = {
  createProperty,
  getProperties,
  getPropertyById,
  updatePropertyStatus,
  resolveMapUrlController,
};

