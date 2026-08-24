const express = require('express');
const { protect, adminOnly } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { body } = require('express-validator');
const adminController = require('../controllers/adminController');

const router = express.Router();

// ─── Admin Auth ─────────────────────────────────────────────────────────────

router.post(
  '/auth/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  adminController.login
);

router.post('/auth/logout', adminController.logout);

router.post(
  '/auth/refresh',
  [body('refreshToken').notEmpty().withMessage('Refresh token is required')],
  validate,
  adminController.refresh
);

// ─── Protected Admin Routes ─────────────────────────────────────────────────

router.use(protect, adminOnly);

router.get('/auth/me', adminController.getMe);

// Listings
router.get('/listings/pending', adminController.getPendingListings);
router.get('/listings', adminController.getAllListings);
router.get('/listings/stats', adminController.getListingStats);
router.get('/listings/:type/:id', adminController.getListingDetail);
router.put('/listings/:type/:id/status', adminController.updateListingStatus);
router.patch('/listings/:type/:id/approve', adminController.approveListing);
router.patch('/listings/:type/:id/changes', adminController.requestChanges);
router.patch('/listings/:type/:id/cancel', adminController.cancelListing);
router.delete('/listings/:type/:id', adminController.deleteListing);

// Contributors
router.get('/contributors', adminController.getContributors);
router.get('/contributors/:id', adminController.getContributorById);

module.exports = router;