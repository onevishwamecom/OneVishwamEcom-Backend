const express = require('express');
const modules = require('../modules');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const { q, page = 1, limit = 20 } = req.query;
  if (!q || !q.trim()) {
    return new ApiResponse(200, { results: {} }, 'No search query provided').send(res);
  }

  const query = q.trim();
  const p = Math.max(1, Number(page));
  const l = Math.min(20, Math.max(1, Number(limit)));

  const results = {};
  await Promise.all(modules.map(async (mod) => {
    try {
      const items = await mod.model.find({
        $or: [{ title: { $regex: query, $options: 'i' } }, { description: { $regex: query, $options: 'i' } }],
      }).limit(l);
      if (items.length > 0) results[mod.id] = items;
    } catch { }
  }));

  new ApiResponse(200, { results, query }, 'Search results').send(res);
}));

module.exports = router;
