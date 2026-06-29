const express = require('express');
const rateLimit = require('express-rate-limit');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const {
  registerRules,
  loginRules,
  refreshRules,
  forgotPasswordRules,
  verifyOtpRules,
  resendOtpRules,
  resetPasswordRules,
  updateProfileRules,
  changePasswordRules,
  saveListingRules,
} = require('../validators/authValidator');
const {
  register, login, refreshTokenHandler, getMe, updateProfile,
  changePassword, forgotPassword, verifyOtp, resendOtp, resetPasswordWithOtp,
  deleteAccount, saveListing, getSavedListings,
} = require('../controllers/authController');

const router = express.Router();

// Stricter rate limiter for OTP-related endpoints (20 requests per 15 minutes per IP, higher in tests)
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 100 : 20,
  message: { success: false, message: 'Too many OTP requests, please try again later' },
});

// ── Public auth routes ─────────────────────────────────────────────────────

router.post('/register', registerRules, validate, register);
router.post('/login', loginRules, validate, login);
router.post('/refresh', refreshRules, validate, refreshTokenHandler);

// ── Password reset flow ────────────────────────────────────────────────────

router.post('/forgot-password', otpLimiter, forgotPasswordRules, validate, forgotPassword);
router.post('/verify-otp', otpLimiter, verifyOtpRules, validate, verifyOtp);
router.post('/resend-otp', otpLimiter, resendOtpRules, validate, resendOtp);
router.post('/reset-password', resetPasswordRules, validate, resetPasswordWithOtp);

// ── Protected routes ───────────────────────────────────────────────────────

router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfileRules, validate, updateProfile);
router.put('/password', protect, changePasswordRules, validate, changePassword);
router.delete('/account', protect, deleteAccount);

// ── Saved listings ─────────────────────────────────────────────────────────

router.post('/save', protect, saveListingRules, validate, saveListing);
router.get('/saved', protect, getSavedListings);

module.exports = router;
