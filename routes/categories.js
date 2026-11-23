const express = require('express');
const { CATEGORIES, resolveCategory } = require('../config/categories');
const modules = require('../modules');

const router = express.Router();

// Map module by id for fast stats resolution
const moduleMap = new Map();
if (Array.isArray(modules)) {
  modules.forEach((mod) => {
    if (mod && mod.id && mod.model) {
      moduleMap.set(mod.id, mod);
    }
  });
}

/**
 * Helper to get live listing statistics for categories from MongoDB
 */
async function getCategoryStats() {
  const statsMap = {};
  await Promise.all(
    Array.from(moduleMap.entries()).map(async ([moduleId, mod]) => {
      try {
        const [total, approved, pending] = await Promise.all([
          mod.model.countDocuments(),
          mod.model.countDocuments({ status: 'approved' }),
          mod.model.countDocuments({ status: 'pending' }),
        ]);
        statsMap[moduleId] = { total, approved, pending };
      } catch (err) {
        // Module collection might not be accessible or query failed; fallback to 0
        statsMap[moduleId] = { total: 0, approved: 0, pending: 0 };
      }
    })
  );
  return statsMap;
}

/**
 * @openapi
 * /categories:
 *   get:
 *     tags: [Categories]
 *     summary: Fetch all programmatic marketplace categories & ecosystem sectors
 *     description: >
 *       Returns the authoritative programmatic category registry for OneVishwam.
 *       Categories are maintained in code to ensure strict schema adherence and zero drift.
 *       Supports filtering by status or featured flag, and optional live MongoDB stats.
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, active, coming-soon]
 *         description: Filter categories by lifecycle status (default 'all')
 *       - in: query
 *         name: featured
 *         schema:
 *           type: boolean
 *         description: Return only featured categories
 *       - in: query
 *         name: includeStats
 *         schema:
 *           type: boolean
 *         description: Attach live listing counts from MongoDB
 *     responses:
 *       200:
 *         description: List of categories retrieved successfully
 */
router.get('/', async (req, res) => {
  try {
    const { status, featured, includeStats } = req.query;

    let result = [...CATEGORIES];

    // Filter by status if specified
    if (status) {
      const normalizedStatus = String(status).trim().toLowerCase();
      if (normalizedStatus === 'active') {
        result = result.filter((cat) => cat.isActive === true || cat.status === 'active');
      } else if (normalizedStatus === 'coming-soon' || normalizedStatus === 'coming_soon') {
        result = result.filter((cat) => cat.isActive === false || cat.status === 'coming-soon');
      }
    }

    // Filter by featured flag if requested
    if (featured !== undefined) {
      const isFeatured = String(featured).toLowerCase() === 'true';
      result = result.filter((cat) => Boolean(cat.isFeatured) === isFeatured);
    }

    // Optionally enrich with live MongoDB counts
    const shouldIncludeStats =
      String(includeStats).toLowerCase() === 'true' ||
      String(includeStats) === '1' ||
      String(req.query.stats).toLowerCase() === 'true';

    if (shouldIncludeStats) {
      const statsMap = await getCategoryStats();
      result = result.map((cat) => {
        const stats = statsMap[cat.id] || { total: 0, approved: 0, pending: 0 };
        return {
          ...cat,
          listingCount: stats.approved,
          totalListings: stats.total,
          pendingListings: stats.pending,
          stats,
        };
      });
    }

    const activeCount = CATEGORIES.filter((c) => c.isActive).length;

    res.json({
      success: true,
      count: result.length,
      data: result,
      meta: {
        activeCount,
        totalCount: CATEGORIES.length,
        version: '1.0.0',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve categories',
      error: error.message,
    });
  }
});

/**
 * @openapi
 * /categories/{idOrSlug}:
 *   get:
 *     tags: [Categories]
 *     summary: Fetch a single category by ID, slug, or alias
 *     parameters:
 *       - in: path
 *         name: idOrSlug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Category found
 *       404:
 *         description: Category not found
 */
router.get('/:idOrSlug', async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const cat = resolveCategory(idOrSlug);

    if (!cat) {
      return res.status(404).json({
        success: false,
        message: `Category not found with identifier '${idOrSlug}'`,
      });
    }

    let responseData = { ...cat };

    const shouldIncludeStats =
      String(req.query.includeStats).toLowerCase() === 'true' ||
      String(req.query.stats).toLowerCase() === 'true';

    if (shouldIncludeStats && moduleMap.has(cat.id)) {
      const mod = moduleMap.get(cat.id);
      try {
        const [total, approved, pending] = await Promise.all([
          mod.model.countDocuments(),
          mod.model.countDocuments({ status: 'approved' }),
          mod.model.countDocuments({ status: 'pending' }),
        ]);
        responseData.stats = { total, approved, pending };
        responseData.listingCount = approved;
      } catch {
        responseData.stats = { total: 0, approved: 0, pending: 0 };
        responseData.listingCount = 0;
      }
    }

    res.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error('Error retrieving category details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve category details',
      error: error.message,
    });
  }
});

module.exports = router;
