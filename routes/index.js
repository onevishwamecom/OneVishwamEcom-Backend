const express = require('express');
const authRoutes = require('./auth');
const userRoutes = require('./users');
const publicRoutes = require('./public');
const productRoutes = require('./product');
const searchRoutes = require('./search');
const uploadRoutes = require('./upload');
const mylistingsRoutes = require('./mylistings');
const wishlistRoutes = require('../modules/wishlist/routes');
const requirementRoutes = require('../modules/requirements/routes');
const propertyRoutes = require('../modules/properties/routes');
const propertyRequirementRoutes = require('./propertyRequirements');
const financeOfferingsRoutes = require('../modules/financeOfferings/routes');

const router = express.Router();

router.use('/v1/auth', authRoutes);
router.use('/v1/users', userRoutes);
router.use('/v1/properties', propertyRoutes);
router.use('/v1/property-requirements', propertyRequirementRoutes);
router.use('/auth', authRoutes);
router.use('/product', productRoutes);
router.use('/search', searchRoutes);
router.use('/upload', uploadRoutes);
router.use('/mylistings', mylistingsRoutes);
router.use('/wishlist', wishlistRoutes);
router.use('/requirements', requirementRoutes);
router.use('/finance-offerings', financeOfferingsRoutes);
router.use('/', publicRoutes);

module.exports = router;
