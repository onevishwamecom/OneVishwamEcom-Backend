const mongoose = require('mongoose');

const requirementSchema = new mongoose.Schema({
  serviceType: { type: String, required: true, index: true },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true },
  message: { type: String, trim: true, maxlength: 2000 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Lister', index: true },
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      delete ret.__v;
      ret.lister = ret.lister || ret.createdBy;
      ret.user = ret.createdBy;
      return ret;
    },
  },
  toObject: { virtuals: true },
});

requirementSchema.virtual('lister', {
  ref: 'Lister',
  localField: 'createdBy',
  foreignField: '_id',
  justOne: true,
});

requirementSchema.virtual('user').get(function () {
  return this.createdBy;
});

requirementSchema.index({ serviceType: 1, createdAt: -1 });
requirementSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Requirement', requirementSchema);
