const mongoose = require('mongoose');
const { parsePrice } = require('../../utils/priceUtils');

const garmentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 200 },
  category: { type: String, required: true, enum: ['Men', 'Women', 'Kids', 'Unisex'], index: true },
  subcategory: { type: String, trim: true, index: true },
  size: { type: String, trim: true },
  color: { type: String, trim: true },
  material: { type: String, trim: true },
  price: { type: String, required: true, trim: true },
  numericPrice: { type: Number, default: 0, index: true },
  priceType: { type: String, default: 'fixed', trim: true },
  priceSuffix: { type: String, default: '', trim: true },
  description: { type: String, maxlength: 5000 },
  images: { type: [String], default: [] },
  brand: { type: String, trim: true },
  gender: { type: String, enum: ['male', 'female', 'unisex'], default: 'unisex' },
  quantity: { type: Number, default: 1, min: 0 },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lister: { type: mongoose.Schema.Types.ObjectId, ref: 'Lister', index: true },
  availabilityStatus: { type: String, enum: ['available', 'sold_out', 'inactive'], default: 'available', index: true },
  status: { type: String, enum: ['available', 'sold', 'out-of-stock', 'pending', 'approved', 'changes-required', 'cancelled'], default: 'available', index: true },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

garmentSchema.index({ category: 1, subcategory: 1 });
garmentSchema.index({ createdAt: -1 });
garmentSchema.index({ name: 'text', description: 'text', brand: 'text' });

garmentSchema.pre('save', function (next) {
  if (this.isModified('price') || this.isNew) {
    this.numericPrice = parsePrice(this.price);
  }
  next();
});

module.exports = mongoose.model('Garment', garmentSchema);
