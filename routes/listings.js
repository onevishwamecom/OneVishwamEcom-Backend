const express = require('express');
const { protect, adminOnly } = require('../middleware/auth');
const modules = require('../modules');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { deleteMultipleMediaFromStorage } = require('../utils/firebaseStorage');

const router = express.Router();

const { CATEGORY_TO_MODULE, findModule, normalizeCategory } = require('../config/constants');
const { normalizeCanonicalPropertyType } = require('../modules/properties/model');

// Status constants
const LISTER_ALLOWED_STATUSES = ['pending', 'changes-required'];
const LISTER_EDITABLE_STATUSES = ['pending', 'changes-required', 'approved', 'cancelled', 'rejected'];
const ADMIN_STATUS_TRANSITIONS = {
  approve: { from: ['pending', 'changes-required', 'approved', 'active', 'cancelled', 'rejected'], to: 'approved' },
  changes: { from: ['pending', 'changes-required', 'approved', 'active', 'cancelled', 'rejected'], to: 'changes-required' },
  cancel: { from: ['pending', 'changes-required', 'approved', 'active', 'cancelled', 'rejected'], to: 'cancelled' },
};

function normalizeListingItem(item) {
  if (!item) return item;
  const raw = typeof item.toJSON === 'function' ? item.toJSON() : item;
  const v = raw.video || raw.videoUrl || (Array.isArray(raw.videos) && raw.videos[0]) || '';
  return {
    ...raw,
    video: v,
    videoUrl: v,
    videos: Array.isArray(raw.videos) && raw.videos.length > 0 ? raw.videos : (v ? [v] : []),
  };
}

