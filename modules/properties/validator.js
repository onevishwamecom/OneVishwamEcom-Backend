const { body } = require('express-validator');

const createRules = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }),
  body('pincode').optional({ values: 'falsy' }).matches(/^\d{6}$/).withMessage('Pincode must be 6 digits'),
  body('projectCount').optional().isInt({ min: 0 }).toInt(),
  body('totalUnits').optional().isInt({ min: 0 }).toInt(),
  body('availableUnits').optional().isInt({ min: 0 }).toInt(),
];

const updateRules = [
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
  body('pincode').optional({ values: 'falsy' }).matches(/^\d{6}$/).withMessage('Pincode must be 6 digits'),
];

module.exports = { createRules, updateRules };
