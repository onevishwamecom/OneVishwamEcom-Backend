const express = require('express');
const { protect, adminOnly } = require('../middleware/auth');
const modules = require('../modules');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { deleteMultipleMediaFromStorage } = require('../utils/firebaseStorage');

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
  bedding: 'garments',
  electronics: 'garments',
};

function findModule(type) {
  let mod = modules.find((m) => m.id === type);
  if (!mod) {
    mod = modules.find((m) => m.id === 'properties') || modules[0];
  }
  return mod;
}

// Status constants
const LISTER_ALLOWED_STATUSES = ['pending', 'changes-required'];
const LISTER_EDITABLE_STATUSES = ['pending', 'changes-required', 'approved', 'cancelled', 'rejected'];
const ADMIN_STATUS_TRANSITIONS = {
  approve: { from: ['pending', 'changes-required', 'approved', 'active', 'cancelled', 'rejected'], to: 'approved' },
  changes: { from: ['pending', 'changes-required', 'approved', 'active', 'cancelled', 'rejected'], to: 'changes-required' },
  cancel: { from: ['pending', 'changes-required', 'approved', 'active', 'cancelled', 'rejected'], to: 'cancelled' },
};

function normalizeListingItem(item) {
  if (!item) return item;
  const raw = typeof item.toJSON === 'function' ? item.toJSON() : item;
  const v = raw.video || raw.videoUrl || (Array.isArray(raw.videos) && raw.videos[0]) || '';
  return {
    ...raw,
    video: v,
    videoUrl: v,
    videos: Array.isArray(raw.videos) && raw.videos.length > 0 ? raw.videos : (v ? [v] : []),
  };
}

// GET /api/listings?flatten=1  -> flat array with `_type`
// GET /api/listings           -> { <moduleId>: [items] }
router.get('/', protect, asyncHandler(async (req, res) => {
  const flatten = req.query.flatten === '1';
  const grouped = {};
  const flat = [];
  const isAdmin = req.auth?.role === 'admin' || req.auth?.accountType === 'admin';
  const userEmail = req.auth?.email || req.user?.email || '';

  const mongoose = require('mongoose');
  const isValidObjectId = (val) => val && mongoose.Types.ObjectId.isValid(String(val));

  const filterOr = [];
  if (isValidObjectId(req.auth?.id)) filterOr.push({ lister: req.auth.id }, { user: req.auth.id });
  if (isValidObjectId(req.user?._id)) filterOr.push({ lister: req.user._id }, { user: req.user._id });
  if (userEmail) filterOr.push({ 'contributor.email': userEmail });
  if (req.user?.firebaseUid) filterOr.push({ 'contributor.firebaseUid': req.user.firebaseUid });

  for (const mod of modules) {
    try {
      if (!mod || !mod.model) continue;
      const filter = isAdmin ? {} : (filterOr.length > 0 ? { $or: filterOr } : { _id: null });

      const items = await mod.model.find(filter).sort({ createdAt: -1 }).limit(500).lean();
      if (!items || items.length === 0) continue;
      const normalizedItems = items.map(normalizeListingItem);
      grouped[mod.id] = normalizedItems;
      for (const item of normalizedItems) {
        flat.push({ ...item, _type: mod.id });
      }
    } catch (modErr) {
      console.warn(`⚠️ [GET /api/listings] Error querying module ${mod?.id}:`, modErr.message);
    }
  }

  if (flatten) {
    return new ApiResponse(200, flat, 'Listings fetched').send(res);
  }
  new ApiResponse(200, grouped, 'Listings fetched').send(res);
}));

// POST /api/listings  — create a listing owned by the authenticated account.
router.post('/', protect, asyncHandler(async (req, res) => {
  const type = req.body._type || CATEGORY_TO_MODULE[req.body.category] || req.body.category || 'properties';
  const mod = findModule(type);

  const body = { ...req.body };
  // Never allow the client to forge the owner, a Mongo _id, or status.
  delete body._id;
  delete body.user;
  delete body.lister;
  delete body._type;
  delete body.status; // Backend controls status - always PENDING on creation

  const data = { ...body, status: 'pending' };

  const mongoose = require('mongoose');
  const isValidObjectId = (val) => val && mongoose.Types.ObjectId.isValid(String(val));
  const ownerId = isValidObjectId(req.auth?.id)
    ? req.auth.id
    : (isValidObjectId(req.user?._id) ? req.user._id : new mongoose.Types.ObjectId());

  data.user = ownerId;
  data.lister = ownerId;
  data.createdBy = ownerId;

  // Server-side automatic identity resolution for One Vishwam vs External Listers
  const userEmail = (req.user?.email || req.auth?.email || '').toLowerCase();
  const isOneVishwamUser = userEmail.endsWith('@onevishwam.com') || req.user?.role === 'in_house' || req.auth?.role === 'in_house';

  if (isOneVishwamUser) {
    data.channelPartnerName = 'One Vishwam';
    data.vendorName = 'One Vishwam';
    data.origin = 'in_house_project';
  } else {
    data.channelPartnerName = data.channelPartnerName || req.user?.partnerName || req.auth?.partnerName || req.user?.fullName || req.user?.name || req.auth?.name || 'External Partner';
    data.vendorName = data.vendorName || req.user?.fullName || req.user?.name || req.auth?.name || req.user?.partnerName || req.auth?.partnerName || 'Independent Owner';
    data.origin = req.user?.origin || req.auth?.origin || 'channel_partner_project';
  }

  data.bankLoanDetails = data.bankLoanDetails || 'Available on request';

  const contributorName =
    req.user?.fullName ||
    req.user?.name ||
    req.auth?.name ||
    body.contributor?.name ||
    data.vendorName ||
    data.channelPartnerName ||
    (userEmail ? userEmail.split('@')[0] : '') ||
    'Contributor';

  const contributorPhone = req.user?.phone || req.user?.phoneNumber || req.user?.mobile || body.contributor?.contact || body.contact || '';
  const contributorCity = req.user?.city || body.contributor?.city || body.city || '';

  data.contributor = {
    _id: ownerId,
    id: ownerId,
    name: contributorName,
    email: userEmail || body.contactEmail || '',
    contact: contributorPhone,
    phone: contributorPhone,
    city: contributorCity,
    type: req.auth?.accountType || 'lister',
    createdAt: new Date(),
  };

  if (data.details && typeof data.details === 'object') {
    data.details.channelPartnerName = data.channelPartnerName;
    data.details.vendorName = data.vendorName;
  }

  const item = await mod.model.create(data);
  new ApiResponse(201, { item: normalizeListingItem(item) }, 'Listing created successfully. It is pending admin approval.').send(res);
}));