/**
 * @openapi
 * /listings:
 *   get:
 *     tags: [Listings]
 *     summary: List my listings (grouped)
 *     description: |
 *       Returns every sector collection the caller owns, keyed by sector id. With
 *       `flatten=1` the response is a single array where each item carries `_type`.
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     parameters:
 *       - { name: flatten, in: query, schema: { type: string, enum: ['0', '1'], default: '0' } }
 *     responses:
 *       200:
 *         description: Grouped listings, or a flat array when `flatten=1`
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       oneOf:
 *                         - type: object
 *                           additionalProperties:
 *                             type: array
 *                             items: { $ref: '#/components/schemas/SectorListing' }
 *                         - type: array
 *                           items: { $ref: '#/components/schemas/SectorListing' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *   post:
 *     tags: [Listings]
 *     summary: Create a listing
 *     description: |
 *       Creates a document in the sector implied by `_type` (or `categoryType` /
 *       `serviceType` / `category`). The server forces `status: pending`, caps images
 *       at 5 and fills sector-specific defaults.
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/SectorListing'
 *               - type: object
 *                 required: [_type]
 *                 properties:
 *                   _type: { type: string, enum: [properties, vehicles, garments, groceries, jewellery, electronics, bedding, finance] }
 *                 description: Extend with sector-specific fields (bhk, brand, model, etc.).
 *     responses:
 *       201:
 *         description: Listing created (pending approval)
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         item: { $ref: '#/components/schemas/SectorListing' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *
 * /listings/{type}/{id}:
 *   get:
 *     tags: [Listings]
 *     summary: Get one listing
 *     description: Owner or admin only.
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/ListingType'
 *       - $ref: '#/components/parameters/ListingId'
 *     responses:
 *       200:
 *         description: Listing
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         item: { $ref: '#/components/schemas/SectorListing' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   patch:
 *     tags: [Listings]
 *     summary: Update a listing
 *     description: |
 *       Owner or admin. A non-admin edit resets the status to `pending` for
 *       re-moderation. Images are capped at 5 per listing.
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/ListingType'
 *       - $ref: '#/components/parameters/ListingId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/SectorListing' }
 *     responses:
 *       200:
 *         description: Updated listing
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         item: { $ref: '#/components/schemas/SectorListing' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   delete:
 *     tags: [Listings]
 *     summary: Delete a listing
 *     description: Owner or admin. Also removes the listing's uploaded images, videos, documents and brochures.
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/ListingType'
 *       - $ref: '#/components/parameters/ListingId'
 *     responses:
 *       200: { description: Deleted, content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *
 * /listings/{type}/{id}/images/reorder:
 *   patch:
 *     tags: [Listings]
 *     summary: Reorder listing images
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/ListingType'
 *       - $ref: '#/components/parameters/ListingId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [images]
 *             properties:
 *               images:
 *                 type: array
 *                 items: { type: string, format: uri }
 *                 description: Full ordered list of image URLs.
 *     responses:
 *       200:
 *         description: Reordered
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         item: { $ref: '#/components/schemas/SectorListing' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *
 * /listings/{id}/images/reorder:
 *   patch:
 *     tags: [Listings]
 *     summary: Reorder listing images (alias)
 *     description: Same behaviour as `/listings/{type}/{id}/images/reorder`; the type is inferred.
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               images: { type: array, items: { type: string, format: uri } }
 *     responses:
 *       200: { description: Reordered, content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *
 * /listings/bulk-upload:
 *   post:
 *     tags: [Listings]
 *     summary: Bulk upload listings from Excel
 *     description: Multipart upload of an `.xlsx` workbook plus the target `category`. Filename must follow the template naming convention.
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, category]
 *             properties:
 *               file: { type: string, format: binary }
 *               category: { type: string, enum: [properties, vehicles, garments, groceries, jewellery, electronics, bedding, finance] }
 *     responses:
 *       200: { description: Upload processed, content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *
 * /listings/bulk/download-log:
 *   post:
 *     tags: [Listings]
 *     summary: Record a template download
 *     description: Analytics-only endpoint; requires no authentication.
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               category: { type: string }
 *               filename: { type: string }
 *               timestamp: { type: string, format: date-time }
 *     responses:
 *       200: { description: Logged, content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } }
 *
 * /listings/bulk/download-logs:
 *   get:
 *     tags: [Listings]
 *     summary: List template download logs (admin)
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     parameters:
 *       - { name: page, in: query, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { name: limit, in: query, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
 *       - { name: category, in: query, schema: { type: string } }
 *       - { name: search, in: query, schema: { type: string } }
 *     responses:
 *       200: { description: Paginated logs, content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *
 * /listings/bulk/batches:
 *   get:
 *     tags: [Listings]
 *     summary: List bulk-upload batches
 *     description: Admins see every batch; other accounts only see their own.
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     parameters:
 *       - { name: category, in: query, schema: { type: string } }
 *       - { name: status, in: query, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Batches with live item counts
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         batches: { type: array, items: { type: object, additionalProperties: true } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *
 * /listings/bulk/batches/{batchId}:
 *   get:
 *     tags: [Listings]
 *     summary: Get a bulk-upload batch
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     parameters:
 *       - { name: batchId, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Batch with items, content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   delete:
 *     tags: [Listings]
 *     summary: Delete a bulk-upload batch
 *     description: Removes the batch and the listings it created.
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     parameters:
 *       - { name: batchId, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Deleted, content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *
 * /listings/bulk/batches/{batchId}/items:
 *   post:
 *     tags: [Listings]
 *     summary: Add an item to a batch
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     parameters:
 *       - { name: batchId, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               name: { type: string }
 *               price: { type: string }
 *               subcategory: { type: string }
 *               city: { type: string }
 *               area: { type: string }
 *               description: { type: string }
 *               images: { type: array, items: { type: string } }
 *               brand: { type: string }
 *               model: { type: string }
 *     responses:
 *       201: { description: Item added, content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *
 * /listings/bulk/batches/{batchId}/items/{itemId}:
 *   put:
 *     tags: [Listings]
 *     summary: Update a batch item
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     parameters:
 *       - { name: batchId, in: path, required: true, schema: { type: string } }
 *       - { name: itemId, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, additionalProperties: true }
 *     responses:
 *       200: { description: Updated, content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   delete:
 *     tags: [Listings]
 *     summary: Delete a batch item
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     parameters:
 *       - { name: batchId, in: path, required: true, schema: { type: string } }
 *       - { name: itemId, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Deleted, content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */

// GET /api/listings?flatten=1  -> flat array with `_type`
// GET /api/listings           -> { <moduleId>: [items] }
router.get('/', protect, asyncHandler(async (req, res) => {
  const flatten = req.query.flatten === '1';
  const grouped = {};
  const flat = [];
  const isAdmin = req.auth?.role === 'admin' || req.auth?.accountType === 'admin';
  const userEmail = req.auth?.email || req.user?.email || '';

  const mongoose = require('mongoose');
  const isValidObjectId = (val) => val && mongoose.Types.ObjectId.isValid(String(val));

  const filterOr = [];
  if (isValidObjectId(req.auth?.id)) filterOr.push({ createdBy: req.auth.id }, { lister: req.auth.id }, { user: req.auth.id });
  if (isValidObjectId(req.user?._id)) filterOr.push({ createdBy: req.user._id }, { lister: req.user._id }, { user: req.user._id });
  const listerIdVal = req.auth?.listerId || req.user?.listerId;
  if (listerIdVal) filterOr.push({ listerId: listerIdVal }, { lister_id: listerIdVal }, { 'details.listerId': listerIdVal });
  if (req.user?.phone) filterOr.push({ listerId: req.user.phone }, { lister_id: req.user.phone });
  if (req.auth?.id || req.user?._id) {
    const rawIdStr = String(req.auth?.id || req.user?._id);
    filterOr.push({ listerId: rawIdStr }, { lister_id: rawIdStr });
  }
  if (userEmail) filterOr.push({ 'contributor.email': userEmail });
  if (req.user?.firebaseUid) filterOr.push({ 'contributor.firebaseUid': req.user.firebaseUid });

  for (const mod of modules) {
    try {
      if (!mod || !mod.model) continue;
      const filter = filterOr.length > 0 ? { $or: filterOr } : { _id: null };

      const items = await mod.model.find(filter).sort({ createdAt: -1 }).limit(500).lean();
      if (!items || items.length === 0) continue;
      const normalizedItems = items.map(normalizeListingItem);
      grouped[mod.id] = normalizedItems;
      for (const item of normalizedItems) {
        flat.push({ ...item, _type: mod.id });
      }
    } catch (modErr) {
      console.warn(`⚠️ [GET /api/listings] Error querying module ${mod?.id}:`, modErr.message);
    }
  }

  if (flatten) {
    return new ApiResponse(200, flat, 'Listings fetched').send(res);
  }
  new ApiResponse(200, grouped, 'Listings fetched').send(res);
}));

const bulkListingController = require('../controllers/bulkListingController');

// Bulk Listing Endpoints
router.post('/bulk-upload', protect, bulkListingController.bulkUploadListings);
router.post('/bulk/download-log', bulkListingController.recordTemplateDownloadLog);
router.get('/bulk/download-logs', protect, adminOnly, bulkListingController.getTemplateDownloadLogs);
router.get('/bulk/batches', protect, bulkListingController.getBulkBatches);
router.get('/bulk/batches/:batchId', protect, bulkListingController.getBulkBatchById);
router.post('/bulk/batches/:batchId/items', protect, bulkListingController.addItemToBatch);
router.put('/bulk/batches/:batchId/items/:itemId', protect, bulkListingController.updateBatchItem);
router.delete('/bulk/batches/:batchId/items/:itemId', protect, bulkListingController.deleteBatchItem);
router.delete('/bulk/batches/:batchId', protect, bulkListingController.deleteBatch);

