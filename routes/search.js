const express = require('express');
const rateLimit = require('express-rate-limit');
const modules = require('../modules');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 600 : 180,
  message: { success: false, message: 'Too many search requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
});

function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

// Canonical category mapper matching both frontend tab IDs and backend module IDs
const CATEGORY_MAP = {
  all: null, // searches all categories
  properties: 'properties',
  property: 'properties',
  'real-estate': 'properties',
  vehicles: 'vehicles',
  vehicle: 'vehicles',
  automobile: 'vehicles',
  automobiles: 'vehicles',
  electronics: 'electronics',
  'consumer-electronics': 'electronics',
  bedding: 'bedding',
  'bedding-comfort': 'bedding',
  finance: 'finance',
  'finance-lending': 'finance',
  loans: 'finance',
};

// Module-specific search fields configuration
const MODULE_SEARCH_CONFIGS = {
  properties: {
    label: 'Properties',
    fields: ['title', 'description', 'location', 'city', 'area', 'locality', 'propertyType', 'bhk', 'projectType', 'landmark'],
    linkPrefix: '/property',
    normalize: (item) => {
      const id = item._id || item.id;
      const title = item.title || item.name || 'Property Listing';
      const bhk = item.bhk ? `${item.bhk}` : '';
      const pType = item.propertyType ? `${item.propertyType}` : '';
      const subtitle = [bhk, pType, item.area].filter(Boolean).join(' · ') || item.location || '';
      const img = Array.isArray(item.images) && item.images[0]
        ? (typeof item.images[0] === 'string' ? item.images[0] : item.images[0].url)
        : (item.coverImage || '');

      return {
        id,
        _id: id,
        title,
        subtitle,
        category: 'properties',
        categoryLabel: 'Properties',
        brand: '',
        model: item.propertyType || '',
        price: item.price || (item.numericPrice ? `₹ ${item.numericPrice.toLocaleString('en-IN')}` : 'Price on Request'),
        numericPrice: item.numericPrice || item.priceValue || 0,
        image: img,
        location: item.location || [item.area, item.city].filter(Boolean).join(', ') || 'Bengaluru',
        city: item.city || 'bengaluru',
        tags: [bhk, pType, item.area].filter(Boolean),
        link: `/property/${id}`,
      };
    },
  },
  vehicles: {
    label: 'Vehicles',
    fields: ['title', 'brand', 'model', 'make', 'category', 'subcategory', 'bodyType', 'fuelType', 'transmission', 'location', 'city', 'description'],
    linkPrefix: '/automobile',
    normalize: (item) => {
      const id = item._id || item.id;
      const brandModel = `${item.brand || ''} ${item.model || ''}`.trim();
      const title = item.title || brandModel || 'Vehicle Listing';
      const subtitle = [item.brand, item.model, item.year].filter(Boolean).join(' · ') || item.category || 'Automobile';
      const img = Array.isArray(item.images) && item.images[0]
        ? (typeof item.images[0] === 'string' ? item.images[0] : item.images[0].url)
        : (item.image || '');

      return {
        id,
        _id: id,
        title,
        subtitle,
        category: 'vehicles',
        categoryLabel: 'Vehicles',
        brand: item.brand || '',
        model: item.model || '',
        price: item.price || (item.numericPrice ? `₹ ${item.numericPrice.toLocaleString('en-IN')}` : 'Price on Request'),
        numericPrice: item.numericPrice || item.priceValue || 0,
        image: img,
        location: item.location || item.city || 'Bengaluru',
        city: item.city || 'bengaluru',
        tags: [item.fuelType, item.transmission, item.condition || 'Verified'].filter(Boolean),
        link: `/automobile/${id}`,
      };
    },
  },
  electronics: {
    label: 'Consumer Electronics',
    fields: ['title', 'name', 'brand', 'model', 'category', 'subcategory', 'description', 'location', 'city'],
    linkPrefix: '/electronics',
    normalize: (item) => {
      const id = item._id || item.id;
      const brandModel = `${item.brand || ''} ${item.model || ''}`.trim();
      const title = item.title || item.name || brandModel || 'Electronics Product';
      const subtitle = item.subcategory || item.brand || 'Consumer Electronics';
      const img = Array.isArray(item.images) && item.images[0]
        ? (typeof item.images[0] === 'string' ? item.images[0] : item.images[0].url)
        : (item.image || '');

      return {
        id,
        _id: id,
        title,
        subtitle,
        category: 'consumer-electronics',
        categoryLabel: 'Electronics',
        brand: item.brand || '',
        model: item.model || '',
        price: item.price || (item.numericPrice ? `₹ ${item.numericPrice.toLocaleString('en-IN')}` : 'Price on Request'),
        numericPrice: item.numericPrice || item.priceValue || 0,
        image: img,
        location: item.location || item.city || 'Bengaluru',
        city: item.city || 'bengaluru',
        tags: [item.brand, item.subcategory, item.warranty || 'Brand Warranty'].filter(Boolean),
        link: `/electronics/${id}`,
      };
    },
  },
  bedding: {
    label: 'Bedding & Comfort',
    fields: ['title', 'name', 'brand', 'model', 'category', 'subcategory', 'description', 'features', 'location', 'city'],
    linkPrefix: '/bedding',
    normalize: (item) => {
      const id = item._id || item.id;
      const brandModel = `${item.brand || ''} ${item.model || ''}`.trim();
      const title = item.title || item.name || brandModel || 'Bedding Item';
      const subtitle = item.subcategory || item.brand || 'Bedding & Sleep Comfort';
      const img = Array.isArray(item.images) && item.images[0]
        ? (typeof item.images[0] === 'string' ? item.images[0] : item.images[0].url)
        : (item.image || '');

      return {
        id,
        _id: id,
        title,
        subtitle,
        category: 'bedding-comfort',
        categoryLabel: 'Bedding & Comfort',
        brand: item.brand || '',
        model: item.model || '',
        price: item.price || (item.numericPrice ? `₹ ${item.numericPrice.toLocaleString('en-IN')}` : 'Factory Direct'),
        numericPrice: item.numericPrice || item.priceValue || 0,
        image: img,
        location: item.location || item.city || 'Bengaluru',
        city: item.city || 'bengaluru',
        tags: [item.brand, item.subcategory, 'Factory Direct'].filter(Boolean),
        link: `/bedding/${id}`,
      };
    },
  },
  finance: {
    label: 'Finance & Loans',
    fields: ['title', 'name', 'loanType', 'bankName', 'description', 'eligibility'],
    linkPrefix: '/finance',
    normalize: (item) => {
      const id = item._id || item.id;
      const title = item.title || item.loanType || item.name || 'Loan & Financial Service';
      const subtitle = item.bankName || item.description || 'Instant Approval';
      const img = Array.isArray(item.images) && item.images[0]
        ? (typeof item.images[0] === 'string' ? item.images[0] : item.images[0].url)
        : '';

      return {
        id,
        _id: id,
        title,
        subtitle,
        category: 'finance-lending',
        categoryLabel: 'Finance',
        brand: item.bankName || '',
        model: item.loanType || '',
        price: item.interestRate ? `${item.interestRate}% ROI` : 'Competitive Interest',
        numericPrice: 0,
        image: img,
        location: 'Bengaluru',
        city: 'bengaluru',
        tags: [item.loanType, 'Instant Approval'].filter(Boolean),
        link: `/finance/${id}`,
      };
    },
  },
};

