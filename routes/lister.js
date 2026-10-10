const express = require('express');
const rateLimit = require('express-rate-limit');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { uploadProfileImage } = require('../middleware/uploadProfileImage');
const { sendOtpRules, verifyOtpRules, registerRules, loginRules, updateProfileRules } = require('../validators/listerValidator');
const { sendOtp, verifyOtp, verifyFirebaseOtp, register, login, getMe, updateProfile, uploadProfileImage: uploadProfileImageController, logout } = require('../controllers/listerController');

const router = express.Router();

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 200 : (Number(process.env.LISTER_SEND_OTP_LIMIT) || 20),
  message: { success: false, message: 'Too many OTP requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const verifyOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 200 : (Number(process.env.LISTER_VERIFY_OTP_LIMIT) || 30),
  message: { success: false, message: 'Too many verification attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 200 : (Number(process.env.LISTER_AUTH_LIMIT) || 50),
  message: { success: false, message: 'Too many attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/send-otp', otpLimiter, sendOtpRules, validate, sendOtp);
router.post('/verify-otp', verifyOtpLimiter, verifyOtpRules, validate, verifyOtp);
router.post('/verify-firebase-otp', verifyOtpLimiter, verifyFirebaseOtp);
router.post('/register', authLimiter, registerRules, validate, register);
router.post('/login', authLimiter, loginRules, validate, login);
router.post('/logout', logout);
router.get('/me', protect, getMe);
router.patch('/profile', protect, updateProfileRules, validate, updateProfile);
router.post('/profile/image', protect, uploadProfileImage.single('image'), uploadProfileImageController);

module.exports = router;
