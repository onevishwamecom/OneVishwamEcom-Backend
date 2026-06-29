const Listing = require('../models/Listing');
const LoanProduct = require('../models/LoanProduct');
const Enquiry = require('../models/Enquiry');
const Review = require('../models/Review');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

const getListings = asyncHandler(async (req, res) => {
  const { category, city, minPrice, maxPrice, sort, page = 1, limit = 20 } = req.query;

  const filter = { status: 'active' };
  if (category) filter.category = category;
  if (city) filter['location.city'] = { $regex: city, $options: 'i' };
  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }

  let sortOption = { createdAt: -1 };
  if (sort === 'price_asc') sortOption = { price: 1 };
  if (sort === 'price_desc') sortOption = { price: -1 };
  if (sort === 'oldest') sortOption = { createdAt: 1 };

  const skip = (Number(page) - 1) * Number(limit);
  const [listings, total] = await Promise.all([
    Listing.find(filter).sort(sortOption).skip(skip).limit(Number(limit)).populate('user', 'name avatar'),
    Listing.countDocuments(filter),
  ]);

  new ApiResponse(200, {
    listings,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit)),
    },
  }).send(res);
});

const getListingById = asyncHandler(async (req, res) => {
  const listing = await Listing.findById(req.params.id).populate('user', 'name email phone avatar');
  if (!listing) throw new ApiError(404, 'Listing not found');

  const user = req.user || null;
  const contactHidden = user && listing.user._id.toString() !== user._id.toString();

  new ApiResponse(200, { listing, contactHidden }).send(res);
});

const getFeaturedListings = asyncHandler(async (req, res) => {
  const listings = await Listing.find({ status: 'active' })
    .sort({ createdAt: -1 })
    .limit(6)
    .populate('user', 'name avatar');
  new ApiResponse(200, { listings }).send(res);
});

const searchListings = asyncHandler(async (req, res) => {
  const { q, page = 1, limit = 20 } = req.query;
  if (!q) throw new ApiError(400, 'Search query is required');

  const filter = {
    status: 'active',
    $or: [
      { title: { $regex: q, $options: 'i' } },
      { description: { $regex: q, $options: 'i' } },
      { 'location.city': { $regex: q, $options: 'i' } },
    ],
  };

  const skip = (Number(page) - 1) * Number(limit);
  const [listings, total] = await Promise.all([
    Listing.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).populate('user', 'name avatar'),
    Listing.countDocuments(filter),
  ]);

  new ApiResponse(200, {
    listings,
    pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
  }).send(res);
});

const getBankLoans = asyncHandler(async (req, res) => {
  const { type } = req.query;
  const filter = { status: 'active' };
  if (type) filter.type = type;
  const loans = await LoanProduct.find(filter).sort({ interestRate: 1 });
  new ApiResponse(200, { loans }).send(res);
});

const createEnquiry = asyncHandler(async (req, res) => {
  const listing = await Listing.findById(req.body.listingId);
  if (!listing) throw new ApiError(404, 'Listing not found');

  const enquiry = await Enquiry.create({
    listing: listing._id,
    fromUser: req.user._id,
    toUser: listing.user,
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
  getListings,
  getListingById,
  getFeaturedListings,
  searchListings,
  getBankLoans,
  createEnquiry,
  createReview,
  getUserReviews,
};