// POST /api/listings  — create a listing owned by the authenticated account.
router.post('/', protect, asyncHandler(async (req, res) => {
  const typeHint = req.body._type || req.body.categoryType || req.body.serviceType;
  const type = normalizeCategory(typeHint || req.body.category) || 'properties';
  const mod = findModule(type);

  const body = { ...req.body };
  // Never allow the client to forge the owner, a Mongo _id, or status.
  delete body._id;
  delete body.user;
  delete body.lister;
  delete body._type;
  delete body.status; // Backend controls status - always PENDING on creation

  const data = { ...body, status: 'pending' };

  // Enforce maximum 5 images across all categories; direct web links bypass Firebase Storage
  if (Array.isArray(data.images)) {
    data.images = data.images.map((img) => (typeof img === 'string' ? img.trim() : '')).filter(Boolean).slice(0, 5);
  }

  // Normalize documents safely based on module expectations
  if (Array.isArray(data.documents)) {
    if (mod.id === 'properties') {
      data.documents = data.documents.map((doc) => {
        if (typeof doc === 'string') return { url: doc.trim(), filename: '', fileType: '' };
        if (doc && typeof doc === 'object') return { url: (doc.url || doc.path || doc.src || '').trim(), filename: doc.filename || doc.name || '', fileType: doc.fileType || doc.type || '' };
        return null;
      }).filter((d) => d && d.url);
    } else {
      data.documents = data.documents.map((doc) => {
        if (typeof doc === 'string') return doc.trim();
        if (doc && typeof doc === 'object') return (doc.url || doc.path || doc.src || '').trim();
        return '';
      }).filter(Boolean);
    }
  }

  if (mod.id === 'vehicles') {
    if (!data.category || data.category === 'vehicle' || data.category === 'vehicles' || data.category === 'car') {
      data.category = data.wheelerType || (data.subcategory === 'Bike' ? '2-wheeler' : data.subcategory === 'Auto Rickshaw' ? '3-wheeler' : data.subcategory === 'Commercial Vehicle' ? 'commercial' : '4-wheeler');
    }
    if (!data.wheelerType) {
      data.wheelerType = data.category || '4-wheeler';
    }
    data.brand = data.brand || data.make || data.title?.split(' ')[0] || 'Generic';
    data.model = data.model || data.title || 'Standard';
    data.year = Number(data.year) || new Date().getFullYear();
    data.price = String(data.price || data.numericPrice || 'Price on Request');
    data.location = data.location || data.area || data.city || 'Bengaluru';
  }

  if (mod.id === 'properties') {
    const rawType = body.propertyType || body.subcategory || data.propertyType || data.subcategory;
    data.propertyType = normalizeCanonicalPropertyType(rawType);
    delete data.subcategory;
    delete body.subcategory;
    data.vendorName = data.vendorName || data.channelPartnerName || req.user?.name || 'One Vishwam';
    data.channelPartnerName = data.channelPartnerName || data.vendorName || req.user?.name || 'One Vishwam';
    data.bankLoanDetails = data.bankLoanDetails || 'Available on request';
  }

  if (mod.id === 'garments') {
    data.name = data.name || data.title || 'Apparel';
    const validGarmentCategories = ['Men', 'Women', 'Kids', 'Unisex'];
    if (!validGarmentCategories.includes(data.category)) {
      const match = validGarmentCategories.find(c => c.toLowerCase() === String(data.category || data.gender || data.subcategory || '').toLowerCase());
      data.category = match || 'Unisex';
    }
    data.price = String(data.price || data.numericPrice || '0');
  }

  if (mod.id === 'groceries') {
    data.name = data.name || data.title || 'Grocery Product';
    data.category = data.category && data.category !== 'grocery' && data.category !== 'groceries' ? data.category : (data.subcategory || 'General');
    data.price = String(data.price || data.numericPrice || '0');
  }

  if (mod.id === 'jewellery') {
    data.title = data.title || data.name || 'Jewellery';
    data.name = data.name || data.title || 'Jewellery';
    data.metalType = data.metalType || data.material || 'Gold';
    data.category = data.category && data.category !== 'jewellery' && data.category !== 'jewelry' ? data.category : (data.subcategory || 'Necklace');
    data.price = String(data.price || data.numericPrice || '0');
  }

  if (mod.id === 'electronics') {
    data.title = data.title || data.name || 'Electronic Item';
    data.brand = data.brand || data.make || 'Brand';
    data.model = data.model || 'Model';
    data.price = String(data.price || data.numericPrice || '0');
  }

  if (mod.id === 'bedding') {
    data.title = data.title || data.name || 'Bedding Item';
    data.brand = data.brand || 'Brand';
    data.model = data.model || 'Model';
    data.price = String(data.price || data.numericPrice || '0');
  }

  if (mod.id === 'finance') {
    data.category = data.category || 'Loan';
    data.companyName = data.companyName || data.vendorName || 'One Vishwam Finance';
    data.description = data.description || data.title || 'Financial Service';
    data.city = data.city || 'bengaluru';
    data.contactEmail = data.contactEmail || userEmail || 'ceo@onevishwam.com';
  }

  const mongoose = require('mongoose');
  const isValidObjectId = (val) => val && mongoose.Types.ObjectId.isValid(String(val));
  const ownerId = isValidObjectId(req.auth?.id)
    ? req.auth.id
    : (isValidObjectId(req.user?._id) ? req.user._id : new mongoose.Types.ObjectId());

  data.createdBy = ownerId;

  // Server-side automatic identity resolution for One Vishwam vs External Listers
  const userEmail = (req.user?.email || req.auth?.email || '').toLowerCase();
  const isOneVishwamUser = userEmail.endsWith('@onevishwam.com') || req.user?.role === 'in_house' || req.auth?.role === 'in_house';

  if (isOneVishwamUser) {
    data.channelPartnerName = 'One Vishwam';
    data.vendorName = 'One Vishwam';
    data.origin = 'in_house_project';
    data.priority = 1;
    data.isPriority = true;
    data.featured = true;
  } else {
    data.channelPartnerName = data.channelPartnerName || req.user?.name || 'External Partner';
    data.vendorName = data.vendorName || req.user?.name || 'Independent Owner';
    data.origin = req.user?.origin || 'channel_partner_project';
  }

  data.bankLoanDetails = data.bankLoanDetails || 'Available on request';

  const contributorName = req.user?.name || body.contributor?.name || data.vendorName || 'Contributor';
  const contributorPhone = req.user?.phone || body.contributor?.contact || body.contact || '';
  const contributorCity = req.user?.city || body.contributor?.city || body.city || '';

  data.contributor = {
    _id: ownerId,
    id: ownerId,
    name: contributorName,
    email: userEmail || body.contactEmail || '',
    contact: contributorPhone,
    phone: contributorPhone,
    city: contributorCity,
    type: req.auth?.accountType || 'lister',
    createdAt: new Date(),
  };

  // Clean redundant root fields from details if present
  if (data.details && typeof data.details === 'object') {
    delete data.details.channelPartnerName;
    delete data.details.vendorName;
    delete data.details.propertyName;
    delete data.details.expectedPrice;
    delete data.details.description;
    delete data.details.listerId;
    delete data.details.possessionStatus;
    delete data.details.negotiable;
  }

  const item = await mod.model.create(data);
  new ApiResponse(201, { item: normalizeListingItem(item) }, 'Listing created successfully. It is pending admin approval.').send(res);
}));

