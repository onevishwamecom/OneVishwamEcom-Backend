const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const listerService = require('../services/listerService');

const sendOtp = asyncHandler(async (req, res) => {
  const result = await listerService.sendOtpToPhone(req.body.phone);
  new ApiResponse(200, result, result.message).send(res);
});

const verifyOtp = asyncHandler(async (req, res) => {
  const result = await listerService.verifyOtpForPhone(req.body.phone, req.body.otp);
  new ApiResponse(200, result, 'OTP verified successfully').send(res);
});

const register = asyncHandler(async (req, res) => {
  const result = await listerService.registerLister(req.body);
  new ApiResponse(201, result, 'Registration successful').send(res);
});

const login = asyncHandler(async (req, res) => {
  const result = await listerService.listerLogin(req.body);
  new ApiResponse(200, result, 'Login successful').send(res);
});

const getMe = asyncHandler(async (req, res) => {
  const lister = await listerService.getListerMe(req.user._id);
  new ApiResponse(200, { lister }).send(res);
});

const updateProfile = asyncHandler(async (req, res) => {
  const lister = await listerService.updateListerProfile(req.user._id, req.body);
  new ApiResponse(200, { lister }, 'Profile updated successfully').send(res);
});

const uploadProfileImage = asyncHandler(async (req, res) => {
  const profileImage = await listerService.updateListerProfileImage(req.user._id, req.file);
  new ApiResponse(200, { profileImage }, 'Profile image updated successfully').send(res);
});

const logout = asyncHandler(async (req, res) => {
  await listerService.listerLogout(req.body);
  new ApiResponse(200, null, 'Logged out successfully').send(res);
});

module.exports = { sendOtp, verifyOtp, register, login, getMe, updateProfile, uploadProfileImage, logout };