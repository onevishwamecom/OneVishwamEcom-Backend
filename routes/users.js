const express = require('express');
const { protect, optionalAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const upload = require('../middleware/upload');
const { updateProfileRules } = require('../validators/userValidator');
const { updateProfile, trackActivity } = require('../controllers/userController');

const router = express.Router();

router.put('/profile', protect, upload.single('profileImage'), updateProfileRules, validate, updateProfile);
router.post('/activity', optionalAuth, trackActivity);

module.exports = router;
