const { body } = require('express-validator');

const FINANCE_CATEGORIES = [
  'Home Loans', 'Personal Loans', 'Vehicle Loans', 'Business Loans', 'Gold Loans',
  'Education Loans', 'Insurance', 'Investment Services', 'Credit Cards', 'Financial Advisors',
];

const createRules = [
  body('companyName').trim().notEmpty().withMessage('Company name is required'),
  body('category').trim().notEmpty().withMessage('Category is required').isIn(FINANCE_CATEGORIES).withMessage('Invalid category'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('city').trim().notEmpty().withMessage('City is required'),
  body('contactEmail').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Invalid email address'),
  body('serviceName').optional().trim(),
  body('providerType').optional().trim(),
  body('interestRate').optional().trim(),
  body('minAmount').optional().trim(),
  body('maxAmount').optional().trim(),
  body('tenure').optional().trim(),
  body('pincode').optional({ values: 'falsy' }).matches(/^\d{6}$/).withMessage('Pincode must be 6 digits'),
  body('serviceMode').optional().isIn(['Online', 'Offline', 'Both']).withMessage('Invalid service mode'),
  body('postedBy').optional().isIn(['Bank', 'Agent', 'Financial Consultant']).withMessage('Invalid postedBy value'),
  body('availability').optional().isIn(['Available Now', 'Appointment Required']).withMessage('Invalid availability value'),
];

const updateRules = [
  body('companyName').optional().trim().notEmpty().withMessage('Company name cannot be empty'),
  body('category').optional().trim().isIn(FINANCE_CATEGORIES).withMessage('Invalid category'),
  body('contactEmail').optional().isEmail().withMessage('Invalid email address'),
  body('pincode').optional({ values: 'falsy' }).matches(/^\d{6}$/).withMessage('Pincode must be 6 digits'),
  body('serviceMode').optional().isIn(['Online', 'Offline', 'Both']).withMessage('Invalid service mode'),
  body('postedBy').optional().isIn(['Bank', 'Agent', 'Financial Consultant']).withMessage('Invalid postedBy value'),
  body('availability').optional().isIn(['Available Now', 'Appointment Required']).withMessage('Invalid availability value'),
];

module.exports = { createRules, updateRules };