function isOwnerOrAdmin(item, req) {
  const isAdmin = Boolean(
    req.auth?.role === 'admin' ||
    req.auth?.role === 'super-admin' ||
    req.auth?.accountType === 'admin' ||
    req.user?.role === 'admin' ||
    req.user?.role === 'super-admin'
  );
  if (isAdmin) return;
  const authId = req.auth?.id ? String(req.auth.id) : null;
  const userId = req.user?._id ? String(req.user._id) : null;
  const userEmail = req.auth?.email || req.user?.email || '';

  if (item) {
    if (authId && item.lister && String(item.lister) === authId) return;
    if (authId && item.user && String(item.user) === authId) return;
    if (userId && item.lister && String(item.lister) === userId) return;
    if (userId && item.user && String(item.user) === userId) return;
    if (userEmail && item.contributor && item.contributor.email === userEmail) return;
  }
  throw new ApiError(403, 'Not authorized to access this listing');
}

function canListerEdit(item, req) {
  if (!LISTER_EDITABLE_STATUSES.includes(item.status)) {
    throw new ApiError(403, `Cannot edit listing with status "${item.status}". Only pending, changes-required, or approved listings can be edited.`);
  }
}

// GET /api/listings/:type/:id — single listing with ownership check.
router.get('/:type/:id', protect, asyncHandler(async (req, res) => {
  const mod = findModule(req.params.type);
  const item = await mod.model.findById(req.params.id).lean();
  if (!item) throw new ApiError(404, 'Listing not found');
  isOwnerOrAdmin(item, req);
  new ApiResponse(200, { item: normalizeListingItem(item) }, 'Listing fetched').send(res);
}));

