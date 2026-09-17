/**
 * Brochure (PDF) upload middleware — Firebase Storage
 * Replaces Cloudinary + multer-storage-cloudinary.
 * Files stored under: products/brochures/
 */
const { makePdfUploadMiddleware } = require('./firebaseStorage');

// uploadBrochure.single('brochure') equivalent — attaches req.uploadedFile
const uploadBrochure = {
  single: (fieldname) => makePdfUploadMiddleware('products/brochures', 3),
};

module.exports = uploadBrochure;
