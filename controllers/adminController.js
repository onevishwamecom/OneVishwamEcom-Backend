const mongoose = require('mongoose');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const Admin = require('../models/Admin');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const modules = require('../modules');
const Lister = require('../models/Lister');
const { parsePrice } = require('../utils/priceUtils');
const { deleteMultipleMediaFromStorage } = require('../utils/firebaseStorage');

// ─── Auth ───────────────────────────────────────────────────────────────────

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required');
  }

  const cleanEmail = email.toLowerCase().trim();
  let admin = await Admin.findOne({ email: cleanEmail }).select('+password');

  if (!admin) {
    // Auto-bootstrap default Admin if DB has no admin or email matches admin bootstrap pattern
    const bootstrapEmail = (process.env.ADMIN_BOOTSTRAP_EMAIL || 'admin@onevishwam.com').toLowerCase().trim();
    const isBootstrapMatch = cleanEmail === bootstrapEmail;
    const adminCount = await Admin.countDocuments().catch(() => 0);

    if (isBootstrapMatch || adminCount === 0) {
      admin = await Admin.create({
        email: cleanEmail,
        password: password,
        name: process.env.ADMIN_BOOTSTRAP_NAME || 'Super Admin',
        role: 'super-admin',
        isActive: true,
      });
      admin = await Admin.findById(admin._id).select('+password');
    } else {
      throw new ApiError(401, 'Invalid admin credentials');
    }
  }

  if (!admin.isActive) {
    throw new ApiError(403, 'Admin account is deactivated');
  }

  let isMatch = await admin.comparePassword(password);
  const bootstrapEmail = (process.env.ADMIN_BOOTSTRAP_EMAIL || 'admin@onevishwam.com').toLowerCase();
  const bootstrapPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!isMatch && bootstrapPassword && cleanEmail === bootstrapEmail) {
    if (password === bootstrapPassword) {
      admin.password = password;
      await admin.save();
      isMatch = true;
    }
  }

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

const { CATEGORY_TO_MODULE, findModule: lookupModule, normalizeCategory } = require('../config/constants');

