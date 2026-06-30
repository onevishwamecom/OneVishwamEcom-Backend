const express = require('express');
const { protect } = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const upload = require('../../middleware/upload');
const ctrl = require('./controller');
const { createRules, updateRules } = require('./validator');

const router = express.Router();

router.get('/', ctrl.getAll);
router.get('/my', protect, ctrl.getMy);
router.get('/:id', ctrl.getById);
router.post('/', protect, upload.array('images', 10), createRules, validate, ctrl.create);
router.put('/:id', protect, upload.array('images', 10), updateRules, validate, ctrl.update);
router.delete('/:id', protect, ctrl.remove);

module.exports = router;
