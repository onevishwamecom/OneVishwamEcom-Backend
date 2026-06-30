const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  item: { type: mongoose.Schema.Types.ObjectId, required: true },
  serviceType: { type: String, required: true, index: true },
}, { timestamps: true });

wishlistSchema.index({ user: 1, item: 1, serviceType: 1 }, { unique: true });
wishlistSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Wishlist', wishlistSchema);
