const express = require('express');
const rateLimit = require('express-rate-limit');
const validate = require('../middleware/validate');
const { protect, verifyFirebaseToken } = require('../middleware/auth');
const User = require('../models/User');
const Lister = require('../models/Lister');
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
    const isLister = role === 'lister' || req.auth?.accountType === 'lister' || req.user?.role === 'lister';

    if (isLister) {
      const cleanEmail = email ? email.toLowerCase().trim() : undefined;
      const cleanPhone = phone ? phone.trim() : undefined;
      const displayName = (fullName || req.user?.name || req.user?.fullName || (cleanEmail ? cleanEmail.split('@')[0] : 'Lister')).trim();

      let lister = await Lister.findOne({
        $or: [
          { firebaseUid: uid },
          ...(cleanEmail ? [{ email: cleanEmail }] : []),
        ],
      });

      if (lister) {
        lister.firebaseUid = uid;
        if (cleanEmail) lister.email = cleanEmail;
        if (displayName) {
          lister.name = displayName;
          lister.fullName = displayName;
        }
        if (cleanPhone) lister.phone = cleanPhone;
        if (city) lister.city = city;
        if (area) lister.area = area;
        if (pincode) lister.pincode = pincode;
        lister.status = 'ACTIVE';
        if (!lister.listerId) {
          lister.listerId = cleanPhone || uid;
        }
        await lister.save({ validateBeforeSave: false });
      } else {
        lister = await Lister.create({
          listerId: cleanPhone || uid,
          firebaseUid: uid,
          name: displayName,
          fullName: displayName,
          email: cleanEmail,
          phone: cleanPhone,
          city: city || '',
          area: area || '',
          pincode: pincode || '',
          status: 'ACTIVE',
          role: 'lister',
        });
      }

      console.log(`[Auth Sync] Successfully saved LISTER ${cleanEmail || uid} (${uid}) to MongoDB Atlas (listers collection).`);

      return res.status(200).json({
        success: true,
        message: 'Lister saved to MongoDB Atlas (listers collection) successfully',
        data: lister.toListerJSON ? lister.toListerJSON() : lister,
      });
    }

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
    let account = req.user;
    const uid = req.firebaseClaims?.uid || req.user?.firebaseUid;
    const email = (req.firebaseClaims?.email || req.user?.email || '').toLowerCase();

    if (uid && (!account || !account._id)) {
      account = (await Lister.findOne({ firebaseUid: uid })) ||
                (await User.findOne({ firebaseUid: uid }));
    }

    if (!account && email) {
      account = (await Lister.findOne({ email })) ||
                (await User.findOne({ email }));
    }

    if (!account) {
      return res.status(404).json({ success: false, message: 'User not found in MongoDB' });
    }

    const responseData = account.toListerJSON
      ? account.toListerJSON()
      : account.toProfileJSON
      ? account.toProfileJSON()
      : account;

    return res.status(200).json({
      success: true,
      data: responseData,
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
