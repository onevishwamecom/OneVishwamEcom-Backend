const mongoose = require('mongoose');
const { parsePrice } = require('../../utils/priceUtils');

const financeSchema = new mongoose.Schema({
  serviceName: { type: String, trim: true, index: true },
  category: { type: String, required: true, trim: true, index: true },
  subcategory: { type: String, trim: true, index: true },
  companyName: { type: String, required: true, trim: true, index: true },
  providerType: { type: String, trim: true },
  logo: { type: String, default: '' },
  banner: { type: String, default: '' },
  interestRate: { type: String, trim: true },
  interestMin: { type: Number, default: 0 },
  interestMax: { type: Number, default: 0 },
  price: { type: String, trim: true },
  numericPrice: { type: Number, default: 0, index: true },
  priceType: { type: String, default: 'fixed', trim: true },
  priceSuffix: { type: String, default: '', trim: true },
  minAmount: { type: String, trim: true },
  maxAmount: { type: String, trim: true },
  minAmountNumeric: { type: Number, default: 0 },
  maxAmountNumeric: { type: Number, default: 0 },
  tenure: { type: String, trim: true },
  description: { type: String, required: true, maxlength: 10000 },
  eligibility: { type: [String], default: [] },
  documentsRequired: { type: [String], default: [] },
  processingTime: { type: String, trim: true },
  features: { type: [String], default: [] },
  location: { type: String, trim: true },
  city: { type: String, required: true, lowercase: true, trim: true, index: true },
  area: { type: String, trim: true, index: true },
  pincode: { type: String, trim: true, match: [/^\d{6}$/, 'Pincode must be 6 digits'] },
  contactEmail: { type: String, required: true, lowercase: true, trim: true },
  serviceMode: { type: String, trim: true },
  postedBy: { type: String, trim: true },
  availability: { type: String, trim: true },
  status: { type: String, enum: ['active', 'inactive', 'pending', 'approved', 'changes-required', 'cancelled'], default: 'active', index: true },
  featured: { type: Boolean, default: false, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  lister: { type: mongoose.Schema.Types.ObjectId, ref: 'Lister', index: true },
  availabilityStatus: { type: String, enum: ['available', 'sold_out', 'inactive'], default: 'available', index: true },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

financeSchema.index({ category: 1, status: 1 });
financeSchema.index({ city: 1, status: 1 });
financeSchema.index({ createdAt: -1 });
financeSchema.index({
  serviceName: 'text', companyName: 'text', category: 'text', description: 'text', location: 'text',
}, { name: 'finance_search' });

financeSchema.pre('save', function (next) {
  if (this.isModified('price') || this.isNew) {
    if (this.price) this.numericPrice = parsePrice(this.price);
  }
  if (this.isModified('minAmount') || this.isNew) {
    if (this.minAmount) this.minAmountNumeric = parsePrice(this.minAmount);
  }
  if (this.isModified('maxAmount') || this.isNew) {
    if (this.maxAmount) this.maxAmountNumeric = parsePrice(this.maxAmount);
  }
  next();
});

module.exports = mongoose.model('Finance', financeSchema);