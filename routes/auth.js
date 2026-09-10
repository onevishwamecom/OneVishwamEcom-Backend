const express = require('express');
const rateLimit = require('express-rate-limit');
const validate = require('../middleware/validate');
const { protect, verifyFirebaseToken } = require('../middleware/auth');
const User = require('../models/User');
const ApiResponse = require('../utils/ApiResponse');
const {
  registerRules,
  loginRules,
  forgotPasswordRules,
  verifyOtpRules,
  resendOtpRules,
  resetPasswordRules,
  updateProfileRules,
  changePasswordRules,
} = require('../validators/authValidator');
const {
  register,
  login,
  logout,
  forgotPassword,
  verifyOtp,
  resendOtp,
  resetPassword,
  getMe,
  refresh,
  updateProfile,
  changePassword,
  deleteAccount,
} = require('../controllers/authController');

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

// ─── Firebase Auth Sync & Me Endpoints ─────────────────────────────────────────

// Mandatory sync route - writes & updates authoritative copy in MongoDB Atlas
router.post('/sync', verifyFirebaseToken, async (req, res) => {
  try {
    const { fullName, phoneNumber, mobile, role, avatar, city, area, pincode, firebaseUid: bodyUid, email: bodyEmail } = req.body;
    const uid = req.firebaseClaims?.uid || req.user?.firebaseUid || bodyUid;
    const email = req.firebaseClaims?.email || req.user?.email || bodyEmail;

    if (!uid) {
      return res.status(400).json({
        success: false,
        message: 'Missing required identifier: firebaseUid',
      });
    }

    const phone = phoneNumber || mobile;

    const updateFields = {
      firebaseUid: uid,
      ...(email && { email: email.toLowerCase().trim() }),
      ...(fullName && { fullName: fullName.trim() }),
      ...(phone && { phoneNumber: phone.trim(), mobile: phone.trim() }),
      ...(role && ['user', 'lister'].includes(role) && { role }),
      ...(avatar && { avatar, profileImage: avatar }),
      ...(city && { city }),
      ...(area && { area }),
      ...(pincode && { pincode }),
      status: 'active',
      accountStatus: 'active',
    };

    const user = await User.findOneAndUpdate(
      { firebaseUid: uid },
      { $set: updateFields },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    console.log(`[Auth Sync] Successfully saved user ${email || uid} (${uid}) to MongoDB Atlas.`);

    return res.status(200).json({
      success: true,
      message: 'User saved to MongoDB Atlas successfully',
      data: user?.toProfileJSON ? user.toProfileJSON() : user,
    });
  } catch (error) {
    console.error('[Auth Sync Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to persist user in database',
      error: error.message,
    });
  }
});

// Fetch full profile on page reload from MongoDB Atlas
router.get('/me', verifyFirebaseToken, async (req, res) => {
  try {
    let user = req.user;
    if (req.firebaseClaims?.uid && !user) {
      user = await User.findOne({ firebaseUid: req.firebaseClaims.uid });
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found in MongoDB' });
    }

    return res.status(200).json({
      success: true,
      data: user.toProfileJSON ? user.toProfileJSON() : user,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Legacy / Compatibility Endpoints ──────────────────────────────────────────
router.post('/register', registerRules, validate, register);
router.post('/login', loginLimiter, loginRules, validate, login);
router.post('/refresh', refreshLimiter, refresh);
router.post('/logout', logout);
router.post('/forgot-password', otpLimiter, forgotPasswordRules, validate, forgotPassword);
router.post('/verify-otp', otpLimiter, verifyOtpRules, validate, verifyOtp);
router.post('/resend-otp', otpLimiter, resendOtpRules, validate, resendOtp);
router.post('/reset-password', resetPasswordRules, validate, resetPassword);
router.put('/profile', protect, updateProfileRules, validate, updateProfile);
router.put('/password', protect, changePasswordRules, validate, changePassword);
router.delete('/account', protect, deleteAccount);

module.exports = router;
