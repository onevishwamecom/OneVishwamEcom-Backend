const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  createListing,
  getMyListings,
  updateListing,
  deleteListing,
  toggleStatus,
} = require('../controllers/listingController');

const router = express.Router();

const listingValidation = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 100 }),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('category').isIn(['real-estate', 'vehicle', 'garment', 'grocery', 'jewellery', 'loan', 'service']),
  body('location.city').trim().notEmpty().withMessage('City is required'),
];

router.post('/', protect, upload.array('images', 10), listingValidation, validate, createListing);
router.get('/my', protect, getMyListings);
router.put('/:id', protect, upload.array('images', 10), updateListing);
router.delete('/:id', protect, deleteListing);
router.patch('/:id/status', protect, toggleStatus);

module.exports = router;
