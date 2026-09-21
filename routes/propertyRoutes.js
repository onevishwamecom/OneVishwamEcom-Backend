const express = require('express');
const { protect, adminOnly, optionalAuth } = require('../middleware/auth');
const validatePropertyListing = require('../middleware/validatePropertyListing');
const upload = require('../middleware/upload');
const {
  createProperty,
  getProperties,
  getPropertyById,
  updatePropertyStatus,
} = require('../controllers/propertyController');

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
// Property Endpoints (94-Question Specification & Marketplace Queries)
// ----------------------------------------------------------------------------

// POST /api/properties — Create new listing (Authenticated, validated, optional files)
router.post('/', protect, optionalUpload, validatePropertyListing, createProperty);

// GET /api/properties — Paginated list with filtering support
router.get('/', optionalAuth, getProperties);

// GET /api/properties/:id — Complete property details by ID
router.get('/:id', optionalAuth, getPropertyById);

// PATCH /api/properties/:id/status — Admin status update (approved / rejected)
router.patch('/:id/status', protect, adminOnly, updatePropertyStatus);

module.exports = router;

