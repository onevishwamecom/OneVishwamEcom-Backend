const express = require('express');
const modules = require('../modules');
const authRoutes = require('./auth');
const listerRoutes = require('./lister');
const userRoutes = require('./users');
const publicRoutes = require('./public');
const productRoutes = require('./product');
const searchRoutes = require('./search');
const uploadRoutes = require('./upload');
const mylistingsRoutes = require('./mylistings');
const listingsRoutes = require('./listings');
const adminRoutes = require('./admin');
const homepageRoutes = require('./homepage');
const wishlistRoutes = require('../modules/wishlist/routes');
const requirementRoutes = require('../modules/requirements/routes');
const propertyRoutes = require('../modules/properties/routes');
const propertyRequirementRoutes = require('../modules/properties/requirements');
const bulkListingRoutes = require('./bulkListing');
const visitorRoutes = require('./visitors');
const announcementRoutes = require('./announcements');

const router = express.Router();

// Top Ribbon Announcements / Notifications
router.use('/announcements', announcementRoutes);

// Visitor Counter / Analytics
router.use('/visitors', visitorRoutes);

// Bulk intake
router.use('/bulk-listing', bulkListingRoutes);

// V1 compatibility endpoints
router.use('/v1/auth', authRoutes);
router.use('/v1/users', userRoutes);
router.use('/v1/properties', propertyRoutes);
router.use('/v1/property-requirements', propertyRequirementRoutes);

// Mount all sector modules directly at root (/properties, /vehicles, /groceries, etc.)
modules.forEach((mod) => router.use(`/${mod.id}`, mod.routes));

// Direct category aliases for convenience
router.use('/property', propertyRoutes);
router.use('/vehicle', require('../modules/vehicles/routes'));
router.use('/automobile', require('../modules/vehicles/routes'));
router.use('/automobiles', require('../modules/vehicles/routes'));
router.use('/consumer-electronics', require('../modules/electronics/routes'));
router.use('/bedding-comfort', require('../modules/bedding/routes'));
router.use('/grocery', require('../modules/groceries/routes'));
router.use('/garment', require('../modules/garments/routes'));

router.use('/auth', authRoutes);
router.use('/auth/lister', listerRoutes);
router.use('/users', userRoutes);
router.use('/admin', adminRoutes);
router.use('/homepage', homepageRoutes);
router.use('/product', productRoutes);
router.use('/products', productRoutes);
router.use('/sectors', productRoutes);
router.use('/v1/sectors', productRoutes);
router.use('/search', searchRoutes);
router.use('/upload', uploadRoutes);
router.use('/mylistings', mylistingsRoutes);
router.use('/listings', listingsRoutes);
router.use('/wishlist', wishlistRoutes);
router.use('/requirements', requirementRoutes);
router.use('/', publicRoutes);

module.exports = router;
