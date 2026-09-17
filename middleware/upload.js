/**
 * Image upload middleware — Firebase Storage
 * Replaces Cloudinary + multer-storage-cloudinary.
 * Files stored under: products/images/
 */
const { makeImageUploadMiddleware, makeVideoUploadMiddleware } = require('./firebaseStorage');

// upload.array('images', 5) — max 5 images, max 1MB each
const upload = {
  array: (fieldname, maxCount = 5) => makeImageUploadMiddleware('products/images', maxCount, 1),
  single: (fieldname) => makeImageUploadMiddleware('products/images', 1, 1),
};

// Video upload — max 1 video, max 10MB
const uploadVideo = {
  single: (fieldname) => makeVideoUploadMiddleware('products/videos', 10),
  fields: (fields) => makeVideoUploadMiddleware('products/videos', 10),
};

module.exports = upload;
module.exports.uploadVideo = uploadVideo;