const express = require('express');
const { protect, adminOnly } = require('../../middleware/auth');
const { getAll, getById, create, update, remove, toggleStatus } = require('./controller');

const router = express.Router();

router.get('/', getAll);
router.get('/:id', getById);
router.post('/', protect, adminOnly, create);
router.put('/:id', protect, adminOnly, update);
router.patch('/:id', protect, adminOnly, update);
router.delete('/:id', protect, adminOnly, remove);
router.patch('/:id/status', protect, adminOnly, toggleStatus);

module.exports = router;
