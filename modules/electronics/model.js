const mongoose = require('mongoose');
const { parsePrice } = require('../../utils/priceUtils');

const electronicSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 250 },
  name: { type: String, trim: true, maxlength: 250 },
  brand: { type: String, required: true, trim: true, index: true },
  model: { type: String, required: true, trim: true, index: true },
  category: { type: String, trim: true, default: 'Consumer Electronics', index: true },
  subcategory: { type: String, trim: true, index: true },
  condition: { type: String, trim: true, default: 'Brand New Sealed', index: true },
  warranty: { type: String, trim: true, default: '1 Year Brand Warranty' },
  price: { type: String, required: true, trim: true },
  numericPrice: { type: Number, default: 0, index: true },
  priceValue: { type: Number, default: 0 },
  priceType: { type: String, default: 'fixed', trim: true },
  priceSuffix: { type: String, default: '', trim: true },
  description: { type: String, maxlength: 10000 },
  specs: { type: mongoose.Schema.Types.Mixed },
  statusBadges: { type: [mongoose.Schema.Types.Mixed], default: [] },
  cardPills: { type: [String], default: [] },
  keyAttributes: { type: [mongoose.Schema.Types.Mixed], default: [] },
  highlightBanner: { type: String, default: null },
  images: { type: [String], default: [] },
  videoUrl: { type: String, default: '', trim: true },
  documents: { type: [String], default: [] },
  pdfUrl: { type: String, default: '' },
  brochure: { type: String, default: '' },
  location: { type: String, trim: true, default: 'Bengaluru' },
  area: { type: String, trim: true },
  city: { type: String, default: 'bengaluru', lowercase: true, trim: true, index: true },
  state: { type: String, default: 'Karnataka', trim: true },
  pincode: { type: String, default: '560001', trim: true },
  status: { type: String, default: 'approved', index: true },
  approvalStatus: { type: String, default: 'approved', index: true },
  availabilityStatus: { type: String, enum: ['available', 'sold_out', 'inactive'], default: 'available', index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Lister', index: true },
  lister: { type: mongoose.Schema.Types.ObjectId, ref: 'Lister' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'Lister' },
  listerId: { type: String, trim: true },
  contributor: { type: mongoose.Schema.Types.Mixed },
  origin: { type: String, default: 'in_house_project' },
  details: { type: mongoose.Schema.Types.Mixed },
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

electronicSchema.pre('save', function (next) {
  if (!this.videoUrl && this.video) this.videoUrl = this.video;
  if (!this.videoUrl && Array.isArray(this.videos) && this.videos[0]) this.videoUrl = this.videos[0];
  this.video = undefined;
  this.videos = undefined;
  if (this.price) {
    const num = parsePrice(this.price);
    this.numericPrice = num;
    this.priceValue = num;
  }
  if (!this.name && this.title) this.name = this.title;
  if (!this.title && this.name) this.title = this.name;
  next();
});

electronicSchema.virtual('listerRef', {
  ref: 'Lister',
  localField: 'createdBy',
  foreignField: '_id',
  justOne: true,
});

electronicSchema.index({ status: 1, availabilityStatus: 1, createdAt: -1 });
electronicSchema.index({ status: 1, availabilityStatus: 1, subcategory: 1, createdAt: -1 });
electronicSchema.index({ status: 1, availabilityStatus: 1, numericPrice: 1 });
electronicSchema.index({ category: 1, subcategory: 1 });
electronicSchema.index({ createdAt: -1 });
electronicSchema.index({ brand: 1, model: 1 });
electronicSchema.index({ title: 'text', description: 'text', brand: 'text', model: 'text' });

module.exports = mongoose.model('Electronic', electronicSchema, 'electronics');
