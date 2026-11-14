const Property = require('./model');
const createCRUDController = require('../baseController');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');
const propertyService = require('./propertyService');
const { resolveGoogleMapsUrl } = require('../../utils/googleMapsResolver');
const { recordProductAddition } = require('../../services/announcementService');

const NUMERIC_FIELDS = ['bedrooms', 'balconies', 'totalFloors', 'areaSize', 'projectCount', 'totalUnits', 'availableUnits'];

function extractNumber(val) {
  if (val == null || val === '') return undefined;
  if (typeof val === 'number') return val;
  const m = String(val).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function sanitizeNumericFields(data) {
  for (const field of NUMERIC_FIELDS) {
    if (field in data) {
      data[field] = extractNumber(data[field]);
    }
  }
  return data;
}

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
  const rawCity = (p.city || p.details?.city || 'Bengaluru').trim();
  const city = /^\d+$/.test(rawCity) ? 'Bengaluru' : rawCity;
  const cleanAddr = address.toLowerCase();
  const isAddressJustCity = !address || cleanAddr === 'bangalore' || cleanAddr === 'bengaluru' || cleanAddr === city.toLowerCase();

  let resolved = '';
  if (locality && address && !cleanAddr.includes(locality.toLowerCase()) && !isAddressJustCity) {
    resolved = `${address}, ${locality}, ${city}`;
  } else if (locality) {
    resolved = `${locality}, ${city}`;
  } else if (address && !isAddressJustCity) {
    resolved = `${address}, ${city}`;
  } else {
    resolved = city;
  }
  return resolved.replace(/\s+/g, ' ').replace(/,\s*,/g, ',').trim();
};

const cleanPropertyOutput = (p) => {
  if (!p) return p;
  const cleanP = typeof p.toObject === 'function' ? p.toObject() : { ...p };

  const loc = formatResolvedLocation(cleanP);
  cleanP.location = loc;
  if (!cleanP.address || cleanP.address.toLowerCase() === 'bangalore' || cleanP.address.toLowerCase() === 'bengaluru') {
    cleanP.address = loc;
  }
  const locUrl = (cleanP.mapUrl || cleanP.details?.mapUrl || '').trim();
  cleanP.mapUrl = locUrl;
  return cleanP;
};

const base = createCRUDController({
  model: Property,
  ownerField: 'user',
  defaultFilter: { status: { $ne: 'deleted' } },
  searchFields: ['title', 'description', 'city', 'area', 'location', 'subtitle'],
  rangeFilters: {
    numericPrice: { min: 'priceMin', max: 'priceMax' },
    numericArea: { min: 'areaMin', max: 'areaMax' },
  },
  transformCreateData: (req, data) => {
    const sanitized = sanitizeNumericFields({ ...data, subtitle: data.subtitle || data.title });
    if (sanitized.rawPrice && !sanitized.numericPrice) sanitized.numericPrice = sanitized.rawPrice;
    if (typeof sanitized.amenities === 'string') {
      sanitized.amenities = sanitized.amenities.split(',').map((a) => a.trim()).filter(Boolean);
    }
    // Server-side enforcement of Channel Partner identity & in-house tagging
    if (req.user?.partnerName || req.auth?.partnerName) {
      sanitized.channelPartnerName = req.user?.partnerName || req.auth?.partnerName;
      if (sanitized.details && typeof sanitized.details === 'object') {
        sanitized.details.channelPartnerName = sanitized.channelPartnerName;
      }
    }
    const uEmail = (req.user?.email || req.auth?.email || '').toLowerCase();
    if (sanitized.origin === 'in_house_project' || req.user?.role === 'in_house' || req.auth?.role === 'in_house' || uEmail === 'ceo@onevishwam.com') {
      sanitized.origin = 'in_house_project';
      sanitized.channelPartnerName = 'One Vishwam';
      sanitized.vendorName = 'One Vishwam';
      sanitized.priority = 1;
      sanitized.isPriority = true;
      sanitized.featured = true;
    } else if (req.user?.origin || req.auth?.origin) {
      sanitized.origin = req.user?.origin || req.auth?.origin;
    }
    return sanitized;
  },
  transformUpdateData: (req, data) => {
    const sanitized = sanitizeNumericFields(data);
    if (sanitized.rawPrice && !sanitized.numericPrice) sanitized.numericPrice = sanitized.rawPrice;
    if (typeof sanitized.amenities === 'string') {
      sanitized.amenities = sanitized.amenities.split(',').map((a) => a.trim()).filter(Boolean);
    }
    const uEmail = (req.user?.email || req.auth?.email || '').toLowerCase();
    if (sanitized.origin === 'in_house_project' || req.user?.role === 'in_house' || req.auth?.role === 'in_house' || uEmail === 'ceo@onevishwam.com' || uEmail.endsWith('@onevishwam.com')) {
      sanitized.origin = 'in_house_project';
      sanitized.channelPartnerName = 'One Vishwam';
      sanitized.vendorName = 'One Vishwam';
      sanitized.priority = 1;
      sanitized.isPriority = true;
      sanitized.featured = true;
    }
    return sanitized;
  },
});

