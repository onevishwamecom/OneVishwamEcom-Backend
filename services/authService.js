const crypto = require('crypto');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const otpService = require('./otpService');
const emailService = require('./emailService');
const { RESET_TOKEN_EXPIRY_MINUTES } = require('../config/authConfig');

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

const getMe = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');
  return user.toProfileJSON();
};

module.exports = { register, login, forgotPassword, verifyOtp, resendOtp, resetPassword, getMe };
