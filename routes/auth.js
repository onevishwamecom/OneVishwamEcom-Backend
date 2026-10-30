const express = require('express');
const rateLimit = require('express-rate-limit');
const validate = require('../middleware/validate');
const { protect, verifyFirebaseToken, optionalAuth } = require('../middleware/auth');
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
    const { name, fullName, phoneNumber, mobile, phone: bodyPhone, role, avatar, profileImage, city, area, pincode, firebaseUid: bodyUid, email: bodyEmail } = req.body;
    const uid = req.firebaseClaims?.uid || req.user?.firebaseUid || (process.env.NODE_ENV !== 'production' ? bodyUid : null);
    const email = req.firebaseClaims?.email || req.user?.email || (process.env.NODE_ENV !== 'production' ? bodyEmail : null);

    if (!uid) {
      return res.status(400).json({
        success: false,
        message: 'Missing required identifier: firebaseUid',
      });
    }

    const phone = phoneNumber || mobile || bodyPhone || req.body.phone;
    const cleanEmail = email ? email.toLowerCase().trim() : undefined;
    const cleanPhone = phone ? String(phone).trim() : undefined;

    // Determine whether caller is targeting Lister or User
    const clientRoleHeader = (
      req.headers['x-client-role'] ||
      req.headers['x-account-type'] ||
      ''
    ).toLowerCase();
    const explicitRole = (role || '').toLowerCase();

    // Priority:
    // 1. If explicitRole is 'user' or clientRoleHeader is 'user' -> DEFINITELY a USER (users collection)
    // 2. If explicitRole is 'lister' -> LISTER (listers collection)
    // 3. If clientRoleHeader is 'lister' and explicitRole is not 'user' -> LISTER
    // 4. Default: USER (all consumer site logins/registrations go to users collection)
    const isUserExplicit = explicitRole === 'user' || clientRoleHeader === 'user';
    const isLister = !isUserExplicit && (explicitRole === 'lister' || clientRoleHeader === 'lister');

    if (isLister) {
      const bodyName = (name || fullName || req.body.displayName)?.trim();
      const displayName = bodyName || req.user?.name || req.user?.fullName || (cleanEmail ? cleanEmail.split('@')[0] : 'Lister');

      let lister = await Lister.findOne({
        $or: [
          { firebaseUid: uid },
          ...(cleanEmail ? [{ email: cleanEmail }] : []),
        ],
      });

      if (lister) {
        lister.firebaseUid = uid;
        if (cleanEmail) lister.email = cleanEmail;
        if (bodyName) {
          lister.name = bodyName;
        } else if (!lister.name || lister.name.includes('.')) {
          lister.name = displayName;
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

    // Clean up any accidental orphan record in Lister collection for this user
    // (e.g. created accidentally without phone or where listerId matches firebaseUid)
    if (uid || cleanEmail) {
      await Lister.deleteMany({
        $or: [
          ...(uid ? [{ firebaseUid: uid }] : []),
          ...(cleanEmail ? [{ email: cleanEmail }] : []),
        ],
        $and: [
          {
            $or: [
              { phone: { $in: [null, '', undefined] } },
              ...(uid ? [{ listerId: uid }] : []),
            ],
          },
        ],
      }).catch(() => null);
    }

    const resolvedName = (name || fullName || req.body.displayName)?.trim();
    const resolvedImage = profileImage || avatar;
    const now = new Date();
    const updateFields = {
      firebaseUid: uid,
      ...(cleanEmail && { email: cleanEmail }),
      ...(resolvedName && { name: resolvedName, fullName: resolvedName }),
      ...(cleanPhone && { phoneNumber: cleanPhone }),
      role: 'user',
      ...(resolvedImage && { avatar: resolvedImage, profileImage: resolvedImage }),
      ...(city && { city }),
      ...(area && { area }),
      ...(pincode && { pincode }),
      status: 'active',
      accountStatus: 'active',
      lastLogin: now,
      lastActiveAt: now,
    };

    // Check if another account with this email already exists to merge and prevent E11000 duplicate key error
    if (cleanEmail) {
      const userWithEmail = await User.findOne({
        email: new RegExp(`^${cleanEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      });

      if (userWithEmail && userWithEmail.firebaseUid !== uid) {
        await User.deleteMany({ firebaseUid: uid, _id: { $ne: userWithEmail._id } }).catch(() => null);
        Object.assign(userWithEmail, updateFields);
        userWithEmail.firebaseUid = uid;
        userWithEmail.loginCount = (userWithEmail.loginCount || 0) + 1;
        await userWithEmail.save({ validateBeforeSave: false });

        console.log(`[Auth Sync] Successfully merged user with email ${cleanEmail} to firebaseUid ${uid}`);
        return res.status(200).json({
          success: true,
          message: 'User profile linked and saved successfully',
          data: userWithEmail.toProfileJSON ? userWithEmail.toProfileJSON() : userWithEmail,
        });
      }
    }

    // Check if another account with this phone already exists to merge or prevent unhandled E11000 duplicate key error
    if (cleanPhone) {
      const userWithPhone = await User.findOne({
        $or: [{ phoneNumber: cleanPhone }, { phone: cleanPhone }, { mobile: cleanPhone }],
      });

      if (userWithPhone && userWithPhone.firebaseUid !== uid) {
        const isSameEmail =
          cleanEmail &&
          userWithPhone.email &&
          userWithPhone.email.toLowerCase() === cleanEmail.toLowerCase();
        const hasNoEmail = !userWithPhone.email || !cleanEmail;

        if (isSameEmail || hasNoEmail) {
          // Same user: Merge accounts and attach this Firebase UID
          await User.deleteMany({ firebaseUid: uid, _id: { $ne: userWithPhone._id } }).catch(() => null);

          Object.assign(userWithPhone, updateFields);
          userWithPhone.firebaseUid = uid;
          if (cleanEmail) userWithPhone.email = cleanEmail;
          userWithPhone.loginCount = (userWithPhone.loginCount || 0) + 1;
          await userWithPhone.save({ validateBeforeSave: false });

          console.log(`[Auth Sync] Successfully merged user with phone ${cleanPhone} to firebaseUid ${uid}`);

          return res.status(200).json({
            success: true,
            message: 'User profile linked and saved successfully',
            data: userWithPhone.toProfileJSON ? userWithPhone.toProfileJSON() : userWithPhone,
          });
        } else {
          // Phone belongs to another registered account
          return res.status(409).json({
            success: false,
            message: 'This mobile number is already registered with another account. Please use a different mobile number or log in with that account.',
          });
        }
      }
    }

    const user = await User.findOneAndUpdate(
      { firebaseUid: uid },
      {
        $set: updateFields,
        $unset: { phone: 1, mobile: 1 },
        $inc: { loginCount: 1 },
      },
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
    if (error.code === 11000 || error.message?.includes('E11000')) {
      if (error.message?.includes('mobile') || error.message?.includes('phoneNumber')) {
        return res.status(409).json({
          success: false,
          message: 'This mobile number is already registered with another account. Please use a different mobile number.',
          error: error.message,
        });
      }
      if (error.message?.includes('email')) {
        return res.status(409).json({
          success: false,
          message: 'This email is already registered with another account.',
          error: error.message,
        });
      }
    }
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to persist user in database',
      error: error.message,
    });
  }
});

// Activity Heartbeat endpoint to track user session & time spent on site
router.post('/heartbeat', optionalAuth, async (req, res) => {
  try {
    const uid = req.firebaseClaims?.uid || req.user?.firebaseUid;
    const { seconds = 30 } = req.body;
    // Cap seconds per ping between 1 and 120s to ensure realistic tracking
    const validSeconds = Math.min(120, Math.max(1, Number(seconds) || 30));

    if (!uid) {
      return res.status(200).json({ success: true, message: 'Ignored unauthenticated heartbeat' });
    }

    const now = new Date();
    const user = await User.findOneAndUpdate(
      { firebaseUid: uid },
      {
        $inc: { totalTimeSpent: validSeconds, sessionDuration: validSeconds },
        $set: { lastActiveAt: now },
      },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      data: {
        totalTimeSpent: user?.totalTimeSpent || 0,
        sessionDuration: user?.sessionDuration || 0,
        lastActiveAt: user?.lastActiveAt || now,
      },
    });
  } catch (err) {
    return res.status(200).json({ success: false, message: err.message });
  }
});

// Fetch full profile on page reload from MongoDB Atlas
router.get('/me', verifyFirebaseToken, async (req, res) => {
  try {
    let account = req.user;
    const uid = req.firebaseClaims?.uid || req.user?.firebaseUid;
    const email = (req.firebaseClaims?.email || req.user?.email || '').toLowerCase();
    const clientRole = (
      req.headers['x-client-role'] ||
      req.headers['x-account-type'] ||
      ''
    ).toLowerCase();

    if (clientRole === 'lister') {
      if (uid && (!account || !account._id || account.role !== 'lister' || !account.toListerJSON)) {
        account = (await Lister.findOne({ firebaseUid: uid })) ||
                  (await User.findOne({ firebaseUid: uid }));
      }
      if ((!account || account.role !== 'lister' || !account.toListerJSON) && email) {
        account = (await Lister.findOne({ email: new RegExp('^' + email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') })) ||
                  (await User.findOne({ email: new RegExp('^' + email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }));
        if (account && uid && !account.firebaseUid) {
          account.firebaseUid = uid;
          await account.save({ validateBeforeSave: false }).catch(() => null);
        }
      }
    } else {
      // Default / clientRole === 'user': Prioritize User collection
      if (uid && (!account || !account._id || account.role !== 'user' || !account.toProfileJSON)) {
        account = (await User.findOne({ firebaseUid: uid })) ||
                  (await Lister.findOne({ firebaseUid: uid }));
      }
      if ((!account || account.role !== 'user' || !account.toProfileJSON) && email) {
        account = (await User.findOne({ email: new RegExp('^' + email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') })) ||
                  (await Lister.findOne({ email: new RegExp('^' + email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }));
        if (account && uid && !account.firebaseUid) {
          account.firebaseUid = uid;
          await account.save({ validateBeforeSave: false }).catch(() => null);
        }
      }
    }

    if (!account) {
      return res.status(404).json({ success: false, message: 'User not found in MongoDB' });
    }

    const responseData = account.toProfileJSON
      ? account.toProfileJSON()
      : account.toListerJSON
      ? account.toListerJSON()
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