const getAll = asyncHandler(async (req, res) => {
  const result = await propertyService.getAll(req.query);
  const items = (result.items || []).map(cleanPropertyOutput);
  const payload = {
    items,
    properties: items,
    pagination: result.pagination,
  };
  const response = new ApiResponse(200, payload, 'Properties fetched successfully');
  if (!req.headers.authorization) {
    response.setCache(60, 120, 300);
  }
  response.send(res);
});

const getById = asyncHandler(async (req, res) => {
  const rawItem = await propertyService.getById(req.params.id);
  const item = cleanPropertyOutput(rawItem);
  const response = new ApiResponse(200, { item, property: item }, 'Property fetched successfully');
  if (!req.headers.authorization) {
    response.setCache(60, 120, 300);
  }
  response.send(res);
});

const getFeatured = asyncHandler(async (req, res) => {
  const result = await propertyService.getFeatured();
  const items = (result.items || []).map(cleanPropertyOutput);
  const response = new ApiResponse(200, { items, properties: items }, 'Featured properties fetched');
  if (!req.headers.authorization) {
    response.setCache(60, 120, 300);
  }
  response.send(res);
});

const getLatest = asyncHandler(async (req, res) => {
  const result = await propertyService.getLatest(req.query.limit);
  const items = (result.items || []).map(cleanPropertyOutput);
  const response = new ApiResponse(200, { items, properties: items }, 'Latest properties fetched');
  if (!req.headers.authorization) {
    response.setCache(60, 120, 300);
  }
  response.send(res);
});

const getSimilar = asyncHandler(async (req, res) => {
  const result = await propertyService.getSimilar(req.params.id);
  const items = (result.items || []).map(cleanPropertyOutput);
  new ApiResponse(200, { items, properties: items }, 'Similar properties fetched').send(res);
});

const create = asyncHandler(async (req, res) => {
  const userId = req.user?._id || req.auth?.id;
  if (!userId) {
    throw new ApiError(401, 'Authentication required to create a property listing');
  }

  const data = { ...req.body };
  delete data._id;
  data.status = 'pending';
  data.createdBy = userId;
  data.user = userId;

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

  const d = data.details || {};
  if (!data.title) {
    data.title = d.apartmentName || d.projectName || d.propertyName || `${data.propertyType || 'Property'}`;
  }
  if (!data.price) {
    data.price = d.expectedPrice || d.expectedPricePerAcre || '';
  }
  const incomingMapUrl = (data.mapUrl || d.mapUrl || '').trim();
  data.mapUrl = incomingMapUrl;

  const property = await Property.create(data);
  const populated = await Property.findById(property._id).populate(
    'createdBy',
    'name fullName email phoneNumber profileImage avatar'
  );

  const clean = cleanPropertyOutput(populated || property);
  new ApiResponse(201, { property: clean, item: clean }, 'Property listing submitted successfully. Pending admin approval.').send(res);
});

const update = base.update;

const remove = asyncHandler(async (req, res) => {
  await propertyService.remove(req.params.id, req.user._id, req.user.role);
  new ApiResponse(200, null, 'Property deleted successfully').send(res);
});

const toggleStatus = asyncHandler(async (req, res) => {
  const item = await propertyService.toggleStatus(req.params.id, req.user._id, req.user.role);
  new ApiResponse(200, { item, property: item }, 'Property status updated').send(res);
});

const updatePropertyStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const ALLOWED_ADMIN_STATUSES = ['approved', 'rejected', 'pending', 'changes-required'];

  if (!status || !ALLOWED_ADMIN_STATUSES.includes(status)) {
    throw new ApiError(400, `Invalid status. Must be one of: ${ALLOWED_ADMIN_STATUSES.join(', ')}`);
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

  new ApiResponse(200, { property, item: property }, `Property status updated to "${status}" successfully`).send(res);
});

const resolveMapUrlController = asyncHandler(async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl || typeof targetUrl !== 'string') {
    throw new ApiError(400, 'url query parameter is required');
  }

  const result = await resolveGoogleMapsUrl(targetUrl);
  new ApiResponse(200, result, 'Google Maps URL resolved successfully').send(res);
});

const getMyProperties = asyncHandler(async (req, res) => {
  const items = await propertyService.getMyProperties(req.user._id);
  new ApiResponse(200, { items, properties: items }, 'Your properties fetched').send(res);
});

const uploadBrochure = asyncHandler(async (req, res) => {
  const property = await Property.findById(req.params.id);
  if (!property) throw new ApiError(404, 'Property not found');
  if (property.user && req.user._id.toString() !== property.user.toString() && req.user.role !== 'admin') {
    throw new ApiError(403, 'Not authorized');
  }
  if (!req.file) throw new ApiError(400, 'No PDF file provided');
  const url = req.file.path && req.file.path.startsWith('http') ? req.file.path : (req.file.cloudinaryUrl || `/uploads/${req.file.filename}`);
  property.brochure = url;
  await property.save();
  new ApiResponse(200, { brochure: url }, 'Brochure uploaded successfully').send(res);
});

