const express = require('express');
const rateLimit = require('express-rate-limit');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { registerRules, loginRules, forgotPasswordRules, verifyOtpRules, resendOtpRules, resetPasswordRules } = require('../validators/authValidator');
const { register, login, logout, forgotPassword, verifyOtp, resendOtp, resetPassword, getMe } = require('../controllers/authController');

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

router.post('/register', registerRules, validate, register);
router.post('/login', loginLimiter, loginRules, validate, login);
router.post('/logout', logout);
router.post('/forgot-password', otpLimiter, forgotPasswordRules, validate, forgotPassword);
router.post('/verify-otp', otpLimiter, verifyOtpRules, validate, verifyOtp);
router.post('/resend-otp', otpLimiter, resendOtpRules, validate, resendOtp);
router.post('/reset-password', resetPasswordRules, validate, resetPassword);
router.get('/me', protect, getMe);

module.exports = router;
