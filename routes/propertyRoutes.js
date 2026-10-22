const express = require('express');
const mongoose = require('mongoose');
const { protect, adminOnly, optionalAuth } = require('../middleware/auth');
const validatePropertyListing = require('../middleware/validatePropertyListing');
const validate = require('../middleware/validate');
const upload = require('../middleware/upload');
const uploadBrochure = require('../middleware/uploadBrochure');
const uploadFloorPlan = require('../middleware/uploadFloorPlan');
const {
  createProperty,
  getProperties,
  getPropertyById,
  updatePropertyStatus,
  resolveMapUrlController,
} = require('../controllers/propertyController');
const {
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
} = require('../modules/properties/controller');
const { updateRules } = require('../modules/properties/validator');

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
