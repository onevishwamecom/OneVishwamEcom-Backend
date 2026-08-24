const express = require('express');
const { optionalAuth } = require('../middleware/auth');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const modules = require('../modules');
const Property = require('../modules/properties/model');
const Vehicle = require('../modules/vehicles/model');
const Grocery = require('../modules/groceries/model');
const Garment = require('../modules/garments/model');
const Jewellery = require('../modules/jewellery/model');
const Finance = require('../modules/finance/model');
const FinanceOffering = require('../modules/financeOfferings/model');

const router = express.Router();

// Card-level projection — only fields needed by homepage cards
const CARD_PROJECTION = {
  title: 1,
  name: 1,
  subtitle: 1,
  price: 1,
  numericPrice: 1,
  priceSuffix: 1,
  city: 1,
  area: 1,
  location: 1,
  images: 1,
  image: 1,
  category: 1,
  propertyType: 1,
  status: 1,
  featured: 1,
  createdAt: 1,
  // Vehicle-specific
  brand: 1,
  model: 1,
  year: 1,
  fuelType: 1,
  // Grocery-specific
  unit: 1,
  stock: 1,
  // Garment-specific
  size: 1,
  color: 1,
  // Jewellery-specific
  metalType: 1,
  purity: 1,
  weightGrams: 1,
  // Finance-specific
  companyName: 1,
  serviceName: 1,
  interestRate: 1,
  logo: 1,
  banner: 1,
};

const FINANCE_OFFERING_PROJECTION = {
  title: 1,
  subtitle: 1,
  type: 1,
  interestRate: 1,
  minAmount: 1,
  maxAmount: 1,
  icon: 1,
  badge: 1,
  badgeColor: 1,
  order: 1,
  status: 1,
};

// GET /api/homepage — single endpoint returning all homepage sections
router.get('/', optionalAuth, asyncHandler(async (req, res) => {
  const [
    featuredProperties,
    latestProperties,
    latestVehicles,
    latestGroceries,
    latestGarments,
    latestJewellery,
    latestFinance,
    financeOfferings,
  ] = await Promise.all([
    // Featured properties (top 6)
    Property.find({ featured: true, status: { $in: ['approved', 'active'] } })
      .sort({ createdAt: -1 })
      .limit(6)
      .select(CARD_PROJECTION)
      .lean(),

    // Latest properties (top 8)
    Property.find({ status: { $in: ['approved', 'active'] } })
      .sort({ createdAt: -1 })
      .limit(8)
      .select(CARD_PROJECTION)
      .lean(),

    // Latest vehicles (top 8)
    Vehicle.find({ status: { $in: ['approved', 'active'] } })
      .sort({ createdAt: -1 })
      .limit(8)
      .select(CARD_PROJECTION)
      .lean().catch(() => []),

    // Latest groceries (top 8)
    Grocery.find({ status: { $in: ['approved', 'active'] } })
      .sort({ createdAt: -1 })
      .limit(8)
      .select(CARD_PROJECTION)
      .lean().catch(() => []),

    // Latest garments (top 8)
    Garment.find({ status: { $in: ['approved', 'active'] } })
      .sort({ createdAt: -1 })
      .limit(8)
      .select(CARD_PROJECTION)
      .lean().catch(() => []),

    // Latest jewellery (top 8)
    Jewellery.find({ status: { $in: ['approved', 'active'] } })
      .sort({ createdAt: -1 })
      .limit(8)
      .select(CARD_PROJECTION)
      .lean().catch(() => []),

    // Latest finance services (top 6)
    Finance.find({ status: { $in: ['approved', 'active'] } })
      .sort({ createdAt: -1 })
      .limit(6)
      .select(CARD_PROJECTION)
      .lean().catch(() => []),

    // Finance offerings / loan cards (top 6)
    FinanceOffering.find({ status: 'active' })
      .sort({ order: 1, createdAt: -1 })
      .limit(6)
      .select(FINANCE_OFFERING_PROJECTION)
      .lean().catch(() => []),
  ]);

  // Stats
  const [
    totalProperties,
    totalVehicles,
    totalGroceries,
    totalGarments,
    totalJewellery,
    totalFinance,
  ] = await Promise.all([
    Property.countDocuments({ status: { $in: ['approved', 'active'] } }),
    Vehicle.countDocuments({ status: { $in: ['approved', 'active'] } }).catch(() => 0),
    Grocery.countDocuments({ status: { $in: ['approved', 'active'] } }).catch(() => 0),
    Garment.countDocuments({ status: { $in: ['approved', 'active'] } }).catch(() => 0),
    Jewellery.countDocuments({ status: { $in: ['approved', 'active'] } }).catch(() => 0),
    Finance.countDocuments({ status: { $in: ['approved', 'active'] } }).catch(() => 0),
  ]);

  const data = {
    featured: featuredProperties,
    latestProperties,
    latestVehicles,
    latestGroceries,
    latestGarments,
    latestJewellery,
    latestFinance,
    financeOfferings,
    stats: {
      totalProperties,
      totalVehicles,
      totalGroceries,
      totalGarments,
      totalJewellery,
      totalFinance,
    },
  };

  new ApiResponse(200, data, 'Homepage data fetched').send(res);
}));

module.exports = router;