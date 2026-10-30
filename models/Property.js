const mongoose = require('mongoose');

const CANONICAL_PROPERTY_TYPES = [
  'Residential',
  'Flat',
  'Independent House',
  'Plot',
  'Land',
  'Agricultural',
  'Commercial',
  'Industrial',
];

const PROPERTY_TYPES = [
  ...CANONICAL_PROPERTY_TYPES,
  'Flat / Villa',
  'Flat/Villa',
  'Plot / Land',
  'Plot/Land',
  'Villa',
];

function normalizeCanonicalPropertyType(val) {
  if (!val || typeof val !== 'string' || !val.trim()) return 'Plot';
  const str = String(val).trim().toLowerCase();
  if (
    str === 'flat/villa' ||
    str === 'flat / villa' ||
    str === 'flat' ||
    str.includes('flat') ||
    str.includes('apartment') ||
    str.includes('villa')
  ) {
    return 'Flat';
  }
  if (
    str === 'plot/land' ||
    str === 'plot / land' ||
    str.includes('plot') ||
    str.includes('layout') ||
    str.includes('plat') ||
    str.includes('site')
  ) {
    return 'Plot';
  }
  if (str.includes('land') && !str.includes('agri')) return 'Land';
  if (str.includes('independent') || str.includes('house')) return 'Independent House';
  if (str.includes('agri') || str.includes('farm') || str.includes('plantation')) return 'Agricultural';
  if (str.includes('commercial') || str.includes('shop') || str.includes('office') || str.includes('retail') || str.includes('showroom')) return 'Commercial';
  if (str.includes('indus') || str.includes('factory') || str.includes('warehouse') || str.includes('shed')) return 'Industrial';
  if (str.includes('residen')) return 'Residential';
  return 'Plot';
}

const PROPERTY_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'active',
  'changes-required',
  'cancelled',
  'inactive',
  'sold',
  'rented',
  'deleted',
];

/**
 * 94-Question Channel Partner Specification Schema
 * ============================================================================
 * Tier 1: Root Identifiers (Common for all listings)
 * Tier 2: Polymorphic Subdocument `details` (Strictly scoped to propertyType)
 * Tier 3: Final & Financial Metadata (Approvals, Media & Documents)
 * ============================================================================
 */

// Polymorphic details schema supporting all 7 categories and custom write-ins
const propertyDetailsSchema = new mongoose.Schema(
  {
    // Residential fields
    propertyName: { type: String, trim: true },
    dimensions: { type: String, trim: true },
    facing: { type: String, trim: true },
    facingOther: { type: String, trim: true },
    cornerPlot: { type: String, trim: true },
    cornerPlotOther: { type: String, trim: true },
    approvedLayout: { type: String, trim: true },
    approvalAuthority: { type: String, trim: true },
    approvalAuthorityOther: { type: String, trim: true },
    boundaryWall: { type: String, trim: true },

    // Flat/Villa & Independent House fields
    apartmentName: { type: String, trim: true },
    projectName: { type: String, trim: true },
    bhk: { type: String, trim: true },
    superBuiltUpArea: { type: String, trim: true },
    floors: { type: String, trim: true },
    bathrooms: { type: String, trim: true },
    balconies: { type: String, trim: true },
    furnishingStatus: { type: String, trim: true },
    furnishingStatusOther: { type: String, trim: true },
    propertyAge: { type: String, trim: true },
    possessionStatus: { type: String, trim: true },
    parkingAvailability: { type: String, trim: true },
    amenities: { type: [String], default: [] },
    amenitiesOther: { type: String, trim: true },
    maintenanceCharges: { type: String, trim: true },
    gatedCommunity: { type: String, trim: true },
    gardenTerrace: { type: String, trim: true },

    // Agricultural fields
    totalLandExtent: { type: String, trim: true },
    surveyNumber: { type: String, trim: true },
    landType: { type: String, trim: true },
    landTypeOther: { type: String, trim: true },
    roadAccessWidth: { type: String, trim: true },
    waterAvailability: { type: mongoose.Schema.Types.Mixed }, // String or Array of Strings
    waterAvailabilityOther: { type: String, trim: true },
    electricityAvailable: { type: String, trim: true },
    currentCrop: { type: String, trim: true },
    soilType: { type: String, trim: true },
    farmhouseAvailable: { type: String, trim: true },
    fencingAvailable: { type: String, trim: true },
    expectedPricePerAcre: { type: String, trim: true },

    // Commercial fields
    commercialType: { type: String, trim: true },
    carpetArea: { type: String, trim: true },
    builtUpArea: { type: String, trim: true },
    totalFloors: { type: String, trim: true },
    washrooms: { type: String, trim: true },
    liftAvailable: { type: String, trim: true },
    powerBackup: { type: String, trim: true },
    parkingCapacity: { type: String, trim: true },
    mainRoadFrontage: { type: String, trim: true },
    occupancyStatus: { type: String, trim: true },
    rentalIncome: { type: String, trim: true },

    // Plot/Land fields
    plotType: { type: String, trim: true },
    totalLandArea: { type: String, trim: true },
    plotDimensions: { type: String, trim: true },
    roadFacingWidth: { type: String, trim: true },
    adjoiningRoadsCount: { type: String, trim: true },
    conversionStatus: { type: String, trim: true },
    boundaryFencing: { type: String, trim: true },
    utilities: { type: [String], default: [] },
    utilitiesOther: { type: String, trim: true },

    // Industrial fields
    industrialType: { type: String, trim: true },
    propertyStatus: { type: String, trim: true },
    shedDimensions: { type: String, trim: true },
    numberOfFloors: { type: String, trim: true },
    roadFrontage: { type: String, trim: true },
    approachRoadWidth: { type: String, trim: true },
    heavyVehicleAccess: { type: String, trim: true },
    powerLoad: { type: String, trim: true },
    industrialZone: { type: String, trim: true },
    pollutionApproval: { type: String, trim: true },
    fireSafetyApproval: { type: String, trim: true },
    officeSpace: { type: String, trim: true },
    labourQuarters: { type: String, trim: true },
    loadingArea: { type: String, trim: true },
    suitableIndustries: { type: String, trim: true },

    // Common commercial/financial terms across categories
    expectedPrice: { type: String, trim: true },
    negotiable: { type: String, trim: true },
  },
  { _id: false, strict: false }
);

const documentItemSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    filename: { type: String, trim: true, default: '' },
    fileType: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const propertySchema = new mongoose.Schema(
  {
    // ==========================================
    // Tier 1: Root Identifiers
    // ==========================================
    vendorName: {
      type: String,
      required: [true, 'Vendor / Builder / Owner name is required'],
      trim: true,
    },
    channelPartnerName: {
      type: String,
      required: [true, 'Channel Partner name is required'],
      trim: true,
    },
    propertyType: {
      type: String,
      required: [true, 'Property type is required'],
      enum: {
        values: PROPERTY_TYPES,
        message: '{VALUE} is not a supported propertyType',
      },
      set: (v) => normalizeCanonicalPropertyType(v),
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lister',
      required: [true, 'Creator Lister reference is required'],
      index: true,
    },
    status: {
      type: String,
      enum: PROPERTY_STATUSES,
      default: 'pending',
      index: true,
    },
    origin: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    priority: {
      type: Number,
      default: 0,
      index: true,
    },

    // ==========================================
    // Tier 2: Subdocument `details`
    // ==========================================
    details: {
      type: propertyDetailsSchema,
      default: () => ({}),
    },

    // ==========================================
    // Tier 3: Final / Financial Metadata
    // ==========================================
    bankLoanDetails: {
      type: String,
      required: [true, 'Bank loan approval details are required'],
      trim: true,
    },
    loanApproved: {
      type: Boolean,
      default: false,
    },
    documents: {
      type: [documentItemSchema],
      default: [],
    },
    images: {
      type: [String],
      default: [],
    },
    videoUrl: {
      type: String,
      trim: true,
      default: '',
    },
    pdfUrl: {
      type: String,
      trim: true,
      default: '',
    },
    floorPlanImages: {
      type: [String],
      default: [],
    },

    // ==========================================
    // Marketplace Root Fields
    // ==========================================
    title: { type: String, trim: true, default: '' },
    subtitle: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
    category: { type: String, trim: true, default: 'properties', index: true },
    purpose: { type: String, enum: ['Sell', 'Rent', 'Lease'], default: 'Sell', index: true },
    price: { type: String, trim: true, default: '' },
    numericPrice: { type: Number, default: 0, index: true },
    priceType: { type: String, default: 'fixed', trim: true },
    priceSuffix: { type: String, default: '', trim: true },
    negotiable: { type: Boolean, default: false },
    country: { type: String, default: 'India', trim: true },
    state: { type: String, trim: true, default: 'karnataka' },
    city: { type: String, lowercase: true, trim: true, default: 'bengaluru', index: true },
    area: { type: String, trim: true, default: '', index: true },
    pincode: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    landmark: { type: String, trim: true, default: '' },
    mapUrl: { type: String, trim: true, default: '' },
    contact: { type: String, trim: true, default: '' },
    contactEmail: { type: String, trim: true, default: '' },
    featured: { type: Boolean, default: false, index: true },
    verified: { type: Boolean, default: false },
    viewsCount: { type: Number, default: 0, index: true },
    recentlyAdded: { type: Boolean, default: false },
    availabilityStatus: { type: String, enum: ["available", "sold_out", "inactive"], default: "available", index: true },
    availabilityUpdatedAt: { type: Date },
    availabilityUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    possessionStatus: { type: String, trim: true, default: "" },
    listerId: { type: String, trim: true, index: true },
    contributor: { type: mongoose.Schema.Types.Mixed },
    agent: {
      name: { type: String, trim: true, default: '' },
      type: { type: String, default: 'Channel Partner' },
      avatar: { type: String, default: '' },
    },
    isBulkListing: { type: Boolean, default: false, index: true },
    bulkBatchId: { type: String, trim: true, index: true },
    bulkFilename: { type: String, trim: true },
    bulkUploadedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret.__v;
        ret.details = ret.details || {};
        ret.title =
          ret.title ||
          ret.details.apartmentName ||
          ret.details.projectName ||
          ret.details.propertyName ||
          `${ret.propertyType || 'Residential'} Property`;
        ret.price = ret.price || ret.details.expectedPrice || ret.details.expectedPricePerAcre || '';
        ret.channelPartnerName = ret.channelPartnerName || ret.details.channelPartnerName || '';
        ret.bankLoanDetails = ret.bankLoanDetails || ret.details.bankLoanDetails || '';
        ret.loanApproved = Boolean(
          ret.loanApproved ||
            (ret.bankLoanDetails && !ret.bankLoanDetails.toLowerCase().includes('no'))
        );
        ret.images = Array.isArray(ret.images) ? ret.images.filter(Boolean) : [];
        if (ret.images.length === 0 && Array.isArray(ret.documents)) {
          ret.images = ret.documents
            .filter((d) => d && d.fileType && d.fileType.startsWith('image'))
            .map((d) => d.url);
        }

        // Ensure single canonical mapUrl at root
        const locUrl = (
          ret.mapUrl ||
          ret.details?.mapUrl ||
          ''
        ).trim();
        ret.mapUrl = locUrl;

        // Remove all duplicate map URL keys
        delete ret.googleMapsUrl;
        delete ret.googleMapUrl;
        delete ret.mapEmbedUrl;
        delete ret.resolvedLocationUrl;
        delete ret.locationUrl;

        // Remove duplicate user/lister keys
        delete ret.lister;
        delete ret.user;
        if (ret.contributor?.listerId && ret.listerId === ret.contributor.listerId) {
          delete ret.listerId;
        }

        // Remove duplicate media aliases
        delete ret.video;
        delete ret.videos;
        delete ret.brochure;
        delete ret.email;
        delete ret.rawPrice;
        delete ret.isPriority;

        // Clean details duplicates
        if (ret.details && typeof ret.details === 'object') {
          delete ret.details.mapUrl;
          delete ret.details.googleMapsUrl;
          delete ret.details.googleMapUrl;
          delete ret.details.mapEmbedUrl;
          delete ret.details.resolvedLocationUrl;
          delete ret.details.locationUrl;

          if (ret.details.propertyName === ret.title) delete ret.details.propertyName;
          if (ret.details.expectedPrice === ret.price) delete ret.details.expectedPrice;
          if (ret.details.possessionStatus === ret.possessionStatus) delete ret.details.possessionStatus;
          if (ret.details.vendorName === ret.vendorName) delete ret.details.vendorName;
          if (ret.details.channelPartnerName === ret.channelPartnerName) delete ret.details.channelPartnerName;
          if (ret.details.approvalAuthority === ret.approval) delete ret.details.approvalAuthority;
        }

        if (ret.propertyType) {
          ret.propertyType = normalizeCanonicalPropertyType(ret.propertyType);
        }
        delete ret.subcategory;

        return ret;
      },
    },
    toObject: { virtuals: false },
  }
);

