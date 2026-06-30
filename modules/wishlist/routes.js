const express = require('express');
const { protect } = require('../../middleware/auth');
const ctrl = require('./controller');

const router = express.Router();

router.get('/', protect, ctrl.getWishlist);
router.post('/', protect, ctrl.addToWishlist);
router.delete('/:id', protect, ctrl.removeFromWishlist);

module.exports = router;
