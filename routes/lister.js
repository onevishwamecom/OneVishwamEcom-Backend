const express = require('express');
const rateLimit = require('express-rate-limit');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { uploadProfileImage } = require('../middleware/uploadProfileImage');
const { sendOtpRules, verifyOtpRules, registerRules, loginRules, updateProfileRules } = require('../validators/listerValidator');
const { sendOtp, verifyOtp, register, login, getMe, updateProfile, uploadProfileImage: uploadProfileImageController, logout } = require('../controllers/listerController');

const router = express.Router();

// Rate limiters disabled for development - uncomment to re-enable
// const otpLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: Number(process.env.LISTER_SEND_OTP_LIMIT) || 1000,
//   message: { success: false, message: 'Too many OTP requests, please try again later' },
//   standardHeaders: true,
//   legacyHeaders: false,
// });
//
// const verifyOtpLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: Number(process.env.LISTER_VERIFY_OTP_LIMIT) || 1000,
//   message: { success: false, message: 'Too many verification attempts, please try again later' },
//   standardHeaders: true,
//   legacyHeaders: false,
// });
//
// const authLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: Number(process.env.LISTER_AUTH_LIMIT) || 1000,
//   message: { success: false, message: 'Too many attempts, please try again later' },
//   standardHeaders: true,
//   legacyHeaders: false,
// });

router.post('/send-otp', sendOtpRules, validate, sendOtp);
router.post('/verify-otp', verifyOtpRules, validate, verifyOtp);
router.post('/register', registerRules, validate, register);
router.post('/login', loginRules, validate, login);
router.post('/logout', logout);
router.get('/me', protect, getMe);
router.patch('/profile', protect, updateProfileRules, validate, updateProfile);
router.post('/profile/image', protect, uploadProfileImage.single('image'), uploadProfileImageController);

module.exports = router;
