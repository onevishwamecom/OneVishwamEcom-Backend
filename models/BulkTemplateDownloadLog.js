const mongoose = require('mongoose');

const bulkTemplateDownloadLogSchema = new mongoose.Schema(
  {
    listerId: {
      type: mongoose.Schema.Types.Mixed,
      index: true,
      default: null,
    },
    listerName: {
      type: String,
      trim: true,
      default: 'Unknown Lister',
    },
    listerEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
      index: true,
    },
    category: {
      type: String,
      trim: true,
      required: true,
      index: true,
    },
    filename: {
      type: String,
      trim: true,
      required: true,
    },
    timestamp: {
      type: String,
      trim: true,
      default: '',
    },
    ip: {
      type: String,
      default: '',
    },
    userAgent: {
      type: String,
      default: '',
    },
    downloadedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

bulkTemplateDownloadLogSchema.index({ category: 1, downloadedAt: -1 });

module.exports =
  mongoose.models.BulkTemplateDownloadLog ||
  mongoose.model('BulkTemplateDownloadLog', bulkTemplateDownloadLogSchema);
