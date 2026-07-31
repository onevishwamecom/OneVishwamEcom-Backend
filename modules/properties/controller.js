const Property = require('./model');
const createCRUDController = require('../baseController');
const ApiResponse = require('../../utils/ApiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const propertyService = require('./propertyService');

const NUMERIC_FIELDS = ['bedrooms', 'balconies', 'floors', 'totalFloors', 'areaSize', 'projectCount', 'totalUnits', 'availableUnits'];

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

const base = createCRUDController({
  model: Property,
  ownerField: 'user',
  defaultFilter: { status: { $ne: 'deleted' } },
  searchFields: ['title', 'description', 'city', 'area', 'location', 'propertyType', 'subtitle'],
  rangeFilters: {
    numericPrice: { min: 'priceMin', max: 'priceMax' },
    numericArea: { min: 'areaMin', max: 'areaMax' },
  },
  transformCreateData: (req, data) => sanitizeNumericFields({ ...data, subtitle: data.subtitle || data.title }),
  transformUpdateData: (req, data) => sanitizeNumericFields(data),
});

const getAll = asyncHandler(async (req, res) => {
  const result = await propertyService.getAll(req.query);
  new ApiResponse(200, result, 'Properties fetched successfully').send(res);
});

const getById = asyncHandler(async (req, res) => {
  const item = await propertyService.getById(req.params.id);
  new ApiResponse(200, { item }, 'Property fetched successfully').send(res);
});

const getFeatured = asyncHandler(async (req, res) => {
  const result = await propertyService.getFeatured();
  new ApiResponse(200, result, 'Featured properties fetched').send(res);
});

const getLatest = asyncHandler(async (req, res) => {
  const result = await propertyService.getLatest(req.query.limit);
  new ApiResponse(200, result, 'Latest properties fetched').send(res);
});

const getSimilar = asyncHandler(async (req, res) => {
  const result = await propertyService.getSimilar(req.params.id);
  new ApiResponse(200, result, 'Similar properties fetched').send(res);
});

const create = base.create;

const update = base.update;

const remove = asyncHandler(async (req, res) => {
  await propertyService.remove(req.params.id, req.user._id, req.user.role);
  new ApiResponse(200, null, 'Property deleted successfully').send(res);
});

const toggleStatus = asyncHandler(async (req, res) => {
  const item = await propertyService.toggleStatus(req.params.id, req.user._id, req.user.role);
  new ApiResponse(200, { item }, 'Property status updated').send(res);
});

const getMyProperties = asyncHandler(async (req, res) => {
  const items = await propertyService.getMyProperties(req.user._id);
  new ApiResponse(200, { items }, 'Your properties fetched').send(res);
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

module.exports = { getAll, getById, getFeatured, getLatest, getSimilar, create, update, remove, toggleStatus, getMyProperties, uploadBrochure };
