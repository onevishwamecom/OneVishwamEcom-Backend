const { body } = require('express-validator');
const { NAME_MIN_LENGTH, NAME_MAX_LENGTH, PHONE_REGEX } = require('../config/authConfig');

const updateProfileRules = [
  body('fullName').optional().trim()
    .isLength({ min: NAME_MIN_LENGTH, max: NAME_MAX_LENGTH })
    .withMessage(`Name must be between ${NAME_MIN_LENGTH} and ${NAME_MAX_LENGTH} characters`),
  body('mobile').optional().trim().matches(PHONE_REGEX).withMessage('Invalid mobile number'),
  body('city').optional().trim(),
  body('area').optional().trim(),
  body('pincode').optional().trim().matches(/^\d{6}$/).withMessage('Pincode must be 6 digits'),
];

module.exports = { updateProfileRules };
