const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const propertyStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'onevishwam/properties',
    allowed_formats: ['jpeg', 'jpg', 'png', 'gif', 'webp', 'avif'],
    transformation: [{ width: 1200, height: 900, crop: 'limit', quality: 'auto' }],
  },
});

const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'onevishwam/avatars',
    allowed_formats: ['jpeg', 'jpg', 'png', 'gif', 'webp'],
    transformation: [{ width: 300, height: 300, crop: 'fill', quality: 'auto' }],
  },
});

const generalStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'onevishwam/uploads',
    allowed_formats: ['jpeg', 'jpg', 'png', 'gif', 'webp', 'avif', 'pdf'],
  },
});

module.exports = { cloudinary, propertyStorage, avatarStorage, generalStorage };
