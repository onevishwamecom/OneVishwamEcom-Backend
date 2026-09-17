/**
 * Firebase Storage Upload Helper
 * --------------------------------
 * Parses multipart/form-data directly from req.rawBody (available on Cloud
 * Functions v2) using busboy — bypasses multer entirely, which permanently
 * fixes the "Unexpected end of form" stream exhaustion issue.
 *
 * Files are stored under:
 *   products/images/      ← product images
 *   products/videos/      ← product videos
 *   products/floor-plans/ ← floor plan images & PDFs
 *   products/brochures/   ← brochure PDFs
 *
 * Returns permanent public URLs:
 *   https://storage.googleapis.com/{bucket}/products/images/{filename}
 */

const Busboy = require('busboy');
const { Readable } = require('stream');
const { getStorage } = require('firebase-admin/storage');
const path = require('path');
const ApiError = require('../utils/ApiError');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getBucket() {
  return getStorage().bucket();
}

/** Generate a unique filename preserving the original extension */
function uniqueFilename(originalname) {
  const ext = path.extname(originalname).toLowerCase();
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 1e9);
  return `${ts}-${rand}${ext}`;
}

/**
 * Upload a single Buffer to Firebase Storage and return its permanent public URL.
 * @param {Buffer} buffer     File data
 * @param {string} storagePath  e.g. "products/images/1234567890-123.jpg"
 * @param {string} mimeType   e.g. "image/jpeg"
 * @returns {Promise<string>} Public URL
 */
