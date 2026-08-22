const express = require('express');
const { protect, adminOnly } = require('../middleware/auth');
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

// Status constants
const LISTER_ALLOWED_STATUSES = ['pending', 'changes-required'];
const LISTER_EDITABLE_STATUSES = ['pending', 'changes-required', 'approved'];
const ADMIN_STATUS_TRANSITIONS = {
  approve: { from: ['pending', 'changes-required'], to: 'approved' },
  changes: { from: ['pending'], to: 'changes-required' },
  cancel: { from: ['pending', 'changes-required', 'approved'], to: 'cancelled' },
};

// GET /api/listings?flatten=1  -> flat array with `_type`
// GET /api/listings           -> { <moduleId>: [items] }
router.get('/', protect, asyncHandler(async (req, res) => {
  const flatten = req.query.flatten === '1';
  const grouped = {};
  const flat = [];

  for (const mod of modules) {
    // Filter by lister if authenticated as lister, otherwise by user
    const filter = req.auth.accountType === 'lister'
      ? { lister: req.auth.id }
      : { user: req.auth.id };

    const items = await mod.model.find(filter).sort({ createdAt: -1 }).limit(500).lean();
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

// POST /api/listings  — create a listing owned by the authenticated lister.
router.post('/', protect, asyncHandler(async (req, res) => {
  // Only listers can create listings
  if (req.auth.accountType !== 'lister') {
    throw new ApiError(403, 'Only listers can create listings');
  }

  const type = req.body._type || CATEGORY_TO_MODULE[req.body.category] || null;
  const mod = findModule(type);

  const body = { ...req.body };
  // Never allow the client to forge the owner, a Mongo _id, or status.
  delete body._id;
  delete body.user;
  delete body.lister;
  delete body._type;
  delete body.status; // Backend controls status - always PENDING on creation

  const data = { ...body, lister: req.auth.id, status: 'pending' };
  const item = await mod.model.create(data);
  new ApiResponse(201, { item }, 'Listing created successfully. It is pending admin approval.').send(res);
}));

function isOwnerOrAdmin(item, req) {
  if (req.auth.role === 'admin') return;
  // Check lister ownership for lister accounts
  if (req.auth.accountType === 'lister') {
    if (item && item.lister && item.lister.toString() === req.auth.id.toString()) return;
  }
  // Fallback to user ownership for backward compatibility
  if (item && item.user && item.user.toString() === req.auth.id.toString()) return;
  throw new ApiError(403, 'Not authorized to access this listing');
}

function canListerEdit(item, req) {
  if (!LISTER_EDITABLE_STATUSES.includes(item.status)) {
    throw new ApiError(403, `Cannot edit listing with status "${item.status}". Only pending, changes-required, or approved listings can be edited.`);
  }
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

  // Listers cannot edit cancelled listings
  if (req.auth.accountType === 'lister') {
    canListerEdit(item, req);
  }

  const body = { ...req.body };
  delete body._id;
  delete body.user;
  delete body.lister;
  delete body._type;
  // Listers cannot change status directly
  if (req.auth.accountType === 'lister') {
    delete body.status;
  }

  const wasApproved = item.status === 'approved';
  Object.assign(item, body);

  // If lister edits a changes-required or approved listing, it goes back to pending
  if (req.auth.accountType === 'lister' && (item.status === 'changes-required' || wasApproved)) {
    item.status = 'pending';
    // Clear any previous admin comment when resubmitting
    item.adminComment = undefined;
  }

  await item.save();
  new ApiResponse(200, { item }, 'Listing updated successfully').send(res);
}));

// DELETE /api/listings/:type/:id — delete owned listing.
router.delete('/:type/:id', protect, asyncHandler(async (req, res) => {
  const mod = findModule(req.params.type);
  const item = await mod.model.findById(req.params.id);
  if (!item) throw new ApiError(404, 'Listing not found');
  isOwnerOrAdmin(item, req);
  await item.deleteOne();
  new ApiResponse(200, null, 'Listing deleted successfully').send(res);
}));

// ============================================================================
// ADMIN ROUTES
// ============================================================================

// GET /api/admin/listings — admin can see all listings with filters
router.get('/admin/all', protect, adminOnly, asyncHandler(async (req, res) => {
  const { status, category, listerId, search, page = 1, limit = 20 } = req.query;
  const p = Math.max(1, Number(page));
  const l = Math.min(100, Math.max(1, Number(limit)));

  const results = {};
  let total = 0;

  await Promise.all(modules.map(async (mod) => {
    const filter = {};
    if (status) filter.status = status;
    if (category && category !== 'all') {
      // Check if category matches this module
      const catToMod = Object.entries(CATEGORY_TO_MODULE).find(([, v]) => v === mod.id);
      if (catToMod && catToMod[0] !== category) return;
    }
    if (listerId) filter.lister = listerId;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
      ];
    }

    try {
      const items = await mod.model.find(filter)
        .populate('lister', 'name email phone listerId')
        .sort({ createdAt: -1 })
        .skip((p - 1) * l)
        .limit(l)
        .lean();
      if (items.length > 0) {
        results[mod.id] = items;
        total += items.length;
      }
    } catch { }
  }));

  new ApiResponse(200, { results, total, page: p, limit: l }, 'Admin listings fetched').send(res);
}));

