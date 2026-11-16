const express = require('express');
const modules = require('../modules');
const { protect, optionalAuth, listerOnly } = require('../middleware/auth');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

/**
 * Sector alias lookup map for canonical resolution
 */
const SECTOR_ALIASES = {
  property: 'properties',
  realestate: 'properties',
  'real-estate': 'properties',
  vehicle: 'vehicles',
  automobile: 'vehicles',
  automobiles: 'vehicles',
  grocery: 'groceries',
  garment: 'garments',
  'consumer-electronics': 'electronics',
  consumer_electronics: 'electronics',
  'bedding-comfort': 'bedding',
  bedding_comfort: 'bedding',
};

function resolveSector(param) {
  if (!param) return null;
  const key = String(param).trim().toLowerCase();
  const canonical = SECTOR_ALIASES[key] || key;
  return modules[canonical] || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Direct Static Mounts for Known Modules & Aliases (Precedence & Swagger)
// ─────────────────────────────────────────────────────────────────────────────
modules.forEach((mod) => {
  if (mod.routes) {
    router.use(`/${mod.id}`, mod.routes);
  }
});

// Common convenience aliases
Object.entries(SECTOR_ALIASES).forEach(([alias, targetId]) => {
  const mod = modules[targetId];
  if (mod && mod.routes) {
    router.use(`/${alias}`, mod.routes);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Dynamic Sector Gateway Router (/product/:sector or /v1/sectors/:sector)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Middleware: Resolves :sector parameter and attaches to req.sectorModule
 */
const resolveSectorMiddleware = (req, res, next) => {
  const mod = resolveSector(req.params.sector);
  if (!mod) {
    return next(new ApiError(404, `Marketplace sector '${req.params.sector}' not found`));
  }
  req.sectorModule = mod;
  next();
};

/**
 * Custom Route Precedence + Fallback to Generic CRUD
 */
const handleSectorSubRequest = (req, res, next) => {
  const mod = req.sectorModule;
  if (!mod) return next(new ApiError(404, 'Sector module not found'));

  // If sector has custom routes, execute them first
  if (mod.routes && typeof mod.routes === 'function') {
    return mod.routes(req, res, (err) => {
      if (err) return next(err);
      // If custom routes did not match or called next(), proceed to generic CRUD fallback
      next();
    });
  }
  next();
};

// Mount dynamic sector routes
router.use('/:sector', resolveSectorMiddleware);

// 1. Sector-level custom route execution
router.use('/:sector', handleSectorSubRequest);

// 2. Generic CRUD Fallback (powered by BaseController / sector controller)
router.get('/:sector', optionalAuth, asyncHandler(async (req, res, next) => {
  const ctrl = req.sectorModule.controller;
  if (ctrl.list) return ctrl.list(req, res, next);
  if (ctrl.getAll) return ctrl.getAll(req, res, next);
  next();
}));

router.get('/:sector/my', protect, asyncHandler(async (req, res, next) => {
  const ctrl = req.sectorModule.controller;
  if (ctrl.getMy) return ctrl.getMy(req, res, next);
  next();
}));

router.get('/:sector/similar/:id', optionalAuth, asyncHandler(async (req, res, next) => {
  const ctrl = req.sectorModule.controller;
  if (ctrl.getSimilar) return ctrl.getSimilar(req, res, next);
  next();
}));

router.get('/:sector/:id', optionalAuth, asyncHandler(async (req, res, next) => {
  const ctrl = req.sectorModule.controller;
  if (ctrl.getOne) return ctrl.getOne(req, res, next);
  if (ctrl.getById) return ctrl.getById(req, res, next);
  next();
}));

router.post('/:sector', protect, listerOnly, asyncHandler(async (req, res, next) => {
  const ctrl = req.sectorModule.controller;
  if (ctrl.create) return ctrl.create(req, res, next);
  next();
}));

router.put('/:sector/:id', protect, asyncHandler(async (req, res, next) => {
  const ctrl = req.sectorModule.controller;
  if (ctrl.update) return ctrl.update(req, res, next);
  next();
}));

router.patch('/:sector/:id', protect, asyncHandler(async (req, res, next) => {
  const ctrl = req.sectorModule.controller;
  if (ctrl.update) return ctrl.update(req, res, next);
  next();
}));

router.delete('/:sector/:id', protect, asyncHandler(async (req, res, next) => {
  const ctrl = req.sectorModule.controller;
  if (ctrl.delete) return ctrl.delete(req, res, next);
  if (ctrl.remove) return ctrl.remove(req, res, next);
  next();
}));

router.patch('/:sector/:id/status', protect, asyncHandler(async (req, res, next) => {
  const ctrl = req.sectorModule.controller;
  if (ctrl.toggleStatus) return ctrl.toggleStatus(req, res, next);
  next();
}));

router.patch('/:sector/:id/toggle-status', protect, asyncHandler(async (req, res, next) => {
  const ctrl = req.sectorModule.controller;
  if (ctrl.toggleStatus) return ctrl.toggleStatus(req, res, next);
  next();
}));

module.exports = router;
