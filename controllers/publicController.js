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
  new ApiResponse(200, { loans }).send(res);
});

const createEnquiry = asyncHandler(async (req, res) => {
  const propertyId = req.body.propertyId || req.body.listingId || req.body.listing;
  let property = null;
  if (propertyId) {
    try {
      property = await Property.findById(propertyId);
    } catch (e) {}
  }
  if (!property) {
    property = await Property.findOne();
  }

  const User = require('../models/User');
  let toUser = property?.user;
  if (!toUser) {
    const defaultUser = await User.findOne();
    toUser = defaultUser?._id;
  }

  let fromUser = req.user?._id;
  if (!fromUser) {
    if (req.body.email) {
      const existingUser = await User.findOne({ email: req.body.email });
      fromUser = existingUser?._id;
    }
    if (!fromUser) {
      fromUser = toUser;
    }
  }

  const enquiry = await Enquiry.create({
    listing: property?._id,
    fromUser: fromUser || toUser,
    toUser: toUser || fromUser,
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
