const express = require('express');
const mongoose = require('mongoose');
const { protect, adminOnly, optionalAuth } = require('../../middleware/auth');
const validatePropertyListing = require('../../middleware/validatePropertyListing');
const validate = require('../../middleware/validate');
const upload = require('../../middleware/upload');
const uploadBrochure = require('../../middleware/uploadBrochure');
const uploadFloorPlan = require('../../middleware/uploadFloorPlan');
const {
  createProperty,
  getProperties,
  getPropertyById,
  updatePropertyStatus,
  resolveMapUrlController,
  getFeatured,
  getLatest,
  getSimilar,
  getMyProperties,
  update,
  remove,
  toggleStatus,
  uploadBrochure: uploadBrochureHandler,
  uploadFloorPlanImages,
  uploadFloorPlanPdf,
  uploadFloorPlan: uploadFloorPlanHandler,
  deleteFloorPlanImage,
  deleteFloorPlanPdf,
} = require('./controller');
const { updateRules } = require('./validator');

const router = express.Router();

/**
 * Middleware that handles multipart upload if content-type is multipart/form-data,
 * otherwise transparently passes JSON requests through.
 */
function optionalUpload(req, res, next) {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    try {
      return upload.array('images', 10)(req, res, next);
    } catch (err) {
      return next(err);
    }
  }
  next();
}

// ----------------------------------------------------------------------------
// Property Endpoints
// ----------------------------------------------------------------------------

/**
 * @openapi
 * /product/properties:
 *   get:
 *     tags: [Products]
 *     summary: List properties
 *     description: |
 *       Public paginated search. Any query parameter not listed here is applied as an
 *       exact-match Mongo filter (e.g. `bedrooms=3`). Returns `{ items, pagination }`.
 *     security:
 *       - {}
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     parameters:
 *       - { name: q, in: query, schema: { type: string }, description: 'Search over title, description, city, area, location and subtitle.' }
 *       - { name: page, in: query, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { name: limit, in: query, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
 *       - { name: sort, in: query, schema: { type: string, enum: [latest, oldest, price-low, price-high, area-low, area-high, viewed], default: latest } }
 *       - { name: priceMin, in: query, schema: { type: number } }
 *       - { name: priceMax, in: query, schema: { type: number } }
 *       - { name: areaMin, in: query, schema: { type: number } }
 *       - { name: areaMax, in: query, schema: { type: number } }
 *       - { name: listedWithin, in: query, schema: { type: string, enum: [Today, Last 3 Days, Last 7 Days, Last 30 Days] } }
 *       - { name: city, in: query, schema: { type: string } }
 *       - { name: propertyType, in: query, schema: { $ref: '#/components/schemas/PropertyType' } }
 *       - { name: purpose, in: query, schema: { type: string, enum: [Sell, Rent, Lease] } }
 *       - { name: amenities, in: query, schema: { type: string }, description: 'Comma-separated list; every amenity must match.' }
 *     responses:
 *       200:
 *         description: Paginated properties
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
 *                         items: { type: array, items: { $ref: '#/components/schemas/Property' } }
 *                         pagination: { $ref: '#/components/schemas/Pagination' }
 *       503: { $ref: '#/components/responses/ServiceUnavailable' }
 *   post:
 *     tags: [Products]
 *     summary: Create a property listing
 *     description: |
 *       Accepts JSON or `multipart/form-data` (field `images`, max 10). New listings start
 *       as `pending`; in-house accounts (`@onevishwam.com`, role `in_house`) are marked
 *       priority/featured automatically.
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PropertyInput' }
 *         multipart/form-data:
 *           schema: { $ref: '#/components/schemas/PropertyInput' }
 *     responses:
 *       201:
 *         description: Listing created
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
 *                         item: { $ref: '#/components/schemas/Property' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *
 * /product/properties/{id}:
 *   get:
 *     tags: [Products]
 *     summary: Get a property
 *     description: Public. Increments `viewsCount` and returns 404 for invalid or non-public ids.
 *     security:
 *       - {}
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Property
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
 *                         item: { $ref: '#/components/schemas/Property' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   put:
 *     tags: [Products]
 *     summary: Update a property
 *     description: Owner or admin. Multipart `images` are appended unless `replaceImages=true`.
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema: { $ref: '#/components/schemas/PropertyInput' }
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PropertyInput' }
 *     responses:
 *       200:
 *         description: Updated property
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
 *                         item: { $ref: '#/components/schemas/Property' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   delete:
 *     tags: [Products]
 *     summary: Soft-delete a property
 *     description: Owner or admin. Soft-deletes by setting the status to `deleted` instead of removing the document.
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Deleted, content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *
 * /product/properties/featured:
 *   get:
 *     tags: [Products]
 *     summary: Featured properties
 *     description: Up to 6 approved/active properties flagged as featured.
 *     responses:
 *       200:
 *         description: Featured properties
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
 *                         items: { type: array, items: { $ref: '#/components/schemas/Property' } }
 *
 * /product/properties/latest:
 *   get:
 *     tags: [Products]
 *     summary: Latest properties
 *     parameters:
 *       - { name: limit, in: query, schema: { type: integer, minimum: 1, maximum: 20, default: 6 } }
 *     responses:
 *       200:
 *         description: Latest properties
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
 *                         items: { type: array, items: { $ref: '#/components/schemas/Property' } }
 *
 * /product/properties/similar/{id}:
 *   get:
 *     tags: [Products]
 *     summary: Similar properties
 *     description: Up to 4 approved properties sharing the city or area of the given property.
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Similar properties
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
 *                         items: { type: array, items: { $ref: '#/components/schemas/Property' } }
 *       404: { $ref: '#/components/responses/NotFound' }
 *
 * /product/properties/my:
 *   get:
 *     tags: [Products]
 *     summary: My properties
 *     description: Properties owned by, or attributed to, the authenticated account.
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     responses:
 *       200:
 *         description: Owned properties
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
 *                         items: { type: array, items: { $ref: '#/components/schemas/Property' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *
 * /product/properties/resolve-map-url:
 *   get:
 *     tags: [Products]
 *     summary: Resolve a Google Maps URL
 *     description: Converts a share/place URL into an embeddable map URL used for `mapUrl`.
 *     parameters:
 *       - { name: url, in: query, required: true, schema: { type: string, format: uri } }
 *     responses:
 *       200:
 *         description: Resolved URL
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
 *                         mapUrl: { type: string }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *
 * /product/properties/{id}/status:
 *   patch:
 *     tags: [Products]
 *     summary: Set property status (admin)
 *     description: Admin only. Used by the moderation queue.
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
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, approved, rejected, active, changes-required, cancelled, inactive, sold, rented]
 *     responses:
 *       200:
 *         description: Status updated
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
 *                         item: { $ref: '#/components/schemas/Property' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *
 * /product/properties/{id}/toggle-status:
 *   patch:
 *     tags: [Products]
 *     summary: Toggle property active/inactive
 *     description: Owner or admin. Flips `active` ↔ `inactive`, defaulting other statuses to `active`.
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Status toggled
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
 *                         item: { $ref: '#/components/schemas/Property' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *
 * /product/properties/{id}/brochure:
 *   post:
 *     tags: [Products]
 *     summary: Upload a brochure
 *     description: Owner or admin. Stores the PDF and sets `pdfUrl` / `brochure` on the property.
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [brochure]
 *             properties:
 *               brochure: { type: string, format: binary }
 *     responses:
 *       200: { description: Brochure uploaded, content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *
 * /product/properties/{id}/floor-plan-images:
 *   post:
 *     tags: [Products]
 *     summary: Upload floor-plan images
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               floorPlanImages:
 *                 type: array
 *                 maxItems: 10
 *                 items: { type: string, format: binary }
 *     responses:
 *       200: { description: Images uploaded, content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *   delete:
 *     tags: [Products]
 *     summary: Remove a floor-plan image
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
 *             required: [imageUrl]
 *             properties:
 *               imageUrl: { type: string, format: uri }
 *     responses:
 *       200: { description: Image removed, content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *
 * /product/properties/{id}/floor-plan-pdf:
 *   post:
 *     tags: [Products]
 *     summary: Upload a floor-plan PDF
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [floorPlanPdf]
 *             properties:
 *               floorPlanPdf: { type: string, format: binary }
 *     responses:
 *       200: { description: PDF uploaded, content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *   delete:
 *     tags: [Products]
 *     summary: Remove the floor-plan PDF
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: PDF removed, content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *
 * /product/properties/{id}/floor-plan:
 *   post:
 *     tags: [Products]
 *     summary: Upload floor-plan files (alias)
 *     description: Alias of `/properties/{id}/floor-plan-images` that accepts up to 10 `floorPlans` files.
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               floorPlans:
 *                 type: array
 *                 maxItems: 10
 *                 items: { type: string, format: binary }
 *     responses:
 *       200: { description: Files uploaded, content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */

