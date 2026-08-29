const mongoose = require('mongoose');

const financeOfferingSchema = new mongoose.Schema({
  title: { type: String, required: [true, 'Title is required'], trim: true, index: true },
  subtitle: { type: String, trim: true },
  type: { type: String, enum: ['home', 'vehicle', 'personal', 'business', 'gold', 'education', 'equipment', 'insurance', 'investment'], trim: true, index: true },
  description: { type: String, maxlength: 5000 },
  interestRate: { type: String, trim: true },
  maxAmount: { type: String, trim: true },
  minAmount: { type: String, trim: true },
  tenure: { type: String, trim: true },
  processingFee: { type: String, trim: true },
  features: { type: [String], default: [] },
  icon: { type: String, default: 'fa-solid fa-file-invoice' },
  badge: { type: String, trim: true },
  badgeColor: { type: String, default: '' },
  order: { type: Number, default: 0, index: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
  availabilityStatus: { type: String, enum: ['available', 'sold_out', 'inactive'], default: 'available', index: true },
}, {
  timestamps: true,
});

financeOfferingSchema.index({ status: 1, type: 1, order: 1 });

module.exports = mongoose.model('FinanceOffering', financeOfferingSchema);
