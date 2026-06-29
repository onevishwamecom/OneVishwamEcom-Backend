const mongoose = require('mongoose');
const crypto = require('crypto');

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true,
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

otpSchema.statics.generateOtp = function () {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

otpSchema.statics.hashOtp = function (otp) {
  return crypto.createHash('sha256').update(otp).digest('hex');
};

module.exports = mongoose.model('Otp', otpSchema);