// GET /api/admin/listings/stats — admin dashboard stats
router.get('/admin/stats', protect, adminOnly, asyncHandler(async (req, res) => {
  const stats = {
    total: 0,
    pending: 0,
    approved: 0,
    'changes-required': 0,
    cancelled: 0,
    byCategory: {},
  };

  await Promise.all(modules.map(async (mod) => {
    try {
      const [total, pending, approved, changes, cancelled] = await Promise.all([
        mod.model.countDocuments(),
        mod.model.countDocuments({ status: 'pending' }),
        mod.model.countDocuments({ status: 'approved' }),
        mod.model.countDocuments({ status: 'changes-required' }),
        mod.model.countDocuments({ status: 'cancelled' }),
      ]);
      stats.total += total;
      stats.pending += pending;
      stats.approved += approved;
      stats['changes-required'] += changes;
      stats.cancelled += cancelled;
      if (total > 0) {
        stats.byCategory[mod.id] = { total, pending, approved, 'changes-required': changes, cancelled };
      }
    } catch { }
  }));

  new ApiResponse(200, stats, 'Admin listing stats fetched').send(res);
}));

// PATCH /api/admin/listings/:type/:id/approve
router.patch('/admin/:type/:id/approve', protect, adminOnly, asyncHandler(async (req, res) => {
  const mod = findModule(req.params.type);
  const item = await mod.model.findById(req.params.id);
  if (!item) throw new ApiError(404, 'Listing not found');

  const transition = ADMIN_STATUS_TRANSITIONS.approve;
  if (!transition.from.includes(item.status)) {
    throw new ApiError(400, `Cannot approve listing with status "${item.status}"`);
  }

  item.status = transition.to;
  item.updatedAt = new Date();
  await item.save();

  new ApiResponse(200, { item }, 'Listing approved successfully').send(res);
}));

// PATCH /api/admin/listings/:type/:id/changes
router.patch('/admin/:type/:id/changes', protect, adminOnly, asyncHandler(async (req, res) => {
  const mod = findModule(req.params.type);
  const item = await mod.model.findById(req.params.id);
  if (!item) throw new ApiError(404, 'Listing not found');

  const transition = ADMIN_STATUS_TRANSITIONS.changes;
  if (!transition.from.includes(item.status)) {
    throw new ApiError(400, `Cannot request changes for listing with status "${item.status}"`);
  }

  const reason = req.body.reason || 'Please make the required changes and resubmit.';
  item.status = transition.to;
  item.adminComment = reason;
  item.updatedAt = new Date();
  await item.save();

  new ApiResponse(200, { item }, 'Changes requested successfully').send(res);
}));

// PATCH /api/admin/listings/:type/:id/cancel
router.patch('/admin/:type/:id/cancel', protect, adminOnly, asyncHandler(async (req, res) => {
  const mod = findModule(req.params.type);
  const item = await mod.model.findById(req.params.id);
  if (!item) throw new ApiError(404, 'Listing not found');

  const transition = ADMIN_STATUS_TRANSITIONS.cancel;
  if (!transition.from.includes(item.status)) {
    throw new ApiError(400, `Cannot cancel listing with status "${item.status}"`);
  }

  const reason = req.body.reason || 'Listing cancelled by admin.';
  item.status = transition.to;
  item.adminComment = reason;
  item.updatedAt = new Date();
  await item.save();

  new ApiResponse(200, { item }, 'Listing cancelled successfully').send(res);
}));

module.exports = router;