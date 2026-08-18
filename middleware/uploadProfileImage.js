const multer = require('multer');
const ApiError = require('../utils/ApiError');

const ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Memory-storage multer for lister profile images.
 * The file is kept in memory only long enough to be validated + compressed
 * with sharp and uploaded to Cloudinary — it is never written to disk.
 */
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'Only JPG, PNG or WEBP images are allowed.'), false);
  }
};

const uploadProfileImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_PROFILE_IMAGE_SIZE, 10) || 10 * 1024 * 1024,
    files: 1,
  },
});

module.exports = { uploadProfileImage, ALLOWED_MIMETYPES };