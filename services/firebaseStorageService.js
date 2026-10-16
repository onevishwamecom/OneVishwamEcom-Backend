const crypto = require('crypto');
const admin = require('../config/firebaseAdmin');

/**
 * Uploads a buffer directly to Firebase Storage bucket using Firebase Admin SDK
 * @param {Object} params
 * @param {Buffer} params.buffer - File buffer
 * @param {string} params.filename - Original filename
 * @param {string} params.mimetype - MIME type
 * @param {string} params.category - Category slug (e.g. 'properties')
 * @param {string} params.itemId - Item or batch ID
 * @param {'images'|'videos'|'documents'} params.mediaType - Media folder classification
 * @returns {Promise<string>} Firebase Storage public download URL
 */
async function uploadBufferToFirebaseStorage({
  buffer,
  filename = 'file',
  mimetype = 'application/octet-stream',
  category = 'properties',
  itemId = 'general',
  mediaType = 'images',
}) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('Invalid buffer provided for Firebase Storage upload');
  }

  const bucket = admin.getStorage().bucket();
  const cleanCategory = String(category).toLowerCase().trim().replace(/\s+/g, '-');
  const cleanId = String(itemId).trim() || `item_${Date.now()}`;
  const cleanType = String(mediaType).toLowerCase().trim();
  const sanitized = String(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${cleanCategory}/${cleanId}/${cleanType}/${Date.now()}_${sanitized}`;

  const fileRef = bucket.file(storagePath);
  const token = crypto.randomUUID();

  await fileRef.save(buffer, {
    metadata: {
      contentType: mimetype,
      metadata: {
        firebaseStorageDownloadTokens: token,
      },
    },
    resumable: false,
  });

  const bucketName = bucket.name;
  const encodedPath = encodeURIComponent(storagePath);
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${token}`;
}

module.exports = {
  uploadBufferToFirebaseStorage,
};
