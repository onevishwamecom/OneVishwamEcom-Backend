const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { BCRYPT_SALT_ROUNDS } = require('../config/authConfig');

const listerSchema = new mongoose.Schema(
  {
    listerId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'],
      default: 'ACTIVE',
    },
    refreshToken: { type: String, select: false },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    profileImage: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
    },
    city: { type: String, trim: true, default: '' },
    area: { type: String, trim: true, default: '' },
    pincode: { type: String, trim: true, default: '' },
    notifications: {
      email: { type: Boolean, default: false },
      whatsapp: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

listerSchema.index({ phone: 1 }, { unique: true });
listerSchema.index({ email: 1 }, { unique: true, sparse: true });

listerSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

listerSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

listerSchema.methods.generateAccessToken = function () {
  return jwt.sign({ id: this._id, role: 'lister', accountType: 'lister' }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRE || '15m',
  });
};

listerSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    { id: this._id, accountType: 'lister', jti: crypto.randomBytes(16).toString('hex') },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
  );
};

listerSchema.methods.toProfileImageJSON = function () {
  const pi = this.profileImage;
  // Legacy docs may hold a plain string URL; normalize to { url, publicId }.
  if (pi && typeof pi === 'object' && !Array.isArray(pi)) {
    return { url: pi.url || null, publicId: pi.publicId || null };
  }
  if (typeof pi === 'string' && pi) {
    return { url: pi, publicId: null };
  }
  return { url: null, publicId: null };
};

listerSchema.methods.toListerJSON = function () {
  return {
    id: this._id,
    accountType: 'lister',
    listerId: this.listerId,
    name: this.name,
    fullName: this.name,
    email: this.email || null,
    phone: this.phone,
    mobile: this.phone,
    profileImage: this.toProfileImageJSON(),
    city: this.city,
    area: this.area,
    pincode: this.pincode,
    phoneVerified: this.phoneVerified,
    isEmailVerified: Boolean(this.email),
    status: this.status,
    accountStatus: String(this.status || '').toLowerCase(),
    notifications: {
      email: this.notifications?.email ?? false,
      whatsapp: this.notifications?.whatsapp ?? false,
    },
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

listerSchema.methods.generateAuthResponse = async function () {
  const accessToken = this.generateAccessToken();
  const refreshToken = this.generateRefreshToken();
  this.refreshToken = refreshToken;
  await this.save({ validateBeforeSave: false });
  return { accessToken, refreshToken, lister: this.toListerJSON() };
};

module.exports = mongoose.model('Lister', listerSchema);