const mongoose = require('mongoose');

const jewellerySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 200 },
  category: { type: String, required: true, trim: true, index: true },
  material: { type: String, required: true, trim: true, index: true },
  purity: { type: String, trim: true },
  weight: { type: Number, default: 0, min: 0, index: true },
  weightUnit: { type: String, default: 'grams', trim: true },
  price: { type: String, required: true, trim: true },
  numericPrice: { type: Number, default: 0, index: true },
  makingCharge: { type: String, default: '', trim: true },
  description: { type: String, maxlength: 5000 },
  images: { type: [String], default: [] },
  gemstone: { type: String, trim: true },
  occasion: { type: String, trim: true },
  gender: { type: String, enum: ['male', 'female', 'unisex'], default: 'female' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['available', 'sold', 'custom-order'], default: 'available', index: true },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

jewellerySchema.index({ category: 1, material: 1 });
jewellerySchema.index({ createdAt: -1 });
jewellerySchema.index({ name: 'text', description: 'text' });

jewellerySchema.pre('save', function (next) {
  if (this.isModified('price') || this.isNew) {
    const cleaned = (this.price || '').replace(/[₹,]/g, '').trim();
    const num = parseFloat(cleaned);
    this.numericPrice = isNaN(num) ? 0 : num;
  }
  next();
});

module.exports = mongoose.model('Jewellery', jewellerySchema);