/**
 * Universal Multi-Vertical Search Handler
 */
async function handleSearch(req, res) {
  const { q = '', category = 'all', city, page = 1, limit = 20 } = req.query;

  const rawQuery = String(q || '').trim().slice(0, 100);
  const targetCategoryKey = (category || 'all').toLowerCase().trim();
  const canonicalTarget = CATEGORY_MAP[targetCategoryKey] !== undefined
    ? CATEGORY_MAP[targetCategoryKey]
    : null;

  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(50, Math.max(1, Number(limit) || 20));

  // Determine which modules to search
  const targetModules = canonicalTarget
    ? modules.filter((m) => m.id === canonicalTarget)
    : modules.filter((m) => Boolean(MODULE_SEARCH_CONFIGS[m.id]));

  const resultsByCategory = {};
  const allItems = [];

  await Promise.all(
    targetModules.map(async (mod) => {
      const cfg = MODULE_SEARCH_CONFIGS[mod.id];
      if (!cfg || !mod.model) return;

      const queryFilter = {
        $or: [
          { status: 'approved' },
          { approvalStatus: 'approved' },
          { status: { $exists: false } },
        ],
      };

      // City filter (if provided and not 'all')
      if (city && city.toLowerCase() !== 'all') {
        const cityRegex = new RegExp(escapeRegex(city), 'i');
        queryFilter.$and = queryFilter.$and || [];
        queryFilter.$and.push({
          $or: [{ city: cityRegex }, { location: cityRegex }, { area: cityRegex }],
        });
      }

      // Text search condition
      if (rawQuery) {
        const tokens = rawQuery
          .split(/\s+/)
          .filter(Boolean)
          .map((t) => escapeRegex(t));

        if (tokens.length > 0) {
          // Build token matching conditions across supported fields
          const tokenConditions = tokens.map((token) => {
            const regex = new RegExp(token, 'i');
            return {
              $or: cfg.fields.map((f) => ({ [f]: regex })),
            };
          });

          queryFilter.$and = queryFilter.$and || [];
          queryFilter.$and.push(...tokenConditions);
        }
      }

      try {
        const items = await mod.model
          .find(queryFilter)
          .sort({ priority: 1, updatedAt: -1, createdAt: -1 })
          .limit(l)
          .lean();

        if (items && items.length > 0) {
          const normalized = items.map(cfg.normalize);
          resultsByCategory[mod.id] = normalized;
          allItems.push(...normalized);
        } else {
          resultsByCategory[mod.id] = [];
        }
      } catch (err) {
        console.error(`Search error in module ${mod.id}:`, err.message);
        resultsByCategory[mod.id] = [];
      }
    })
  );

  // If query was empty and no items matched city filter, fallback to general approved inventory
  if (allItems.length === 0 && !rawQuery) {
    await Promise.all(
      targetModules.map(async (mod) => {
        const cfg = MODULE_SEARCH_CONFIGS[mod.id];
        if (!cfg || !mod.model) return;
        try {
          const fallbackItems = await mod.model
            .find({
              $or: [{ status: 'approved' }, { approvalStatus: 'approved' }, { status: { $exists: false } }],
            })
            .sort({ createdAt: -1 })
            .limit(6)
            .lean();

          if (fallbackItems.length > 0) {
            const normalized = fallbackItems.map(cfg.normalize);
            resultsByCategory[mod.id] = normalized;
            allItems.push(...normalized);
          }
        } catch {}
      })
    );
  }

  return new ApiResponse(
    200,
    {
      query: rawQuery,
      category: targetCategoryKey,
      city: city || 'all',
      totalCount: allItems.length,
      items: allItems,
      results: resultsByCategory,
    },
    'Search results retrieved successfully'
  ).send(res);
}

// 1. Primary multi-vertical search endpoint
router.get('/', searchLimiter, asyncHandler(handleSearch));

// 2. Dedicated items search endpoint
router.get('/items', searchLimiter, asyncHandler(handleSearch));

module.exports = router;
