/**
 * Image upload middleware — Firebase Storage
 * Replaces Cloudinary + multer-storage-cloudinary.
 * Files stored under: products/images/
 */
const { makeImageUploadMiddleware, makeVideoUploadMiddleware } = require('./firebaseStorage');

// upload.array('images', 10) equivalent — attaches req.uploadedFiles
const upload = {
  array: (fieldname, maxCount = 10) => makeImageUploadMiddleware('products/images', maxCount, 5),
  single: (fieldname) => makeImageUploadMiddleware('products/images', 1, 5),
};

// Video upload — attaches req.uploadedFile
const uploadVideo = {
  single: (fieldname) => makeVideoUploadMiddleware('products/videos', 50),
  fields: (fields) => makeVideoUploadMiddleware('products/videos', 50), // simplified for /media route
};

module.exports = upload;
module.exports.uploadVideo = uploadVideo;