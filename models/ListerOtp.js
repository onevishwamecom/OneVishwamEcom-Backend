const mongoose = require('mongoose');
const crypto = require('crypto');
const { OTP_LENGTH, OTP_EXPIRY_MINUTES, OTP_MAX_ATTEMPTS, OTP_RESEND_COOLDOWN_SECONDS } = require('../config/authConfig');

const listerOtpSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  purpose: {
    type: String,
    required: true,
    enum: ['LISTER_REGISTRATION', 'LISTER_LOGIN'],
    default: 'LISTER_REGISTRATION',
    index: true,
  },
  otpHash: {
    type: String,
    required: true,
  },
  isUsed: {
    type: Boolean,
    default: false,
    index: true,
  },
  attempts: {
    type: Number,
    default: 0,
    max: OTP_MAX_ATTEMPTS,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
}, { timestamps: true });

// TTL index — MongoDB automatically deletes documents once expiresAt has passed
listerOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Fast lookup for an active (unused, not expired) OTP for a phone + purpose
listerOtpSchema.index({ phone: 1, purpose: 1, isUsed: 1, createdAt: -1 });

listerOtpSchema.statics.generateOtp = function () {
  const max = Math.pow(10, OTP_LENGTH);
  const min = Math.pow(10, OTP_LENGTH - 1);
  // crypto.randomInt is cryptographically secure (uses OpenSSL)
  const value = crypto.randomInt(min, max);
  return value.toString().padStart(OTP_LENGTH, '0');
};

listerOtpSchema.statics.hashOtp = function (otp) {
  return crypto.createHash('sha256').update(otp).digest('hex');
};

listerOtpSchema.statics.OTP_EXPIRY_MS = OTP_EXPIRY_MINUTES * 60 * 1000;
listerOtpSchema.statics.OTP_MAX_ATTEMPTS = OTP_MAX_ATTEMPTS;
listerOtpSchema.statics.OTP_RESEND_COOLDOWN_SECONDS = OTP_RESEND_COOLDOWN_SECONDS;

module.exports = mongoose.model('ListerOtp', listerOtpSchema);
