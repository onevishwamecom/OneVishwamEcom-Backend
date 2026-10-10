const admin = require('../config/firebaseAdmin');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Lister = require('../models/Lister');
const Admin = require('../models/Admin');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { resolvePartnerIdentity } = require('../config/partnerDirectory');

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

function attachPartnerIdentity(req, email) {
  if (!email) return;
  const partnerInfo = resolvePartnerIdentity(email);
  if (partnerInfo && partnerInfo.isLocked) {
    if (req.user) {
      req.user.partnerName = partnerInfo.partnerName;
      req.user.partnerRole = partnerInfo.role;
      req.user.role = partnerInfo.role || req.user.role;
      req.user.origin = partnerInfo.origin;
    }
    if (req.auth) {
      req.auth.partnerName = partnerInfo.partnerName;
      req.auth.partnerRole = partnerInfo.role;
      req.auth.origin = partnerInfo.origin;
    }
  }
}

/**
 * Helper to process a verified or decoded Firebase user token
 */
async function processFirebaseUser(decodedToken, req, next, isDevUnverified = false) {
  const uid = decodedToken.uid || decodedToken.user_id || decodedToken.sub || `usr_${Date.now()}`;
  const email = decodedToken.email ? decodedToken.email.toLowerCase() : '';
  const bootstrapEmail = (process.env.ADMIN_BOOTSTRAP_EMAIL || 'admin@onevishwam.com').toLowerCase();
  const isAdminEmail = email === bootstrapEmail || email === 'ceo@onevishwam.com';

  try {
    // Check Admin collection
    let adminAccount = await Admin.findOne({
      $or: [
        { firebaseUid: uid },
        ...(email ? [{ email }] : []),
      ],
    }).catch(() => null);

    if (!adminAccount && isAdminEmail && !isDevUnverified) {
      adminAccount = await Admin.create({
        email: email || (process.env.ADMIN_BOOTSTRAP_EMAIL || 'admin@onevishwam.com'),
        name: decodedToken.name || process.env.ADMIN_BOOTSTRAP_NAME || 'Super Admin',
        password: process.env.ADMIN_BOOTSTRAP_PASSWORD || 'Admin@' + Math.random().toString(36).slice(-6),
        role: 'super-admin',
        firebaseUid: uid,
        isActive: true,
      }).catch(() => null);
    }

    if (adminAccount) {
      if (!adminAccount.firebaseUid && uid) {
        adminAccount.firebaseUid = uid;
        await adminAccount.save({ validateBeforeSave: false }).catch(() => null);
      }
      req.user = adminAccount;
      req.auth = {
        id: adminAccount._id,
        accountType: 'admin',
        role: adminAccount.role || 'super-admin',
      };
      req.firebaseClaims = decodedToken;
      attachPartnerIdentity(req, email || adminAccount.email);
      return next();
    }

    // Check Lister collection
    let listerAccount = await Lister.findOne({
      $or: [
        { firebaseUid: uid },
        ...(email ? [{ email }] : []),
      ],
    }).catch(() => null);

    if (listerAccount) {
      if (!listerAccount.firebaseUid && uid) {
        listerAccount.firebaseUid = uid;
        await listerAccount.save({ validateBeforeSave: false }).catch(() => null);
      }
      req.user = listerAccount;
      req.auth = {
        id: listerAccount._id,
        accountType: 'lister',
        role: 'lister',
        listerId: listerAccount.listerId || null,
      };
      req.firebaseClaims = decodedToken;
      attachPartnerIdentity(req, email || listerAccount.email);
      return next();
    }

    // Check User collection
    let user = await User.findOne({
      $or: [
        { firebaseUid: uid },
        ...(email ? [{ email }] : []),
      ],
    }).catch(() => null);

    if (user) {
      req.user = user;
      req.auth = {
        id: user._id,
        accountType: user.role === 'lister' ? 'lister' : user.role === 'admin' ? 'admin' : 'user',
        role: user.role || 'user',
        listerId: user.listerId || null,
      };
      req.firebaseClaims = decodedToken;
      attachPartnerIdentity(req, email || user.email);
      return next();
    }
  } catch (err) {
    console.warn('[AUTH] DB lookup exception in processFirebaseUser:', err.message);
  }

  // Virtual identity fallback ensuring valid tokens are accepted safely
  const partnerInfo = resolvePartnerIdentity(email);
  const fallbackRole = partnerInfo && partnerInfo.isLocked ? partnerInfo.role : 'user';
  const resolvedRole = (isAdminEmail && !isDevUnverified) ? 'admin' : fallbackRole;

  req.user = {
    _id: uid,
    firebaseUid: uid,
    email,
    fullName: decodedToken.name || (email ? email.split('@')[0] : 'User'),
    role: resolvedRole,
  };
  req.auth = {
    id: uid,
    accountType: resolvedRole,
    role: resolvedRole,
    listerId: resolvedRole === 'lister' ? uid : null,
  };
  req.firebaseClaims = decodedToken;
  attachPartnerIdentity(req, email);
  return next();
}

/**
 * Verify Firebase ID Token or legacy JWT
 */
const verifyFirebaseToken = asyncHandler(async (req, res, next) => {
  const token = extractBearerToken(req);
  if (!token) {
    throw new ApiError(401, "No token provided or invalid format. Expected 'Bearer <token>'");
  }

  // 1. First attempt Firebase ID Token verification via Admin SDK (Cryptographic verification)
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    return await processFirebaseUser(decodedToken, req, next, false);
  } catch (firebaseError) {
    // 2. Fallback: Check if it is a valid legacy JWT verified against server secret
    try {
      const secret = process.env.JWT_SECRET || (process.env.NODE_ENV !== 'production' ? 'fallback-secret' : null);
      if (!secret) {
        throw new Error('JWT_SECRET is required in production');
      }
      const decoded = jwt.verify(token, secret);
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
      attachPartnerIdentity(req, doc.email);
      return next();
    } catch (jwtError) {
      // 3. Development-only fallback for mock tokens or local emulators (NEVER in production)
      if (process.env.NODE_ENV === 'development') {
        try {
          const decoded = jwt.decode(token);
          if (decoded && (decoded.iss?.includes('securetoken.google.com') || decoded.firebase || decoded.email)) {
            if (decoded.exp && decoded.exp < Date.now() / 1000) {
              throw new ApiError(401, 'Unauthorized: Firebase token has expired');
            }
            return await processFirebaseUser(decoded, req, next, true /* isDevUnverified */);
          }
        } catch (decodeErr) {
          if (decodeErr instanceof ApiError) throw decodeErr;
        }
      }

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
  const role = req.user?.role || req.auth?.role;
  if (role === 'admin' || role === 'super-admin') {
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
