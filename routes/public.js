const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const {
  getBankLoans,
  createEnquiry,
  createReview,
  getUserReviews,
} = require('../controllers/publicController');

const router = express.Router();

router.get('/loans', getBankLoans);
router.get('/users/:userId/reviews', getUserReviews);

router.post(
  '/enquiries',
  protect,
  [body('propertyId').isMongoId(), body('message').trim().notEmpty().withMessage('Message is required')],
  validate,
  createEnquiry
);

router.post(
  '/reviews',
  protect,
  [
    body('reviewedUser').isMongoId(),
    body('rating').isInt({ min: 1, max: 5 }),
    body('comment').trim().notEmpty().withMessage('Comment is required'),
  ],
  validate,
  createReview
);

module.exports = router;
