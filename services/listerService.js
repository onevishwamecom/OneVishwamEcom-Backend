const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const cloudinary = require('cloudinary').v2;
const Lister = require('../models/Lister');
const ListerOtp = require('../models/ListerOtp');
const smsService = require('./smsService');
const imageService = require('./imageService');
const ApiError = require('../utils/ApiError');
const { normalizePhone } = require('../utils/phone');
const {
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_SECONDS,
} = require('../config/authConfig');

/**
 * Generate + persist a 6-digit OTP for a phone number.
 * The OTP is hashed before storage and sent via the (dev-safe) SMS service.
 * The real OTP is NEVER persisted or returned to the client.
 */
async function sendOtpToPhone(phone) {
  const normalized = normalizePhone(phone);

  // Refuse to send OTP if the phone is already a registered Lister.
  const existing = await Lister.findOne({
    phone: normalized,
    phoneVerified: true,
  });
  if (existing) {
    throw new ApiError(409, 'This phone number is already registered. Please log in.');
  }

  // Throttle: check resend cooldown against the most recent OTP for this phone.
  // Cooldown removed for development - allow immediate resend
  // const lastOtp = await ListerOtp.findOne({ phone: normalized, purpose: 'LISTER_REGISTRATION' }).sort({ createdAt: -1 });
  // if (lastOtp && !lastOtp.isUsed && lastOtp.attempts < OTP_MAX_ATTEMPTS) {
  //   const secondsSince = (Date.now() - lastOtp.createdAt.getTime()) / 1000;
  //   if (secondsSince < OTP_RESEND_COOLDOWN_SECONDS) {
  //     const wait = Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - secondsSince);
  //     throw new ApiError(429, `Please wait ${wait} seconds before requesting a new code.`);
  //   }
  // }

  // Generate (secure), hash, store
  const otp = ListerOtp.generateOtp();
  const otpHash = ListerOtp.hashOtp(otp);
  await ListerOtp.create({
    phone: normalized,
    purpose: 'LISTER_REGISTRATION',
    otpHash,
    expiresAt: new Date(Date.now() + ListerOtp.OTP_EXPIRY_MS),
  });

  // Send via (dev-safe) SMS abstraction
  await smsService.sendOtp(normalized, otp, 'LISTER_REGISTRATION');

  return { phone: normalized, message: 'OTP sent successfully.' };
}

/**
 * Verify a 6-digit OTP for a phone number (lister registration purpose).
 * Marks the OTP record used. Does NOT create a lister account.
 */
async function verifyOtpForPhone(phone, otp) {
  const normalized = normalizePhone(phone);

  const record = await ListerOtp.findOne({
    phone: normalized,
    purpose: 'LISTER_REGISTRATION',
    isUsed: false,
  }).sort({ createdAt: -1 });

  if (!record) {
    throw new ApiError(400, 'No verification code found. Please request a new code.');
  }

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    record.isUsed = true;
    await record.save();
    throw new ApiError(400, 'Too many failed attempts. Please request a new code.');
  }

  if (record.expiresAt < new Date()) {
    record.isUsed = true;
    await record.save();
    throw new ApiError(400, 'Your OTP has expired. Please request a new code.');
  }

  const hashedInput = ListerOtp.hashOtp(otp);
  if (record.otpHash !== hashedInput) {
    record.attempts += 1;
    await record.save();
    throw new ApiError(400, 'That OTP is incorrect. Please try again.');
  }

  // Success — mark verified, invalidate this OTP (and any other active ones).
  record.isUsed = true;
  await record.save();
  await ListerOtp.updateMany(
    { phone: normalized, purpose: 'LISTER_REGISTRATION', isUsed: false },
    { $set: { isUsed: true } }
  );

  return { phone: normalized, verified: true };
}

/**
 * Confirm a phone has an OTP that was successfully verified recently
 * (i.e. a pending registration). This is the "gate" between OTP and account
 * creation so that incomplete accounts are never created.
 */
