const express = require('express');
const { protect } = require('../middleware/auth');
const modules = require('../modules');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Maps the listing-admin "category" field to a backend module id.
const CATEGORY_TO_MODULE = {
  'real-estate': 'properties',
  vehicle: 'vehicles',
  grocery: 'groceries',
  garment: 'garments',
  jewellery: 'jewellery',
  finance: 'finance',
  service: 'properties',
};

function findModule(type) {
  const mod = modules.find((m) => m.id === type);
  if (!mod) throw new ApiError(400, `Unknown listing type "${type}"`);
  return mod;
}

// GET /api/listings?flatten=1  -> flat array with `_type`
// GET /api/listings           -> { <moduleId>: [items] }
router.get('/', protect, asyncHandler(async (req, res) => {
  const flatten = req.query.flatten === '1';
  const grouped = {};
  const flat = [];

  for (const mod of modules) {
    const items = await mod.model.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(500).lean();
    if (items.length === 0) continue;
    grouped[mod.id] = items;
    for (const item of items) {
      flat.push({ ...item, _type: mod.id });
    }
  }

  if (flatten) {
    return new ApiResponse(200, flat, 'Listings fetched').send(res);
  }
  new ApiResponse(200, grouped, 'Listings fetched').send(res);
}));

// POST /api/listings  — create a listing owned by the authenticated account.
router.post('/', protect, asyncHandler(async (req, res) => {
  const type = req.body._type || CATEGORY_TO_MODULE[req.body.category] || null;
  const mod = findModule(type);

  const body = { ...req.body };
  // Never allow the client to forge the owner or a Mongo _id.
  delete body._id;
  delete body.user;
  delete body._type;

  const data = { ...body, user: req.user._id };
  const item = await mod.model.create(data);
  new ApiResponse(201, { item }, 'Listing created').send(res);
}));

function isOwnerOrAdmin(item, req) {
  if (req.user.role === 'admin') return;
  if (item && item.user && item.user.toString() === req.user._id.toString()) return;
  throw new ApiError(403, 'Not authorized to access this listing');
}

// GET /api/listings/:type/:id — single listing with ownership check.
router.get('/:type/:id', protect, asyncHandler(async (req, res) => {
  const mod = findModule(req.params.type);
  const item = await mod.model.findById(req.params.id).lean();
  if (!item) throw new ApiError(404, 'Listing not found');
  isOwnerOrAdmin(item, req);
  new ApiResponse(200, { item }, 'Listing fetched').send(res);
}));

// PATCH /api/listings/:type/:id — update owned listing.
router.patch('/:type/:id', protect, asyncHandler(async (req, res) => {
  const mod = findModule(req.params.type);
  const item = await mod.model.findById(req.params.id);
  if (!item) throw new ApiError(404, 'Listing not found');
  isOwnerOrAdmin(item, req);

  const body = { ...req.body };
  delete body._id;
  delete body.user;
  delete body._type;
  Object.assign(item, body);
  await item.save();

  new ApiResponse(200, { item }, 'Listing updated').send(res);
}));

// DELETE /api/listings/:type/:id — delete owned listing.
router.delete('/:type/:id', protect, asyncHandler(async (req, res) => {
  const mod = findModule(req.params.type);
  const item = await mod.model.findById(req.params.id);
  if (!item) throw new ApiError(404, 'Listing not found');
  isOwnerOrAdmin(item, req);
  await item.deleteOne();
  new ApiResponse(200, null, 'Listing deleted').send(res);
}));

module.exports = router;