const adminController = require('../controllers/adminController');

// PATCH /api/listings/:type/:id/images/reorder — reorder images in batch
router.patch('/:type/:id/images/reorder', protect, adminController.reorderListingImages);
router.patch('/:id/images/reorder', protect, adminController.reorderListingImages);

// PATCH /api/listings/:type/:id — update owned listing.
router.patch('/:type/:id', protect, asyncHandler(async (req, res) => {
  const mod = findModule(req.params.type);
  const item = await mod.model.findById(req.params.id);
  if (!item) throw new ApiError(404, 'Listing not found');
  isOwnerOrAdmin(item, req);

  const isAdmin = Boolean(
    req.auth?.role === 'admin' ||
    req.auth?.role === 'super-admin' ||
    req.auth?.accountType === 'admin' ||
    req.user?.role === 'admin' ||
    req.user?.role === 'super-admin'
  );

  // Non-admins cannot edit cancelled listings
  if (!isAdmin) {
    canListerEdit(item, req);
  }

  const body = { ...req.body };
  delete body._id;
  delete body.user;
  delete body.lister;
  delete body._type;
  // When a lister edits any product/listing, revert status to 'pending' so admin can review and approve it.
  // When an admin edits anything, it should NOT become pending status; let it be in approved.
  if (!isAdmin) {
    item.status = 'pending';
    item.adminComment = null;
    item.markModified('status');
    delete body.status;
  } else {
    if (body.status === 'pending' || !body.status) {
      if (item.status === 'pending' || item.status === 'changes-required' || item.status === 'approved' || !item.status) {
        item.status = 'approved';
        body.status = 'approved';
      } else {
        body.status = item.status;
      }
    } else {
      item.status = body.status;
    }
    item.adminComment = null;
    item.markModified('status');
  }

  // Enforce maximum 5 images across all categories; direct web links bypass Firebase Storage
  if (Array.isArray(body.images)) {
    const cleanImgs = body.images.map((img) => (typeof img === 'string' ? img.trim() : '')).filter(Boolean).slice(0, 5);
    body.images = cleanImgs;
    item.images = cleanImgs;
    item.markModified('images');
    if (item.details && typeof item.details === 'object') {
      item.details.images = cleanImgs;
      item.markModified('details');
    }
  }

  // Normalize documents safely based on module expectations
  if (Array.isArray(body.documents)) {
    if (mod.id === 'properties') {
      body.documents = body.documents.map((doc) => {
        if (typeof doc === 'string') return { url: doc.trim(), filename: '', fileType: '' };
        if (doc && typeof doc === 'object') return { url: (doc.url || doc.path || doc.src || '').trim(), filename: doc.filename || doc.name || '', fileType: doc.fileType || doc.type || '' };
        return null;
      }).filter((d) => d && d.url);
    } else {
      body.documents = body.documents.map((doc) => {
        if (typeof doc === 'string') return doc.trim();
        if (doc && typeof doc === 'object') return (doc.url || doc.path || doc.src || '').trim();
        return '';
      }).filter(Boolean);
    }
  }

  const wasApproved = item.status === 'approved';
  const wasCancelled = item.status === 'cancelled' || item.status === 'rejected';

  if (mod.id === 'properties') {
    const rawType = body.propertyType || body.subcategory || item.propertyType || item.subcategory;
    if (rawType) {
      const canonicalType = normalizeCanonicalPropertyType(rawType);
      body.propertyType = canonicalType;
      item.propertyType = canonicalType;
      if (item.details && typeof item.details === 'object') {
        item.details.propertyType = canonicalType;
      }
      if (body.details && typeof body.details === 'object') {
        body.details.propertyType = canonicalType;
      }
    }
    delete body.subcategory;
    if (item.subcategory !== undefined) {
      item.set('subcategory', undefined);
    }
    if (item._doc && 'subcategory' in item._doc) {
      delete item._doc.subcategory;
    }
    item.markModified('propertyType');
    item.markModified('details');
  }

  Object.assign(item, body);
  if (Array.isArray(body.images)) {
    item.markModified('images');
  }

  // Enforce priority for in-house / ceo@onevishwam.com listings
  const userEmail = (req.user?.email || req.auth?.email || '').toLowerCase();
  const isOneVishwamUser = userEmail === 'ceo@onevishwam.com' || userEmail.endsWith('@onevishwam.com') || req.user?.role === 'in_house' || req.auth?.role === 'in_house';
  if (isOneVishwamUser || item.origin === 'in_house_project') {
    item.priority = 1;
    item.isPriority = true;
    item.featured = true;
    item.origin = 'in_house_project';
    item.channelPartnerName = 'One Vishwam';
    item.vendorName = 'One Vishwam';
  }

  await item.save();
  if (mod?.service?.cache) {
    mod.service.cache.delete(String(req.params.id));
  }
  new ApiResponse(200, { item: normalizeListingItem(item) }, 'Listing updated successfully').send(res);
}));

