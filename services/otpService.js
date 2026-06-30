const crypto = require('crypto');
const Otp = require('../models/Otp');
const { OTP_LENGTH, OTP_EXPIRY_MINUTES, OTP_MAX_ATTEMPTS, OTP_RESEND_COOLDOWN_SECONDS } = require('../config/authConfig');
const ApiError = require('../utils/ApiError');

function generateOtp() {
  const max = Math.pow(10, OTP_LENGTH);
  const min = Math.pow(10, OTP_LENGTH - 1);
  return Math.floor(min + Math.random() * (max - min)).toString();
}

function hashOtp(otp) {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

async function createOtp(email) {
  await Otp.updateMany({ email: email.toLowerCase(), isUsed: false }, { isUsed: true });

  const otp = generateOtp();
  const hashed = hashOtp(otp);

  await Otp.create({
    email: email.toLowerCase(),
    otp: hashed,
    expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
  });

  return otp;
}

async function verifyOtp(email, otp) {
  const record = await Otp.findOne({ email: email.toLowerCase(), isUsed: false }).sort({ createdAt: -1 });

  if (!record) throw new ApiError(400, 'No verification code found. Please request a new code.');

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    record.isUsed = true;
    await record.save();
    throw new ApiError(400, 'Too many failed attempts. Please request a new code.');
  }

  if (record.expiresAt < new Date()) {
    record.isUsed = true;
    await record.save();
    throw new ApiError(400, 'Your verification code has expired. Please request a new code.');
  }

  const hashedInput = hashOtp(otp);
  if (record.otp !== hashedInput) {
    record.attempts += 1;
    await record.save();
    throw new ApiError(400, 'The verification code you entered is incorrect.');
  }

  record.isUsed = true;
  await record.save();

  return true;
}

async function checkResendCooldown(email) {
  const lastOtp = await Otp.findOne({ email: email.toLowerCase() }).sort({ createdAt: -1 });
  if (lastOtp) {
    const secondsSinceLast = (Date.now() - lastOtp.createdAt.getTime()) / 1000;
    if (secondsSinceLast < OTP_RESEND_COOLDOWN_SECONDS) {
      const waitSeconds = Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - secondsSinceLast);
      throw new ApiError(429, `Please wait ${waitSeconds} seconds before requesting a new code.`);
    }
  }
}

async function invalidateOtps(email) {
  await Otp.updateMany({ email: email.toLowerCase(), isUsed: false }, { isUsed: true });
}

module.exports = { generateOtp, hashOtp, createOtp, verifyOtp, checkResendCooldown, invalidateOtps };
