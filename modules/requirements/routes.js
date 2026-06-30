const express = require('express');
const { protect, adminOnly, optionalAuth } = require('../../middleware/auth');
const ctrl = require('./controller');

const router = express.Router();

router.post('/', optionalAuth, ctrl.createRequirement);
router.get('/', protect, adminOnly, ctrl.getAllRequirements);

module.exports = router;
