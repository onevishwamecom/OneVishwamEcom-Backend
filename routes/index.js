const express = require('express');
const authRoutes = require('./auth');
const listingRoutes = require('./listings');
const publicRoutes = require('./public');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/listings', listingRoutes);
router.use('/', publicRoutes);

module.exports = router;
