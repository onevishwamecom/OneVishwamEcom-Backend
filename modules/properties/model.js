const mongoose = require('mongoose');
const { parsePrice } = require('../../utils/priceUtils');

const propertySchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  subtitle: { type: String, trim: true, maxlength: 500 },
  description: { type: String, maxlength: 5000 },
  category: { type: String, trim: true, index: true },
  subcategory: { type: String, trim: true, index: true },
  purpose: { type: String, enum: ['Sell', 'Rent', 'Lease'], index: true },
  price: { type: String, trim: true },
  numericPrice: { type: Number, default: 0, index: true },
  priceType: { type: String, default: 'fixed', trim: true },
  priceSuffix: { type: String, default: '', trim: true },
  negotiable: { type: Boolean, default: false },
  country: { type: String, default: 'India', trim: true },
  state: { type: String, trim: true },
  city: { type: String, lowercase: true, trim: true, index: true },
  area: { type: String, trim: true, index: true },
  pincode: { type: String, trim: true, match: [/^\d{6}$/, 'Pincode must be 6 digits'] },
  landmark: { type: String, trim: true },
  latitude: { type: Number },
  longitude: { type: Number },
  location: { type: String, trim: true },
  zone: { type: String, trim: true, index: true },
  areaSize: { type: Number },
  areaUnit: { type: String, trim: true },
  numericArea: { type: Number, default: 0, index: true },
  bedrooms: { type: Number, index: true },
  bathrooms: { type: String, trim: true },
  balconies: { type: Number },
  bhk: { type: String, trim: true },
  floors: { type: Number },
  totalFloors: { type: Number },
  floor: { type: String, trim: true },
  facing: { type: String, default: '', trim: true },
  furnishing: { type: String, trim: true },
  furnishingStatus: { type: String, trim: true },
  propertyAge: { type: String, default: '', trim: true },
  parking: { type: String, trim: true },
  waterSupply: { type: String, trim: true },
  powerBackup: { type: Boolean, default: false },
  amenities: { type: [String], default: [] },
  images: { type: [String], default: [] },
  brochure: { type: String, default: '' },
  contact: { type: String, trim: true },
  contactEmail: { type: String, trim: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  agent: {
    name: { type: String, trim: true },
    type: { type: String, default: 'Agent' },
    avatar: { type: String, default: '' },
  },
  status: { type: String, enum: ['available', 'active', 'sold', 'rented', 'inactive', 'deleted', 'pending', 'approved', 'changes-required', 'cancelled'], default: 'active', index: true },
  featured: { type: Boolean, default: false, index: true },
  verified: { type: Boolean, default: false },
  viewsCount: { type: Number, default: 0, index: true },
  recentlyAdded: { type: Boolean, default: false },
  loanApproved: { type: Boolean, default: false },
  shortlisted: { type: Boolean, default: false },
  postedBy: { type: String, default: '', trim: true },
  possessionStatus: { type: String, default: '', trim: true },
  gatedCommunity: { type: Boolean, default: false },
  buildingType: { type: String, enum: ['Residential', 'Commercial'], default: 'Residential' },
  extraRoom: { type: String, default: '', trim: true },
  projectCount: { type: Number, default: 0 },
  totalUnits: { type: Number, default: 0 },
  availableUnits: { type: Number, default: 0 },
  availability: { type: String, default: '', trim: true },
  availabilityStatus: { type: String, enum: ['available', 'sold_out', 'inactive'], default: 'available', index: true },
  lister: { type: mongoose.Schema.Types.ObjectId, ref: 'Lister', index: true },
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      delete ret.__v;
      // Preserve original subcategory value; add normalized version for UI if needed
      const rawSub = String(ret.subcategory || ret.subCategory || ret.category || '').toLowerCase();
      let normalizedSubcategory = 'Flat';
      if (rawSub.includes('plot') || rawSub.includes('site') || rawSub.includes('land')) {
        normalizedSubcategory = 'Plot';
      } else if (rawSub.includes('villa')) {
        normalizedSubcategory = 'Villa';
      }
      return ret;
    },
  },
  toObject: { virtuals: true },
});

propertySchema.index({ city: 1, area: 1 });
propertySchema.index({ subcategory: 1, status: 1 });
propertySchema.index({ category: 1, status: 1 });
propertySchema.index({ purpose: 1, status: 1 });
propertySchema.index({ createdAt: -1 });
propertySchema.index({ viewsCount: -1 });
propertySchema.index({ featured: 1, status: 1 });
propertySchema.index({
  title: 'text', subtitle: 'text', description: 'text', location: 'text', area: 'text', city: 'text',
}, { weights: { title: 10, subtitle: 5, description: 1, location: 3, area: 3, city: 5 }, name: 'property_search' });

propertySchema.pre('save', function (next) {
  if (!this.numericPrice && this.price) {
    this.numericPrice = parsePrice(this.price);
  }
  if (!this.numericArea && this.area) {
    this.numericArea = parseArea(this.area);
  }

  // Store normalized subcategory for UI filtering; keep original subcategory intact
  const rawSub = String(this.subcategory || this.subCategory || this.category || '').toLowerCase();
  let normalizedSubcategory = 'Flat';
  if (rawSub.includes('plot') || rawSub.includes('site') || rawSub.includes('land')) {
    normalizedSubcategory = 'Plot';
  } else if (rawSub.includes('villa')) {
    normalizedSubcategory = 'Villa';
  }

  next();
});

function parseArea(s) {
  if (!s) return 0;
  const m = s.match(/^([\d,.]+)/);
  if (!m) return 0;
  return parseFloat(m[1].replace(/,/g, '')) || 0;
}

propertySchema.statics.parsePrice = parsePrice;

module.exports = mongoose.model('Property', propertySchema);