// DELETE /api/listings/:type/:id — delete owned listing.
router.delete('/:type/:id', protect, asyncHandler(async (req, res) => {
  const mod = findModule(req.params.type);
  const item = await mod.model.findById(req.params.id);
  if (!item) throw new ApiError(404, 'Listing not found');
  isOwnerOrAdmin(item, req);

  const media = [
    ...(Array.isArray(item.images) ? item.images : []),
    ...(Array.isArray(item.videos) ? item.videos : []),
    ...(Array.isArray(item.documents) ? item.documents : []),
    ...(Array.isArray(item.floorPlanImages) ? item.floorPlanImages : []),
    item.videoUrl,
    item.video,
    item.pdfUrl,
    item.brochure,
  ];
  await deleteMultipleMediaFromStorage(media);

  await item.deleteOne();
  new ApiResponse(200, null, 'Listing deleted successfully').send(res);
}));

// ============================================================================
// ADMIN ROUTES
// ============================================================================

// GET /api/admin/listings — admin can see all listings with filters
router.get('/admin/all', protect, adminOnly, asyncHandler(async (req, res) => {
  const { status, category, listerId, search, page = 1, limit = 20 } = req.query;
  const p = Math.max(1, Number(page));
  const l = Math.min(100, Math.max(1, Number(limit)));

  const results = {};
  let total = 0;

  await Promise.all(modules.map(async (mod) => {
    const filter = {};
    if (status) filter.status = status;
    if (category && category !== 'all') {
      const targetMod = normalizeCategory(category);
      if (targetMod !== mod.id) return;
    }
    if (listerId) filter.lister = listerId;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
      ];
    }

    try {
      const items = await mod.model.find(filter)
        .populate('lister', 'name email phone listerId')
        .sort({ createdAt: -1 })
        .skip((p - 1) * l)
        .limit(l)
        .lean();
      if (items.length > 0) {
        results[mod.id] = items.map(normalizeListingItem);
        total += items.length;
      }
    } catch { }
  }));

  new ApiResponse(200, { results, total, page: p, limit: l }, 'Admin listings fetched').send(res);
}));

