const { body } = require('express-validator');

const createRules = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('city').trim().notEmpty().withMessage('City is required'),
  body('price').trim().notEmpty().withMessage('Price is required'),
  body('area').trim().notEmpty().withMessage('Area is required'),
  body('pincode').optional({ values: 'falsy' }).matches(/^\d{6}$/).withMessage('Pincode must be 6 digits'),
  body('contactName').optional().trim().notEmpty().withMessage('Contact name cannot be empty'),
  body('contactNumber').optional().trim().matches(/^\+?[\d\s-]{10,15}$/).withMessage('Invalid contact number'),
];

const updateRules = [
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
  body('pincode').optional({ values: 'falsy' }).matches(/^\d{6}$/).withMessage('Pincode must be 6 digits'),
];

module.exports = { createRules, updateRules };
