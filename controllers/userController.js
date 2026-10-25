const mongoose = require('mongoose');
const User = require('../models/User');
const Activity = require('../models/Activity');
const upload = require('../middleware/upload');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const userService = require('../services/userService');

const updateProfile = asyncHandler(async (req, res) => {
  const updates = { ...req.body };

  if (req.file) {
    updates.profileImage = req.file.path && req.file.path.startsWith('http')
      ? req.file.path
      : req.file.cloudinaryUrl || `/uploads/${req.file.filename}`;
  }

  const user = await userService.updateProfile(req.user._id, updates);
  new ApiResponse(200, { user }, 'Profile updated').send(res);
});

/**
 * POST /api/users/activity
 * Records user activity, page visit, or specific property/listing view.
 * Updates user's sector interests breakdown, browsing history, and primary interest.
 */
const trackActivity = asyncHandler(async (req, res) => {
  const {
    category = 'general',
    listingId,
    title = '',
    price = '',
    location = '',
    image = '',
    path = '',
    userId,
    userEmail,
  } = req.body;

  const targetId = req.user?._id || req.user?.id || userId;
  const targetUid = req.firebaseClaims?.uid || req.user?.firebaseUid;
  const targetEmail = (req.user?.email || userEmail || '').trim().toLowerCase();

  const queryOr = [];
  if (targetId && mongoose.Types.ObjectId.isValid(targetId)) {
    queryOr.push({ _id: targetId });
  }
  if (targetUid) {
    queryOr.push({ firebaseUid: targetUid });
  }
  if (targetEmail) {
    queryOr.push({ email: targetEmail });
  }

  if (queryOr.length === 0) {
    // No authenticated user identified - log to Activity model as session tracking
    const cleanCategory = String(category || 'general').toLowerCase().trim();
    const now = new Date();

    await Activity.create({
      category: cleanCategory,
      listingId: listingId || undefined,
      title: title ? String(title).slice(0, 200) : '',
      price: price ? String(price).slice(0, 80) : '',
      location: location ? String(location).slice(0, 150) : '',
      image: image ? String(image).slice(0, 500) : '',
      path: path ? String(path).slice(0, 200) : '',
      sessionIdentifier: req.sessionID || `${req.ip}-${req.get('user-agent') || ''}`,
      visitedAt: now,
    });

    return new ApiResponse(
      200,
      { tracked: true, reason: 'Session activity logged', category: cleanCategory },
      'Session activity recorded'
    ).send(res);
  }

  const user = await User.findOne({ $or: queryOr });
  if (!user) {
    return new ApiResponse(200, { tracked: false, reason: 'User record not found' }).send(res);
  }

  const cleanCategory = String(category || 'general').toLowerCase().trim();
  const now = new Date();

  // 1. Update or increment sector interest count
  if (!Array.isArray(user.interests)) {
    user.interests = [];
  }
  const existingInterestIndex = user.interests.findIndex(
    (i) => i.category?.toLowerCase() === cleanCategory
  );
  if (existingInterestIndex >= 0) {
    user.interests[existingInterestIndex].viewCount = (user.interests[existingInterestIndex].viewCount || 0) + 1;
    user.interests[existingInterestIndex].lastVisitedAt = now;
  } else {
    user.interests.push({
      category: cleanCategory,
      viewCount: 1,
      lastVisitedAt: now,
    });
  }

  // 2. Compute primary interest
  let maxViews = 0;
  let topSector = cleanCategory;
  user.interests.forEach((item) => {
    if ((item.viewCount || 0) > maxViews) {
      maxViews = item.viewCount;
      topSector = item.category;
    }
  });
  user.primaryInterest = topSector;

  // 3. Add to browsing history (keep latest 50 items)
  if (!Array.isArray(user.browsingHistory)) {
    user.browsingHistory = [];
  }

  // Avoid spamming duplicate entries if refreshed within 20s
  const lastEntry = user.browsingHistory[0];
  const isDuplicateListing = lastEntry && listingId && String(lastEntry.listingId) === String(listingId);
  const isRecentDuplicate = isDuplicateListing && (now - new Date(lastEntry.visitedAt || 0)) < 20 * 1000;

  if (!isRecentDuplicate) {
    user.browsingHistory.unshift({
      category: cleanCategory,
      listingId: listingId ? String(listingId) : undefined,
      title: title ? String(title).slice(0, 200) : '',
      price: price ? String(price).slice(0, 80) : '',
      location: location ? String(location).slice(0, 150) : '',
      image: image ? String(image).slice(0, 500) : '',
      path: path ? String(path).slice(0, 200) : '',
      visitedAt: now,
    });

    if (user.browsingHistory.length > 50) {
      user.browsingHistory = user.browsingHistory.slice(0, 50);
    }
  }

  // Also log to Activity model linked to this user
  await Activity.create({
    user: user._id,
    category: cleanCategory,
    listingId: listingId || undefined,
    title: title ? String(title).slice(0, 200) : '',
    price: price ? String(price).slice(0, 80) : '',
    location: location ? String(location).slice(0, 150) : '',
    image: image ? String(image).slice(0, 500) : '',
    path: path ? String(path).slice(0, 200) : '',
    visitedAt: now,
  });

  user.lastActiveAt = now;
  await user.save({ validateBeforeSave: false });

  new ApiResponse(
    200,
    {
      tracked: true,
      primaryInterest: user.primaryInterest,
      interests: user.interests,
      historyCount: user.browsingHistory.length,
    },
    'Activity recorded'
  ).send(res);
});

module.exports = {
  updateProfile,
  trackActivity,
};
