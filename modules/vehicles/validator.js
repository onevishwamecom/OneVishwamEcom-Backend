const { body } = require('express-validator');

const VALID_CATEGORIES = ['2-wheeler', '3-wheeler', '4-wheeler', 'commercial'];
const VALID_FUEL_TYPES = ['Petrol', 'Diesel', 'Electric', 'CNG'];
const VALID_CONDITIONS = ['new', 'old'];
const VALID_TRANSMISSIONS = ['Manual', 'Automatic', 'CVT', 'DCT', 'AMT'];
const VALID_STATUS = ['active', 'inactive', 'sold'];
const VALID_LISTED_BY = ['Owner', 'Dealer', 'Showroom'];

const createRules = [
  body('brand').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Brand must be 2-50 characters'),
  body('make').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Make must be 2-50 characters'),
  body('model').trim().notEmpty().withMessage('Model is required').isLength({ min: 2, max: 100 }).withMessage('Model must be 2-100 characters'),
  body('year').notEmpty().withMessage('Year is required').isInt({ min: 1990, max: new Date().getFullYear() + 1 }).withMessage('Year must be between 1990 and current year+1'),
  body('condition').notEmpty().withMessage('Condition is required').isIn(VALID_CONDITIONS).withMessage('Condition must be new or old'),
  body('category').notEmpty().withMessage('Category is required').isIn(VALID_CATEGORIES).withMessage('Invalid category'),
  body('fuelType').notEmpty().withMessage('Fuel type is required').isIn(VALID_FUEL_TYPES).withMessage('Invalid fuel type'),
  body('price').trim().notEmpty().withMessage('Price is required'),
  body('priceValue').notEmpty().withMessage('Price value is required').isFloat({ min: 0 }).withMessage('Price value must be a positive number'),
  body('kmDriven').optional().isInt({ min: 0 }).withMessage('KM driven must be a positive number'),
  body('location').trim().notEmpty().withMessage('Location is required').isLength({ min: 2, max: 100 }).withMessage('Location must be 2-100 characters'),
  body('city').trim().notEmpty().withMessage('City is required'),
  body('pincode').trim().notEmpty().withMessage('Pincode is required').matches(/^\d{6}$/).withMessage('Pincode must be 6 digits'),
  body('images').isArray({ min: 1 }).withMessage('At least one image is required'),
  body('images.*').isString().trim().notEmpty().withMessage('Invalid image URL'),
  body('showroom.phone').optional().isMobilePhone('any').withMessage('Invalid phone number'),
  body('transmission').optional().isIn(VALID_TRANSMISSIONS).withMessage('Invalid transmission type'),
  body('status').optional().isIn(VALID_STATUS).withMessage('Invalid status'),
  body('listedBy').optional().isIn(VALID_LISTED_BY).withMessage('Invalid listedBy value'),
];

const updateRules = [
  body('brand').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Brand must be 2-50 characters'),
  body('make').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Make must be 2-50 characters'),
  body('model').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Model must be 2-100 characters'),
  body('year').optional().isInt({ min: 1990, max: new Date().getFullYear() + 1 }).withMessage('Year must be between 1990 and current year+1'),
  body('condition').optional().isIn(VALID_CONDITIONS).withMessage('Condition must be new or old'),
  body('category').optional().isIn(VALID_CATEGORIES).withMessage('Invalid category'),
  body('fuelType').optional().isIn(VALID_FUEL_TYPES).withMessage('Invalid fuel type'),
  body('priceValue').optional().isFloat({ min: 0 }).withMessage('Price value must be a positive number'),
  body('images').optional().isArray({ min: 1 }).withMessage('At least one image is required'),
  body('transmission').optional().isIn(VALID_TRANSMISSIONS).withMessage('Invalid transmission type'),
  body('status').optional().isIn(VALID_STATUS).withMessage('Invalid status'),
  body('listedBy').optional().isIn(VALID_LISTED_BY).withMessage('Invalid listedBy value'),
];

module.exports = { createRules, updateRules };
