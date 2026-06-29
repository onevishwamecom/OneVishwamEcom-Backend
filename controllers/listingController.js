const Listing = require('../models/Listing');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

const createListing = asyncHandler(async (req, res) => {
  const listingData = { ...req.body, user: req.user._id };

  if (req.files && req.files.length > 0) {
    listingData.images = req.files.map((f) => f.filename);
  }

  const listing = await Listing.create(listingData);
  new ApiResponse(201, { listing }, 'Listing created').send(res);
});

const getMyListings = asyncHandler(async (req, res) => {
  const listings = await Listing.find({ user: req.user._id }).sort({ createdAt: -1 });
  new ApiResponse(200, { listings }).send(res);
});

const updateListing = asyncHandler(async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing) throw new ApiError(404, 'Listing not found');
  if (listing.user.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Not authorized to update this listing');
  }

  const updateData = { ...req.body };
  if (req.files && req.files.length > 0) {
    updateData.images = [...(listing.images || []), ...req.files.map((f) => f.filename)];
  }

  const updated = await Listing.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
  new ApiResponse(200, { listing: updated }, 'Listing updated').send(res);
});

const deleteListing = asyncHandler(async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing) throw new ApiError(404, 'Listing not found');
  if (listing.user.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Not authorized to delete this listing');
  }

  await listing.deleteOne();
  new ApiResponse(200, null, 'Listing deleted').send(res);
});

const toggleStatus = asyncHandler(async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing) throw new ApiError(404, 'Listing not found');
  if (listing.user.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Not authorized');
  }

  listing.status = listing.status === 'active' ? 'inactive' : 'active';
  await listing.save();
  new ApiResponse(200, { listing }, 'Status updated').send(res);
});

module.exports = { createListing, getMyListings, updateListing, deleteListing, toggleStatus };
