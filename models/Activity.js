const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    firebaseUid: {
      type: String,
      index: true,
    },
    email: {
      type: String,
      index: true,
    },

    sessionIdentifier: {
      type: String,
      index: true,
    },

    category: {
      type: String,
      required: true,
    },

    listingId: {
      type: String,
    },

    title: {
      type: String,
      default: '',
    },

    price: {
      type: String,
      default: '',
    },

    location: {
      type: String,
      default: '',
    },

    image: {
      type: String,
      default: '',
    },

    path: {
      type: String,
      default: '',
    },

    visitedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

activitySchema.index({ category: 1, visitedAt: -1 });
activitySchema.index({ sessionIdentifier: 1, visitedAt: -1 });
activitySchema.index({ user: 1, category: 1 });

module.exports = mongoose.models.Activity || mongoose.model('Activity', activitySchema);