const mongoose = require('mongoose');

const bulkBatchItemSchema = new mongoose.Schema(
  {
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    title: {
      type: String,
      trim: true,
      default: '',
    },
    price: {
      type: String,
      trim: true,
      default: '',
    },
    numericPrice: {
      type: Number,
      default: 0,
    },
    category: {
      type: String,
      trim: true,
      default: '',
    },
    subcategory: {
      type: String,
      trim: true,
      default: '',
    },
    city: {
      type: String,
      trim: true,
      default: '',
    },
    area: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'changes-required'],
      default: 'pending',
    },
    images: {
      type: [String],
      default: [],
    },
    video: {
      type: String,
      trim: true,
      default: '',
    },
    pdfUrl: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { _id: true, timestamps: true }
);

const bulkUploadBatchSchema = new mongoose.Schema(
  {
    batchId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    filename: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    itemCount: {
      type: Number,
      default: 0,
    },
    pendingCount: {
      type: Number,
      default: 0,
    },
    approvedCount: {
      type: Number,
      default: 0,
    },
    rejectedCount: {
      type: Number,
      default: 0,
    },
    listerId: {
      type: mongoose.Schema.Types.Mixed,
      index: true,
      default: null,
    },
    listerName: {
      type: String,
      trim: true,
      default: '',
    },
    listerEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'partially_approved', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    items: {
      type: [bulkBatchItemSchema],
      default: [],
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

bulkUploadBatchSchema.index({ listerId: 1, createdAt: -1 });
bulkUploadBatchSchema.index({ listerEmail: 1, createdAt: -1 });

module.exports =
  mongoose.models.BulkUploadBatch ||
  mongoose.model('BulkUploadBatch', bulkUploadBatchSchema);