async function assertPhoneOtpVerified(normalized) {
  const recent = await ListerOtp.findOne({
    phone: normalized,
    purpose: 'LISTER_REGISTRATION',
    isUsed: true,
  }).sort({ updatedAt: -1 });

  if (!recent) {
    throw new ApiError(400, 'Phone number is not verified. Please verify the OTP first.');
  }

  // OTP record used within the last OTP_EXPIRY window counts as a fresh verification.
  const ageMs = Date.now() - new Date(recent.updatedAt).getTime();
  if (ageMs > ListerOtp.OTP_EXPIRY_MS) {
    throw new ApiError(400, 'OTP verification has expired. Please request a new OTP and verify again.');
  }

  return true;
}

async function registerLister({ name, email, phone, password, confirmPassword }) {
  if (password !== confirmPassword) {
    throw new ApiError(400, 'Passwords do not match');
  }

  const normalized = normalizePhone(phone);

  // Phone must have been OTP verified before an account is created.
  await assertPhoneOtpVerified(normalized);

  // Reject if this phone is already associated with ANY account.
  const existingPhone = await Lister.findOne({
    $or: [{ phone: normalized }, { listerId: normalized }],
  });
  if (existingPhone) {
    throw new ApiError(409, 'This phone number is already registered. Please log in.');
  }

  // Email is optional - only check if provided
  if (email && email.trim()) {
    const existingEmail = await Lister.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      throw new ApiError(409, 'Email already registered');
    }
  }

  const lister = await Lister.create({
    listerId: normalizePhone(phone), // verified phone as listerId
    name,
    email: email && email.trim() ? email.toLowerCase() : undefined,
    phone: normalizePhone(phone),
    password,
    phoneVerified: true,
    status: 'ACTIVE',
  });

  // Invalidate any remaining OTPs for this phone (registration complete).
  await ListerOtp.deleteMany({ phone: normalizePhone(phone), purpose: 'LISTER_REGISTRATION' });

  return { ...(await lister.generateAuthResponse()), lister: lister.toListerJSON() };
}

async function listerLogin({ phone, password }) {
  const normalized = normalizePhone(phone);

  const lister = await Lister.findOne({ phone: normalized }).select('+password');
  if (!lister) {
    throw new ApiError(401, 'Invalid phone number or password');
  }

  const isMatch = await lister.comparePassword(password);
  if (!isMatch) {
    throw new ApiError(401, 'Invalid phone number or password');
  }

  if (lister.status !== 'ACTIVE') {
    throw new ApiError(403, 'Account is suspended. Please contact support.');
  }

  lister.lastLogin = new Date();
  await lister.save({ validateBeforeSave: false });

  return { ...(await lister.generateAuthResponse()), lister: lister.toListerJSON() };
}

async function getLister(listerId) {
  const lister = await Lister.findById(listerId);
  if (!lister) throw new ApiError(404, 'Lister not found');
  return lister.toListerJSON();
}

async function updateListerProfile(listerId, { name, fullName, email, city, area, pincode, profileImage, notifications }) {
  const updateData = {};
  const resolvedName = name !== undefined ? name : fullName;

  if (resolvedName !== undefined) {
    updateData.name = resolvedName;
  }

  if (email !== undefined) {
    if (email && email.trim()) {
      const existingEmail = await Lister.findOne({
        email: email.toLowerCase(),
        _id: { $ne: listerId },
      });
      if (existingEmail) {
        throw new ApiError(409, 'Email already registered');
      }
      updateData.email = email.toLowerCase();
    }
  }

  if (city !== undefined) updateData.city = city;
  if (area !== undefined) updateData.area = area;
  if (pincode !== undefined) updateData.pincode = pincode;
  if (profileImage !== undefined) {
    // Accept both legacy string URLs and the { url, publicId } object shape.
    if (typeof profileImage === 'string') {
      updateData.profileImage = { url: profileImage, publicId: null };
    } else if (profileImage && typeof profileImage === 'object') {
      updateData.profileImage = {
        url: profileImage.url || null,
        publicId: profileImage.publicId || null,
      };
    }
  }

  if (notifications && typeof notifications === 'object') {
    if (typeof notifications.email === 'boolean') updateData['notifications.email'] = notifications.email;
    if (typeof notifications.whatsapp === 'boolean') updateData['notifications.whatsapp'] = notifications.whatsapp;
  }

  // Phone / listerId / password are authentication identity — never editable here.
  const lister = await Lister.findByIdAndUpdate(
    listerId,
    { $set: updateData },
    { new: true, runValidators: true }
  );

  if (!lister) throw new ApiError(404, 'Lister not found');
  return lister.toListerJSON();
}