// Virtual properties for direct document access
propertySchema.virtual('lister', {
  ref: 'Lister',
  localField: 'createdBy',
  foreignField: '_id',
  justOne: true,
});
propertySchema.virtual('video').get(function () {
  return this.videoUrl || '';
});
propertySchema.virtual('videos').get(function () {
  return this.videoUrl ? [this.videoUrl] : [];
});
propertySchema.virtual('brochure').get(function () {
  return this.pdfUrl || '';
});
propertySchema.virtual('email').get(function () {
  return this.contactEmail || '';
});
propertySchema.virtual('location').get(function () {
  return this.address || '';
});
propertySchema.virtual('subcategory')
  .get(function () {
    return this.propertyType;
  })
  .set(function (val) {
    if (val) this.propertyType = normalizeCanonicalPropertyType(val);
  });
propertySchema.pre('save', function (next) {
  const url = (
    this.mapUrl ||
    this.details?.mapUrl ||
    ''
  ).trim();

  this.mapUrl = url;
  this.locationUrl = undefined;
  this.googleMapsUrl = undefined;
  this.googleMapUrl = undefined;
  this.mapEmbedUrl = undefined;
  this.resolvedLocationUrl = undefined;

  if (this.details) {
    this.details.mapUrl = url;
    this.details.locationUrl = undefined;
    this.details.googleMapsUrl = undefined;
    this.details.googleMapUrl = undefined;
    this.details.mapEmbedUrl = undefined;
    this.details.resolvedLocationUrl = undefined;
  }
  next();
});
propertySchema.virtual('rawPrice').get(function () {
  return this.numericPrice || 0;
});
propertySchema.virtual('isPriority').get(function () {
  return Boolean(this.priority && this.priority > 0);
});
propertySchema.virtual('user').get(function () {
  return this.createdBy;
});

