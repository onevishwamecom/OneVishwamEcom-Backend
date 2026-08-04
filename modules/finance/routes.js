const express = require('express');
const { protect } = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const { createRules, updateRules } = require('./validator');
const { getAll, getById, getSimilar, create, update, remove, toggleStatus, getMy } = require('./controller');

const router = express.Router();

router.get('/', getAll);
router.get('/my', protect, getMy);
router.get('/similar/:id', getSimilar);
router.get('/:id', getById);
router.post('/', protect, createRules, validate, create);
router.put('/:id', protect, updateRules, validate, update);
router.delete('/:id', protect, remove);
router.patch('/:id/status', protect, toggleStatus);

module.exports = router;