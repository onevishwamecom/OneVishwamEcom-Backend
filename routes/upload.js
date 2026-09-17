const express = require('express');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const uploadFloorPlan = require('../middleware/uploadFloorPlan');
const uploadBrochure = require('../middleware/uploadBrochure');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');

const router = express.Router();

// POST /upload/images — product images (up to 10)
router.post('/images', protect, upload.array('images', 10), (req, res) => {
  if (!req.uploadedFiles || req.uploadedFiles.length === 0) {
    throw new ApiError(400, 'No images provided');
  }
  const urls = req.uploadedFiles.map((f) => f.url);
  new ApiResponse(200, { images: urls }, 'Images uploaded').send(res);
});

// POST /upload/video — single product video
router.post('/video', protect, upload.uploadVideo.single('video'), (req, res) => {
  if (!req.uploadedFile) {
    throw new ApiError(400, 'No video provided');
  }
  new ApiResponse(200, { videos: [req.uploadedFile.url] }, 'Video uploaded').send(res);
});

// POST /upload/media — images + optional video together
router.post('/media', protect, async (req, res, next) => {
  try {
    const Busboy = require('busboy');
    const { Readable } = require('stream');
    const admin = require('firebase-admin');
    const path = require('path');

    const rawBody = req.rawBody;
    if (!rawBody) return next(new ApiError(400, 'No file data received'));

    const contentType = req.headers['content-type'] || '';
    const bb = Busboy({ headers: { 'content-type': contentType }, limits: { files: 11, fileSize: 50 * 1024 * 1024 } });
    const parsed = [];

    bb.on('file', (fieldname, fileStream, info) => {
      const { filename, mimeType } = info;
      const chunks = [];
      fileStream.on('data', (c) => chunks.push(c));
      fileStream.on('end', () => parsed.push({ fieldname, originalname: filename || 'upload', mimetype: mimeType, buffer: Buffer.concat(chunks) }));
    });

    bb.on('finish', async () => {
      if (parsed.length === 0) return next(new ApiError(400, 'No media files provided'));
      if (parsed.length > 11) return next(new ApiError(400, 'Maximum 10 images + 1 video allowed'));

      try {
        const bucket = admin.storage().bucket();
        const uploaded = await Promise.all(parsed.map(async (f) => {
          const isVideo = /^video\//.test(f.mimetype);
          const folder = isVideo ? 'products/videos' : 'products/images';
          const ext = path.extname(f.originalname).toLowerCase() || (isVideo ? '.mp4' : '.jpg');
          const fname = `${Date.now()}-${Math.floor(Math.random() * 1e9)}${ext}`;
          const storagePath = `${folder}/${fname}`;
          await bucket.file(storagePath).save(f.buffer, { metadata: { contentType: f.mimetype }, resumable: false, public: true });
          return { url: `https://storage.googleapis.com/${bucket.name}/${storagePath}`, isVideo };
        }));

        new ApiResponse(200, {
          images: uploaded.filter((u) => !u.isVideo).map((u) => u.url),
          videos: uploaded.filter((u) => u.isVideo).map((u) => u.url),
        }, 'Media uploaded').send(res);
      } catch (err) {
        next(err);
      }
    });

    bb.on('error', (err) => next(new ApiError(400, `Parse error: ${err.message}`)));
    Readable.from(rawBody).pipe(bb);
  } catch (err) {
    next(err);
  }
});

// POST /upload/floor-plan-images — floor plan images (up to 10)
router.post('/floor-plan-images', protect, uploadFloorPlan.array('floorPlanImages', 10), (req, res) => {
  if (!req.uploadedFiles || req.uploadedFiles.length === 0) {
    throw new ApiError(400, 'No floor plan images provided');
  }
  const urls = req.uploadedFiles.map((f) => f.url);
  new ApiResponse(200, { floorPlanImages: urls }, 'Floor plan images uploaded').send(res);
});

// POST /upload/floor-plan-pdf — single floor plan PDF
router.post('/floor-plan-pdf', protect, uploadFloorPlan.single('floorPlanPdf'), (req, res) => {
  const uploaded = req.uploadedFile || (req.uploadedFiles && req.uploadedFiles[0]);
  if (!uploaded) throw new ApiError(400, 'No PDF file provided');
  new ApiResponse(200, { pdfUrl: uploaded.url }, 'Floor plan PDF uploaded').send(res);
});

// POST /upload/floor-plans — floor plan images (alias)
router.post('/floor-plans', protect, uploadFloorPlan.array('floorPlans', 10), (req, res) => {
  if (!req.uploadedFiles || req.uploadedFiles.length === 0) {
    throw new ApiError(400, 'No floor plan files provided');
  }
  const urls = req.uploadedFiles.map((f) => f.url);
  new ApiResponse(200, { floorPlans: urls }, 'Floor plans uploaded').send(res);
});

// POST /upload/brochure — single brochure PDF
router.post('/brochure', protect, uploadBrochure.single('brochure'), (req, res) => {
  if (!req.uploadedFile) throw new ApiError(400, 'No brochure provided');
  new ApiResponse(200, { brochureUrl: req.uploadedFile.url }, 'Brochure uploaded').send(res);
});

module.exports = router;
