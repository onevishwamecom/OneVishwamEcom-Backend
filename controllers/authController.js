const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Otp = require('../models/Otp');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { sendPasswordResetOtp } = require('../utils/sendEmail');

const register = asyncHandler(async (req, res) => {
  const { name, email, phone, password } = req.body;

  const existingEmail = await User.findOne({ email: email.toLowerCase() });
  if (existingEmail) throw new ApiError(409, 'Email already registered');

  const existingPhone = await User.findOne({ phone });
  if (existingPhone) throw new ApiError(409, 'Phone number already registered');

  const user = await User.create({ name, email, phone, password });
  const authResponse = await user.generateAuthResponse();

  new ApiResponse(201, authResponse, 'Registration successful').send(res);
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user) throw new ApiError(401, 'Invalid email or password');

  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw new ApiError(401, 'Invalid email or password');

  const authResponse = await user.generateAuthResponse();

  new ApiResponse(200, authResponse, 'Login successful').send(res);
});

const refreshTokenHandler = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw new ApiError(400, 'Refresh token is required');

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
  } catch {
    throw new ApiError(401, 'Invalid or expired refresh token');
  }

  const user = await User.findById(decoded.id).select('+refreshToken');
  if (!user || user.refreshToken !== refreshToken) {
    throw new ApiError(401, 'Refresh token revoked');
  }

  const newAccessToken = user.generateAccessToken();
  const newRefreshToken = user.generateRefreshToken();

  user.refreshToken = newRefreshToken;
  await user.save({ validateBeforeSave: false });

  new ApiResponse(200, { accessToken: newAccessToken, refreshToken: newRefreshToken }, 'Token refreshed').send(res);
});

const getMe = asyncHandler(async (req, res) => {
  new ApiResponse(200, { user: req.user.toAuthJSON() }).send(res);
});

const updateProfile = asyncHandler(async (req, res) => {
  const updates = {};
  if (req.body.name) updates.name = req.body.name;

  if (req.body.phone) {
    const existingPhone = await User.findOne({ phone: req.body.phone, _id: { $ne: req.user._id } });
    if (existingPhone) throw new ApiError(409, 'Phone number already registered');
    updates.phone = req.body.phone;
  }

  const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
  if (!user) throw new ApiError(404, 'User not found');

  new ApiResponse(200, { user: user.toAuthJSON() }, 'Profile updated').send(res);
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+password');
  if (!user) throw new ApiError(404, 'User not found');

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) throw new ApiError(400, 'Current password is incorrect');

  user.password = newPassword;
  await user.save();
  
  const { accessToken, refreshToken } = await user.generateAuthResponse();

  new ApiResponse(200, { accessToken, refreshToken }, 'Password changed successfully').send(res);
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return new ApiResponse(200, null, 'If an account exists for this email, a verification code has been sent.').send(res);
  }

  await Otp.updateMany({ email: email.toLowerCase(), isUsed: false }, { isUsed: true });

  const otp = Otp.generateOtp();
  const hashedOtp = Otp.hashOtp(otp);

  await Otp.create({
    email: email.toLowerCase(),
    otp: hashedOtp,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  });

  let emailed = false;
  try {
    await sendPasswordResetOtp(email, otp);
    emailed = true;
  } catch (err) {
    console.log(`[DEV] OTP for ${email}: ${otp}`);
  }

  const payload = process.env.NODE_ENV === 'development' && !emailed ? { otp } : undefined;
  new ApiResponse(200, payload, 'If an account exists for this email, a verification code has been sent.').send(res);
});

const verifyOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  const otpRecord = await Otp.findOne({
    email: email.toLowerCase(),
    isUsed: false,
  }).sort({ createdAt: -1 });

  if (!otpRecord) {
    throw new ApiError(400, 'No verification code found. Please request a new code.');
  }

  if (otpRecord.attempts >= 5) {
    otpRecord.isUsed = true;
    await otpRecord.save();
    throw new ApiError(400, 'Too many failed attempts. Please request a new code.');
  }

  if (otpRecord.expiresAt < new Date()) {
    otpRecord.isUsed = true;
    await otpRecord.save();
    throw new ApiError(400, 'Your verification code has expired. Please request a new code.');
  }

  const hashedInput = Otp.hashOtp(otp);
  if (otpRecord.otp !== hashedInput) {
    otpRecord.attempts += 1;
    await otpRecord.save();
    throw new ApiError(400, 'The verification code you entered is incorrect.');
  }

  otpRecord.isUsed = true;
  await otpRecord.save();

  const verifyToken = crypto.randomBytes(32).toString('hex');
  const hashedVerifyToken = crypto.createHash('sha256').update(verifyToken).digest('hex');

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) throw new ApiError(404, 'User not found');

  user.resetPasswordToken = hashedVerifyToken;
  user.resetPasswordExpire = Date.now() + 5 * 60 * 1000;
  await user.save({ validateBeforeSave: false });

  new ApiResponse(200, { verifyToken, message: 'Email verified successfully' }, 'OTP verified').send(res);
});

const resendOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return new ApiResponse(200, null, 'If an account exists for this email, a verification code has been sent.').send(res);
  }

  await Otp.updateMany({ email: email.toLowerCase(), isUsed: false }, { isUsed: true });

  const otp = Otp.generateOtp();
  const hashedOtp = Otp.hashOtp(otp);

  await Otp.create({
    email: email.toLowerCase(),
    otp: hashedOtp,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  });

  let emailed = false;
  try {
    await sendPasswordResetOtp(email, otp);
    emailed = true;
  } catch (err) {
    console.log(`[DEV] New OTP for ${email}: ${otp}`);
  }

  const payload = process.env.NODE_ENV === 'development' && !emailed ? { otp } : undefined;
  new ApiResponse(200, payload, 'A new verification code has been sent to your email.').send(res);
});

const resetPasswordWithOtp = asyncHandler(async (req, res) => {
  const { email, verifyToken, password } = req.body;

  const hashedToken = crypto.createHash('sha256').update(verifyToken).digest('hex');
  const user = await User.findOne({
    email: email.toLowerCase(),
    resetPasswordToken: hashedToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user) throw new ApiError(400, 'Invalid or expired verification. Please start the password reset process again.');

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_\-+=<>?/{}[\]~|]).{8,}$/;
  if (!passwordRegex.test(password)) {
    throw new ApiError(400,
      'Password must be at least 8 characters and contain an uppercase letter, a lowercase letter, a number, and a special character.'
    );
  }

  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  user.refreshToken = undefined;
  await user.save();

  await Otp.updateMany({ email: email.toLowerCase(), isUsed: false }, { isUsed: true });

  new ApiResponse(200, null, 'Your password has been changed successfully. You can now log in with your new password.').send(res);
});

const deleteAccount = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) throw new ApiError(404, 'User not found');

  await user.deleteOne();
  new ApiResponse(200, null, 'Account deleted permanently').send(res);
});

const saveListing = asyncHandler(async (req, res) => {
  const { listingId } = req.body;
  const user = await User.findById(req.user._id);

  if (!user) throw new ApiError(404, 'User not found');

  if (user.savedListings.includes(listingId)) {
    user.savedListings.pull(listingId);
    await user.save();
    return new ApiResponse(200, { saved: false }, 'Listing removed from saved').send(res);
  }

  user.savedListings.push(listingId);
  await user.save();
  new ApiResponse(200, { saved: true }, 'Listing saved').send(res);
});

const getSavedListings = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate('savedListings');
  if (!user) throw new ApiError(404, 'User not found');
  new ApiResponse(200, { listings: user.savedListings }).send(res);
});

module.exports = {
  register, login, refreshTokenHandler, getMe, updateProfile,
  changePassword, forgotPassword, verifyOtp, resendOtp, resetPasswordWithOtp,
  deleteAccount, saveListing, getSavedListings,
};
