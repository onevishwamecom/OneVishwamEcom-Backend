const express = require('express');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
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

module.exports = router;
