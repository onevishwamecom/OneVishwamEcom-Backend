const Property = require('../modules/properties/model');
const LoanProduct = require('../models/LoanProduct');
const Enquiry = require('../models/Enquiry');
const Review = require('../models/Review');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

const getBankLoans = asyncHandler(async (req, res) => {
  const { type } = req.query;
  const filter = { status: 'active' };
  if (type) filter.type = type;
  const loans = await LoanProduct.find(filter).sort({ interestRate: 1 });
  new ApiResponse(200, { loans }).send(res);
});

const createEnquiry = asyncHandler(async (req, res) => {
  const property = await Property.findById(req.body.propertyId);
  if (!property) throw new ApiError(404, 'Property not found');

  const enquiry = await Enquiry.create({
    listing: property._id,
    fromUser: req.user._id,
    toUser: property.user || req.user._id,
    message: req.body.message,
    contactInfo: { phone: req.body.phone, email: req.body.email },
  });

  new ApiResponse(201, { enquiry }, 'Enquiry sent').send(res);
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
