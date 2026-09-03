const Property = require('./model');
const createCRUDController = require('../baseController');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
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
  searchFields: ['title', 'description', 'city', 'area', 'location', 'subtitle'],
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
  getAll, getById, getFeatured, getLatest, getSimilar, create, update, remove, toggleStatus, getMyProperties,
  uploadBrochure, uploadFloorPlanImages, uploadFloorPlanPdf, uploadFloorPlan, deleteFloorPlanImage, deleteFloorPlanPdf
};
