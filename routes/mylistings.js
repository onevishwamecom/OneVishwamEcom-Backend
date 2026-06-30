const express = require('express');
const { protect } = require('../middleware/auth');
const modules = require('../modules');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.get('/', protect, asyncHandler(async (req, res) => {
  const { serviceType } = req.query;

  if (serviceType) {
    const mod = modules.find(m => m.id === serviceType);
    if (!mod) throw new ApiError(400, 'Invalid serviceType');
    const items = await mod.model.find({ user: req.user._id }).sort({ createdAt: -1 });
    return new ApiResponse(200, { [serviceType]: items }, 'My listings fetched').send(res);
  }

  const all = {};
  await Promise.all(modules.map(async (mod) => {
    try {
      const items = await mod.model.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(20);
      if (items.length > 0) all[mod.id] = items;
    } catch { }
  }));

  new ApiResponse(200, all, 'My listings fetched').send(res);
}));

module.exports = router;
