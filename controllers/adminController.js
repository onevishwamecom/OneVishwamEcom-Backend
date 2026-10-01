const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const Admin = require('../models/Admin');
const jwt = require('jsonwebtoken');
const modules = require('../modules');
const Lister = require('../models/Lister');
const { parsePrice } = require('../utils/priceUtils');

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
  console.log('🔑 [ADMIN AUTH TOKEN]:', result.accessToken);
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
        results[mod.id] = items.map((item) => {
          const v = item.video || item.videoUrl || (Array.isArray(item.videos) && item.videos[0]) || '';
          let listerObj = item.lister;
          if (!listerObj || typeof listerObj !== 'object') {
            const fallbackName = item.contributor?.name || item.channelPartnerName || item.vendorName || 'Contributor';
            const fallbackEmail = item.contributor?.email || item.contactEmail || item.email || '';
            const fallbackPhone = item.contributor?.contact || item.contributor?.phone || item.contact || item.phone || '';
            listerObj = {
              _id: item.lister || item.user || item._id,
              name: fallbackName,
              email: fallbackEmail,
              phone: fallbackPhone,
            };
          }
          const contributorObj = item.contributor || {
            _id: listerObj._id,
            name: listerObj.name,
            email: listerObj.email,
            contact: listerObj.phone,
            phone: listerObj.phone,
          };
          return {
            ...item,
            lister: listerObj,
            contributor: contributorObj,
            video: v,
            videoUrl: v,
            videos: Array.isArray(item.videos) && item.videos.length > 0 ? item.videos : (v ? [v] : []),
          };
        });
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

  if (!item.lister || typeof item.lister !== 'object') {
    const fallbackName = item.contributor?.name || item.channelPartnerName || item.vendorName || 'Contributor';
    const fallbackEmail = item.contributor?.email || item.contactEmail || item.email || '';
    const fallbackPhone = item.contributor?.contact || item.contributor?.phone || item.contact || item.phone || '';
    const fallbackCity = item.contributor?.city || item.city || '';

    item.lister = {
      _id: item.lister || item.user || item._id,
      name: fallbackName,
      email: fallbackEmail,
      phone: fallbackPhone,
      city: fallbackCity,
    };
  }

  if (!item.contributor) {
    item.contributor = {
      _id: item.lister?._id || item.lister || item.user || item._id,
      name: item.lister?.name || item.channelPartnerName || item.vendorName || 'Contributor',
      email: item.lister?.email || item.contactEmail || '',
      contact: item.lister?.phone || item.contact || '',
      phone: item.lister?.phone || item.contact || '',
      city: item.lister?.city || item.city || '',
    };
  }

  new ApiResponse(200, { item }, 'Listing fetched').send(res);
});

const overrideListing = asyncHandler(async (req, res) => {
  const { type, id } = req.params;
  const mod = findModule(type);
  const item = await mod.model.findById(id);
  if (!item) throw new ApiError(404, 'Listing not found');

  const updates = { ...req.body };
  delete updates._id;
  delete updates.__v;
  delete updates.createdAt;
  delete updates.user;
  delete updates.lister;

  if (updates.price !== undefined && updates.price !== null && updates.price !== '') {
    const numPrice = parsePrice(updates.price);
    if (numPrice > 0) {
      updates.numericPrice = numPrice;
      updates.priceValue = numPrice;
    }
  }

  if (updates.area_sqft !== undefined && updates.area_sqft !== null && updates.area_sqft !== '') {
    const numArea = Number(String(updates.area_sqft).replace(/[^\d.]/g, ''));
    if (!isNaN(numArea)) {
      updates.numericArea = numArea;
    }
  }

  if (updates.weight !== undefined && updates.weight !== null && updates.weight !== '') {
    const numWeight = Number(updates.weight);
    if (!isNaN(numWeight)) {
      updates.weightGrams = numWeight;
    }
  }

  Object.assign(item, updates);
  item.updatedAt = new Date();
  await item.save();

  new ApiResponse(200, { item }, 'Listing overridden successfully').send(res);
});