// Compound Indexes for fast dashboard & filter queries
propertySchema.index({ status: 1, availabilityStatus: 1, priority: -1, createdAt: -1 });
propertySchema.index({ status: 1, availabilityStatus: 1, numericPrice: 1 });
propertySchema.index({ status: 1, city: 1, propertyType: 1, createdAt: -1 });
propertySchema.index({ propertyType: 1, status: 1 });
propertySchema.index({ createdBy: 1, createdAt: -1 });
propertySchema.index({ city: 1, area: 1 });
propertySchema.index({ createdAt: -1 });

// Full-text search index
propertySchema.index(
  {
    vendorName: 'text',
    channelPartnerName: 'text',
    title: 'text',
    'details.propertyName': 'text',
    'details.projectName': 'text',
    'details.apartmentName': 'text',
    city: 'text',
    area: 'text',
  },
  {
    weights: {
      title: 10,
      'details.propertyName': 8,
      'details.projectName': 8,
      'details.apartmentName': 8,
      channelPartnerName: 5,
      vendorName: 5,
      city: 3,
      area: 3,
    },
    name: 'property_intake_search',
  }
);

// Pre-save synchronization hook
propertySchema.pre('save', function (next) {
  // Consolidate duplicate incoming media fields
  if (!this.videoUrl && this.video) this.videoUrl = this.video;
  if (!this.videoUrl && Array.isArray(this.videos) && this.videos[0]) this.videoUrl = this.videos[0];
  this.video = undefined;
  this.videos = undefined;

  if (!this.pdfUrl && this.brochure) this.pdfUrl = this.brochure;
  this.brochure = undefined;

  if (!this.contactEmail && this.email) this.contactEmail = this.email;
  this.email = undefined;

  if (!this.address && this.location) this.address = this.location;
  this.location = undefined;

  // Derive title from details if empty
  const d = this.details || {};
  if (!this.title) {
    this.title =
      d.apartmentName ||
      d.projectName ||
      d.propertyName ||
      `${this.propertyType || 'Residential'} Property`;
  }

  // Derive price from details if empty
  if (!this.price) {
    this.price = d.expectedPrice || d.expectedPricePerAcre || '';
  }

  // Compute numericPrice if missing
  if (!this.numericPrice && this.price) {
    const digits = String(this.price).replace(/[^\d.]/g, '');
    const num = parseFloat(digits);
    if (!isNaN(num)) {
      if (/cr/i.test(this.price)) {
        this.numericPrice = num * 10000000;
      } else if (/lakh|lac|l/i.test(this.price)) {
        this.numericPrice = num * 100000;
      } else {
        this.numericPrice = num;
      }
    }
  }

  // Loan approval flag
  if (this.bankLoanDetails) {
    this.loanApproved = !this.bankLoanDetails.toLowerCase().includes('no');
  }

  if (!this.address && d.address) {
    this.address = d.address;
  }
  if (!this.landmark && d.landmark) {
    this.landmark = d.landmark;
  }

  // Clean redundant root fields from details so they don't duplicate
  if (this.details && typeof this.details === 'object') {
    delete this.details.propertyName;
    delete this.details.expectedPrice;
    delete this.details.negotiable;
    delete this.details.channelPartnerName;
    delete this.details.vendorName;
    delete this.details.description;
    delete this.details.possessionStatus;
    delete this.details.listerId;
  }

  if (this.lister && !this.createdBy) {
    this.createdBy = this.lister;
  }

  if (this.propertyType) {
    this.propertyType = normalizeCanonicalPropertyType(this.propertyType);
  }
  if (this.details && typeof this.details === 'object') {
    this.details.propertyType = this.propertyType;
  }
  if (this._doc && 'subcategory' in this._doc) {
    delete this._doc.subcategory;
  }

  next();
});

const Property = mongoose.models.Property || mongoose.model('Property', propertySchema);

module.exports = Property;
module.exports.PROPERTY_TYPES = PROPERTY_TYPES;
module.exports.CANONICAL_PROPERTY_TYPES = CANONICAL_PROPERTY_TYPES;
module.exports.normalizeCanonicalPropertyType = normalizeCanonicalPropertyType;
module.exports.PROPERTY_STATUSES = PROPERTY_STATUSES;

