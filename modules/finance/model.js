const mongoose = require('mongoose');

const financeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 200 },
  type: { type: String, required: true, trim: true, index: true },
  provider: { type: String, required: true, trim: true, index: true },
  interestRate: { type: String, trim: true },
  numericInterestRate: { type: Number, default: 0 },
  tenureMin: { type: Number, default: 0, min: 0 },
  tenureMax: { type: Number, default: 0, min: 0 },
  amountMin: { type: Number, default: 0, min: 0 },
  amountMax: { type: Number, default: 0, min: 0 },
  description: { type: String, maxlength: 5000 },
  eligibility: { type: String, maxlength: 2000 },
  features: { type: [String], default: [] },
  image: { type: String, default: '' },
  documents: { type: [String], default: [] },
  processingFee: { type: String, trim: true },
  prepaymentPenalty: { type: String, trim: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['active', 'inactive', 'discontinued'], default: 'active', index: true },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

financeSchema.index({ type: 1, provider: 1 });
financeSchema.index({ createdAt: -1 });
financeSchema.index({ name: 'text', description: 'text', provider: 'text' });

module.exports = mongoose.model('Finance', financeSchema);
