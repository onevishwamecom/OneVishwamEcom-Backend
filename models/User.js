const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { BCRYPT_SALT_ROUNDS } = require('../config/authConfig');

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
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
    mobile: {
      type: String,
      required: [true, 'Mobile number is required'],
      unique: true,
      trim: true,
      match: [/^\+?[\d\s-]{10,15}$/, 'Please provide a valid mobile number'],
    },
    phone: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    // Application-level Lister business ID. Derived from the VERIFIED phone
    // number (normalized E.164 digits, e.g. "919876543210"). This is NOT the
    // MongoDB _id — it is the stable business identifier for listings.
    listerId: {
      type: String,
      unique: true,
      sparse: true,
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    profileImage: {
      type: String,
      default: '',
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    city: { type: String, trim: true, default: '' },
    area: { type: String, trim: true, default: '' },
    pincode: { type: String, trim: true, default: '' },
    isEmailVerified: { type: Boolean, default: false },
    accountStatus: {
      type: String,
      enum: ['active', 'suspended', 'deactivated'],
      default: 'active',
    },
    lastLogin: { type: Date },
    refreshToken: { type: String, select: false },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    savedListings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Property' }],
    notifications: {
      email: { type: Boolean, default: false },
      whatsapp: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.generateAccessToken = function () {
  return jwt.sign({ id: this._id, role: this.role, accountType: 'user' }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRE || '15m',
  });
};

userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    { id: this._id, accountType: 'user', jti: crypto.randomBytes(16).toString('hex') },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
  );
};

userSchema.methods.toProfileJSON = function () {
  return {
    id: this._id,
    accountType: 'user',
    fullName: this.fullName,
    name: this.fullName,
    email: this.email,
    mobile: this.mobile,
    phone: this.phone || null,
    listerId: this.listerId || null,
    profileImage: this.profileImage,
    role: this.role,
    city: this.city,
    area: this.area,
    pincode: this.pincode,
    isEmailVerified: this.isEmailVerified,
    phoneVerified: this.phoneVerified,
    accountStatus: this.accountStatus,
    status: this.accountStatus,
    lastLogin: this.lastLogin,
    createdAt: this.createdAt,
    notifications: {
      email: this.notifications?.email ?? false,
      whatsapp: this.notifications?.whatsapp ?? false,
    },
  };
};

userSchema.methods.toListerJSON = function () {
  return {
    id: this._id,
    accountType: 'lister',
    listerId: this.listerId || null,
    name: this.fullName,
    fullName: this.fullName,
    email: this.email,
    phone: this.phone || this.mobile || null,
    mobile: this.mobile,
    profileImage: this.profileImage,
    role: this.role,
    city: this.city,
    area: this.area,
    pincode: this.pincode,
    phoneVerified: this.phoneVerified,
    isEmailVerified: this.isEmailVerified,
    accountStatus: this.accountStatus,
    lastLogin: this.lastLogin,
    createdAt: this.createdAt,
    notifications: {
      email: this.notifications?.email ?? false,
      whatsapp: this.notifications?.whatsapp ?? false,
    },
  };
};

userSchema.methods.generateAuthResponse = async function () {
  const accessToken = this.generateAccessToken();
  const refreshToken = this.generateRefreshToken();
  this.refreshToken = refreshToken;
  await this.save({ validateBeforeSave: false });
  return { accessToken, refreshToken, user: this.toProfileJSON() };
};

module.exports = mongoose.model('User', userSchema);
