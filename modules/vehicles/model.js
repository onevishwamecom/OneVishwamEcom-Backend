const mongoose = require('mongoose');

const showroomSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  address: { type: String, trim: true },
  phone: { type: String, trim: true },
  mapsLink: { type: String, trim: true },
}, { _id: false });

const vehicleSchema = new mongoose.Schema({
  title: { type: String, trim: true, maxlength: 200 },
  brand: { type: String, required: true, trim: true, index: true },
  make: { type: String, trim: true },
  model: { type: String, required: true, trim: true, index: true },
  year: { type: Number, required: true, index: true },
  condition: { type: String, required: true, enum: ['new', 'old'], index: true },
  category: { type: String, required: true, enum: ['2-wheeler', '3-wheeler', '4-wheeler', 'commercial'], index: true },
  wheelerType: { type: String, enum: ['2-wheeler', '3-wheeler', '4-wheeler', 'commercial'], index: true },
  fuelType: { type: String, required: true, enum: ['Petrol', 'Diesel', 'Electric', 'CNG'], index: true },
  price: { type: String, required: true, trim: true },
  priceValue: { type: Number, required: true },
  kmDriven: { type: Number, required: true, default: 0, index: true },
  location: { type: String, required: true, trim: true },
  city: { type: String, required: true, lowercase: true, trim: true, index: true },
  pincode: { type: String, required: true, trim: true, match: [/^\d{6}$/, 'Pincode must be 6 digits'] },
  showroom: { type: showroomSchema, default: null },
  contactPhone: { type: String, trim: true },
  contactEmail: { type: String, trim: true },
  loanApproved: { type: Boolean, default: false, index: true },
  featured: { type: Boolean, default: false, index: true },
  variants: { type: Number, default: 1 },
  images: { type: [String], default: [] },
  description: { type: String, maxlength: 5000 },
  transmission: { type: String, enum: ['Manual', 'Automatic', 'CVT', 'DCT', 'AMT'] },
  mileage: { type: String, trim: true },
  registrationNumber: { type: String, trim: true },
  insuranceValidTill: { type: Date },
  ownersCount: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'inactive', 'sold'], default: 'active', index: true },
  listedBy: { type: String, enum: ['Owner', 'Dealer', 'Showroom'] },
  listedDate: { type: Date, default: Date.now },
  views: { type: Number, default: 0, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

vehicleSchema.index({ brand: 1, model: 1 });
vehicleSchema.index({ city: 1, status: 1 });
vehicleSchema.index({ category: 1, status: 1 });
vehicleSchema.index({ condition: 1, status: 1 });
vehicleSchema.index({ createdAt: -1 });
vehicleSchema.index({ priceValue: 1 });
vehicleSchema.index({ featured: 1, status: 1 });
vehicleSchema.index({
  brand: 'text', model: 'text', location: 'text', description: 'text', title: 'text',
}, { weights: { brand: 10, model: 10, title: 8, location: 5, description: 1 }, name: 'vehicle_search' });

vehicleSchema.pre('save', function (next) {
  if (!this.make && this.brand) this.make = this.brand;
  if (!this.brand && this.make) this.brand = this.make;
  if (!this.wheelerType) this.wheelerType = this.category;
  if (!this.title) {
    this.title = `${this.brand} ${this.model} ${this.year || ''}`.trim();
  }
  next();
});

module.exports = mongoose.model('Vehicle', vehicleSchema);
