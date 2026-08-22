const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  city: { type: String, trim: true },
  pincode: { type: String, trim: true, match: [/^\d{6}$/, 'Pincode must be 6 digits'] },
  address: { type: String, trim: true },
  contactEmail: { type: String, trim: true },
}, { _id: false });

const jewellerySchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  name: { type: String, required: true, trim: true, maxlength: 200 },
  metalType: { type: String, required: true, trim: true, index: true },
  purity: { type: String, trim: true, index: true },
  weightGrams: { type: Number, default: 0, min: 0, index: true },
  price: { type: String, required: true, trim: true },
  numericPrice: { type: Number, default: 0, index: true },
  makingCharges: { type: String, default: '₹ 0', trim: true },
  category: { type: String, required: true, trim: true, index: true },
  occasion: { type: [String], default: [] },
  certified: { type: Boolean, default: false, index: true },
  certificationBody: { type: String, trim: true },
  gender: { type: String, enum: ['Women', 'Men', 'Kids', 'Unisex'], default: 'Women', index: true },
  tryAtHome: { type: Boolean, default: false, index: true },
  aiRecommended: { type: Boolean, default: false, index: true },
  images: { type: [String], default: [] },
  store: { type: storeSchema, default: null },
  description: { type: String, maxlength: 5000 },
  gemstone: { type: String, trim: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  lister: { type: mongoose.Schema.Types.ObjectId, ref: 'Lister', index: true },
  status: { type: String, enum: ['active', 'inactive', 'sold', 'pending', 'approved', 'changes-required', 'cancelled'], default: 'active', index: true },
  featured: { type: Boolean, default: false, index: true },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

jewellerySchema.index({ category: 1, status: 1 });
jewellerySchema.index({ metalType: 1, purity: 1 });
jewellerySchema.index({ gender: 1, status: 1 });
jewellerySchema.index({ tryAtHome: 1, status: 1 });
jewellerySchema.index({ aiRecommended: 1, status: 1 });
jewellerySchema.index({ createdAt: -1 });
jewellerySchema.index({ numericPrice: 1 });
jewellerySchema.index({
  name: 'text', title: 'text', description: 'text', category: 'text', metalType: 'text', 'store.city': 'text',
}, { weights: { name: 10, title: 10, category: 5, metalType: 5, description: 1, 'store.city': 3 }, name: 'jewellery_search' });

jewellerySchema.pre('save', function (next) {
  if (this.isNew && !this.name && this.title) this.name = this.title;
  if (this.isNew && !this.title && this.name) this.title = this.name;
  if (this.isModified('price') || this.isNew) {
    const cleaned = (this.price || '').replace(/[₹,]/g, '').trim();
    const num = parseFloat(cleaned);
    this.numericPrice = isNaN(num) ? 0 : num;
  }
  next();
});

module.exports = mongoose.model('Jewellery', jewellerySchema);