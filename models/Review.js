const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
    },
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reviewer is required'],
    },
    reviewedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reviewed user is required'],
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
    },
    comment: { type: String, maxlength: [1000, 'Comment cannot exceed 1000 characters'] },
  },
  { timestamps: true }
);

reviewSchema.index({ reviewedUser: 1, createdAt: -1 });
reviewSchema.index({ reviewer: 1, reviewedUser: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);
