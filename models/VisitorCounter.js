const mongoose = require('mongoose');

const visitorCounterSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: 'global',
      unique: true,
      index: true,
    },
    totalHits: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalVisitors: {
      type: Number,
      default: 0,
      min: 0,
    },
    todayDate: {
      type: String,
      default: '',
      index: true,
    },
    todayHits: {
      type: Number,
      default: 0,
      min: 0,
    },
    todayVisitors: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('VisitorCounter', visitorCounterSchema);
