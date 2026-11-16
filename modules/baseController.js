const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const mongoose = require('mongoose');

/**
 * Universal BaseController
 * Provides schema-driven, reusable REST operations with extensible lifecycle hooks.
 *
 * Lifecycle Hooks (in service):
 * - beforeList(filter, req) -> filter
 * - afterList(items, req) -> items
 * - afterGetOne(item, req) -> item
 * - beforeCreate(data, req) -> data
 * - afterCreate(item, req)
 * - beforeUpdate(item, updateData, req) -> updateData
 * - afterUpdate(item, req)
 * - beforeDelete(item, req)
 * - afterDelete(item, req)
 */
class BaseController {
  constructor(options = {}) {
    this.model = options.model;
    this.config = options.config || options || {};
    this.service = options.service || {};
    this.ownerField = options.ownerField || this.config.ownerField || 'user';
    this.searchableFields = this.config.searchableFields || ['title', 'name', 'description', 'brand', 'city', 'area'];
    this.filterableFields = this.config.filterableFields || [
      'category',
      'subcategory',
      'brand',
      'condition',
      'city',
      'status',
      'isActive',
    ];
    this.rangeFilters = this.config.rangeFilters || {
      numericPrice: { min: 'minPrice', max: 'maxPrice' },
      price: { min: 'priceMin', max: 'priceMax' },
    };
    this.defaultSort = this.config.defaultSort || { createdAt: -1 };
    this.populate = this.config.populate || [];
    this.softDelete = this.config.softDelete !== false;

    // Bind methods
    this.list = this.list.bind(this);
    this.getOne = this.getOne.bind(this);
    this.getMy = this.getMy.bind(this);
    this.getSimilar = this.getSimilar.bind(this);
    this.create = this.create.bind(this);
    this.update = this.update.bind(this);
    this.delete = this.delete.bind(this);
    this.toggleStatus = this.toggleStatus.bind(this);

    // Backward-compatibility aliases
    this.getAll = this.list;
    this.getById = this.getOne;
    this.remove = this.delete;
  }

  /**
   * Helper: Builds Mongoose filter query from request query params
   */
  buildFilter(query, user) {
    const filter = {};

    // Search query via regex across searchableFields
    const searchTerm = query.search || query.q;
    if (searchTerm && this.searchableFields.length > 0) {
      const cleanTerm = String(searchTerm).trim();
      const regex = new RegExp(cleanTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = this.searchableFields.map((field) => ({ [field]: regex }));
    }

    // Dynamic direct match filters
    this.filterableFields.forEach((field) => {
      if (query[field] !== undefined && query[field] !== '') {
        const val = query[field];
        if (val === 'true' || val === true) filter[field] = true;
        else if (val === 'false' || val === false) filter[field] = false;
        else if (field === 'city') filter[field] = String(val).toLowerCase().trim();
        else filter[field] = val;
      }
    });

    // Dynamic numeric range filters (e.g. minPrice/maxPrice)
    if (this.rangeFilters) {
      Object.entries(this.rangeFilters).forEach(([field, mapping]) => {
        const minVal = query[mapping.min] || query.minPrice || query.priceMin;
        const maxVal = query[mapping.max] || query.maxPrice || query.priceMax;
        if (minVal !== undefined || maxVal !== undefined) {
          filter[field] = filter[field] || {};
          if (minVal !== undefined && !isNaN(Number(minVal))) filter[field].$gte = Number(minVal);
          if (maxVal !== undefined && !isNaN(Number(maxVal))) filter[field].$lte = Number(maxVal);
          if (Object.keys(filter[field]).length === 0) delete filter[field];
        }
      });
    }

    // Default active/status visibility for non-admin public listing queries
    const isAdmin = user && user.role === 'admin';
    if (!isAdmin && query.my !== 'true') {
      if (filter.status === undefined) {
        filter.status = 'approved';
      }
      if (filter.isActive === undefined) {
        filter.isActive = { $ne: false };
      }
    }

    return filter;
  }

  /**
   * GET / - Paginated, filterable, searchable list
   */
  list = asyncHandler(async (req, res) => {
    let filter = this.buildFilter(req.query, req.user);

    // Lifecycle hook: beforeList
    if (typeof this.service.beforeList === 'function') {
      filter = await this.service.beforeList(filter, req);
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    // Sorting
    let sort = this.defaultSort;
    if (req.query.sort) {
      sort = req.query.sort;
    } else if (req.query.sortBy) {
      const order = req.query.order === 'asc' || req.query.order === '1' ? 1 : -1;
      sort = { [req.query.sortBy]: order };
    }

    let query = this.model.find(filter).sort(sort).skip(skip).limit(limit);
    if (this.populate.length > 0) {
      query = query.populate(this.populate);
    }

    const [items, total] = await Promise.all([
      query.exec(),
      this.model.countDocuments(filter),
    ]);

    let finalItems = items;
    // Lifecycle hook: afterList
    if (typeof this.service.afterList === 'function') {
      finalItems = await this.service.afterList(items, req);
    }

    const response = new ApiResponse(
      200,
      {
        items: finalItems,
        pagination: {
          page,
          limit,
          totalItems: total,
          totalPages: Math.ceil(total / limit),
        },
      },
      'Fetched successfully'
    );

    // Edge CDN / HTTP caching for public reads
    if (!req.headers.authorization) {
      response.setCache(30, 60, 120);
    }

    response.send(res);
  });

  /**
   * GET /:id - Single item by ID
   */
  getOne = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, 'Invalid item ID format');
    }

