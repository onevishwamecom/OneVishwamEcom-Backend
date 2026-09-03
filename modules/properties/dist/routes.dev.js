"use strict";

var express = require('express');

var _require = require('../../middleware/auth'),
    protect = _require.protect,
    adminOnly = _require.adminOnly,
    optionalAuth = _require.optionalAuth;

var validate = require('../../middleware/validate');

var upload = require('../../middleware/upload');

var uploadBrochure = require('../../middleware/uploadBrochure');

var uploadFloorPlan = require('../../middleware/uploadFloorPlan');

var _require2 = require('./validator'),
    createRules = _require2.createRules,
    updateRules = _require2.updateRules;

var _require3 = require('./controller'),
    getAll = _require3.getAll,
    getById = _require3.getById,
    getFeatured = _require3.getFeatured,
    getLatest = _require3.getLatest,
    getSimilar = _require3.getSimilar,
    create = _require3.create,
    update = _require3.update,
    remove = _require3.remove,
    toggleStatus = _require3.toggleStatus,
    getMyProperties = _require3.getMyProperties,
    uploadBrochureHandler = _require3.uploadBrochure,
    uploadFloorPlanImages = _require3.uploadFloorPlanImages,
    uploadFloorPlanPdf = _require3.uploadFloorPlanPdf,
    uploadFloorPlanHandler = _require3.uploadFloorPlan,
    deleteFloorPlanImage = _require3.deleteFloorPlanImage,
    deleteFloorPlanPdf = _require3.deleteFloorPlanPdf;

var router = express.Router();
router.get('/', getAll);
router.get('/featured', getFeatured);
router.get('/latest', getLatest);
router.get('/similar/:id', getSimilar);
router.get('/my', protect, getMyProperties);
router.get('/:id', optionalAuth, getById);
router.post('/', protect, upload.array('images', 10), createRules, validate, create);
router.put('/:id', protect, upload.array('images', 10), updateRules, validate, update);
router["delete"]('/:id', protect, remove);
router.patch('/:id/status', protect, toggleStatus);
router.post('/:id/brochure', protect, uploadBrochure.single('brochure'), uploadBrochureHandler);
router.post('/:id/floor-plan-images', protect, uploadFloorPlan.array('floorPlanImages', 10), uploadFloorPlanImages);
router.post('/:id/floor-plan-pdf', protect, uploadFloorPlan.single('floorPlanPdf'), uploadFloorPlanPdf);
router.post('/:id/floor-plan', protect, uploadFloorPlan.array('floorPlans', 10), uploadFloorPlanHandler);
router["delete"]('/:id/floor-plan-images', protect, deleteFloorPlanImage);
router["delete"]('/:id/floor-plan-pdf', protect, deleteFloorPlanPdf);
module.exports = router;