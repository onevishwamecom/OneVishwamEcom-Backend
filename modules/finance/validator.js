const { body } = require('express-validator');

const createRules = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }),
  body('price').trim().notEmpty().withMessage('Price is required'),
  body('city').trim().notEmpty().withMessage('City is required'),
  body('category').optional().trim(),
  body('interestRate').optional().isFloat({ min: 0, max: 100 }),
  body('tenure').optional().trim(),
];

const updateRules = [
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
];

module.exports = { createRules, updateRules };
