const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { BCRYPT_SALT_ROUNDS } = require('../config/authConfig');

const userSchema = new mongoose.Schema(
  {
    firebaseUid: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    name: {
      type: String,
      trim: true,
      default: 'User',
    },
    fullName: {
      type: String,
      trim: true,
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
    phoneNumber: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
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
      required: false,
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    avatar: {
      type: String,
      default: '',
    },
    profileImage: {
      type: String,
      default: '',
    },
    role: {
      type: String,
      enum: ['user', 'lister', 'admin'],
      default: 'user',
    },
    city: { type: String, trim: true, default: '' },
    area: { type: String, trim: true, default: '' },
    pincode: { type: String, trim: true, default: '' },
    isEmailVerified: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['active', 'suspended', 'deactivated', 'deleted'],
      default: 'active',
    },
    accountStatus: {
      type: String,
      enum: ['active', 'suspended', 'deactivated', 'deleted'],
      default: 'active',
    },
    lastLogin: { type: Date },
    lastActiveAt: { type: Date },
    totalTimeSpent: { type: Number, default: 0 },
    sessionDuration: { type: Number, default: 0 },
    loginCount: { type: Number, default: 0 },
    refreshToken: { type: String, select: false },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    savedListings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Property' }],
    interests: [
      {
        category: { type: String, required: true },
        viewCount: { type: Number, default: 1 },
        lastVisitedAt: { type: Date, default: Date.now },
      },
    ],
    browsingHistory: [
      {
        category: { type: String, default: 'general' },
        listingId: { type: String },
        title: { type: String, default: '' },
        price: { type: String, default: '' },
        location: { type: String, default: '' },
        image: { type: String, default: '' },
        path: { type: String, default: '' },
        visitedAt: { type: Date, default: Date.now },
      },
    ],
    primaryInterest: { type: String, default: '' },
    notifications: {
      email: { type: Boolean, default: false },
      whatsapp: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

userSchema.virtual('mobile').get(function () {
  return this.phoneNumber || '';
});

userSchema.virtual('phone').get(function () {
  return this.phoneNumber || '';
});

userSchema.pre('save', async function (next) {
  if (!this.name && this.fullName) {
    this.name = this.fullName;
  }
  if (!this.fullName && this.name) {
    this.fullName = this.name;
  }
  if (!this.phoneNumber && (this.mobile || this.phone)) {
    this.phoneNumber = this.mobile || this.phone;
  }
  if (!this.password || !this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function (candidate) {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.generateAccessToken = function () {
  return jwt.sign({ id: this._id, role: this.role, accountType: 'user' }, process.env.JWT_SECRET || 'fallback-secret', {
    expiresIn: process.env.JWT_ACCESS_EXPIRE || '15m',
  });
};

userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    { id: this._id, accountType: 'user', jti: crypto.randomBytes(16).toString('hex') },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'fallback-secret',
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
  );
};

userSchema.methods.toProfileJSON = function () {
  const resolvedName = this.name || this.fullName || 'User';
  return {
    id: this._id,
    firebaseUid: this.firebaseUid,
    accountType: this.role === 'lister' ? 'lister' : this.role === 'admin' ? 'admin' : 'user',
    name: resolvedName,
    fullName: resolvedName,
    email: this.email,
    phoneNumber: this.phoneNumber || this.mobile || this.phone || '',
    mobile: this.mobile || this.phoneNumber || '',
    phone: this.phone || this.phoneNumber || this.mobile || null,
    listerId: this.listerId || null,
    avatar: this.avatar || this.profileImage || '',
    profileImage: this.profileImage || this.avatar || '',
    role: this.role,
    city: this.city,
    area: this.area,
    pincode: this.pincode,
    isEmailVerified: this.isEmailVerified,
    phoneVerified: this.phoneVerified,
    accountStatus: this.accountStatus || this.status,
    status: this.status || this.accountStatus,
    lastLogin: this.lastLogin,
    lastActiveAt: this.lastActiveAt,
    totalTimeSpent: this.totalTimeSpent || 0,
    sessionDuration: this.sessionDuration || 0,
    loginCount: this.loginCount || 0,
    createdAt: this.createdAt,
    notifications: {
      email: this.notifications?.email ?? false,
      whatsapp: this.notifications?.whatsapp ?? false,
    },
  };
};

userSchema.methods.toListerJSON = function () {
  const resolvedName = this.name || this.fullName || 'User';
  return {
    id: this._id,
    firebaseUid: this.firebaseUid,
    accountType: 'lister',
    listerId: this.listerId || null,
    name: resolvedName,
    fullName: resolvedName,
    email: this.email,
    phone: this.phone || this.phoneNumber || this.mobile || null,
    phoneNumber: this.phoneNumber || this.phone || this.mobile || '',
    mobile: this.mobile || this.phoneNumber || '',
    avatar: this.avatar || this.profileImage || '',
    profileImage: this.profileImage || this.avatar || '',
    role: this.role,
    city: this.city,
    area: this.area,
    pincode: this.pincode,
    phoneVerified: this.phoneVerified,
    isEmailVerified: this.isEmailVerified,
    accountStatus: this.accountStatus || this.status,
    status: this.status || this.accountStatus,
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

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
