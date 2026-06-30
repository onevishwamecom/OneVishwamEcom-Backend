const Wishlist = require('./model');
const modules = require('../index');
const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const asyncHandler = require('../../utils/asyncHandler');

const getWishlist = asyncHandler(async (req, res) => {
  const items = await Wishlist.find({ user: req.user._id }).sort({ createdAt: -1 });

  const grouped = {};
  for (const entry of items) {
    if (!grouped[entry.serviceType]) grouped[entry.serviceType] = [];
    grouped[entry.serviceType].push(entry.item);
  }

  const populated = {};
  for (const [serviceType, ids] of Object.entries(grouped)) {
    const mod = modules.find(m => m.id === serviceType);
    if (mod) {
      populated[serviceType] = await mod.model.find({ _id: { $in: ids } });
    }
  }

  new ApiResponse(200, { wishlist: items, items: populated }, 'Wishlist fetched').send(res);
});

const addToWishlist = asyncHandler(async (req, res) => {
  const { item, serviceType } = req.body;
  if (!item || !serviceType) throw new ApiError(400, 'item and serviceType are required');

  const mod = modules.find(m => m.id === serviceType);
  if (!mod) throw new ApiError(400, 'Invalid serviceType');

  const exists = await mod.model.findById(item);
  if (!exists) throw new ApiError(404, 'Item not found');

  const wishlistItem = await Wishlist.create({ user: req.user._id, item, serviceType });
  new ApiResponse(201, { wishlistItem }, 'Added to wishlist').send(res);
});

const removeFromWishlist = asyncHandler(async (req, res) => {
  const item = await Wishlist.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!item) throw new ApiError(404, 'Wishlist item not found');
  new ApiResponse(200, null, 'Removed from wishlist').send(res);
});

module.exports = { getWishlist, addToWishlist, removeFromWishlist };
