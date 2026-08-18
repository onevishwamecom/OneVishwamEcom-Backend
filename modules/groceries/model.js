const mongoose = require('mongoose');

const grocerySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 200 },
  category: { type: String, required: true, trim: true, index: true },
  subcategory: { type: String, trim: true },
  price: { type: String, required: true, trim: true },
  numericPrice: { type: Number, default: 0, index: true },
  unit: { type: String, default: 'kg', trim: true },
  stock: { type: Number, default: 0, min: 0 },
  description: { type: String, maxlength: 2000 },
  images: { type: [String], default: [] },
  expiryDate: { type: Date },
  brand: { type: String, trim: true },
  organic: { type: Boolean, default: false },
  discount: { type: Number, default: 0, min: 0, max: 100 },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['available', 'out-of-stock', 'discontinued', 'pending', 'approved', 'changes-required', 'cancelled'], default: 'available', index: true },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

grocerySchema.index({ name: 1, category: 1 });
grocerySchema.index({ createdAt: -1 });
grocerySchema.index({ name: 'text', description: 'text', brand: 'text' });

grocerySchema.pre('save', function (next) {
  if (this.isModified('price') || this.isNew) {
    const cleaned = (this.price || '').replace(/[₹,]/g, '').trim();
    const num = parseFloat(cleaned);
    this.numericPrice = isNaN(num) ? 0 : num;
  }
  next();
});

module.exports = mongoose.model('Grocery', grocerySchema);