const updateListingStatus = asyncHandler(async (req, res) => {
  const { type, id } = req.params;
  const { status, reason } = req.body;

  // If payload contains more than status/reason, route to full override
  const keys = Object.keys(req.body);
  if (keys.some((k) => k !== 'status' && k !== 'reason' && k !== 'adminComment')) {
    return overrideListing(req, res);
  }

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

const updateAvailabilityStatus = asyncHandler(async (req, res) => {
  const { type, id } = req.params;
  const { availabilityStatus } = req.body;

  const validStatuses = ['available', 'sold_out', 'inactive'];
  if (!validStatuses.includes(availabilityStatus)) {
    throw new ApiError(400, `Invalid availabilityStatus "${availabilityStatus}". Must be one of: ${validStatuses.join(', ')}`);
  }

  const mod = findModule(type);
  const item = await mod.model.findById(id);
  if (!item) throw new ApiError(404, 'Listing not found');

  item.availabilityStatus = availabilityStatus;
  item.availabilityUpdatedAt = new Date();
  item.availabilityUpdatedBy = req.auth.id;
  item.updatedAt = new Date();
  await item.save();

  new ApiResponse(200, { item }, `Listing availability updated to ${availabilityStatus}`).send(res);
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
  let listers = [];
  try {
    listers = (await Lister.find({}, 'name email phone listerId city area pincode createdAt').lean()) || [];
  } catch (err) {
    console.warn('⚠️ [ADMIN CONTRIBUTORS]: Lister collection query failed:', err.message);
    listers = [];
  }

  const listingContributorsMap = new Map();
  await Promise.all(modules.map(async (mod) => {
    try {
      if (!mod || !mod.model) return;
      const items = await mod.model.find({}, 'contributor lister user vendorName channelPartnerName status createdAt').lean();
      (items || []).forEach((item) => {
        if (item.contributor && (item.contributor.name || item.contributor.email)) {
          const key = item.contributor.email || String(item.lister || item.user || item._id);
          if (!listingContributorsMap.has(key)) {
            listingContributorsMap.set(key, {
              _id: item.lister || item.user || item._id,
              name: item.contributor.name || item.channelPartnerName || item.vendorName || 'Contributor',
              email: item.contributor.email || '',
              phone: item.contributor.contact || '',
              city: item.contributor.city || '',
              type: item.contributor.type || 'lister',
              createdAt: item.createdAt || new Date(),
            });
          }
        }
      });
    } catch {}
  }));

  const map = new Map();
  listers.forEach((l) => map.set(String(l._id || l.email), l));
  listingContributorsMap.forEach((c, key) => {
    if (!map.has(key)) map.set(key, c);
  });

  const allContributors = Array.from(map.values());

  const enriched = await Promise.all(allContributors.map(async (lister) => {
    let totalListings = 0;
    let pendingCount = 0;
    let approvedCount = 0;

    await Promise.all(modules.map(async (mod) => {
      try {
        if (!mod || !mod.model) return;
        const filterOr = [
          lister._id ? { lister: lister._id } : null,
          lister._id ? { user: lister._id } : null,
          lister.email ? { 'contributor.email': lister.email } : null,
        ].filter(Boolean);

        if (filterOr.length === 0) return;

        const [total, pending, approved] = await Promise.all([
          mod.model.countDocuments({ $or: filterOr }),
          mod.model.countDocuments({ status: 'pending', $or: filterOr }),
          mod.model.countDocuments({ status: 'approved', $or: filterOr }),
        ]);
        totalListings += total || 0;
        pendingCount += pending || 0;
        approvedCount += approved || 0;
      } catch {}
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
  let lister = null;
  try {
    lister = await Lister.findById(id).lean();
  } catch {}

  const listings = {};
  let totalListings = 0;

  await Promise.all(modules.map(async (mod) => {
    try {
      if (!mod || !mod.model) return;
      const items = await mod.model.find({ $or: [{ lister: id }, { user: id }] }).sort({ createdAt: -1 }).lean();
      if (items && items.length > 0) {
        listings[mod.id] = items;
        totalListings += items.length;
      }
    } catch {}
  }));

  if (!lister) {
    // Construct synthetic contributor profile from listing data if not in Lister model
    lister = {
      _id: id,
      name: 'Contributor',
      email: '',
      phone: '',
    };
  }

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
  overrideListing,
  approveListing,
  requestChanges,
  cancelListing,
  deleteListing,
  updateAvailabilityStatus,
  getContributors,
  getContributorById,
};