const mongoose = require('mongoose');
const { parsePrice } = require('../../utils/priceUtils');

const showroomSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  address: { type: String, trim: true },
  phone: { type: String, trim: true },
  email: { type: String, trim: true },
  type: { type: String, trim: true },
  mapsLink: { type: String, trim: true },
}, { _id: false });

const vehicleSchema = new mongoose.Schema({
  id: { type: mongoose.Schema.Types.Mixed },
  title: { type: String, trim: true, maxlength: 250 },
  subtitle: { type: String, trim: true },
  brand: { type: String, required: true, trim: true, index: true },
  make: { type: String, trim: true },
  model: { type: String, required: true, trim: true, index: true },
  year: { type: Number, required: true, index: true },
  condition: { type: String, trim: true, default: 'new', index: true },
  category: { type: String, trim: true, default: '4-wheeler', index: true },
  subcategory: { type: String, trim: true, index: true },
  bodyType: { type: String, trim: true, index: true },
  wheelerType: { type: String, trim: true, default: '4-wheeler', index: true },
  fuelType: { type: String, trim: true, default: 'Petrol', index: true },
  price: { type: String, required: true, trim: true },
  priceValue: { type: Number, default: 0 },
  numericPrice: { type: Number, default: 0 },
  priceType: { type: String, default: 'fixed', trim: true },
  priceSuffix: { type: String, default: '', trim: true },
  priceNote: { type: String, default: '', trim: true },
  kmDriven: { type: Number, default: 0, index: true },
  location: { type: String, required: true, trim: true },
  city: { type: String, default: 'bengaluru', lowercase: true, trim: true, index: true },
  state: { type: String, default: 'Karnataka', trim: true },
  pincode: { type: String, default: '560001', trim: true },
  showroom: { type: showroomSchema, default: null },
  contactEmail: { type: String, trim: true },
  loanApproved: { type: Boolean, default: false, index: true },
  featured: { type: Boolean, default: false, index: true },
  variants: { type: mongoose.Schema.Types.Mixed, default: [] },
  statusBadges: { type: [mongoose.Schema.Types.Mixed], default: [] },
  cardPills: { type: [String], default: [] },
  trustBannerText: { type: String, trim: true },
  highlightBanner: { type: String, default: null },
  keyAttributes: { type: [mongoose.Schema.Types.Mixed], default: [] },
  overviewHighlights: { type: [mongoose.Schema.Types.Mixed], default: [] },
  images: { type: [String], default: [] },
  video: { type: String, default: '', trim: true },
  videoUrl: { type: String, default: '', trim: true },
  videos: { type: [String], default: [] },
  documents: { type: [String], default: [] },
  pdfUrl: { type: String, default: '' },
  brochure: { type: String, default: '' },
  locationUrl: { type: String, trim: true },
  mapUrl: { type: String, trim: true },
  googleMapsUrl: { type: String, trim: true },
  description: { type: String, maxlength: 10000 },
  features: { type: [String], default: [] },
  amenities: { type: [String], default: [] },
  transmission: { type: String, trim: true },
  mileage: { type: String, trim: true },
  registrationNumber: { type: String, trim: true },
  insuranceValidTill: { type: Date },
  ownersCount: { type: Number, default: 0 },
  status: { type: String, default: 'approved', index: true },
  approvalStatus: { type: String, default: 'approved', index: true },
  listedBy: { type: String, default: 'Dealer' },
  listedDate: { type: Date, default: Date.now },
  views: { type: Number, default: 0, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Lister', index: true },
  lister: { type: mongoose.Schema.Types.ObjectId, ref: 'Lister' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'Lister' },
  listerId: { type: String, trim: true },
  contributor: { type: mongoose.Schema.Types.Mixed },
  origin: { type: String, default: 'in_house_project' },
  details: { type: mongoose.Schema.Types.Mixed },
  availabilityStatus: { type: String, enum: ['available', 'sold_out', 'inactive'], default: 'available', index: true },
  isBulkListing: { type: Boolean, default: false, index: true },
  bulkBatchId: { type: String, trim: true, index: true },
  bulkFilename: { type: String, trim: true },
  bulkUploadedAt: { type: Date },
}, {
  strict: false,
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      delete ret.__v;
      const v = ret.video || ret.videoUrl || (Array.isArray(ret.videos) && ret.videos[0]) || '';
      ret.video = v;
      ret.videoUrl = v;
      ret.videos = Array.isArray(ret.videos) && ret.videos.length > 0 ? ret.videos : (v ? [v] : []);
      ret.lister = ret.lister || ret.createdBy;
      ret.user = ret.createdBy;
      return ret;
    },
  },
  toObject: { virtuals: true },
});

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
  // Sync video, videoUrl, and videos
  const v = this.video || this.videoUrl || (Array.isArray(this.videos) && this.videos[0]) || '';
  if (v) {
    if (!this.video) this.video = v;
    if (!this.videoUrl) this.videoUrl = v;
    if (!Array.isArray(this.videos) || this.videos.length === 0) this.videos = [v];
  }

  if (!this.make && this.brand) this.make = this.brand;
  if (!this.brand && this.make) this.brand = this.make;
  if (!this.wheelerType) this.wheelerType = this.category;
  if (!this.title) {
    this.title = `${this.brand} ${this.model} ${this.year || ''}`.trim();
  }
  if (this.isModified('price') || this.isNew) {
    const parsed = parsePrice(this.price);
    if (parsed > 0) {
      this.priceValue = parsed;
      this.numericPrice = parsed;
    }
  }
  if (!this.numericPrice && this.priceValue) {
    this.numericPrice = this.priceValue;
  }
  if (!this.priceValue && this.numericPrice) {
    this.priceValue = this.numericPrice;
  }

  // Auto-enrich cardPills
  if (!this.cardPills || this.cardPills.length === 0) {
    this.cardPills = [
      this.fuelType || 'Petrol',
      this.transmission || 'Manual',
      this.year ? String(this.year) : null,
    ].filter(Boolean);
  }

  // Auto-enrich statusBadges
  if (!this.statusBadges || this.statusBadges.length === 0) {
    const badges = [];
    if (this.loanApproved) badges.push({ label: 'Loan Pre-Approved', className: 'bg-blue-600 text-white' });
    const isNew = String(this.condition || '').toLowerCase().includes('new');
    badges.push({
      label: isNew ? 'Brand New' : 'Certified Pre-Owned',
      className: isNew ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-white',
    });
    if (this.featured) badges.push({ label: 'Featured', className: 'bg-amber-500 text-white' });
    this.statusBadges = badges;
  }

  // Auto-enrich overviewHighlights
  if (!this.overviewHighlights || this.overviewHighlights.length === 0) {
    const isNew = String(this.condition || '').toLowerCase().includes('new');
    this.overviewHighlights = [
      { label: 'Fuel System', value: this.fuelType || 'Petrol', icon: 'fa-gas-pump', color: 'text-emerald-600 bg-emerald-50' },
      { label: 'Transmission', value: this.transmission || 'Manual', icon: 'fa-gear', color: 'text-blue-600 bg-blue-50' },
      { label: 'Model Year', value: String(this.year || new Date().getFullYear()), icon: 'fa-calendar', color: 'text-amber-600 bg-amber-50' },
      { label: 'KM Driven', value: isNew ? 'Brand New (0 km)' : `${this.kmDriven || 0} km`, icon: 'fa-gauge', color: 'text-cyan-600 bg-cyan-50' },
      this.mileage ? { label: 'ARAI Mileage', value: this.mileage, icon: 'fa-gauge-high', color: 'text-teal-600 bg-teal-50' } : null,
      this.showroom?.name ? { label: 'Dealership', value: this.showroom.name, icon: 'fa-building', color: 'text-indigo-600 bg-indigo-50' } : null,
    ].filter(Boolean);
  }
  next();
});

module.exports = mongoose.models.Vehicle || mongoose.model('Vehicle', vehicleSchema);