// GET /api/admin/listings/stats — admin dashboard stats
router.get('/admin/stats', protect, adminOnly, asyncHandler(async (req, res) => {
  const stats = {
    total: 0,
    pending: 0,
    approved: 0,
    'changes-required': 0,
    cancelled: 0,
    byCategory: {},
  };

  await Promise.all(modules.map(async (mod) => {
    try {
      const [total, pending, approved, changes, cancelled] = await Promise.all([
        mod.model.countDocuments(),
        mod.model.countDocuments({ status: 'pending' }),
        mod.model.countDocuments({ status: 'approved' }),
        mod.model.countDocuments({ status: 'changes-required' }),
        mod.model.countDocuments({ status: 'cancelled' }),
      ]);
      stats.total += total;
      stats.pending += pending;
      stats.approved += approved;
      stats['changes-required'] += changes;
      stats.cancelled += cancelled;
      if (total > 0) {
        stats.byCategory[mod.id] = { total, pending, approved, 'changes-required': changes, cancelled };
      }
    } catch { }
  }));

  stats.totalListings = stats.total;
  stats.pendingListings = stats.pending;
  stats.approvedListings = stats.approved;
  stats.cancelledListings = stats.cancelled;
  stats.changesRequiredListings = stats['changes-required'];

  new ApiResponse(200, stats, 'Admin listing stats fetched').send(res);
}));

// PATCH /api/admin/listings/:type/:id/approve
router.patch('/admin/:type/:id/approve', protect, adminOnly, asyncHandler(async (req, res) => {
  const mod = findModule(req.params.type);
  const item = await mod.model.findById(req.params.id);
  if (!item) throw new ApiError(404, 'Listing not found');

  item.status = 'approved';
  item.adminComment = undefined;
  item.updatedAt = new Date();
  await item.save();

  new ApiResponse(200, { item }, 'Listing approved successfully').send(res);
}));

// PATCH /api/admin/listings/:type/:id/changes
router.patch('/admin/:type/:id/changes', protect, adminOnly, asyncHandler(async (req, res) => {
  const mod = findModule(req.params.type);
  const item = await mod.model.findById(req.params.id);
  if (!item) throw new ApiError(404, 'Listing not found');

  const reason = req.body.reason || 'Please make the required changes and resubmit.';
  item.status = 'changes-required';
  item.adminComment = reason;
  item.updatedAt = new Date();
  await item.save();

  new ApiResponse(200, { item }, 'Changes requested successfully').send(res);
}));

// PATCH /api/admin/listings/:type/:id/cancel
router.patch('/admin/:type/:id/cancel', protect, adminOnly, asyncHandler(async (req, res) => {
  const mod = findModule(req.params.type);
  const item = await mod.model.findById(req.params.id);
  if (!item) throw new ApiError(404, 'Listing not found');

  const transition = ADMIN_STATUS_TRANSITIONS.cancel;
  if (!transition.from.includes(item.status)) {
    throw new ApiError(400, `Cannot cancel listing with status "${item.status}"`);
  }

  const reason = req.body.reason || 'Listing cancelled by admin.';
  item.status = transition.to;
  item.adminComment = reason;
  item.updatedAt = new Date();
  await item.save();

  new ApiResponse(200, { item }, 'Listing cancelled successfully').send(res);
}));

module.exports = router;