function findModule(type) {
  if (!type) throw new ApiError(400, 'Listing type is required');
  const mod = lookupModule(type, false);
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
    if (category && category !== 'all') {
      const targetMod = normalizeCategory(category);
      if (targetMod !== mod.id) return;
    }
    try {
      const items = await mod.model
        .find({ status: 'pending' })
        .populate('createdBy', 'name email phone listerId')
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
    if (category && category !== 'all') {
      const targetMod = normalizeCategory(category);
      if (targetMod !== mod.id) return;
    }
    const filter = {};
    if (status) filter.status = status;
    if (listerId) {
      filter.$or = [
        ...(mongoose.Types.ObjectId.isValid(listerId) ? [{ createdBy: listerId }, { lister: listerId }] : []),
        { 'contributor.email': listerId }
      ];
    }
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
        .populate('createdBy', 'name email phone listerId')
        .populate('lister', 'name email phone listerId')
        .sort({ createdAt: -1 })
        .skip((p - 1) * l)
        .limit(l)
        .lean();
      if (items.length > 0) {
        results[mod.id] = items.map((item) => {
          const v = item.video || item.videoUrl || (Array.isArray(item.videos) && item.videos[0]) || '';
          let listerObj = item.createdBy || item.lister;
          if (!listerObj || typeof listerObj !== 'object') {
            const fallbackName = item.contributor?.name || item.channelPartnerName || item.vendorName || 'Contributor';
            const fallbackEmail = item.contributor?.email || item.contactEmail || item.email || '';
            const fallbackPhone = item.contributor?.contact || item.contact || '';
            listerObj = {
              _id: item.createdBy || item.lister || item.user || item._id,
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
            contributorId: listerObj._id || item.createdBy || item.lister,
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
    userStats: {
      totalUsers: 0,
      loggedInUsers: 0,
      activeUsers: 0,
      emailVerifiedUsers: 0,
    },
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

  try {
    const userRoleFilter = { role: { $ne: 'admin' } };
    const [totalUsers, loggedInUsers, activeUsers, emailVerifiedUsers] = await Promise.all([
      User.countDocuments(userRoleFilter),
      User.countDocuments({ ...userRoleFilter, lastLogin: { $exists: true, $ne: null } }),
      User.countDocuments({ ...userRoleFilter, $or: [{ status: 'active' }, { accountStatus: 'active' }] }),
      User.countDocuments({ ...userRoleFilter, isEmailVerified: true }),
    ]);

    stats.userStats = {
      totalUsers,
      loggedInUsers,
      activeUsers,
      emailVerifiedUsers,
    };
  } catch (err) {
    console.warn('⚠️ [ADMIN STATS]: User collection count failed:', err.message);
  }

  // Exact aliases expected by Admin frontend
  stats.totalListings = stats.total;
  stats.pendingListings = stats.pending;
  stats.approvedListings = stats.approved;
  stats.cancelledListings = stats.cancelled;
  stats.changesRequiredListings = stats['changes-required'];

  try {
    const VisitorCounter = require('../models/VisitorCounter');
    const VisitorSession = require('../models/VisitorSession');
    const d = new Date();
    const today = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    const counter = await VisitorCounter.findOne({ key: 'global' }).lean();
    const activeThreshold = new Date(Date.now() - 45 * 1000);
    const realActive = await VisitorSession.countDocuments({
      isOnline: true,
      lastSeenAt: { $gte: activeThreshold },
    }).catch(() => 0);

    const visitsToday = counter?.todayDate === today ? (counter?.todayHits || counter?.todayVisitors || 0) : 0;

    stats.visitorStats = {
      totalVisitors: counter?.totalVisitors || counter?.totalHits || 0,
      totalHits: counter?.totalHits || counter?.totalVisitors || 0,
      visitsToday: visitsToday || 0,
      uniqueToday: counter?.todayVisitors || 0,
      activeVisitors: Math.max(realActive, 1),
    };
  } catch (err) {
    console.warn('⚠️ [ADMIN STATS]: Visitor counter fetch failed:', err.message);
  }

  new ApiResponse(200, stats, 'Admin listing stats fetched').send(res);
});

// ─── Website Users Management ─────────────────────────────────────────────

const getWebsiteUserStats = asyncHandler(async (req, res) => {
  const userRoleFilter = { role: { $ne: 'admin' } };
  const [totalUsers, loggedInUsers, activeUsers, emailVerifiedUsers, durationAgg] = await Promise.all([
    User.countDocuments(userRoleFilter),
    User.countDocuments({ ...userRoleFilter, lastLogin: { $exists: true, $ne: null } }),
    User.countDocuments({ ...userRoleFilter, $or: [{ status: 'active' }, { accountStatus: 'active' }] }),
    User.countDocuments({ ...userRoleFilter, isEmailVerified: true }),
    User.aggregate([
      { $match: userRoleFilter },
      { $group: { _id: null, totalSeconds: { $sum: '$totalTimeSpent' }, avgSeconds: { $avg: '$totalTimeSpent' } } },
    ]).catch(() => []),
  ]);

  const totalTimeSpentSeconds = durationAgg[0]?.totalSeconds || 0;
  const avgTimeSpentSeconds = Math.round(durationAgg[0]?.avgSeconds || 0);

  new ApiResponse(
    200,
    {
      totalUsers,
      loggedInUsers,
      activeUsers,
      emailVerifiedUsers,
      totalTimeSpentSeconds,
      avgTimeSpentSeconds,
    },
    'Website user stats fetched successfully'
  ).send(res);
});

const getWebsiteUsers = asyncHandler(async (req, res) => {
  const { search, status, page = 1, limit = 50 } = req.query;
  const p = Math.max(1, Number(page));
  const l = Math.min(100, Math.max(1, Number(limit)));

  const filter = { role: { $ne: 'admin' } };

  if (status && status !== 'all') {
    filter.$or = [{ status }, { accountStatus: status }];
  }

  if (search) {
    const searchRegex = { $regex: search, $options: 'i' };
    const searchConditions = [
      { name: searchRegex },
      { fullName: searchRegex },
      { email: searchRegex },
      { mobile: searchRegex },
      { phoneNumber: searchRegex },
      { phone: searchRegex },
      { city: searchRegex },
      { area: searchRegex },
    ];
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, { $or: searchConditions }];
      delete filter.$or;
    } else {
      filter.$or = searchConditions;
    }
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .select('-password -refreshToken')
      .sort({ lastLogin: -1, createdAt: -1 })
      .skip((p - 1) * l)
      .limit(l)
      .lean(),
    User.countDocuments(filter),
  ]);

  const formattedUsers = users.map((u) => {
    const resolvedName = u.name || u.fullName || u.email?.split('@')[0] || 'User';
    return {
      _id: u._id,
      name: resolvedName,
      fullName: resolvedName,
      email: u.email || 'N/A',
      phone: u.phoneNumber || u.mobile || u.phone || 'N/A',
      avatar: u.profileImage || u.avatar || '',
      profileImage: u.profileImage || u.avatar || '',
      city: u.city || '',
      area: u.area || '',
      role: u.role || 'user',
      isEmailVerified: Boolean(u.isEmailVerified),
      status: u.status || u.accountStatus || 'active',
      lastLogin: u.lastLogin || null,
      lastActiveAt: u.lastActiveAt || u.updatedAt || u.lastLogin || null,
      totalTimeSpent: u.totalTimeSpent || 0,
      sessionDuration: u.sessionDuration || 0,
      loginCount: u.loginCount || (u.lastLogin ? 1 : 0),
      interests: u.interests || [],
      primaryInterest: u.primaryInterest || '',
      browsingHistory: (u.browsingHistory || []).slice(0, 10),
      createdAt: u.createdAt,
    };
  });

  new ApiResponse(200, { users: formattedUsers, total, page: p, limit: l }, 'Website users fetched').send(res);
});

const getUserActivity = asyncHandler(async (req, res) => {
  const { id } = req.params;
  let user = null;
  if (mongoose.Types.ObjectId.isValid(id)) {
    user = await User.findById(id).select('-password -refreshToken').lean();
  }
  if (!user) {
    user = await User.findOne({ $or: [{ email: id }, { firebaseUid: id }] }).select('-password -refreshToken').lean();
  }
  if (!user) throw new ApiError(404, 'User not found');

  new ApiResponse(
    200,
    {
      user: {
        _id: user._id,
        name: user.name || user.fullName || 'User',
        email: user.email || 'N/A',
        phone: user.phoneNumber || user.mobile || 'N/A',
        avatar: user.avatar || user.profileImage || '',
        city: user.city || '',
        area: user.area || '',
        pincode: user.pincode || '',
        role: user.role || 'user',
        status: user.status || user.accountStatus || 'active',
        isEmailVerified: Boolean(user.isEmailVerified),
        lastLogin: user.lastLogin,
        lastActiveAt: user.lastActiveAt,
        totalTimeSpent: user.totalTimeSpent || 0,
        sessionDuration: user.sessionDuration || 0,
        createdAt: user.createdAt,
        primaryInterest: user.primaryInterest || '',
        interests: user.interests || [],
        browsingHistory: user.browsingHistory || [],
      },
    },
    'User activity fetched'
  ).send(res);
});

const getListingDetail = asyncHandler(async (req, res) => {
  const { type, id } = req.params;
  const mod = findModule(type);
  const item = await mod.model.findById(id).populate('lister', 'name email phone listerId city area pincode').lean();
  if (!item) throw new ApiError(404, 'Listing not found');

  if (!item.lister || typeof item.lister !== 'object') {
    const fallbackName = item.contributor?.name || item.channelPartnerName || item.vendorName || 'Contributor';
    const fallbackEmail = item.contributor?.email || item.contactEmail || item.email || '';
    const fallbackPhone = item.contributor?.contact || item.contact || '';
    const fallbackCity = item.contributor?.city || item.city || '';

    item.lister = {
      _id: item.createdBy || item.lister || item.user || item._id,
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

  if (updates.possessionStatus !== undefined) {
    updates.possession = updates.possessionStatus;
    if (item.details && typeof item.details === "object") {
      item.details.possessionStatus = updates.possessionStatus;
      item.markModified("details");
    }
  } else if (updates.possession !== undefined) {
    updates.possessionStatus = updates.possession;
    if (item.details && typeof item.details === "object") {
      item.details.possessionStatus = updates.possession;
      item.markModified("details");
    }
  }

  if (Array.isArray(updates.images)) {
    const cleanImages = updates.images
      .map((entry) => (typeof entry === 'string' ? entry.trim() : (entry?.url || entry?.src || '')))
      .filter(Boolean)
      .slice(0, 5);
    item.images = cleanImages;
    item.markModified('images');
    if (item.details && typeof item.details === 'object') {
      item.details.images = cleanImages;
      item.markModified('details');
    }
  }

  Object.assign(item, updates);
  if (Array.isArray(updates.images)) {
    item.markModified('images');
  }
  item.updatedAt = new Date();
  await item.save();

  if (mod?.service?.cache) {
    mod.service.cache.delete(String(id));
  }

  new ApiResponse(200, { item }, 'Listing overridden successfully').send(res);
});

const reorderListingImages = asyncHandler(async (req, res) => {
  const { type, id } = req.params;
  const rawList = Array.isArray(req.body)
    ? req.body
    : Array.isArray(req.body.images)
    ? req.body.images
    : Array.isArray(req.body.reorderedImages)
    ? req.body.reorderedImages
    : null;

  if (!rawList) {
    throw new ApiError(400, 'Payload must be an array of images or an object containing an "images" array');
  }

  // Find target model
  let targetMod = null;
  let item = null;
  if (type) {
    targetMod = findModule(type);
    item = await targetMod.model.findById(id);
  } else {
    for (const m of modules) {
      if (!m?.model) continue;
      const found = await m.model.findById(id);
      if (found) {
        targetMod = m;
        item = found;
        break;
      }
    }
  }

  if (!item) throw new ApiError(404, 'Listing not found');

  // Parse and sort images based on position / index
  let orderedUrls = [];
  if (rawList.length > 0 && typeof rawList[0] === 'object' && rawList[0] !== null) {
    // If elements have position or sort_order or order
    const sorted = [...rawList].sort((a, b) => {
      const posA = Number(a.position ?? a.order ?? a.sort_order ?? 0);
      const posB = Number(b.position ?? b.order ?? b.sort_order ?? 0);
      return posA - posB;
    });
    orderedUrls = sorted
      .map((entry) => entry.url || entry.imageUrl || entry.image || entry.src || entry.imageId)
      .filter((url) => typeof url === 'string' && url.trim().length > 0);
  } else {
    // Array of string URLs
    orderedUrls = rawList
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter(Boolean);
  }

  // Enforce maximum 5 images
  orderedUrls = orderedUrls.slice(0, 5);

  item.images = orderedUrls;
  if (item.details && typeof item.details === 'object' && Array.isArray(item.details.images)) {
    item.details.images = orderedUrls;
    item.markModified('details');
  }
  item.markModified('images');
  item.updatedAt = new Date();
  await item.save();

  // Clear LRU cache if service exists
  if (targetMod?.service?.cache) {
    targetMod.service.cache.delete(String(id));
  }

  new ApiResponse(200, { item, images: item.images }, 'Images reordered successfully').send(res);
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

  const email = (item.contributor?.email || item.contactEmail || item.email || '').toLowerCase();
  const partner = (item.channelPartnerName || item.vendorName || '').toLowerCase().replace(/\s+/g, '');
  if (email === 'ceo@onevishwam.com' || item.origin === 'in_house_project' || partner === 'onevishwam') {
    item.priority = 1;
    item.isPriority = true;
    item.featured = true;
    item.origin = 'in_house_project';
    item.channelPartnerName = 'One Vishwam';
    item.vendorName = 'One Vishwam';
  }

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
  const updatedItem = await mod.model.findByIdAndUpdate(
    id,
    {
      $set: {
        availabilityStatus,
        availabilityUpdatedAt: new Date(),
        availabilityUpdatedBy: req.auth.id,
        updatedAt: new Date(),
      },
    },
    { new: true, runValidators: false }
  );
  if (!updatedItem) throw new ApiError(404, 'Listing not found');
  const item = updatedItem;

  new ApiResponse(200, { item }, `Listing availability updated to ${availabilityStatus}`).send(res);
});

const deleteListing = asyncHandler(async (req, res) => {
  const { type, id } = req.params;
  const mod = findModule(type);
  const item = await mod.model.findById(id);
  if (!item) throw new ApiError(404, 'Listing not found');

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

  const contributorsByEmail = new Map();
  const contributorsById = new Map();

  listers.forEach((l) => {
    const norm = {
      ...l,
      _id: String(l._id),
      id: String(l._id),
      name: l.name || 'Contributor',
      email: (l.email || '').trim().toLowerCase(),
      phone: l.phone || l.listerId || '',
      city: l.city || '',
      type: l.role || 'lister',
      createdAt: l.createdAt || new Date(),
    };
    if (norm._id) contributorsById.set(norm._id, norm);
    if (norm.email) contributorsByEmail.set(norm.email, norm);
  });

  await Promise.all(modules.map(async (mod) => {
    try {
      if (!mod || !mod.model) return;
      const items = await mod.model.find({}, 'contributor createdBy lister user vendorName channelPartnerName status createdAt').lean();
      (items || []).forEach((item) => {
        const idKey = String(item.createdBy || item.lister || item.user || '');
        const emailKey = (item.contributor?.email || '').trim().toLowerCase();

        if (idKey && contributorsById.has(idKey)) {
          const existing = contributorsById.get(idKey);
          if (!existing.phone && item.contributor?.contact) existing.phone = item.contributor.contact;
          return;
        }
        if (emailKey && contributorsByEmail.has(emailKey)) {
          const existing = contributorsByEmail.get(emailKey);
          if (!existing.phone && item.contributor?.contact) existing.phone = item.contributor.contact;
          return;
        }

        if (item.contributor && (item.contributor.name || item.contributor.email)) {
          const newContributor = {
            _id: idKey || String(item._id),
            id: idKey || String(item._id),
            name: item.contributor.name || item.channelPartnerName || item.vendorName || 'Contributor',
            email: emailKey,
            phone: item.contributor.contact || item.contributor.phone || '',
            city: item.contributor.city || '',
            type: item.contributor.type || 'lister',
            createdAt: item.createdAt || new Date(),
          };
          if (idKey) contributorsById.set(idKey, newContributor);
          if (emailKey) contributorsByEmail.set(emailKey, newContributor);
        }
      });
    } catch {}
  }));

  const seenIdentities = new Set();
  const allContributors = [];
  const candidateList = [...contributorsById.values(), ...contributorsByEmail.values()];

  candidateList.forEach((c) => {
    const key = (c.email || String(c._id || '')).toLowerCase();
    if (!key || seenIdentities.has(key)) return;
    seenIdentities.add(key);
    allContributors.push(c);
  });

  const enriched = await Promise.all(allContributors.map(async (lister) => {
    let totalListings = 0;
    let pendingCount = 0;
    let approvedCount = 0;

    const orFilters = [];
    if (lister._id && mongoose.Types.ObjectId.isValid(lister._id)) {
      const objId = new mongoose.Types.ObjectId(lister._id);
      orFilters.push(
        { createdBy: objId },
        { createdBy: String(objId) },
        { lister: objId },
        { lister: String(objId) },
        { user: objId },
        { user: String(objId) }
      );
    }
    if (lister.email) {
      orFilters.push({ 'contributor.email': lister.email });
      orFilters.push({ 'contributor.email': lister.email.toLowerCase() });
    }
    if (lister.phone) {
      orFilters.push({ 'contributor.phone': lister.phone });
      orFilters.push({ 'contributor.contact': lister.phone });
    }
    if (lister.listerId) {
      orFilters.push({ listerId: lister.listerId });
      orFilters.push({ 'contributor.listerId': lister.listerId });
    }

    if (orFilters.length > 0) {
      await Promise.all(modules.map(async (mod) => {
        try {
          if (!mod || !mod.model) return;
          const [total, pending, approved] = await Promise.all([
            mod.model.countDocuments({ $or: orFilters }),
            mod.model.countDocuments({ status: 'pending', $or: orFilters }),
            mod.model.countDocuments({ status: 'approved', $or: orFilters }),
          ]);
          totalListings += total || 0;
          pendingCount += pending || 0;
          approvedCount += approved || 0;
        } catch {}
      }));
    }

    return {
      ...lister,
      contact: lister.phone || lister.contact || '',
      phone: lister.phone || lister.contact || '',
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
    if (mongoose.Types.ObjectId.isValid(id)) {
      lister = await Lister.findById(id).lean();
    }
    if (!lister) {
      lister = await Lister.findOne({ $or: [{ email: id }, { listerId: id }] }).lean();
    }
  } catch {}

  const orFilters = [];
  if (mongoose.Types.ObjectId.isValid(id)) {
    const objId = new mongoose.Types.ObjectId(id);
    orFilters.push(
      { createdBy: objId },
      { createdBy: String(objId) },
      { lister: objId },
      { lister: String(objId) },
      { user: objId },
      { user: String(objId) }
    );
  }
  if (lister?._id && mongoose.Types.ObjectId.isValid(lister._id)) {
    const objId = new mongoose.Types.ObjectId(lister._id);
    orFilters.push(
      { createdBy: objId },
      { createdBy: String(objId) },
      { lister: objId },
      { lister: String(objId) }
    );
  }
  if (lister?.email) {
    orFilters.push({ 'contributor.email': lister.email }, { 'contributor.email': lister.email.toLowerCase() });
  } else if (id && id.includes('@')) {
    orFilters.push({ 'contributor.email': id }, { 'contributor.email': id.toLowerCase() });
  }
  if (lister?.phone) {
    orFilters.push({ 'contributor.phone': lister.phone }, { 'contributor.contact': lister.phone });
  }
  if (lister?.listerId) {
    orFilters.push({ listerId: lister.listerId }, { 'contributor.listerId': lister.listerId });
  }

  const listings = {};
  let totalListings = 0;

  if (orFilters.length > 0) {
    await Promise.all(modules.map(async (mod) => {
      try {
        if (!mod || !mod.model) return;
        const items = await mod.model.find({ $or: orFilters }).sort({ createdAt: -1 }).lean();
        if (items && items.length > 0) {
          listings[mod.id] = items;
          totalListings += items.length;
        }
      } catch {}
    }));
  }

  if (!lister) {
    lister = {
      _id: id,
      name: 'Contributor',
      email: id.includes('@') ? id : '',
      phone: '',
      contact: '',
    };
  } else {
    lister = {
      ...lister,
      contact: lister.phone || lister.contact || '',
      phone: lister.phone || lister.contact || '',
    };
  }

  new ApiResponse(200, { contributor: lister, listings, totalListings }, 'Contributor details fetched').send(res);
});

const getCategoryBreakdown = asyncHandler(async (req, res) => {
  const { timeframe = 'all' } = req.query;
  const now = new Date();
  const lookupTimeframe = {};

  if (timeframe === 'day') {
    lookupTimeframe.visitedAt = { $gte: new Date(now.setHours(0, 0, 0, 0)) };
  } else if (timeframe === 'week') {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    lookupTimeframe.visitedAt = { $gte: weekAgo };
  } else if (timeframe === 'month') {
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    lookupTimeframe.visitedAt = { $gte: monthAgo };
  }
  // 'all' returns no time filter

  const pipeline = [
    { $match: lookupTimeframe },
    {
      $group: {
        _id: '$category',
        totalVisits: { $sum: 1 },
        uniqueVisitors: { $addToSet: '$sessionIdentifier' },
        firstVisit: { $min: '$visitedAt' },
        lastVisit: { $max: '$visitedAt' },
      },
    },
    { $sort: { totalVisits: -1 } },
  ];

  const categoryBreakdown = await Activity.aggregate(pipeline);

  // Format the unique visitor count
  const formatted = categoryBreakdown.map((item) => ({
    category: item._id || 'unknown',
    totalVisits: item.totalVisits || 0,
    uniqueVisitors: item.uniqueVisitors ? item.uniqueVisitors.length : 0,
    firstVisit: item.firstVisit || null,
    lastVisit: item.lastVisit || null,
  }));

  new ApiResponse(200, { categoryBreakdown: formatted, timeframe }).send(res);
});

const getActivityStats = asyncHandler(async (req, res) => {
  const { timeframe = 'all' } = req.query;
  const now = new Date();
  const lookup = {};

  if (timeframe === 'day') {
    lookup.visitedAt = { $gte: new Date(now.setHours(0, 0, 0, 0)) };
  } else if (timeframe === 'week') {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    lookup.visitedAt = { $gte: weekAgo };
  } else if (timeframe === 'month') {
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    lookup.visitedAt = { $gte: monthAgo };
  }

  const totalActivity = await Activity.countDocuments(lookup);

  const categoryStats = await Activity.aggregate([
    { $match: lookup },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);

  new ApiResponse(
    200,
    {
      totalActivity,
      categoryStats,
      timeframe,
    },
    'Activity stats fetched'
  ).send(res);
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
  reorderListingImages,
  approveListing,
  requestChanges,
  cancelListing,
  deleteListing,
  updateAvailabilityStatus,
  getContributors,
  getContributorById,
  getWebsiteUserStats,
  getWebsiteUsers,
  getUserActivity,
  getActivityStats,
  getCategoryBreakdown,
};