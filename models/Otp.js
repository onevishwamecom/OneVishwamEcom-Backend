const mongoose = require('mongoose');
const crypto = require('crypto');
const { OTP_LENGTH } = require('../config/authConfig');

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  otp: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  attempts: {
    type: Number,
    default: 0,
    max: 5,
  },
  isUsed: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

// Compound index for fast OTP lookups by email + usage status
otpSchema.index({ email: 1, isUsed: 1, createdAt: -1 });

// TTL index — MongoDB automatically deletes documents once expiresAt has passed
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

otpSchema.statics.generateOtp = function () {
  const max = Math.pow(10, OTP_LENGTH);
  const min = Math.pow(10, OTP_LENGTH - 1);
  return Math.floor(min + Math.random() * (max - min)).toString();
};

otpSchema.statics.hashOtp = function (otp) {
  return crypto.createHash('sha256').update(otp).digest('hex');
};

module.exports = mongoose.model('Otp', otpSchema);
