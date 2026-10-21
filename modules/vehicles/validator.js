const { body } = require('express-validator');

const VALID_CATEGORIES = [
  '2-wheeler', '3-wheeler', '4-wheeler', 'commercial',
  'car', 'bike', 'hatchback', 'suv', 'sedan', 'muv', 'van',
  'electric vehicle', 'auto rickshaw', 'commercial vehicle',
];
const VALID_CONDITIONS = ['new', 'old', 'brand-new', 'used', 'Used - Excellent', 'Used - Good', 'Used - Fair'];
const VALID_STATUS = ['active', 'inactive', 'sold', 'pending', 'approved', 'changes-required', 'cancelled'];
const VALID_FUEL_TYPES = ['Petrol', 'Diesel', 'Electric', 'CNG', 'Hybrid', 'petrol', 'diesel', 'electric', 'cng', 'hybrid'];
const VALID_TRANSMISSIONS = ['Manual', 'Automatic', 'Automatic (AGS / AMT)', 'Automatic (Torque Converter)', 'CVT', 'DCT', 'AMT', 'AGS', 'manual', 'automatic'];

const createRules = [
  body('brand').optional().trim().isLength({ min: 1, max: 100 }),
  body('make').optional().trim().isLength({ min: 1, max: 100 }),
  body('model').trim().notEmpty().withMessage('Model is required'),
  body('year').optional().isInt({ min: 1950, max: new Date().getFullYear() + 2 }),
  body('condition').optional(),
  body('category').optional(),
  body('bodyType').optional(),
  body('fuelType').optional(),
  body('price').trim().notEmpty().withMessage('Price is required'),
  body('priceValue').optional().isFloat({ min: 0 }),
  body('kmDriven').optional().isInt({ min: 0 }),
  body('mileage').optional(),
  body('loanApproved').optional(),
  body('location').optional().trim(),
  body('city').optional().trim(),
  body('pincode').optional().trim(),
  body('images').optional().isArray(),
  body('showroom').optional(),
  body('variants').optional(),
  body('features').optional(),
  body('transmission').optional(),
  body('status').optional().isIn(VALID_STATUS),
  body('listedBy').optional(),
];

const updateRules = [
  body('brand').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Brand must be 1-100 characters'),
  body('make').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Make must be 1-100 characters'),
  body('model').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Model must be 1-100 characters'),
  body('year').optional().isInt({ min: 1950, max: new Date().getFullYear() + 2 }).withMessage('Invalid year'),
  body('condition').optional(),
  body('category').optional(),
  body('bodyType').optional(),
  body('fuelType').optional(),
  body('priceValue').optional().isFloat({ min: 0 }),
  body('images').optional().isArray(),
  body('transmission').optional(),
  body('status').optional().isIn(VALID_STATUS),
  body('listedBy').optional(),
];

module.exports = { createRules, updateRules };
