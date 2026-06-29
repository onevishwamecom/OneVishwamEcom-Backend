const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const {
  register, login, refreshTokenHandler, getMe, updateProfile,
  changePassword, forgotPassword, verifyOtp, resendOtp, resetPasswordWithOtp,
  deleteAccount, saveListing, getSavedListings,
} = require('../controllers/authController');

const router = express.Router();

router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('phone').trim().notEmpty().withMessage('Phone number is required')
      .matches(/^\+?[\d\s-]{10,15}$/).withMessage('Invalid phone number'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  validate,
  register
);

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  login
);

router.post(
  '/refresh',
  [body('refreshToken').notEmpty().withMessage('Refresh token is required')],
  validate,
  refreshTokenHandler
);

router.post(
  '/forgot-password',
  [body('email').isEmail().withMessage('Valid email is required')],
  validate,
  forgotPassword
);

router.post(
  '/verify-otp',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('otp').notEmpty().withMessage('OTP is required'),
  ],
  validate,
  verifyOtp
);

router.post(
  '/resend-otp',
  [body('email').isEmail().withMessage('Valid email is required')],
  validate,
  resendOtp
);

router.post(
  '/reset-password',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('verifyToken').notEmpty().withMessage('Verification token is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  validate,
  resetPasswordWithOtp
);

router.get('/me', protect, getMe);
router.put(
  '/profile',
  protect,
  [
    body('name').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
    body('phone').optional().trim().matches(/^\+?[\d\s-]{10,15}$/).withMessage('Invalid phone number'),
  ],
  validate,
  updateProfile
);

router.put(
  '/password',
  protect,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  ],
  validate,
  changePassword
);

router.delete('/account', protect, deleteAccount);

router.post('/save', protect, saveListing);
router.get('/saved', protect, getSavedListings);

module.exports = router;
