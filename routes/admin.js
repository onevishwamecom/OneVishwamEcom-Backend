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

/**
 * @openapi
 * /admin/auth/login:
 *   post:
 *     tags: [Admin]
 *     summary: Admin login
 *     description: Returns an admin access/refresh token pair. The first login against a database with no admins bootstraps a super-admin.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, format: password }
 *     responses:
 *       200:
 *         description: Tokens issued
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         accessToken: { type: string }
 *                         refreshToken: { type: string }
 *                         admin: { type: object, additionalProperties: true }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *
 * /admin/auth/logout:
 *   post:
 *     tags: [Admin]
 *     summary: Admin logout
 *     description: Revokes the supplied refresh token when present. Always returns 200.
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200: { description: Logged out, content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } }
 *
 * /admin/auth/refresh:
 *   post:
 *     tags: [Admin]
 *     summary: Rotate the admin refresh token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: New token pair
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         accessToken: { type: string }
 *                         refreshToken: { type: string }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *
 * /admin/auth/me:
 *   get:
 *     tags: [Admin]
 *     summary: Current admin profile
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     responses:
 *       200:
 *         description: Admin profile
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         admin: { type: object, additionalProperties: true }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *
 * /admin/listings:
 *   get:
 *     tags: [Admin]
 *     summary: All listings (moderation queue)
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     parameters:
 *       - { name: status, in: query, schema: { type: string, enum: [pending, approved, changes-required, cancelled, rejected] } }
 *       - { name: category, in: query, schema: { type: string } }
 *       - { name: listerId, in: query, schema: { type: string } }
 *       - { name: search, in: query, schema: { type: string } }
 *       - { name: page, in: query, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { name: limit, in: query, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
 *     responses:
 *       200: { description: Paginated listings, content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *
 * /admin/listings/pending:
 *   get:
 *     tags: [Admin]
 *     summary: Listings awaiting moderation
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     parameters:
 *       - { name: page, in: query, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { name: limit, in: query, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
 *       - { name: category, in: query, schema: { type: string } }
 *     responses:
 *       200: { description: Pending listings, content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *
 * /admin/listings/stats:
 *   get:
 *     tags: [Admin]
 *     summary: Listing counts by status and category
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     responses:
 *       200:
 *         description: Aggregate counts
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         total: { type: integer }
 *                         pending: { type: integer }
 *                         approved: { type: integer }
 *                         'changes-required': { type: integer }
 *                         cancelled: { type: integer }
 *                         byCategory: { type: object, additionalProperties: true }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *
 * /admin/listings/{type}/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Listing detail
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/ListingType'
 *       - $ref: '#/components/parameters/ListingId'
 *     responses:
 *       200: { description: Listing, content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   put:
 *     tags: [Admin]
 *     summary: Override a listing (full update)
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/ListingType'
 *       - $ref: '#/components/parameters/ListingId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, additionalProperties: true }
 *     responses:
 *       200: { description: Updated, content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   patch:
 *     tags: [Admin]
 *     summary: Override a listing (partial update)
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/ListingType'
 *       - $ref: '#/components/parameters/ListingId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, additionalProperties: true }
 *     responses:
 *       200: { description: Updated, content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   delete:
 *     tags: [Admin]
 *     summary: Delete a listing
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/ListingType'
 *       - $ref: '#/components/parameters/ListingId'
 *     responses:
 *       200: { description: Deleted, content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *
 * /admin/listings/{type}/{id}/status:
 *   put:
 *     tags: [Admin]
 *     summary: Set listing status
 *     description: Accepts `approved`, `rejected` (stored as `cancelled`), `changes-required` or `cancelled`. Extra body fields fall through to the full override handler.
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/ListingType'
 *       - $ref: '#/components/parameters/ListingId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [approved, rejected, changes-required, cancelled] }
 *               reason: { type: string }
 *     responses:
 *       200: { description: Status updated, content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *
 * /admin/listings/{type}/{id}/approve:
 *   patch:
 *     tags: [Admin]
 *     summary: Approve a listing
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/ListingType'
 *       - $ref: '#/components/parameters/ListingId'
 *     responses:
 *       200: { description: Approved, content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *
 * /admin/listings/{type}/{id}/changes:
 *   patch:
 *     tags: [Admin]
 *     summary: Request changes to a listing
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/ListingType'
 *       - $ref: '#/components/parameters/ListingId'
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string, description: Shown to the lister as `adminComment`. }
 *     responses:
 *       200: { description: Changes requested, content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *
 * /admin/listings/{type}/{id}/cancel:
 *   patch:
 *     tags: [Admin]
 *     summary: Cancel a listing
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/ListingType'
 *       - $ref: '#/components/parameters/ListingId'
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string }
 *     responses:
 *       200: { description: Cancelled, content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *
 * /admin/listings/{type}/{id}/availability:
 *   patch:
 *     tags: [Admin]
 *     summary: Set listing availability
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/ListingType'
 *       - $ref: '#/components/parameters/ListingId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [availabilityStatus]
 *             properties:
 *               availabilityStatus: { type: string, enum: [available, sold_out, inactive] }
 *     responses:
 *       200: { description: Availability updated, content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *
 * /admin/listings/{type}/{id}/images/reorder:
 *   patch:
 *     tags: [Admin]
 *     summary: Reorder listing images
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/ListingType'
 *       - $ref: '#/components/parameters/ListingId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               images: { type: array, items: { type: string, format: uri } }
 *               reorderedImages: { type: array, items: { type: string, format: uri } }
 *     responses:
 *       200: { description: Reordered, content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *
 * /admin/listings/{id}/images/reorder:
 *   patch:
 *     tags: [Admin]
 *     summary: Reorder images by id only
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               images: { type: array, items: { type: string, format: uri } }
 *     responses:
 *       200: { description: Reordered, content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *
 * /admin/products/{id}/images/reorder:
 *   patch:
 *     tags: [Admin]
 *     summary: Reorder images (legacy alias)
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               images: { type: array, items: { type: string, format: uri } }
 *     responses:
 *       200: { description: Reordered, content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *
 * /admin/contributors:
 *   get:
 *     tags: [Admin]
 *     summary: List contributors
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     parameters:
 *       - { name: search, in: query, schema: { type: string } }
 *       - { name: status, in: query, schema: { type: string } }
 *       - { name: page, in: query, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { name: limit, in: query, schema: { type: integer, minimum: 1, maximum: 100, default: 50 } }
 *     responses:
 *       200: { description: Paginated contributors, content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *
 * /admin/contributors/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Contributor detail
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Contributor, content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *
 * /admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: List website users
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     parameters:
 *       - { name: search, in: query, schema: { type: string } }
 *       - { name: status, in: query, schema: { type: string } }
 *       - { name: page, in: query, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { name: limit, in: query, schema: { type: integer, minimum: 1, maximum: 100, default: 50 } }
 *     responses:
 *       200: { description: Paginated users, content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *
 * /admin/users/stats:
 *   get:
 *     tags: [Admin]
 *     summary: Website user statistics
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     responses:
 *       200: { description: User stats, content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *
 * /admin/users/{id}/activity:
 *   get:
 *     tags: [Admin]
 *     summary: Activity feed for one user
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Activity, content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *
 * /admin/activity/stats:
 *   get:
 *     tags: [Admin]
 *     summary: Platform activity statistics
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     parameters:
 *       - { name: timeframe, in: query, schema: { type: string, default: all, enum: [all, today, week, month] } }
 *     responses:
 *       200: { description: Activity stats, content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *
 * /admin/activity/category-breakdown:
 *   get:
 *     tags: [Admin]
 *     summary: Activity broken down by category
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     parameters:
 *       - { name: timeframe, in: query, schema: { type: string, default: all, enum: [all, today, week, month] } }
 *     responses:
 *       200: { description: Category breakdown, content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */

