const { body } = require('express-validator');

const createRules = [
  body('title').optional().trim().notEmpty().withMessage('Title is required'),
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('brand').optional().trim().notEmpty().withMessage('Brand is required'),
  body('price').trim().notEmpty().withMessage('Price is required'),
  body('location').optional().trim(),
  body('city').optional().trim(),
  body('pincode').optional().trim(),
];

const updateRules = [
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('price').optional().trim().notEmpty().withMessage('Price cannot be empty'),
];

module.exports = { createRules, updateRules };
