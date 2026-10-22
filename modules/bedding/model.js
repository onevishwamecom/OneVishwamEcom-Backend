const mongoose = require('mongoose');
const { parsePrice } = require('../../utils/priceUtils');

const beddingSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 250 },
  name: { type: String, trim: true, maxlength: 250 },
  brand: { type: String, required: true, trim: true, index: true },
  model: { type: String, required: true, trim: true, index: true },
  category: { type: String, trim: true, default: 'Bedding & Sleep Comfort', index: true },
  subcategory: { type: String, trim: true, index: true },
  condition: { type: String, trim: true, default: 'new', index: true },
  warranty: { type: String, trim: true, default: '10-Year Brand Warranty' },
  price: { type: String, required: true, trim: true },
  numericPrice: { type: Number, default: 0, index: true },
  priceValue: { type: Number, default: 0 },
  priceType: { type: String, default: 'fixed', trim: true },
  priceSuffix: { type: String, default: '', trim: true },
  priceNote: { type: String, default: '', trim: true },
  description: { type: String, maxlength: 10000 },
  variants: { type: [mongoose.Schema.Types.Mixed], default: [] },
  statusBadges: { type: [mongoose.Schema.Types.Mixed], default: [] },
  cardPills: { type: [String], default: [] },
  keyAttributes: { type: [mongoose.Schema.Types.Mixed], default: [] },
  overviewHighlights: { type: [mongoose.Schema.Types.Mixed], default: [] },
  features: { type: [String], default: [] },
  specifications: { type: [mongoose.Schema.Types.Mixed], default: [] },
  highlightBanner: { type: String, default: null },
  trustBannerText: { type: String, default: '100% Brand Genuine & Direct Factory Warranty' },
  loanApproved: { type: Boolean, default: true },
  images: { type: [String], default: [] },
  videoUrl: { type: String, default: '', trim: true },
  documents: { type: [String], default: [] },
  pdfUrl: { type: String, default: '' },
  brochure: { type: String, default: '' },
  location: { type: String, trim: true, default: 'Bengaluru' },
  area: { type: String, trim: true },
  city: { type: String, default: 'bengaluru', lowercase: true, trim: true, index: true },
  state: { type: String, default: 'Karnataka', trim: true },
  pincode: { type: String, default: '560038', trim: true },
  showroom: { type: mongoose.Schema.Types.Mixed },
  status: { type: String, default: 'approved', index: true },
  approvalStatus: { type: String, default: 'approved', index: true },
  availabilityStatus: { type: String, enum: ['available', 'sold_out', 'inactive'], default: 'available', index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Lister', index: true },
  lister: { type: mongoose.Schema.Types.ObjectId, ref: 'Lister' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'Lister' },
  listerId: { type: String, trim: true },
  contributor: { type: mongoose.Schema.Types.Mixed },
  origin: { type: String, default: 'channel_partner_project' },
  details: { type: mongoose.Schema.Types.Mixed },
  isBulkListing: { type: Boolean, default: false, index: true },
  bulkBatchId: { type: String, trim: true, index: true },
  bulkFilename: { type: String, trim: true },
  bulkUploadedAt: { type: Date },
}, {
  strict: false,
  timestamps: true,
  collection: 'beddings',
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      delete ret.__v;
      ret.videoUrl = ret.videoUrl || '';
      ret.name = ret.name || ret.title;
      ret.title = ret.title || ret.name;
      ret.lister = ret.lister || ret.createdBy;
      ret.user = ret.createdBy;
      return ret;
    },
  },
  toObject: { virtuals: true },
});

beddingSchema.pre('save', function (next) {
  if (!this.name && this.title) this.name = this.title;
  if (!this.title && this.name) this.title = this.name;
  if (this.price && (!this.numericPrice || this.numericPrice === 0)) {
    const parsed = parsePrice(this.price);
    if (parsed) {
      this.numericPrice = parsed;
      this.priceValue = parsed;
    }
  }

  // Ensure maximum 5 direct image URLs
  if (Array.isArray(this.images)) {
    this.images = this.images.map((img) => (typeof img === 'string' ? img.trim() : '')).filter(Boolean).slice(0, 5);
  }

  // Enforce single video field: keep only videoUrl
  if (!this.videoUrl && this.video) {
    this.videoUrl = this.video;
  }
  if (!this.videoUrl && Array.isArray(this.videos) && this.videos.length > 0) {
    this.videoUrl = this.videos[0];
  }
  this.set('video', undefined);
  this.set('videos', undefined);

  next();
});

beddingSchema.index({ status: 1, availabilityStatus: 1, createdAt: -1 });
beddingSchema.index({ status: 1, availabilityStatus: 1, subcategory: 1, createdAt: -1 });
beddingSchema.index({ status: 1, availabilityStatus: 1, numericPrice: 1 });
beddingSchema.index({ brand: 1, model: 1 });
beddingSchema.index({ createdAt: -1 });
beddingSchema.index({ title: 'text', brand: 'text', model: 'text', description: 'text', category: 'text' });

const Bedding = mongoose.models.Bedding || mongoose.model('Bedding', beddingSchema);

module.exports = Bedding;
