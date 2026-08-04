const { body } = require('express-validator');

const createRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 200 }),
  body('price').trim().notEmpty().withMessage('Price is required'),
  body('city').trim().notEmpty().withMessage('City is required'),
  body('category').optional().trim(),
  body('material').optional().trim(),
  body('purity').optional().trim(),
  body('weight').optional().isFloat({ min: 0 }),
  body('weightUnit').optional().trim(),
  body('occasion').optional().trim(),
  body('images').optional().isArray({ min: 1 }).withMessage('At least one image is required'),
  body('images.*').optional().isURL().withMessage('Image must be a valid URL'),
];

const updateRules = [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
];

module.exports = { createRules, updateRules };