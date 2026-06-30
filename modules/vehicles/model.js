const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  make: { type: String, required: true, trim: true, index: true },
  model: { type: String, required: true, trim: true, index: true },
  year: { type: Number, index: true },
  price: { type: String, required: true, trim: true },
  numericPrice: { type: Number, default: 0, index: true },
  mileage: { type: String, trim: true },
  fuelType: { type: String, enum: ['Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG', 'LPG'], default: 'Petrol', index: true },
  transmission: { type: String, enum: ['Manual', 'Automatic'], default: 'Manual' },
  condition: { type: String, enum: ['New', 'Used'], default: 'Used', index: true },
  seats: { type: Number, default: 5 },
  color: { type: String, trim: true },
  registrationNumber: { type: String, trim: true },
  ownership: { type: String, default: '1st', trim: true },
  location: { type: String, required: true, trim: true },
  city: { type: String, required: true, lowercase: true, trim: true, index: true },
  description: { type: String, maxlength: 5000 },
  images: { type: [String], default: [] },
  features: { type: [String], default: [] },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['available', 'sold', 'pending'], default: 'available', index: true },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

vehicleSchema.index({ make: 1, model: 1 });
vehicleSchema.index({ city: 1, status: 1 });
vehicleSchema.index({ createdAt: -1 });
vehicleSchema.index({
  title: 'text', description: 'text', make: 'text', model: 'text', location: 'text',
}, { weights: { title: 10, make: 5, model: 5, location: 3, description: 1 }, name: 'vehicle_search_index' });

vehicleSchema.pre('save', function (next) {
  if (this.isModified('price') || this.isNew) {
    const cleaned = (this.price || '').replace(/[₹,]/g, '').trim();
    const num = parseFloat(cleaned);
    this.numericPrice = isNaN(num) ? 0 : num;
  }
  if (this.isNew && !this.title) {
    this.title = `${this.make} ${this.model} ${this.year || ''}`.trim();
  }
  next();
});

module.exports = mongoose.model('Vehicle', vehicleSchema);
