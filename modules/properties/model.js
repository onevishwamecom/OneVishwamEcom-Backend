const mongoose = require('mongoose');
const { parsePrice } = require('../../utils/priceUtils');
const Property = require('../../models/Property');

const propertySchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  subtitle: { type: String, trim: true, maxlength: 500 },
  description: { type: String, maxlength: 5000 },
  category: { type: String, trim: true, index: true },
  subcategory: { type: String, trim: true, index: true },
  purpose: { type: String, enum: ['Sell', 'Rent', 'Lease'], index: true },
  price: { type: String, trim: true },
  numericPrice: { type: Number, default: 0, index: true },
  propertyType: { type: String, trim: true, index: true },
  rawPrice: { type: Number, index: true },
  priceType: { type: String, default: 'fixed', trim: true },
  priceSuffix: { type: String, default: '', trim: true },
  negotiable: { type: Boolean, default: false },
  country: { type: String, default: 'India', trim: true },
  state: { type: String, trim: true },
  city: { type: String, lowercase: true, trim: true, index: true },
  area: { type: String, trim: true, index: true },
  pincode: {
    type: String,
    trim: true,
    validate: {
      validator: (v) => !v || /^\d{6}$/.test(String(v).trim()),
      message: 'Pincode must be 6 digits',
    },
  },
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
  floors: { type: String, trim: true },
  totalFloors: { type: Number },
  floor: { type: String, trim: true },
  towers: { type: String, trim: true },
  approval: { type: String, trim: true },
  possession: { type: String, trim: true },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  vendorName: { type: String, trim: true },
  channelPartnerName: { type: String, trim: true },
  origin: { type: String, trim: true, default: '' },
  bankLoanDetails: { type: String, trim: true },
  facing: { type: String, default: '', trim: true },
  furnishing: { type: String, trim: true },
  furnishingStatus: { type: String, trim: true },
  propertyAge: { type: String, default: '', trim: true },
  parking: { type: String, trim: true },
  waterSupply: { type: String, trim: true },
  powerBackup: { type: Boolean, default: false },
  amenities: { type: [String], default: [] },
  images: { type: [String], default: [] },
  video: { type: String, default: '', trim: true },
  videoUrl: { type: String, default: '', trim: true },
  videos: { type: [String], default: [] },
  floorPlanImages: { type: [String], default: [] },
  pdfUrl: { type: String, default: '' },
  brochure: { type: String, default: '' },
  contact: { type: String, trim: true },
  contactEmail: { type: String, trim: true },
  email: { type: String, trim: true },
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
      // Dual-compatibility cross-mappings
      ret.details = ret.details || {};
      ret.description = ret.description || (typeof ret.details === 'string' ? ret.details : (ret.details.description || ''));
      ret.channelPartnerName = ret.channelPartnerName || (ret.details && ret.details.channelPartnerName) || '';
      ret.bankLoanDetails = ret.bankLoanDetails || (ret.details && ret.details.bankLoanDetails) || '';
      ret.loanApproved = Boolean(ret.loanApproved || (ret.bankLoanDetails && !ret.bankLoanDetails.toLowerCase().includes('no')));
      ret.possession = ret.possession || ret.possessionStatus || '';
      ret.possessionStatus = ret.possessionStatus || ret.possession || '';
      ret.propertyType = ret.propertyType || ret.subcategory || ret.subCategory || '';
      ret.subcategory = ret.subcategory || ret.propertyType || '';
      ret.email = ret.email || ret.contactEmail || '';
      ret.contactEmail = ret.contactEmail || ret.email || '';
      ret.rawPrice = ret.rawPrice || ret.numericPrice || 0;
      ret.vendorName = ret.vendorName || ret.agent?.name || ret.postedBy || '';

      ret.floorPlans = ret.floorPlanImages || [];
      ret.floorPlanPdf = ret.pdfUrl || ret.brochure || '';
      ret.pdf = ret.pdfUrl || ret.brochure || '';
      ret.images = Array.isArray(ret.images) ? ret.images.filter(Boolean) : [];
      const v = ret.video || ret.videoUrl || (Array.isArray(ret.videos) && ret.videos[0]) || '';
      ret.video = v;
      ret.videoUrl = v;
      ret.videos = Array.isArray(ret.videos) && ret.videos.length > 0 ? ret.videos : (v ? [v] : []);
      return ret;
    },
  },
  toObject: { virtuals: true },
});

