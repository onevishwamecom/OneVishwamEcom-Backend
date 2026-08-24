const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { BCRYPT_SALT_ROUNDS } = require('../config/authConfig');

const adminSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Admin email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    name: {
      type: String,
      required: [true, 'Admin name is required'],
      trim: true,
      maxlength: [60, 'Name cannot exceed 60 characters'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: ['admin', 'super-admin'],
      default: 'admin',
    },
    refreshToken: { type: String, select: false },
    lastLogin: { type: Date },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

adminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

adminSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

adminSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    { id: this._id, role: this.role, accountType: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRE || '15m' }
  );
};

adminSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    { id: this._id, accountType: 'admin', jti: crypto.randomBytes(16).toString('hex') },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
  );
};

adminSchema.methods.toAdminJSON = function () {
  return {
    id: this._id,
    accountType: 'admin',
    email: this.email,
    name: this.name,
    role: this.role,
    isActive: this.isActive,
    lastLogin: this.lastLogin,
    createdAt: this.createdAt,
  };
};

adminSchema.methods.generateAuthResponse = async function () {
  const accessToken = this.generateAccessToken();
  const refreshToken = this.generateRefreshToken();
  this.refreshToken = refreshToken;
  await this.save({ validateBeforeSave: false });
  return { accessToken, refreshToken, admin: this.toAdminJSON() };
};

module.exports = mongoose.model('Admin', adminSchema);