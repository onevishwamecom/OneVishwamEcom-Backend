const { PROPERTY_TYPES } = require('../models/Property');
const ApiError = require('../utils/ApiError');

// Defined allowed keys per property category inside the `details` subdocument
const CATEGORY_ALLOWED_KEYS = {
  Residential: [
    'propertyName',
    'dimensions',
    'facing',
    'facingOther',
    'cornerPlot',
    'cornerPlotOther',
    'approvedLayout',
    'approvalAuthority',
    'approvalAuthorityOther',
    'boundaryWall',
    'expectedPrice',
    'negotiable',
  ],
  'Flat/Villa': [
    'apartmentName',
    'projectName',
    'bhk',
    'superBuiltUpArea',
    'floors',
    'facing',
    'facingOther',
    'bathrooms',
    'balconies',
    'furnishingStatus',
    'furnishingStatusOther',
    'propertyAge',
    'possessionStatus',
    'parkingAvailability',
    'amenities',
    'amenitiesOther',
    'maintenanceCharges',
    'gatedCommunity',
    'gardenTerrace',
    'expectedPrice',
    'negotiable',
  ],
  'Independent House': [
    'apartmentName',
    'projectName',
    'bhk',
    'superBuiltUpArea',
    'floors',
    'facing',
    'facingOther',
    'bathrooms',
    'balconies',
    'furnishingStatus',
    'furnishingStatusOther',
    'propertyAge',
    'possessionStatus',
    'parkingAvailability',
    'amenities',
    'amenitiesOther',
    'maintenanceCharges',
    'gatedCommunity',
    'gardenTerrace',
    'expectedPrice',
    'negotiable',
  ],
  Agricultural: [
    'totalLandExtent',
    'surveyNumber',
    'landType',
    'landTypeOther',
    'roadAccessWidth',
    'waterAvailability',
    'waterAvailabilityOther',
    'electricityAvailable',
    'currentCrop',
    'soilType',
    'farmhouseAvailable',
    'fencingAvailable',
    'expectedPricePerAcre',
    'expectedPrice',
    'negotiable',
  ],
  Commercial: [
    'commercialType',
    'carpetArea',
    'builtUpArea',
    'totalFloors',
    'facing',
    'facingOther',
    'furnishingStatus',
    'furnishingStatusOther',
    'washrooms',
    'liftAvailable',
    'powerBackup',
    'parkingCapacity',
    'mainRoadFrontage',
    'occupancyStatus',
    'rentalIncome',
    'maintenanceCharges',
    'expectedPrice',
    'negotiable',
  ],
  'Plot/Land': [
    'projectName',
    'plotType',
    'totalLandArea',
    'plotDimensions',
    'facing',
    'facingOther',
    'cornerPlot',
    'cornerPlotOther',
    'roadFacingWidth',
    'adjoiningRoadsCount',
    'approvalAuthority',
    'approvalAuthorityOther',
    'conversionStatus',
    'boundaryFencing',
    'utilities',
    'utilitiesOther',
    'expectedPrice',
    'negotiable',
  ],
  Industrial: [
    'industrialType',
    'propertyStatus',
    'totalLandArea',
    'builtUpArea',
    'shedDimensions',
    'numberOfFloors',
    'roadFrontage',
    'approachRoadWidth',
    'heavyVehicleAccess',
    'powerLoad',
    'waterAvailability',
    'industrialZone',
    'pollutionApproval',
    'fireSafetyApproval',
    'officeSpace',
    'labourQuarters',
    'loadingArea',
    'parkingCapacity',
    'suitableIndustries',
    'expectedPrice',
    'negotiable',
  ],
};

// Mandatory fields for each category
const CATEGORY_REQUIRED_KEYS = {
  Residential: ['dimensions', 'facing', 'expectedPrice'],
  'Flat/Villa': ['superBuiltUpArea', 'bhk', 'facing', 'expectedPrice'],
  'Independent House': ['superBuiltUpArea', 'bhk', 'facing', 'expectedPrice'],
  Agricultural: ['totalLandExtent', 'surveyNumber', 'landType'],
  Commercial: ['commercialType', 'builtUpArea', 'expectedPrice'],
  'Plot/Land': ['totalLandArea', 'plotDimensions', 'facing', 'expectedPrice'],
  Industrial: ['industrialType', 'totalLandArea', 'expectedPrice'],
};

/**
 * Validates the incoming property payload dynamically based on propertyType.
 * Strips any unwanted fields in req.body.details that do not belong to the selected category.
 */
function validatePropertyListing(req, res, next) {
  const errors = {};

  // Parse details if passed as JSON string in multipart form
  if (typeof req.body.details === 'string') {
    try {
      req.body.details = JSON.parse(req.body.details);
    } catch {
      req.body.details = {};
    }
  } else if (!req.body.details || typeof req.body.details !== 'object') {
    req.body.details = {};
  }

  // Parse documents if passed as JSON string
  if (typeof req.body.documents === 'string') {
    try {
      req.body.documents = JSON.parse(req.body.documents);
    } catch {
      req.body.documents = [];
    }
  }

  // Tier 1 Validation: Root Identifiers
  const { vendorName, channelPartnerName, propertyType, bankLoanDetails } = req.body;

  if (!vendorName || typeof vendorName !== 'string' || !vendorName.trim()) {
    errors.vendorName = 'Vendor / Builder / Owner name is required';
  }

  if (!channelPartnerName || typeof channelPartnerName !== 'string' || !channelPartnerName.trim()) {
    errors.channelPartnerName = 'Channel Partner name is required';
  }

  if (!propertyType || typeof propertyType !== 'string') {
    errors.propertyType = 'Property type is required';
  } else if (!PROPERTY_TYPES.includes(propertyType.trim())) {
    errors.propertyType = `Invalid propertyType. Must be one of: ${PROPERTY_TYPES.join(', ')}`;
  }

  // Tier 3 Validation: Bank Loan Details
  if (!bankLoanDetails || typeof bankLoanDetails !== 'string' || !bankLoanDetails.trim()) {
    errors.bankLoanDetails = 'Bank loan approval details are required';
  }

  // If root fields failed, return early
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Property listing validation failed',
      errors,
    });
  }

  const normalizedType = propertyType.trim();
  const allowedKeys = CATEGORY_ALLOWED_KEYS[normalizedType] || [];
  const requiredKeys = CATEGORY_REQUIRED_KEYS[normalizedType] || [];
  const rawDetails = req.body.details || {};

  // Strip unwanted fields to prevent dirty DB state
  const cleanDetails = {};
  for (const key of allowedKeys) {
    if (key in rawDetails && rawDetails[key] !== undefined && rawDetails[key] !== null) {
      cleanDetails[key] = rawDetails[key];
    }
  }

  // Fallback check: sync expectedPrice from details or root price
  if (!cleanDetails.expectedPrice && req.body.price) {
    cleanDetails.expectedPrice = String(req.body.price);
  }
  if (!cleanDetails.expectedPrice && cleanDetails.expectedPricePerAcre) {
    cleanDetails.expectedPrice = String(cleanDetails.expectedPricePerAcre);
  }

  // Validate category-specific required fields
  for (const field of requiredKeys) {
    const val = cleanDetails[field];
    if (val === undefined || val === null || (typeof val === 'string' && !val.trim())) {
      errors[`details.${field}`] = `${field} is required for ${normalizedType}`;
    }
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      success: false,
      message: `Validation failed for ${normalizedType} specifications`,
      errors,
    });
  }

  // Assign cleaned details back to req.body
  req.body.details = cleanDetails;
  req.body.propertyType = normalizedType;

  next();
}

module.exports = validatePropertyListing;

