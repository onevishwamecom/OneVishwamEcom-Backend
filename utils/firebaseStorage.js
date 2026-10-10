const { getStorage } = require('firebase-admin/storage');

const BUCKET_NAME = process.env.STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || 'onevishwam.firebasestorage.app';

/**
 * Deletes a media file from Firebase Storage using its download URL
 * @param {string} fileUrl
 */
async function deleteMediaFromStorage(fileUrl) {
  if (!fileUrl || typeof fileUrl !== 'string' || !fileUrl.includes('firebasestorage')) return;
  try {
    const bucket = getStorage().bucket(BUCKET_NAME);
    const urlObj = new URL(fileUrl);
    const pathSegments = urlObj.pathname.split('/o/');
    if (pathSegments.length > 1) {
      const encodedPath = pathSegments[1];
      const storagePath = decodeURIComponent(encodedPath);
      const file = bucket.file(storagePath);
      await file.delete().catch((err) => console.warn(`⚠️ [FIREBASE STORAGE DELETE NOTICE]: ${err.message}`));
    }
  } catch (err) {
    console.warn(`⚠️ [FIREBASE STORAGE DELETE WARNING]: ${err.message}`);
  }
}

/**
 * Deletes multiple media files from Firebase Storage
 * @param {Array<string>} urls
 */
async function deleteMultipleMediaFromStorage(urls = []) {
  const validUrls = (Array.isArray(urls) ? urls : [urls]).filter((u) => u && typeof u === 'string' && u.includes('firebasestorage'));
  await Promise.allSettled(validUrls.map(deleteMediaFromStorage));
}

module.exports = {
  deleteMediaFromStorage,
  deleteMultipleMediaFromStorage,
};
