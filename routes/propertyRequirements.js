const express = require('express');
const { body } = require('express-validator');
const { protect, optionalAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const Requirement = require('../modules/requirements/model');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.post('/',
  optionalAuth,
  [
    body('requirementType').trim().notEmpty().withMessage('Requirement type is required'),
    body('propertyType').trim().notEmpty().withMessage('Property type is required'),
    body('budgetMin').notEmpty().withMessage('Minimum budget is required').isFloat({ min: 0 }),
    body('budgetMax').notEmpty().withMessage('Maximum budget is required').isFloat({ min: 0 }),
    body('city').trim().notEmpty().withMessage('City is required'),
    body('contactNumber').trim().notEmpty().withMessage('Contact number is required').matches(/^\+?[\d\s-]{10,15}$/),
  ],
  validate,
  asyncHandler(async (req, res) => {
    if (req.body.budgetMin && req.body.budgetMax && Number(req.body.budgetMin) >= Number(req.body.budgetMax)) {
      throw new ApiError(400, 'Maximum budget must be greater than minimum budget');
    }
    const data = {
      serviceType: 'properties',
      name: req.body.name || req.body.contactName,
      phone: req.body.contactNumber,
      email: req.body.email,
      message: req.body.additionalNotes,
      details: {
        requirementType: req.body.requirementType,
        propertyType: req.body.propertyType,
        budgetMin: req.body.budgetMin,
        budgetMax: req.body.budgetMax,
        preferredCity: req.body.preferredCity || req.body.city,
        preferredArea: req.body.preferredArea || req.body.area,
        pincode: req.body.pincode,
        additionalNotes: req.body.additionalNotes,
      },
    };
    if (req.user) data.user = req.user._id;
    const requirement = await Requirement.create(data);
    new ApiResponse(201, { requirement }, 'Property requirement submitted').send(res);
  })
);

router.get('/me',
  protect,
  asyncHandler(async (req, res) => {
    const requirements = await Requirement.find({ user: req.user._id, serviceType: 'properties' })
      .sort({ createdAt: -1 });
    new ApiResponse(200, { requirements }, 'Your property requirements').send(res);
  })
);

module.exports = router;
