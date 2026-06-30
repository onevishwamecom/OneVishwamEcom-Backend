const { body } = require('express-validator');

const createRules = [
  body('title').optional().trim().isLength({ max: 200 }),
  body('make').trim().notEmpty().withMessage('Make is required'),
  body('model').trim().notEmpty().withMessage('Model is required'),
  body('price').trim().notEmpty().withMessage('Price is required'),
  body('location').trim().notEmpty().withMessage('Location is required'),
  body('city').trim().notEmpty().withMessage('City is required'),
  body('year').optional().isInt({ min: 1900, max: 2030 }),
  body('mileage').optional().trim(),
  body('fuelType').optional().isIn(['Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG', 'LPG']),
  body('transmission').optional().isIn(['Manual', 'Automatic']),
  body('condition').optional().isIn(['New', 'Used']),
];

const updateRules = [
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
  body('year').optional().isInt({ min: 1900, max: 2030 }),
];

module.exports = { createRules, updateRules };
