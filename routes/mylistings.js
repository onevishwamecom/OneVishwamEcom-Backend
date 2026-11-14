const express = require('express');
const { protect } = require('../middleware/auth');
const modules = require('../modules');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

/**
 * @openapi
 * /mylistings:
 *   get:
 *     tags: [Listings]
 *     summary: My listings across sectors
 *     description: |
 *       Returns the caller's listings grouped by sector id. When `serviceType` is
 *       provided the response is `{ <serviceType>: [ ... ] }` for that sector only.
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     parameters:
 *       - { name: serviceType, in: query, schema: { type: string, enum: [properties, vehicles, garments, groceries, jewellery, electronics, bedding, finance] } }
 *       - { name: status, in: query, schema: { type: string, enum: [pending, approved, changes-required, cancelled, rejected, active, inactive] } }
 *     responses:
 *       200:
 *         description: Listings grouped by sector
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       additionalProperties:
 *                         type: array
 *                         items: { $ref: '#/components/schemas/SectorListing' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/', protect, asyncHandler(async (req, res) => {
  const { serviceType, status } = req.query;

  // Support both user and lister accounts for backward compatibility
  // Listers use 'lister' field, users use 'user' field
  const listerIdVal = req.user?.listerId || req.auth?.listerId || req.user?.phone;
  const listerOr = [
    { lister: req.auth.id },
    { user: req.auth.id },
  ];
  if (listerIdVal) listerOr.push({ listerId: listerIdVal }, { lister_id: listerIdVal }, { 'details.listerId': listerIdVal });
  if (req.auth?.id) listerOr.push({ listerId: String(req.auth.id) });

  const filter = req.auth.accountType === 'lister' 
    ? { $or: listerOr } 
    : { user: req.auth.id };
  
  if (status) filter.status = status;

  if (serviceType) {
    const mod = modules.find(m => m.id === serviceType);
    if (!mod) throw new ApiError(400, 'Invalid serviceType');
    const items = await mod.model.find(filter).sort({ createdAt: -1 });
    return new ApiResponse(200, { [serviceType]: items }, 'My listings fetched').send(res);
  }

  const all = {};
  await Promise.all(modules.map(async (mod) => {
    try {
      const items = await mod.model.find(filter).sort({ createdAt: -1 }).limit(100);
      if (items.length > 0) all[mod.id] = items;
    } catch { }
  }));

  new ApiResponse(200, all, 'My listings fetched').send(res);
}));

module.exports = router;