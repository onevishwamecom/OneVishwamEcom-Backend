const mongoose = require('mongoose');

const requirementSchema = new mongoose.Schema({
  serviceType: { type: String, required: true, index: true },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true },
  message: { type: String, trim: true, maxlength: 2000 },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

requirementSchema.index({ serviceType: 1, createdAt: -1 });
requirementSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Requirement', requirementSchema);
