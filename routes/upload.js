const express = require('express');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const uploadFloorPlan = require('../middleware/uploadFloorPlan');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');

const router = express.Router();

router.post('/images', protect, upload.array('images', 10), (req, res) => {
  if (!req.files || req.files.length === 0) {
    throw new ApiError(400, 'No images provided');
  }
  const urls = req.files.map(f => {
    if (f.path && f.path.startsWith('http')) return f.path;
    if (f.cloudinaryUrl) return f.cloudinaryUrl;
    return `/uploads/${f.filename}`;
  });
  new ApiResponse(200, { images: urls }, 'Images uploaded').send(res);
});

router.post('/floor-plan-images', protect, uploadFloorPlan.array('floorPlanImages', 10), (req, res) => {
  if (!req.files || req.files.length === 0) {
    throw new ApiError(400, 'No floor plan images provided');
  }
  const urls = req.files.map(f => {
    if (f.path && f.path.startsWith('http')) return f.path;
    if (f.cloudinaryUrl) return f.cloudinaryUrl;
    return `/uploads/${f.filename}`;
  });
  new ApiResponse(200, { floorPlanImages: urls }, 'Floor plan images uploaded').send(res);
});

router.post('/floor-plan-pdf', protect, uploadFloorPlan.single('floorPlanPdf'), (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'No PDF file provided');
  }
  const url = req.file.path && req.file.path.startsWith('http') ? req.file.path : (req.file.cloudinaryUrl || `/uploads/${req.file.filename}`);
  new ApiResponse(200, { pdfUrl: url }, 'Floor plan PDF uploaded').send(res);
});

router.post('/floor-plans', protect, uploadFloorPlan.array('floorPlans', 10), (req, res) => {
  if (!req.files || req.files.length === 0) {
    throw new ApiError(400, 'No floor plan files provided');
  }
  const urls = req.files.map(f => {
    if (f.path && f.path.startsWith('http')) return f.path;
    if (f.cloudinaryUrl) return f.cloudinaryUrl;
    return `/uploads/${f.filename}`;
  });
  new ApiResponse(200, { floorPlans: urls }, 'Floor plans uploaded').send(res);
});

module.exports = router;
