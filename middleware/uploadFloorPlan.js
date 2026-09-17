/**
 * Floor plan upload middleware — Firebase Storage
 * Replaces Cloudinary + multer-storage-cloudinary.
 * Files stored under: products/floor-plans/
 */
const { makeImageUploadMiddleware, makePdfUploadMiddleware } = require('./firebaseStorage');

// Handles both images and PDFs for floor plans
const uploadFloorPlan = {
  array: (fieldname, maxCount = 10) => makeImageUploadMiddleware('products/floor-plans', maxCount, 5),
  single: (fieldname) => {
    // If fieldname suggests PDF, use PDF middleware; otherwise image
    if (fieldname && fieldname.toLowerCase().includes('pdf')) {
      return makePdfUploadMiddleware('products/floor-plans', 5);
    }
    return makeImageUploadMiddleware('products/floor-plans', 1, 5);
  },
};

module.exports = uploadFloorPlan;