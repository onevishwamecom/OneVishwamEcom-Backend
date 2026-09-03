"use strict";

var express = require('express');

var _require = require('../middleware/auth'),
    protect = _require.protect;

var upload = require('../middleware/upload');

var uploadFloorPlan = require('../middleware/uploadFloorPlan');

var ApiResponse = require('../utils/ApiResponse');

var ApiError = require('../utils/ApiError');

var router = express.Router();
router.post('/images', protect, upload.array('images', 10), function (req, res) {
  if (!req.files || req.files.length === 0) {
    throw new ApiError(400, 'No images provided');
  }

  var urls = req.files.map(function (f) {
    if (f.path && f.path.startsWith('http')) return f.path;
    if (f.cloudinaryUrl) return f.cloudinaryUrl;
    return "/uploads/".concat(f.filename);
  });
  new ApiResponse(200, {
    images: urls
  }, 'Images uploaded').send(res);
});
router.post('/floor-plan-images', protect, uploadFloorPlan.array('floorPlanImages', 10), function (req, res) {
  if (!req.files || req.files.length === 0) {
    throw new ApiError(400, 'No floor plan images provided');
  }

  var urls = req.files.map(function (f) {
    if (f.path && f.path.startsWith('http')) return f.path;
    if (f.cloudinaryUrl) return f.cloudinaryUrl;
    return "/uploads/".concat(f.filename);
  });
  new ApiResponse(200, {
    floorPlanImages: urls
  }, 'Floor plan images uploaded').send(res);
});
router.post('/floor-plan-pdf', protect, uploadFloorPlan.single('floorPlanPdf'), function (req, res) {
  if (!req.file) {
    throw new ApiError(400, 'No PDF file provided');
  }

  var url = req.file.path && req.file.path.startsWith('http') ? req.file.path : req.file.cloudinaryUrl || "/uploads/".concat(req.file.filename);
  new ApiResponse(200, {
    pdfUrl: url
  }, 'Floor plan PDF uploaded').send(res);
});
router.post('/floor-plans', protect, uploadFloorPlan.array('floorPlans', 10), function (req, res) {
  if (!req.files || req.files.length === 0) {
    throw new ApiError(400, 'No floor plan files provided');
  }

  var urls = req.files.map(function (f) {
    if (f.path && f.path.startsWith('http')) return f.path;
    if (f.cloudinaryUrl) return f.cloudinaryUrl;
    return "/uploads/".concat(f.filename);
  });
  new ApiResponse(200, {
    floorPlans: urls
  }, 'Floor plans uploaded').send(res);
});
module.exports = router;