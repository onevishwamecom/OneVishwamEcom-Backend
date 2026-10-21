const { body } = require('express-validator');

const createRules = [
  body('title').optional().trim().isLength({ max: 250 }),
  body('name').optional().trim().isLength({ max: 250 }),
  body('brand').trim().notEmpty().withMessage('Brand is required'),
  body('model').trim().notEmpty().withMessage('Model is required'),
  body('price').trim().notEmpty().withMessage('Price is required'),
  body('city').optional().trim(),
  body('category').optional().trim(),
  body('subcategory').optional().trim(),
  body('condition').optional().trim(),
];

const updateRules = [
  body('title').optional().trim().isLength({ max: 250 }),
  body('brand').optional().trim(),
  body('model').optional().trim(),
  body('price').optional().trim(),
];

module.exports = { createRules, updateRules };
