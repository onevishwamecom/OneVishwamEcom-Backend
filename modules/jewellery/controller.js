const createCRUDController = require('../baseController');
const Jewellery = require('./model');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');
const jewelleryService = require('./jewelleryService');

function parseOccasion(occasion) {
  if (!occasion) return [];
  if (Array.isArray(occasion)) return occasion;
  return occasion.split(/[,/]/).map((s) => s.trim()).filter(Boolean);
}

function parsePrice(priceStr) {
  if (!priceStr) return 0;
  const cleaned = priceStr.replace(/[₹,]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function transformCreateData(req, data) {
  const material = data.material || data.metalType || 'Gold';
  const city = data.city || 'Bangalore';

  return {
    ...data,
    name: data.name || data.title,
    title: data.title || data.name,
    metalType: data.metalType || data.material || 'Gold',
    purity: data.purity || '',
    weightGrams: data.weightUnit === 'grams' ? (data.weight || 0) : (data.weight || 0) * 1000,
    makingCharges: data.makingCharges || '₹ 0',
    category: data.category || material,
    occasion: parseOccasion(data.occasion),
    certified: data.certified || false,
    certificationBody: data.certificationBody || '',
    gender: data.gender || 'Women',
    tryAtHome: data.tryAtHome || false,
    aiRecommended: data.aiRecommended || false,
    store: data.store || {
      name: 'Vishwam Jewellers',
      city: city.charAt(0).toUpperCase() + city.slice(1).toLowerCase(),
      pincode: data.pincode || '560001',
      address: '',
    },
    numericPrice: parsePrice(data.price),
    images: data.images || [],
    status: 'pending',
    featured: false,
  };
}

function transformUpdateData(req, item) {
  const data = { ...req.body };

  if (data.metalType) item.metalType = data.metalType;
  if (data.purity !== undefined) item.purity = data.purity;
  if (data.weight !== undefined) {
    item.weightGrams = data.weightUnit === 'grams' ? data.weight : data.weight * 1000;
  }
  if (data.makingCharges !== undefined) item.makingCharges = data.makingCharges;
  if (data.category) item.category = data.category;
  if (data.occasion !== undefined) item.occasion = parseOccasion(data.occasion);
  if (data.certified !== undefined) item.certified = data.certified;
  if (data.certificationBody !== undefined) item.certificationBody = data.certificationBody;
  if (data.gender) item.gender = data.gender;
  if (data.tryAtHome !== undefined) item.tryAtHome = data.tryAtHome;
  if (data.aiRecommended !== undefined) item.aiRecommended = data.aiRecommended;
  if (data.store) item.store = data.store;
  if (data.price !== undefined) item.numericPrice = parsePrice(data.price);
  if (data.images) item.images = data.images;
  if (data.name) {
    item.name = data.name;
    item.title = data.name;
  }

  return item;
}

const base = createCRUDController({
  model: Jewellery,
  searchFields: ['name', 'title', 'description', 'category', 'metalType', 'store.city'],
  rangeFilters: {
    numericPrice: { min: 'budgetMin', max: 'budgetMax' },
    weightGrams: { min: 'weightMin', max: 'weightMax' },
  },
  defaultSort: { createdAt: -1 },
  defaultFilter: { status: { $in: ['approved', 'active'] } },
  transformCreateData,
  transformUpdateData,
});

const getAll = asyncHandler(async (req, res) => {
  const result = await jewelleryService.getAll(req.query);
  new ApiResponse(200, result, 'Fetched successfully').send(res);
});

const getById = asyncHandler(async (req, res) => {
  const item = await jewelleryService.getById(req.params.id);
  new ApiResponse(200, { item }, 'Fetched successfully').send(res);
});

const getMy = asyncHandler(async (req, res) => {
  const items = await jewelleryService.getMy(req.user._id);
  new ApiResponse(200, { items }, 'Your listings fetched').send(res);
});

const getSimilar = asyncHandler(async (req, res) => {
  const items = await jewelleryService.getSimilar(req.params.id);
  res.json({ data: { items } });
});

const toggleStatus = asyncHandler(async (req, res) => {
  const item = await jewelleryService.toggleStatus(req.params.id, req.user._id, req.user.role);
  res.json({ data: { item }, message: `Status changed to ${item.status}` });
});

module.exports = {
  getAll,
  getById,
  getMy,
  create: base.create,
  update: base.update,
  remove: base.remove,
  getSimilar,
  toggleStatus,
};