const sharp = require('sharp');
const ApiError = require('../utils/ApiError');

const MAX_BYTES = 1 * 1024 * 1024; // ~1 MB final target
const MAX_DIMENSION = 1200;
const MIN_DIMENSION = 200;
const QUALITY_STEPS = [85, 80, 72, 64, 56, 48, 40];

/**
 * Validate that the buffer is a real, decodable image (JPEG/PNG/WebP).
 * Trusts the decoded image metadata, never the client-supplied MIME/extension.
 */
async function validateImage(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new ApiError(400, 'No image data received.');
  }

  let meta;
  try {
    meta = await sharp(buffer).metadata();
  } catch {
    throw new ApiError(400, 'Uploaded file is not a valid image.');
  }

  if (!meta.format || !['jpeg', 'png', 'webp'].includes(meta.format)) {
    throw new ApiError(400, 'Only JPG, PNG or WEBP images are allowed.');
  }
  if (!meta.width || !meta.height || meta.width < 1 || meta.height < 1) {
    throw new ApiError(400, 'Uploaded image has no valid dimensions.');
  }

  return meta;
}

/**
 * Produce an optimized image <= ~1 MB.
 * Strategy: auto-orient -> resize inside max dimensions -> encode as WebP.
 * Iteratively lower quality, then dimensions, until the 1 MB target is met
 * or a safe minimum threshold is reached. Aspect ratio is always preserved.
 */
async function compressImage(buffer, meta) {
  const sourceWidth = meta.width || MAX_DIMENSION;
  const sourceHeight = meta.height || MAX_DIMENSION;
  const scale = Math.min(1, MAX_DIMENSION / Math.max(sourceWidth, sourceHeight));
  let width = Math.round(sourceWidth * scale);
  let height = Math.round(sourceHeight * scale);

  const render = async (w, h, quality) => {
    const out = await sharp(buffer)
      .rotate() // honour EXIF orientation
      .resize({
        width: Math.max(1, w),
        height: Math.max(1, h),
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality, effort: 4 })
      .toBuffer();
    return out;
  };

  // Pass 1: full size, stepping quality down.
  for (const quality of QUALITY_STEPS) {
    const out = await render(width, height, quality);
    if (out.length <= MAX_BYTES) return { buffer: out, format: 'webp' };
  }

  // Pass 2: step dimensions down, retrying quality at each step.
  while (width > MIN_DIMENSION && height > MIN_DIMENSION) {
    width = Math.max(MIN_DIMENSION, Math.round(width * 0.8));
    height = Math.max(MIN_DIMENSION, Math.round(height * 0.8));
    for (const quality of QUALITY_STEPS) {
      const out = await render(width, height, quality);
      if (out.length <= MAX_BYTES) return { buffer: out, format: 'webp' };
    }
  }

  throw new ApiError(400, 'Image could not be compressed below 1 MB. Please use a smaller image.');
}

/**
 * Validate + compress an uploaded profile image.
 */
async function processProfileImage(buffer) {
  const meta = await validateImage(buffer);
  return compressImage(buffer, meta);
}

module.exports = { validateImage, compressImage, processProfileImage, MAX_BYTES };