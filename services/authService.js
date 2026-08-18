const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Lister = require('../models/Lister');
const ApiError = require('../utils/ApiError');
const otpService = require('./otpService');
const emailService = require('./emailService');
const { resolveModel } = require('../middleware/auth');
const { RESET_TOKEN_EXPIRY_MINUTES } = require('../config/authConfig');

/**
 * Fetch the authenticated account's normalized JSON from the collection
 * implied by `accountType` ('user' -> users, 'lister' -> listers).
 */
const getAuthenticatedAccount = async ({ id, accountType }) => {
  const Model = resolveModel(accountType);
  const doc = await Model.findById(id);
  if (!doc) {
    throw new ApiError(404, accountType === 'lister' ? 'Lister not found' : 'User not found');
  }
  return accountType === 'lister' ? doc.toListerJSON() : doc.toProfileJSON();
};

const register = async ({ fullName, email, mobile, password }) => {
  const existingEmail = await User.findOne({ email: email.toLowerCase() });
  if (existingEmail) throw new ApiError(409, 'Email already registered');

  const existingMobile = await User.findOne({ mobile });
  if (existingMobile) throw new ApiError(409, 'Mobile number already registered');

  const user = await User.create({ fullName, email, mobile, password });
  return user.generateAuthResponse();
};

const login = async ({ email, password }) => {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user) throw new ApiError(401, 'Invalid email or password');

  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw new ApiError(401, 'Invalid email or password');

  if (user.accountStatus !== 'active') {
    throw new ApiError(403, 'Account is suspended. Please contact support.');
  }

  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  return user.generateAuthResponse();
};

const forgotPassword = async ({ email }) => {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return null;

  const otp = await otpService.createOtp(email);

  let emailed = false;
  try {
    await emailService.sendOtpEmail(email, otp);
    emailed = true;
  } catch {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV] OTP for ${email}: ${otp}`);
    }
  }

  if (process.env.NODE_ENV === 'development' && !emailed) return { otp };
  return undefined;
};

const verifyOtp = async ({ email, otp }) => {
  await otpService.verifyOtp(email, otp);

  const verifyToken = crypto.randomBytes(32).toString('hex');
  const hashedVerifyToken = crypto.createHash('sha256').update(verifyToken).digest('hex');

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) throw new ApiError(404, 'User not found');

  user.resetPasswordToken = hashedVerifyToken;
  user.resetPasswordExpire = Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000;
  await user.save({ validateBeforeSave: false });

  return { verifyToken };
};

const resendOtp = async ({ email }) => {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return null;

  await otpService.checkResendCooldown(email);

  const otp = await otpService.createOtp(email);

  let emailed = false;
  try {
    await emailService.sendOtpEmail(email, otp);
    emailed = true;
  } catch {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV] OTP for ${email}: ${otp}`);
    }
  }

  if (process.env.NODE_ENV === 'development' && !emailed) return { otp };
  return undefined;
};

const resetPassword = async ({ email, verifyToken, password }) => {
  const hashedToken = crypto.createHash('sha256').update(verifyToken).digest('hex');

  const user = await User.findOne({
    email: email.toLowerCase(),
    resetPasswordToken: hashedToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user) {
    throw new ApiError(400, 'Invalid or expired verification. Please start the password reset process again.');
  }

  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  user.refreshToken = undefined;
  await user.save();

  await otpService.invalidateOtps(email);
};

const getMe = async (auth) => {
  if (!auth || !auth.id) throw new ApiError(401, 'Not authorized');
  return getAuthenticatedAccount(auth);
};

const logout = async ({ refreshToken }) => {
  if (!refreshToken || typeof refreshToken !== 'string') {
    return;
  }
  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    const Model = resolveModel(payload.accountType || 'user');
    const account = await Model.findById(payload.id).select('+refreshToken');
    if (account && account.refreshToken === refreshToken) {
      account.refreshToken = undefined;
      await account.save({ validateBeforeSave: false });
    }
  } catch {
    // Token already invalid/reused; nothing to revoke
  }
};

const updateProfile = async (userId, updates) => {
  const allowed = ['fullName', 'mobile', 'city', 'area', 'pincode'];
  const data = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) data[key] = updates[key];
  }
  if (updates.profileImage !== undefined) data.profileImage = updates.profileImage;

  if (updates.notifications && typeof updates.notifications === 'object') {
    if (typeof updates.notifications.email === 'boolean') data['notifications.email'] = updates.notifications.email;
    if (typeof updates.notifications.whatsapp === 'boolean') data['notifications.whatsapp'] = updates.notifications.whatsapp;
  }

  if (data.mobile) {
    const existingMobile = await User.findOne({ mobile: data.mobile, _id: { $ne: userId } });
    if (existingMobile) throw new ApiError(409, 'Mobile number already registered');
  }

  const user = await User.findByIdAndUpdate(userId, data, { new: true, runValidators: true });
  if (!user) throw new ApiError(404, 'User not found');
  return user.toProfileJSON();
};

const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await User.findById(userId).select('+password');
  if (!user) throw new ApiError(404, 'User not found');

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) throw new ApiError(400, 'Current password is incorrect');

  user.password = newPassword;
  user.refreshToken = undefined;
  await user.save();

  return user.generateAuthResponse();
};

const deleteAccount = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');
  await user.deleteOne();
};

const refresh = async ({ refreshToken }) => {
  if (!refreshToken || typeof refreshToken !== 'string') {
    throw new ApiError(401, 'Refresh token is required');
  }

  let payload;
  try {
    payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
  } catch {
    throw new ApiError(401, 'Invalid or expired refresh token');
  }

  // New tokens carry accountType; legacy tokens fall back to User, then Lister.
  let accountType = payload.accountType;
  let account;
  if (accountType === 'user' || accountType === 'lister') {
    const Model = resolveModel(accountType);
    account = await Model.findById(payload.id).select('+refreshToken');
  } else {
    account = await User.findById(payload.id).select('+refreshToken');
    if (account) {
      accountType = 'user';
    } else {
      account = await Lister.findById(payload.id).select('+refreshToken');
      accountType = 'lister';
    }
  }

  if (!account) throw new ApiError(401, 'Authenticated account not found');

  if (account.refreshToken !== refreshToken) {
    account.refreshToken = undefined;
    await account.save({ validateBeforeSave: false });
    throw new ApiError(401, 'Refresh token reuse detected. All sessions have been revoked. Please log in again.');
  }

  if (accountType === 'user' && account.accountStatus !== 'active') {
    throw new ApiError(403, 'Account is suspended. Please contact support.');
  }
  if (accountType === 'lister' && account.status !== 'ACTIVE') {
    throw new ApiError(403, 'Account is suspended. Please contact support.');
  }

  const accessToken = account.generateAccessToken();
  const newRefreshToken = account.generateRefreshToken();
  account.refreshToken = newRefreshToken;
  await account.save({ validateBeforeSave: false });

  const json = accountType === 'lister' ? account.toListerJSON() : account.toProfileJSON();
  return accountType === 'lister'
    ? { accessToken, refreshToken: newRefreshToken, lister: json }
    : { accessToken, refreshToken: newRefreshToken, user: json };
};

module.exports = { register, login, logout, forgotPassword, verifyOtp, resendOtp, resetPassword, getMe, getAuthenticatedAccount, refresh, updateProfile, changePassword, deleteAccount };
