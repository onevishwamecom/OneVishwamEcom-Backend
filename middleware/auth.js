const admin = require('../config/firebaseAdmin');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Lister = require('../models/Lister');
const Admin = require('../models/Admin');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

function resolveAccountType(decoded) {
  if (decoded.accountType === 'user' || decoded.accountType === 'lister' || decoded.accountType === 'admin') {
    return decoded.accountType;
  }
  if (decoded.role === 'lister') return 'lister';
  if (decoded.role === 'admin' || decoded.role === 'super-admin') return 'admin';
  return 'user';
}

function resolveModel(accountType) {
  if (accountType === 'lister') return Lister;
  if (accountType === 'admin') return Admin;
  return User;
}

function extractBearerToken(req) {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return req.headers.authorization.split(' ')[1];
  }
  return null;
}

/**
 * Verify Firebase ID Token or legacy JWT
 */
const verifyFirebaseToken = asyncHandler(async (req, res, next) => {
  const token = extractBearerToken(req);
  if (!token) {
    throw new ApiError(401, "No token provided or invalid format. Expected 'Bearer <token>'");
  }

  // 1. First attempt Firebase ID Token verification
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Find associated user in MongoDB Atlas by firebaseUid or email
    let user = await User.findOne({ firebaseUid: decodedToken.uid });
    
    if (!user && decodedToken.email) {
      user = await User.findOne({ email: decodedToken.email.toLowerCase() });
      if (user && !user.firebaseUid) {
        user.firebaseUid = decodedToken.uid;
        await user.save({ validateBeforeSave: false });
      }
    }

    // Auto-provision if user exists in Firebase but not yet saved in MongoDB
    if (!user) {
      user = await User.create({
        firebaseUid: decodedToken.uid,
        email: decodedToken.email ? decodedToken.email.toLowerCase() : undefined,
        fullName: decodedToken.name || 'User',
        avatar: decodedToken.picture || '',
        profileImage: decodedToken.picture || '',
        phoneNumber: decodedToken.phone_number || '',
        mobile: decodedToken.phone_number || undefined,
        role: 'user',
        status: 'active',
        accountStatus: 'active',
        isEmailVerified: decodedToken.email_verified || false,
      });
    }

    req.user = user;
    req.auth = {
      id: user._id,
      accountType: user.role === 'lister' ? 'lister' : user.role === 'admin' ? 'admin' : 'user',
      role: user.role || 'user',
      listerId: user.listerId || null,
    };
    req.firebaseClaims = decodedToken;
    return next();
  } catch (firebaseError) {
    // 2. Fallback: Check if it is a valid legacy JWT (used by Lister / Admin portals)
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
      const accountType = resolveAccountType(decoded);
      const Model = resolveModel(accountType);
      const doc = await Model.findById(decoded.id).select('-password');

      if (!doc) {
        throw new ApiError(401, 'Authenticated account not found');
      }

      req.auth = {
        id: doc._id,
        accountType,
        role: decoded.role || (accountType === 'lister' ? 'lister' : accountType === 'admin' ? 'admin' : doc.role),
        listerId: doc.listerId || null,
      };
      req.user = doc;
      req.user.role = req.auth.role;
      return next();
    } catch (jwtError) {
      console.error('Auth Verification Error:', firebaseError.message);
      throw new ApiError(401, 'Unauthorized: Invalid or expired token');
    }
  }
});

const protect = verifyFirebaseToken;

const optionalAuth = asyncHandler(async (req, res, next) => {
  const token = extractBearerToken(req);
  if (!token) return next();

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    let user = await User.findOne({ firebaseUid: decodedToken.uid });
    if (user) {
      req.user = user;
      req.auth = {
        id: user._id,
        accountType: user.role,
        role: user.role,
        listerId: user.listerId || null,
      };
      req.firebaseClaims = decodedToken;
    }
  } catch {
    // Check legacy JWT
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
      const accountType = resolveAccountType(decoded);
      const Model = resolveModel(accountType);
      const doc = await Model.findById(decoded.id).select('-password');
      if (doc) {
        req.auth = { id: doc._id, accountType, role: doc.role, listerId: doc.listerId || null };
        req.user = doc;
      }
    } catch {
      // Continue unauthenticated
    }
  }
  next();
});

const adminOnly = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'super-admin')) {
    return next();
  }
  next(new ApiError(403, 'Not authorized as admin'));
};

module.exports = {
  verifyFirebaseToken,
  protect,
  optionalAuth,
  adminOnly,
  resolveAccountType,
  resolveModel,
};