async function uploadBuffer(buffer, storagePath, mimeType) {
  const bucket = getBucket();
  const file = bucket.file(storagePath);
  await file.save(buffer, {
    metadata: { contentType: mimeType },
    resumable: false,   // small files — disable resumable for speed
    public: true,       // make the file publicly readable
  });
  // Permanent public URL (no expiry — works because file is public)
  return `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
}

// ─── Multipart Parser ─────────────────────────────────────────────────────────

/**
 * Parse a multipart/form-data request from req.rawBody using busboy.
 *
 * @param {import('express').Request} req
 * @param {object} opts
 * @param {number}   opts.maxFiles      Maximum number of files allowed
 * @param {number}   opts.maxFileSizeB  Maximum size per file in bytes
 * @param {RegExp}   opts.mimeFilter    RegExp tested against file.mimetype
 * @param {string}   opts.mimeError     Error message if mime test fails
 * @returns {Promise<Array<{originalname, mimetype, buffer}>>}
 */
function parseMultipart(req, opts = {}) {
  const {
    maxFiles = 10,
    maxFileSizeB = 5 * 1024 * 1024,
    mimeFilter = null,
    mimeError = 'File type not allowed',
  } = opts;

  return new Promise((resolve, reject) => {
    const rawBody = req.rawBody;
    if (!rawBody || !rawBody.length) {
      return reject(new ApiError(400, 'No file data received'));
    }

    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      return reject(new ApiError(400, 'Expected multipart/form-data'));
    }

    let bb;
    try {
      bb = Busboy({ headers: { 'content-type': contentType }, limits: { files: maxFiles, fileSize: maxFileSizeB } });
    } catch (e) {
      return reject(new ApiError(400, 'Invalid multipart headers'));
    }

    const files = [];
    let hasError = false;

    bb.on('file', (fieldname, fileStream, info) => {
      const { filename, mimeType } = info;

      // MIME type validation
      if (mimeFilter && !mimeFilter.test(mimeType)) {
        fileStream.resume(); // drain the stream
        if (!hasError) {
          hasError = true;
          reject(new ApiError(400, mimeError));
        }
        return;
      }

      const chunks = [];

      fileStream.on('data', (chunk) => chunks.push(chunk));

      fileStream.on('limit', () => {
        if (!hasError) {
          hasError = true;
          reject(new ApiError(413, `File too large — maximum size is ${Math.round(maxFileSizeB / 1024 / 1024)} MB`));
        }
      });

      fileStream.on('end', () => {
        if (!hasError) {
          files.push({
            originalname: filename || 'upload',
            mimetype: mimeType,
            buffer: Buffer.concat(chunks),
          });
        }
      });
    });

    bb.on('error', (err) => {
      if (!hasError) {
        hasError = true;
        reject(new ApiError(400, `Multipart parse error: ${err.message}`));
      }
    });

    bb.on('finish', () => {
      if (!hasError) {
        if (files.length === 0) {
          reject(new ApiError(400, 'No files found in request'));
        } else {
          resolve(files);
        }
      }
    });

    // Feed rawBody into busboy as a readable stream
    Readable.from(rawBody).pipe(bb);
  });
}

// ─── Public upload factories ──────────────────────────────────────────────────

/**
 * Express middleware factory for uploading multiple image files.
 * Attaches req.uploadedFiles = [{ url, originalname, mimetype }]
 *
 * @param {string} folder  Firebase Storage sub-folder, e.g. "products/images"
 * @param {number} maxFiles
 * @param {number} maxFileSizeMB
 */
function makeImageUploadMiddleware(folder, maxFiles = 10, maxFileSizeMB = 5) {
  const mimeFilter = /image\/(jpeg|jpg|png|gif|webp|avif)/;
  const mimeError = 'Only image files are allowed (JPEG, PNG, WebP, GIF, AVIF)';

  return async function imageUploadMiddleware(req, res, next) {
    try {
      const files = await parseMultipart(req, {
        maxFiles,
        maxFileSizeB: maxFileSizeMB * 1024 * 1024,
        mimeFilter,
        mimeError,
      });

      // Upload all files in parallel
      const uploaded = await Promise.all(
        files.map(async (f) => {
          const filename = uniqueFilename(f.originalname);
          const storagePath = `${folder}/${filename}`;
          const url = await uploadBuffer(f.buffer, storagePath, f.mimetype);
          return { url, originalname: f.originalname, mimetype: f.mimetype };
        })
      );

      req.uploadedFiles = uploaded;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Express middleware factory for uploading a single PDF file.
 * Attaches req.uploadedFile = { url, originalname, mimetype }
 *
 * @param {string} folder  Firebase Storage sub-folder, e.g. "products/brochures"
 * @param {number} maxFileSizeMB
 */
function makePdfUploadMiddleware(folder, maxFileSizeMB = 3) {
  const mimeFilter = /application\/pdf/;
  const mimeError = 'Only PDF files are allowed';

  return async function pdfUploadMiddleware(req, res, next) {
    try {
      const files = await parseMultipart(req, {
        maxFiles: 1,
        maxFileSizeB: maxFileSizeMB * 1024 * 1024,
        mimeFilter,
        mimeError,
      });

      const f = files[0];
      const filename = uniqueFilename(f.originalname || 'document.pdf');
      const storagePath = `${folder}/${filename}`;
      const url = await uploadBuffer(f.buffer, storagePath, f.mimetype);
      req.uploadedFile = { url, originalname: f.originalname, mimetype: f.mimetype };
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Express middleware factory for uploading a single video file.
 * Attaches req.uploadedFile = { url, originalname, mimetype }
 *
 * @param {string} folder  Firebase Storage sub-folder, e.g. "products/videos"
 * @param {number} maxFileSizeMB
 */
function makeVideoUploadMiddleware(folder, maxFileSizeMB = 50) {
  const mimeFilter = /video\/(mp4|webm|quicktime|x-msvideo)/;
  const mimeError = 'Only video files are allowed (MP4, WebM, MOV, AVI)';

  return async function videoUploadMiddleware(req, res, next) {
    try {
      const files = await parseMultipart(req, {
        maxFiles: 1,
        maxFileSizeB: maxFileSizeMB * 1024 * 1024,
        mimeFilter,
        mimeError,
      });

      const f = files[0];
      const filename = uniqueFilename(f.originalname || 'video.mp4');
      const storagePath = `${folder}/${filename}`;
      const url = await uploadBuffer(f.buffer, storagePath, f.mimetype);
      req.uploadedFile = { url, originalname: f.originalname, mimetype: f.mimetype };
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = {
  makeImageUploadMiddleware,
  makePdfUploadMiddleware,
  makeVideoUploadMiddleware,
};