propertySchema.index({ city: 1, area: 1 });
propertySchema.index({ subcategory: 1, status: 1 });
propertySchema.index({ category: 1, status: 1 });
propertySchema.index({ purpose: 1, status: 1 });
propertySchema.index({ propertyType: 1, status: 1 });
propertySchema.index({ approval: 1, status: 1 });
propertySchema.index({ createdAt: -1 });
propertySchema.index({ viewsCount: -1 });
propertySchema.index({ featured: 1, status: 1 });
propertySchema.index({
  title: 'text', subtitle: 'text', description: 'text', location: 'text', area: 'text', city: 'text',
}, { weights: { title: 10, subtitle: 5, description: 1, location: 3, area: 3, city: 5 }, name: 'property_search' });

propertySchema.pre('save', function (next) {
  // Synchronize from details subdocument if provided
  if (this.details && typeof this.details === 'object') {
    const d = this.details;
    if (!this.title && (d.propertyName || d.projectName)) {
      this.title = d.propertyName || d.projectName;
    }
    if (!this.facing && (d.facing || d.plotFacing)) {
      this.facing = d.facing || d.plotFacing;
    }
    if (!this.bhk && d.bhk) {
      this.bhk = d.bhk;
    }
    if (!this.floors && (d.floors || d.totalFloors)) {
      this.floors = d.floors || d.totalFloors;
    }
    if (!this.furnishing && d.furnishing) {
      this.furnishing = d.furnishing;
    }
    if (!this.possession && d.possession) {
      this.possession = d.possession;
    }
    if (!this.parking && (d.parking || d.parkingCapacity)) {
      this.parking = d.parking || d.parkingCapacity;
    }
    if (!this.approval && (d.approvalAuthority || d.approvalZone)) {
      this.approval = d.approvalAuthority || d.approvalZone;
    }
    if (!this.bankLoanDetails && d.bankLoanDetails) {
      this.bankLoanDetails = d.bankLoanDetails;
    }
    if (d.gatedCommunity !== undefined) {
      this.gatedCommunity = d.gatedCommunity === 'Yes';
    }
    if (d.negotiable !== undefined) {
      this.negotiable = d.negotiable === 'Yes';
    }
    if (this.bankLoanDetails) {
      this.loanApproved = !this.bankLoanDetails.toLowerCase().includes('no');
    }
  }

  // Sync video, videoUrl, and videos
  const v = this.video || this.videoUrl || (Array.isArray(this.videos) && this.videos[0]) || '';
  if (v) {
    if (!this.video) this.video = v;
    if (!this.videoUrl) this.videoUrl = v;
    if (!Array.isArray(this.videos) || this.videos.length === 0) this.videos = [v];
  }

  // Sync numericPrice and rawPrice
  if (this.rawPrice && !this.numericPrice) {
    this.numericPrice = this.rawPrice;
  } else if (!this.numericPrice && this.price) {
    this.numericPrice = parsePrice(this.price);
  }
  if (this.numericPrice && !this.rawPrice) {
    this.rawPrice = this.numericPrice;
  }

  if (!this.numericArea && this.area) {
    this.numericArea = parseArea(this.area);
  }

  // Cross-populate alias fields
  if (this.details && !this.description && typeof this.details === 'string') {
    this.description = this.details;
  }

  if (this.possession && !this.possessionStatus) {
    this.possessionStatus = this.possession;
  } else if (this.possessionStatus && !this.possession) {
    this.possession = this.possessionStatus;
  }

  if (this.propertyType && !this.subcategory) {
    this.subcategory = this.propertyType;
  } else if (this.subcategory && !this.propertyType) {
    this.propertyType = this.subcategory;
  }

  if (this.email && !this.contactEmail) {
    this.contactEmail = this.email;
  } else if (this.contactEmail && !this.email) {
    this.email = this.contactEmail;
  }

  // Normalize images array
  if (Array.isArray(this.images)) {
    this.images = this.images.filter((img) => img && typeof img === 'string' && img.trim() !== '');
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
module.exports = Property;