// ─── Protected Admin Routes ─────────────────────────────────────────────────

router.use(protect, adminOnly);

// Prevent any browser/proxy caching of admin API responses
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

router.get('/auth/me', adminController.getMe);

// Listings
router.get('/listings/pending', adminController.getPendingListings);
router.get('/listings', adminController.getAllListings);
router.get('/listings/stats', adminController.getListingStats);
router.get('/listings/:type/:id', adminController.getListingDetail);
router.put('/listings/:type/:id', adminController.overrideListing);
router.patch('/listings/:type/:id', adminController.overrideListing);
router.put('/listings/:type/:id/status', adminController.updateListingStatus);
router.patch('/listings/:type/:id/approve', adminController.approveListing);
router.patch('/listings/:type/:id/changes', adminController.requestChanges);
router.patch('/listings/:type/:id/cancel', adminController.cancelListing);
router.patch('/listings/:type/:id/availability', adminController.updateAvailabilityStatus);
router.patch('/listings/:type/:id/images/reorder', adminController.reorderListingImages);
router.patch('/listings/:id/images/reorder', adminController.reorderListingImages);
router.patch('/products/:id/images/reorder', adminController.reorderListingImages);
router.delete('/listings/:type/:id', adminController.deleteListing);

// Contributors
router.get('/contributors', adminController.getContributors);
router.get('/contributors/:id', adminController.getContributorById);

// Website Users
router.get('/users/stats', adminController.getWebsiteUserStats);
router.get('/users', adminController.getWebsiteUsers);
router.get('/users/:id/activity', adminController.getUserActivity);

// Activity & Interest Tracking
router.get('/activity/stats', adminController.getActivityStats);
router.get('/activity/category-breakdown', adminController.getCategoryBreakdown);

module.exports = router;