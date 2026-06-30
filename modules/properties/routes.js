const express = require('express');
const { protect, adminOnly, optionalAuth } = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const upload = require('../../middleware/upload');
const { createRules, updateRules } = require('./validator');
const {
  getAll, getById, getFeatured, getLatest, getSimilar,
  create, update, remove, toggleStatus, getMyProperties,
} = require('./controller');

const router = express.Router();

router.get('/', getAll);
router.get('/featured', getFeatured);
router.get('/latest', getLatest);
router.get('/similar/:id', getSimilar);
router.get('/my', protect, getMyProperties);
router.get('/:id', optionalAuth, getById);

router.post('/', protect, upload.array('images', 10), createRules, validate, create);
router.put('/:id', protect, upload.array('images', 10), updateRules, validate, update);
router.delete('/:id', protect, remove);
router.patch('/:id/status', protect, toggleStatus);

module.exports = router;