// Static & sub-resource endpoints (declared before parameterized /:id)
router.get('/resolve-map-url', resolveMapUrlController);
router.get('/featured', getFeatured);
router.get('/latest', getLatest);
router.get('/similar/:id', getSimilar);
router.get('/my', protect, getMyProperties);

// Root endpoints
router.post('/', protect, optionalUpload, validatePropertyListing, createProperty);
router.get('/', optionalAuth, getProperties);

// Brochure & Floor Plan sub-routes
router.post('/:id/brochure', protect, uploadBrochure.single('brochure'), uploadBrochureHandler);
router.post('/:id/floor-plan-images', protect, uploadFloorPlan.array('floorPlanImages', 10), uploadFloorPlanImages);
router.post('/:id/floor-plan-pdf', protect, uploadFloorPlan.single('floorPlanPdf'), uploadFloorPlanPdf);
router.post('/:id/floor-plan', protect, uploadFloorPlan.array('floorPlans', 10), uploadFloorPlanHandler);
router.delete('/:id/floor-plan-images', protect, deleteFloorPlanImage);
router.delete('/:id/floor-plan-pdf', protect, deleteFloorPlanPdf);

// Status updates
router.patch('/:id/status', protect, adminOnly, updatePropertyStatus);
router.patch('/:id/toggle-status', protect, toggleStatus);

// Single property item endpoints
router.get('/:id', (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(404).json({
      success: false,
      message: 'Property not found or invalid identifier format',
    });
  }
  optionalAuth(req, res, () => getPropertyById(req, res, next));
});

router.put('/:id', protect, upload.array('images', 10), updateRules, validate, update);
router.delete('/:id', protect, remove);

module.exports = router;
