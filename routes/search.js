const express = require("express");
const rateLimit = require("express-rate-limit");
const modules = require("../modules");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === "test" ? 300 : 60,
  message: { success: false, message: "Too many search requests, please slow down" },
  standardHeaders: true,
  legacyHeaders: false,
});

function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

router.get("/", searchLimiter, asyncHandler(async (req, res) => {
  const { q, page = 1, limit = 20 } = req.query;
  if (!q || !q.trim()) {
    return new ApiResponse(200, { results: {} }, "No search query provided").send(res);
  }

  // Cap query length to prevent ReDoS / CPU lockups
  const rawQuery = q.trim().slice(0, 100);
  const safeRegexQuery = escapeRegex(rawQuery);
  const p = Math.max(1, Number(page));
  const l = Math.min(20, Math.max(1, Number(limit)));

  const results = {};
  await Promise.all(modules.map(async (mod) => {
    try {
      const items = await mod.model.find({
        status: "approved",
        $or: [
          { title: { $regex: safeRegexQuery, $options: "i" } },
          { description: { $regex: safeRegexQuery, $options: "i" } }
        ],
      }).limit(l);
      if (items.length > 0) results[mod.id] = items;
    } catch {}
  }));

  new ApiResponse(200, { results, query: rawQuery }, "Search results").send(res);
}));

module.exports = router;