    let query = this.model.findById(id);
    if (this.populate.length > 0) {
      query = query.populate(this.populate);
    }

    let item = await query.exec();
    if (!item) {
      throw new ApiError(404, 'Item not found');
    }

    // Lifecycle hook: afterGetOne
    if (typeof this.service.afterGetOne === 'function') {
      item = await this.service.afterGetOne(item, req);
    }

    const response = new ApiResponse(200, { item }, 'Fetched successfully');
    if (!req.headers.authorization) {
      response.setCache(30, 60, 120);
    }
    response.send(res);
  });

  /**
   * GET /similar/:id or /:id/similar - Similar items by subcategory/category
   */
  getSimilar = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, 'Invalid item ID format');
    }

    const current = await this.model.findById(id).lean();
    if (!current) {
      throw new ApiError(404, 'Item not found');
    }

    const filter = {
      _id: { $ne: current._id },
      status: { $in: ['approved', 'active', 'available'] },
      availabilityStatus: { $ne: 'sold_out' },
    };

    if (current.subcategory) {
      filter.subcategory = current.subcategory;
    } else if (current.category) {
      filter.category = current.category;
    } else if (current.propertyType) {
      filter.propertyType = current.propertyType;
    }

    if (current.city) {
      filter.city = current.city;
    }

    let items = await this.model.find(filter).limit(4).sort({ createdAt: -1 }).lean();
    if (items.length === 0 && (current.category || current.propertyType)) {
      delete filter.city;
      items = await this.model.find(filter).limit(4).sort({ createdAt: -1 }).lean();
    }

    new ApiResponse(200, { items }, 'Similar items fetched').send(res);
  });

  /**
   * GET /my - Lister's own listings
   */
  getMy = asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }

    const filter = { [this.ownerField]: req.user._id };
    const items = await this.model.find(filter).sort({ createdAt: -1 });

    new ApiResponse(200, { items }, 'Your listings fetched successfully').send(res);
  });

  /**
   * POST / - Create a new item
   */
  create = asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required to create listing');
    }

    let data = { ...req.body, [this.ownerField]: req.user._id };

    // File uploads handling (single or multiple)
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      data.images = req.files.map(
        (f) => f.path || f.cloudinaryUrl || f.location || `/uploads/${f.filename}`
      );
    } else if (req.file) {
      data.image = req.file.path || req.file.cloudinaryUrl || `/uploads/${req.file.filename}`;
    }

    // Lifecycle hook: beforeCreate
    if (typeof this.service.beforeCreate === 'function') {
      data = await this.service.beforeCreate(data, req);
    }

    const item = await this.model.create(data);

    // Lifecycle hook: afterCreate
    if (typeof this.service.afterCreate === 'function') {
      await this.service.afterCreate(item, req);
    }

    new ApiResponse(201, { item }, 'Created successfully').send(res);
  });

  /**
   * PUT /:id - Update an existing item
   */
  update = asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, 'Invalid item ID format');
    }

    const item = await this.model.findById(id);
    if (!item) {
      throw new ApiError(404, 'Item not found');
    }

    // Ownership authorization check
    const ownerId = item[this.ownerField] ? item[this.ownerField].toString() : null;
    const isOwner = ownerId && req.user._id.toString() === ownerId;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      throw new ApiError(403, 'Not authorized to update this listing');
    }

    let updateData = { ...req.body };

    // Append / replace images if files uploaded
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      const newImages = req.files.map(
        (f) => f.path || f.cloudinaryUrl || f.location || `/uploads/${f.filename}`
      );
      updateData.images =
        req.body.replaceImages === 'true'
          ? newImages
          : [...(item.images || []), ...newImages];
    }

    // Lifecycle hook: beforeUpdate
    if (typeof this.service.beforeUpdate === 'function') {
      updateData = await this.service.beforeUpdate(item, updateData, req);
    }

    Object.assign(item, updateData);
    await item.save();

    // Lifecycle hook: afterUpdate
    if (typeof this.service.afterUpdate === 'function') {
      await this.service.afterUpdate(item, req);
    }

    new ApiResponse(200, { item }, 'Updated successfully').send(res);
  });

  /**
   * DELETE /:id - Delete item (soft delete by default, or hard delete)
   */
  delete = asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, 'Invalid item ID format');
    }

    const item = await this.model.findById(id);
    if (!item) {
      throw new ApiError(404, 'Item not found');
    }

    const ownerId = item[this.ownerField] ? item[this.ownerField].toString() : null;
    const isOwner = ownerId && req.user._id.toString() === ownerId;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      throw new ApiError(403, 'Not authorized to delete this listing');
    }

    // Lifecycle hook: beforeDelete
    if (typeof this.service.beforeDelete === 'function') {
      await this.service.beforeDelete(item, req);
    }

    if (this.softDelete && ('isActive' in item || 'status' in item)) {
      item.isActive = false;
      item.status = 'deleted';
      await item.save();
    } else {
      await item.deleteOne();
    }

    // Lifecycle hook: afterDelete
    if (typeof this.service.afterDelete === 'function') {
      await this.service.afterDelete(item, req);
    }

    new ApiResponse(200, null, 'Deleted successfully').send(res);
  });

  /**
   * PATCH /:id/status - Toggle active/inactive state
   */
  toggleStatus = asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }

    const { id } = req.params;
    const item = await this.model.findById(id);
    if (!item) {
      throw new ApiError(404, 'Item not found');
    }

    const ownerId = item[this.ownerField] ? item[this.ownerField].toString() : null;
    const isOwner = ownerId && req.user._id.toString() === ownerId;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      throw new ApiError(403, 'Not authorized to change listing status');
    }

    item.isActive = !item.isActive;
    await item.save();

    new ApiResponse(200, { item }, `Listing ${item.isActive ? 'activated' : 'deactivated'}`).send(res);
  });
}

/**
 * Factory wrapper ensuring full backwards compatibility with modules calling createCRUDController()
 */
function createCRUDController(options) {
  const controller = new BaseController(options);
  return {
    getAll: controller.list,
    list: controller.list,
    getById: controller.getOne,
    getOne: controller.getOne,
    getMy: controller.getMy,
    getSimilar: controller.getSimilar,
    create: controller.create,
    update: controller.update,
    remove: controller.delete,
    delete: controller.delete,
    toggleStatus: controller.toggleStatus,
    controller,
  };
}

createCRUDController.BaseController = BaseController;
module.exports = createCRUDController;
