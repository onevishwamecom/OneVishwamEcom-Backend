const mongoose = require('mongoose');

const visitorSessionSchema = new mongoose.Schema(
  {
    identifier: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    ip: {
      type: String,
      default: '',
    },
    userAgent: {
      type: String,
      default: '',
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    isOnline: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 86400, // Automatically expires and gets removed by MongoDB after 24 hours (86400s)
    },
  },
  {
    timestamps: false,
  }
);

module.exports = mongoose.model('VisitorSession', visitorSessionSchema);
