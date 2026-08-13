const express = require('express');
const rateLimit = require('express-rate-limit');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { registerRules, loginRules, forgotPasswordRules, verifyOtpRules, resendOtpRules, resetPasswordRules, updateProfileRules, changePasswordRules } = require('../validators/authValidator');
const { register, login, logout, forgotPassword, verifyOtp, resendOtp, resetPassword, getMe, refresh, updateProfile, changePassword, deleteAccount } = require('../controllers/authController');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 100 : 10,
  message: { success: false, message: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 100 : 20,
  message: { success: false, message: 'Too many OTP requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 200 : 50,
  message: { success: false, message: 'Too many refresh requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/register', registerRules, validate, register);
router.post('/login', loginLimiter, loginRules, validate, login);
router.post('/refresh', refreshLimiter, refresh);
router.post('/logout', logout);
router.post('/forgot-password', otpLimiter, forgotPasswordRules, validate, forgotPassword);
router.post('/verify-otp', otpLimiter, verifyOtpRules, validate, verifyOtp);
router.post('/resend-otp', otpLimiter, resendOtpRules, validate, resendOtp);
router.post('/reset-password', resetPasswordRules, validate, resetPassword);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfileRules, validate, updateProfile);
router.put('/password', protect, changePasswordRules, validate, changePassword);
router.delete('/account', protect, deleteAccount);

module.exports = router;