async function getListerMe(listerId) {
  const lister = await Lister.findById(listerId);
  if (!lister) throw new ApiError(404, 'Lister not found');
  return lister.toListerJSON();
}

const PROFILE_IMAGE_FOLDER = 'Listers Profile Images';

/**
 * Replace the authenticated lister's profile image:
 * validate -> compress (<= ~1 MB) -> Cloudinary -> update listers doc.
 *
 * A predictable public_id + `overwrite:true` replaces the previous asset in
 * place (no duplicate files). Mongo is only updated AFTER Cloudinary succeeds;
 * if the DB write fails, the freshly uploaded asset is cleaned up. Any legacy
 * publicId that differs from the new one is destroyed after the DB succeeds.
 */
async function updateListerProfileImage(listerId, file) {
  if (!file || !file.buffer) {
    throw new ApiError(400, 'No image file received.');
  }

  const lister = await Lister.findById(listerId);
  if (!lister) throw new ApiError(404, 'Lister not found');

  // 1. Validate + compress in-memory (target <= ~1 MB).
  const { buffer, format } = await imageService.processProfileImage(file.buffer);

  // 2. Upload to Cloudinary under the fixed folder with a predictable id.
  //    The SDK receives the in-memory buffer as a data URI — nothing touches disk.
  const publicId = `lister_${lister._id}_profile`;
  const mime = format === 'webp' ? 'image/webp' : 'image/jpeg';
  const dataUri = `data:${mime};base64,${buffer.toString('base64')}`;
  let uploaded;
  try {
    uploaded = await cloudinary.uploader.upload(dataUri, {
      folder: PROFILE_IMAGE_FOLDER,
      public_id: publicId,
      format: format === 'webp' ? 'webp' : 'jpg',
      overwrite: true,
      resource_type: 'image',
      transformation: [{ width: 500, height: 500, crop: 'fill', quality: 'auto' }],
    });
  } catch (err) {
    console.error('[LISTER] Cloudinary upload failed:', err.message);
    throw new ApiError(502, 'Image upload failed. Please try again.');
  }

  const newProfileImage = { url: uploaded.secure_url, publicId: uploaded.public_id };

  // 3. Persist only after the upload succeeded.
  let updated;
  try {
    updated = await Lister.findByIdAndUpdate(
      listerId,
      { $set: { profileImage: newProfileImage } },
      { new: true, runValidators: true }
    );
  } catch (err) {
    // DB failed after Cloudinary succeeded — remove the orphan asset.
    console.error('[LISTER] Mongo update failed after upload, cleaning up:', err.message);
    cloudinary.uploader.destroy(uploaded.public_id).catch(() => {});
    throw new ApiError(500, 'Could not save your profile image. Please try again.');
  }

  if (!updated) {
    cloudinary.uploader.destroy(uploaded.public_id).catch(() => {});
    throw new ApiError(404, 'Lister not found');
  }

  // 4. Best-effort cleanup of any legacy asset that differs from the new one.
  const old = lister.toProfileImageJSON();
  if (old.publicId && old.publicId !== uploaded.public_id) {
    cloudinary.uploader.destroy(old.publicId).catch((e) => {
      console.error('[LISTER] Could not remove old profile image:', e.message);
    });
  }

  return updated.toProfileImageJSON();
}

async function listerLogout({ refreshToken }) {
  if (!refreshToken || typeof refreshToken !== 'string') {
    return;
  }
  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    const lister = await Lister.findById(payload.id).select('+refreshToken');
    if (lister && lister.refreshToken === refreshToken) {
      lister.refreshToken = undefined;
      await lister.save({ validateBeforeSave: false });
    }
  } catch {
    // Token already invalid/reused; nothing to revoke
  }
}

module.exports = {
  sendOtpToPhone,
  verifyOtpForPhone,
  registerLister,
  listerLogin,
  getLister,
  updateListerProfile,
  getListerMe,
  updateListerProfileImage,
  listerLogout,
};