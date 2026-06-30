const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/authService');

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  new ApiResponse(201, result, 'Registration successful').send(res);
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  new ApiResponse(200, result, 'Login successful').send(res);
});

const logout = asyncHandler(async (req, res) => {
  new ApiResponse(200, null, 'Logged out successfully').send(res);
});

const forgotPassword = asyncHandler(async (req, res) => {
  const devPayload = await authService.forgotPassword(req.body);
  new ApiResponse(200, devPayload, 'If an account exists for this email, a verification code has been sent.').send(res);
});

const verifyOtp = asyncHandler(async (req, res) => {
  const result = await authService.verifyOtp(req.body);
  new ApiResponse(200, result, 'OTP verified successfully').send(res);
});

const resendOtp = asyncHandler(async (req, res) => {
  const devPayload = await authService.resendOtp(req.body);
  new ApiResponse(200, devPayload, 'A new verification code has been sent to your email.').send(res);
});

const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body);
  new ApiResponse(200, null, 'Your password has been changed successfully.').send(res);
});

const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.user._id);
  new ApiResponse(200, { user }).send(res);
});

module.exports = { register, login, logout, forgotPassword, verifyOtp, resendOtp, resetPassword, getMe };
