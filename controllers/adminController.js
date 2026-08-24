const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const Admin = require('../models/Admin');
const jwt = require('jsonwebtoken');
const modules = require('../modules');
const Lister = require('../models/Lister');

// ─── Auth ───────────────────────────────────────────────────────────────────

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required');
  }

  const admin = await Admin.findOne({ email: email.toLowerCase().trim() }).select('+password');
  if (!admin) {
    throw new ApiError(401, 'Invalid admin credentials');
  }

  if (!admin.isActive) {
    throw new ApiError(403, 'Admin account is deactivated');
  }

  const isMatch = await admin.comparePassword(password);
  if (!isMatch) {
    throw new ApiError(401, 'Invalid admin credentials');
  }

  admin.lastLogin = new Date();
  await admin.save({ validateBeforeSave: false });

  const result = await admin.generateAuthResponse();
  new ApiResponse(200, result, 'Admin login successful').send(res);
});

const getMe = asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.auth.id);
  if (!admin) throw new ApiError(404, 'Admin not found');
  new ApiResponse(200, { admin: admin.toAdminJSON() }).send(res);
});

const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken || typeof refreshToken !== 'string') {
    return new ApiResponse(200, null, 'Logged out').send(res);
  }
  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    const admin = await Admin.findById(payload.id).select('+refreshToken');
    if (admin && admin.refreshToken === refreshToken) {
      admin.refreshToken = undefined;
      await admin.save({ validateBeforeSave: false });
    }
  } catch {
    // Token invalid, nothing to revoke
  }
  new ApiResponse(200, null, 'Admin logged out successfully').send(res);
});

const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    throw new ApiError(401, 'No refresh token provided');
  }

  const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
  const admin = await Admin.findById(payload.id).select('+refreshToken');
  if (!admin || admin.refreshToken !== refreshToken) {
    throw new ApiError(401, 'Invalid refresh token');
  }

  const result = await admin.generateAuthResponse();
  new ApiResponse(200, result, 'Token refreshed').send(res);
});

// ─── Listing Management ─────────────────────────────────────────────────────

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