function isOwnerOrAdmin(item, req) {
  if (req.auth?.role === 'admin' || req.auth?.accountType === 'admin') return;
  const authId = req.auth?.id ? String(req.auth.id) : null;
  const userId = req.user?._id ? String(req.user._id) : null;
  const userEmail = req.auth?.email || req.user?.email || '';

  if (item) {
    if (authId && item.lister && String(item.lister) === authId) return;
    if (authId && item.user && String(item.user) === authId) return;
    if (userId && item.lister && String(item.lister) === userId) return;
    if (userId && item.user && String(item.user) === userId) return;
    if (userEmail && item.contributor && item.contributor.email === userEmail) return;
  }
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
  new ApiResponse(200, { item: normalizeListingItem(item) }, 'Listing fetched').send(res);
}));

// PATCH /api/listings/:type/:id — update owned listing.
router.patch('/:type/:id', protect, asyncHandler(async (req, res) => {
  const mod = findModule(req.params.type);
  const item = await mod.model.findById(req.params.id);
  if (!item) throw new ApiError(404, 'Listing not found');
  isOwnerOrAdmin(item, req);

  // Non-admins cannot edit cancelled listings
  if (req.auth.role !== 'admin') {
    canListerEdit(item, req);
  }

  const body = { ...req.body };
  delete body._id;
  delete body.user;
  delete body.lister;
  delete body._type;
  // Non-admins cannot change status directly
  if (req.auth.role !== 'admin') {
    delete body.status;
  }

  const wasApproved = item.status === 'approved';
  const wasCancelled = item.status === 'cancelled' || item.status === 'rejected';
  Object.assign(item, body);

  // If user/lister edits a changes-required, cancelled, or approved listing, it goes back to pending for re-approval
  if (req.auth.role !== 'admin' && (item.status === 'changes-required' || wasCancelled || wasApproved)) {
    item.status = 'pending';
    // Clear any previous admin comment when resubmitting
    item.adminComment = undefined;
  }

  await item.save();
  new ApiResponse(200, { item: normalizeListingItem(item) }, 'Listing updated successfully').send(res);
}));

// DELETE /api/listings/:type/:id — delete owned listing.
router.delete('/:type/:id', protect, asyncHandler(async (req, res) => {
  const mod = findModule(req.params.type);
  const item = await mod.model.findById(req.params.id);
  if (!item) throw new ApiError(404, 'Listing not found');
  isOwnerOrAdmin(item, req);

  const media = [
    ...(Array.isArray(item.images) ? item.images : []),
    ...(Array.isArray(item.videos) ? item.videos : []),
    ...(Array.isArray(item.documents) ? item.documents : []),
    ...(Array.isArray(item.floorPlanImages) ? item.floorPlanImages : []),
    item.videoUrl,
    item.video,
    item.pdfUrl,
    item.brochure,
  ];
  await deleteMultipleMediaFromStorage(media);

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
        results[mod.id] = items.map(normalizeListingItem);
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

  item.status = 'approved';
  item.adminComment = undefined;
  item.updatedAt = new Date();
  await item.save();

  new ApiResponse(200, { item }, 'Listing approved successfully').send(res);
}));

// PATCH /api/admin/listings/:type/:id/changes
router.patch('/admin/:type/:id/changes', protect, adminOnly, asyncHandler(async (req, res) => {
  const mod = findModule(req.params.type);
  const item = await mod.model.findById(req.params.id);
  if (!item) throw new ApiError(404, 'Listing not found');

  const reason = req.body.reason || 'Please make the required changes and resubmit.';
  item.status = 'changes-required';
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