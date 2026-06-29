const mongoose = require('mongoose');

const detailsSchema = new mongoose.Schema(
  {
    // Real Estate
    propertyType: String,
    bedrooms: Number,
    bathrooms: Number,
    area: Number,
    furnishing: String,
    // Vehicle
    make: String,
    model: String,
    year: Number,
    fuelType: String,
    kilometersDriven: Number,
    // Garment
    size: String,
    fabric: String,
    occasion: String,
    // Grocery
    unit: String,
    quantity: Number,
    expiryDate: Date,
    // Jewellery
    material: String,
    weight: Number,
    // Loan
    loanType: String,
    interestRate: Number,
    maxAmount: Number,
    tenure: Number,
    // Service
    serviceType: String,
    duration: String,
  },
  { _id: false }
);

const listingSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      maxlength: [5000, 'Description cannot exceed 5000 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: ['real-estate', 'vehicle', 'garment', 'grocery', 'jewellery', 'loan', 'service'],
    },
    price: {
      type: Number,
      min: [0, 'Price cannot be negative'],
    },
    images: [String],
    location: {
      address: String,
      city: { type: String, required: [true, 'City is required'] },
      state: String,
      pincode: String,
    },
    details: detailsSchema,
    status: {
      type: String,
      enum: ['active', 'pending', 'sold', 'inactive'],
      default: 'active',
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
  },
  { timestamps: true }
);

listingSchema.index({ category: 1, status: 1 });
listingSchema.index({ 'location.city': 1 });
listingSchema.index({ user: 1 });
listingSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Listing', listingSchema);