const getPendingListings = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, category } = req.query;
  const p = Math.max(1, Number(page));
  const l = Math.min(100, Math.max(1, Number(limit)));

  const results = {};
  let total = 0;

  await Promise.all(modules.map(async (mod) => {
    if (category && CATEGORY_TO_MODULE[category] && CATEGORY_TO_MODULE[category] !== mod.id) return;
    try {
      const items = await mod.model
        .find({ status: 'pending' })
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

  new ApiResponse(200, { results, total, page: p, limit: l }, 'Pending listings fetched').send(res);
});

const getAllListings = asyncHandler(async (req, res) => {
  const { status, category, listerId, search, page = 1, limit = 20 } = req.query;
  const p = Math.max(1, Number(page));
  const l = Math.min(100, Math.max(1, Number(limit)));

  const results = {};
  let total = 0;

  await Promise.all(modules.map(async (mod) => {
    if (category && CATEGORY_TO_MODULE[category] && CATEGORY_TO_MODULE[category] !== mod.id) return;
    const filter = {};
    if (status) filter.status = status;
    if (listerId) filter.lister = listerId;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
      ];
    }
    try {
      const items = await mod.model
        .find(filter)
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
});

const getListingStats = asyncHandler(async (req, res) => {
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
});

const getListingDetail = asyncHandler(async (req, res) => {
  const { type, id } = req.params;
  const mod = findModule(type);
  const item = await mod.model.findById(id).populate('lister', 'name email phone listerId city area pincode').lean();
  if (!item) throw new ApiError(404, 'Listing not found');
  new ApiResponse(200, { item }, 'Listing fetched').send(res);
});

const updateListingStatus = asyncHandler(async (req, res) => {
  const { type, id } = req.params;
  const { status, reason } = req.body;

  const validStatuses = ['approved', 'rejected', 'changes-required', 'cancelled'];
  if (!validStatuses.includes(status)) {
    throw new ApiError(400, `Invalid status "${status}". Must be one of: ${validStatuses.join(', ')}`);
  }

  const mod = findModule(type);
  const item = await mod.model.findById(id);
  if (!item) throw new ApiError(404, 'Listing not found');

  // Map "rejected" to "cancelled" for schema compatibility
  const schemaStatus = status === 'rejected' ? 'cancelled' : status;

  item.status = schemaStatus;
  if (reason) item.adminComment = reason;
  item.updatedAt = new Date();
  await item.save();

  new ApiResponse(200, { item }, `Listing ${status} successfully`).send(res);
});

const approveListing = asyncHandler(async (req, res) => {
  const { type, id } = req.params;
  const mod = findModule(type);
  const item = await mod.model.findById(id);
  if (!item) throw new ApiError(404, 'Listing not found');

  if (!['pending', 'changes-required'].includes(item.status)) {
    throw new ApiError(400, `Cannot approve listing with status "${item.status}"`);
  }

  item.status = 'approved';
  item.adminComment = undefined;
  item.updatedAt = new Date();
  await item.save();

  new ApiResponse(200, { item }, 'Listing approved successfully').send(res);
});

const requestChanges = asyncHandler(async (req, res) => {
  const { type, id } = req.params;
  const { reason } = req.body;
  const mod = findModule(type);
  const item = await mod.model.findById(id);
  if (!item) throw new ApiError(404, 'Listing not found');

  if (!['pending'].includes(item.status)) {
    throw new ApiError(400, `Cannot request changes for listing with status "${item.status}"`);
  }

  item.status = 'changes-required';
  item.adminComment = reason || 'Please make the required changes and resubmit.';
  item.updatedAt = new Date();
  await item.save();

  new ApiResponse(200, { item }, 'Changes requested successfully').send(res);
});

const cancelListing = asyncHandler(async (req, res) => {
  const { type, id } = req.params;
  const { reason } = req.body;
  const mod = findModule(type);
  const item = await mod.model.findById(id);
  if (!item) throw new ApiError(404, 'Listing not found');

  item.status = 'cancelled';
  item.adminComment = reason || 'Listing cancelled by admin.';
  item.updatedAt = new Date();
  await item.save();

  new ApiResponse(200, { item }, 'Listing cancelled successfully').send(res);
});

const deleteListing = asyncHandler(async (req, res) => {
  const { type, id } = req.params;
  const mod = findModule(type);
  const item = await mod.model.findById(id);
  if (!item) throw new ApiError(404, 'Listing not found');
  await item.deleteOne();
  new ApiResponse(200, null, 'Listing deleted permanently').send(res);
});

// ─── Contributors ───────────────────────────────────────────────────────────

const getContributors = asyncHandler(async (req, res) => {
  const listers = await Lister.find({}, 'name email phone listerId city area pincode createdAt').lean();

  const enriched = await Promise.all(listers.map(async (lister) => {
    let totalListings = 0;
    let pendingCount = 0;
    let approvedCount = 0;

    await Promise.all(modules.map(async (mod) => {
      try {
        const [total, pending, approved] = await Promise.all([
          mod.model.countDocuments({ lister: lister._id }),
          mod.model.countDocuments({ lister: lister._id, status: 'pending' }),
          mod.model.countDocuments({ lister: lister._id, status: 'approved' }),
        ]);
        totalListings += total;
        pendingCount += pending;
        approvedCount += approved;
      } catch { }
    }));

    return {
      ...lister,
      totalListings,
      pendingCount,
      approvedCount,
    };
  }));

  new ApiResponse(200, { contributors: enriched }, 'Contributors fetched').send(res);
});

const getContributorById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const lister = await Lister.findById(id).lean();
  if (!lister) throw new ApiError(404, 'Contributor not found');

  const listings = {};
  let totalListings = 0;

  await Promise.all(modules.map(async (mod) => {
    try {
      const items = await mod.model.find({ lister: id }).sort({ createdAt: -1 }).lean();
      if (items.length > 0) {
        listings[mod.id] = items;
        totalListings += items.length;
      }
    } catch { }
  }));

  new ApiResponse(200, { contributor: lister, listings, totalListings }, 'Contributor details fetched').send(res);
});

module.exports = {
  login,
  getMe,
  logout,
  refresh,
  getPendingListings,
  getAllListings,
  getListingStats,
  getListingDetail,
  updateListingStatus,
  approveListing,
  requestChanges,
  cancelListing,
  deleteListing,
  getContributors,
  getContributorById,
};