const uploadFloorPlanImages = asyncHandler(async (req, res) => {
  const property = await Property.findById(req.params.id);
  if (!property) throw new ApiError(404, 'Property not found');
  if (property.user && req.user._id.toString() !== property.user.toString() && req.user.role !== 'admin') {
    throw new ApiError(403, 'Not authorized');
  }
  const files = req.files || (req.file ? [req.file] : []);
  if (files.length === 0) throw new ApiError(400, 'No floor plan image files provided');

  const urls = files.map((f) =>
    f.path && f.path.startsWith('http') ? f.path : (f.cloudinaryUrl || `/uploads/${f.filename}`)
  );

  property.floorPlanImages = Array.from(new Set([...(property.floorPlanImages || []), ...urls]));
  await property.save();

  new ApiResponse(200, { floorPlanImages: property.floorPlanImages, item: property }, 'Floor plan images uploaded successfully').send(res);
});

const uploadFloorPlanPdf = asyncHandler(async (req, res) => {
  const property = await Property.findById(req.params.id);
  if (!property) throw new ApiError(404, 'Property not found');
  if (property.user && req.user._id.toString() !== property.user.toString() && req.user.role !== 'admin') {
    throw new ApiError(403, 'Not authorized');
  }
  const file = req.file || (req.files && req.files[0]);
  if (!file) throw new ApiError(400, 'No PDF file provided');

  const url = file.path && file.path.startsWith('http') ? file.path : (file.cloudinaryUrl || `/uploads/${file.filename}`);
  property.pdfUrl = url;
  await property.save();

  new ApiResponse(200, { pdfUrl: url, item: property }, 'Floor plan PDF uploaded successfully').send(res);
});

const uploadFloorPlan = asyncHandler(async (req, res) => {
  const property = await Property.findById(req.params.id);
  if (!property) throw new ApiError(404, 'Property not found');
  if (property.user && req.user._id.toString() !== property.user.toString() && req.user.role !== 'admin') {
    throw new ApiError(403, 'Not authorized');
  }
  const files = req.files || (req.file ? [req.file] : []);
  if (files.length === 0) throw new ApiError(400, 'No files provided');

  const imageFiles = files.filter(f => f.mimetype !== 'application/pdf');
  const pdfFiles = files.filter(f => f.mimetype === 'application/pdf');

  if (imageFiles.length > 0) {
    const imageUrls = imageFiles.map((f) =>
      f.path && f.path.startsWith('http') ? f.path : (f.cloudinaryUrl || `/uploads/${f.filename}`)
    );
    property.floorPlanImages = Array.from(new Set([...(property.floorPlanImages || []), ...imageUrls]));
  }

  if (pdfFiles.length > 0) {
    const pdfUrl = pdfFiles[0].path && pdfFiles[0].path.startsWith('http') ? pdfFiles[0].path : (pdfFiles[0].cloudinaryUrl || `/uploads/${pdfFiles[0].filename}`);
    property.pdfUrl = pdfUrl;
  }

  await property.save();
  new ApiResponse(200, { floorPlanImages: property.floorPlanImages, pdfUrl: property.pdfUrl, item: property }, 'Floor plan uploaded successfully').send(res);
});

const deleteFloorPlanImage = asyncHandler(async (req, res) => {
  const property = await Property.findById(req.params.id);
  if (!property) throw new ApiError(404, 'Property not found');
  if (property.user && req.user._id.toString() !== property.user.toString() && req.user.role !== 'admin') {
    throw new ApiError(403, 'Not authorized');
  }
  const { imageUrl } = req.body;
  if (!imageUrl) throw new ApiError(400, 'Image URL required');

  property.floorPlanImages = (property.floorPlanImages || []).filter(url => url !== imageUrl);
  await property.save();

  new ApiResponse(200, { floorPlanImages: property.floorPlanImages, item: property }, 'Floor plan image deleted successfully').send(res);
});

const deleteFloorPlanPdf = asyncHandler(async (req, res) => {
  const property = await Property.findById(req.params.id);
  if (!property) throw new ApiError(404, 'Property not found');
  if (property.user && req.user._id.toString() !== property.user.toString() && req.user.role !== 'admin') {
    throw new ApiError(403, 'Not authorized');
  }
  property.pdfUrl = '';
  await property.save();

  new ApiResponse(200, { pdfUrl: '', item: property }, 'Floor plan PDF deleted successfully').send(res);
});

module.exports = {
  getAll,
  getById,
  getFeatured,
  getLatest,
  getSimilar,
  create,
  update,
  remove,
  toggleStatus,
  updatePropertyStatus,
  resolveMapUrlController,
  getMyProperties,
  uploadBrochure,
  uploadFloorPlanImages,
  uploadFloorPlanPdf,
  uploadFloorPlan,
  deleteFloorPlanImage,
  deleteFloorPlanPdf,
  // Aliases for full legacy compatibility
  getProperties: getAll,
  getPropertyById: getById,
  createProperty: create,
};
