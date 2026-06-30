const express = require('express');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const upload = require('../middleware/upload');
const { updateProfileRules } = require('../validators/userValidator');
const { updateProfile } = require('../controllers/userController');

const router = express.Router();

router.put('/profile', protect, upload.single('profileImage'), updateProfileRules, validate, updateProfile);

module.exports = router;
