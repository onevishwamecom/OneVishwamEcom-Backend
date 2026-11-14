const Property = require('../modules/properties/model');
const FinanceOffering = require('../modules/financeOfferings/model');
const Enquiry = require('../models/Enquiry');
const Review = require('../models/Review');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

const getBankLoans = asyncHandler(async (req, res) => {
  const { type, limit } = req.query;
  const filter = { status: 'active' };
  if (type) filter.type = type;
  const query = FinanceOffering.find(filter).sort({ order: 1, createdAt: -1 });
  if (limit) query.limit(Number(limit));
  const loans = await query;
  const response = new ApiResponse(200, { loans });
  if (!req.headers.authorization) {
    response.setCache(60, 120, 300);
  }
  response.send(res);
});

const createEnquiry = asyncHandler(async (req, res) => {
  const propertyId = req.body.propertyId || req.body.listingId || req.body.listing;
  let property = null;
  if (propertyId) {
    try {
      property = await Property.findById(propertyId);
    } catch (e) {}
  }

  const User = require('../models/User');
  let toUser = property?.user || null;
  let fromUser = req.user?._id || null;

  if (!fromUser && req.body.email) {
    const existingUser = await User.findOne({ email: req.body.email.toLowerCase().trim() });
    if (existingUser) fromUser = existingUser._id;
  }

  const enquiry = await Enquiry.create({
    listing: property?._id || null,
    fromUser: fromUser || undefined,
    toUser: toUser || undefined,
    message: req.body.message || 'Interested in this property',
    contactInfo: {
      phone: req.body.phone || req.body.mobile,
      email: req.body.email,
      name: req.body.name,
    },
  });

  new ApiResponse(201, { enquiry }, 'Enquiry submitted successfully').send(res);
});

const createReview = asyncHandler(async (req, res) => {
  const review = await Review.create({ ...req.body, reviewer: req.user._id });
  new ApiResponse(201, { review }, 'Review submitted').send(res);
});

const getUserReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find({ reviewedUser: req.params.userId })
    .populate('reviewer', 'name avatar')
    .sort({ createdAt: -1 });

  const stats = await Review.aggregate([
    { $match: { reviewedUser: req.params.userId } },
    { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);

  new ApiResponse(200, {
    reviews,
    stats: stats[0] || { avgRating: 0, count: 0 },
  }).send(res);
});

module.exports = {
  getBankLoans,
  createEnquiry,
  createReview,
  getUserReviews,
};
