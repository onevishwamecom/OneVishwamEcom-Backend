const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Lister = require('../models/Lister');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Resolve which collection a token belongs to using the explicit
 * `accountType` claim (added to new tokens). Falls back to the legacy `role`
 * claim for backward compatibility. Never guesses from fields like email.
 */
function resolveAccountType(decoded) {
  if (decoded.accountType === 'user' || decoded.accountType === 'lister') {
    return decoded.accountType;
  }
  return decoded.role === 'lister' ? 'lister' : 'user';
}

function resolveModel(accountType) {
  return accountType === 'lister' ? Lister : User;
}

function extractBearerToken(req) {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    return req.headers.authorization.split(' ')[1];
  }
  return null;
}

async function attachAuthenticatedAccount(req, token) {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const accountType = resolveAccountType(decoded);
  const Model = resolveModel(accountType);
  const doc = await Model.findById(decoded.id).select('-password');

  if (!doc) {
    throw new ApiError(401, 'Authenticated account not found');
  }

  // Identity + account type used by controllers/services to pick a collection.
  req.auth = {
    id: doc._id,
    accountType,
    role: decoded.role || (accountType === 'lister' ? 'lister' : doc.role),
    listerId: doc.listerId || null,
  };
  // req.user is kept for existing controllers that already use it.
  req.user = doc;
  req.user.role = req.auth.role;
}

const protect = asyncHandler(async (req, res, next) => {
  const token = extractBearerToken(req);
  if (!token) {
    throw new ApiError(401, 'Not authorized, no token provided');
  }

  try {
    await attachAuthenticatedAccount(req, token);
    next();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      throw new ApiError(401, 'Not authorized, token invalid or expired');
    }
    throw new ApiError(401, 'Not authorized');
  }
});

const optionalAuth = asyncHandler(async (req, res, next) => {
  const token = extractBearerToken(req);
  if (token) {
    try {
      await attachAuthenticatedAccount(req, token);
    } catch {
      // Token invalid, continue without user
    }
  }
  next();
});

const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  next(new ApiError(403, 'Not authorized as admin'));
};

module.exports = { protect, optionalAuth, adminOnly, resolveAccountType, resolveModel };
