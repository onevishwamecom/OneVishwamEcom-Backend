const ApiError = require('../utils/ApiError');
const LRUCache = require('../utils/lruCache');

/**
 * BaseService - Core Object-Oriented base service class
 * Provides reusable CRUD, filtering, pagination, and ownership verification.
 * Backed by an O(1) in-memory LRU Cache for high-frequency product reads.
 */
class BaseService {
  /**
   * @param {Object} options
   * @param {import('mongoose').Model} options.model - Mongoose Model
   * @param {Array<string>} [options.searchFields] - Fields to search against with regex
   * @param {Object} [options.rangeFilters] - Field range mapping e.g. { numericPrice: { min: 'priceMin', max: 'priceMax' } }
   * @param {Object} [options.defaultSort] - Default sort object
   * @param {Object} [options.defaultFilter] - Default query filter (e.g. status)
   * @param {string} [options.ownerField] - Owner field on document (defaults to 'user')
   * @param {number} [options.cacheCapacity=300] - In-memory LRU cache capacity
   * @param {number} [options.cacheTtlMs=60000] - Cache entry TTL in milliseconds
   */
  constructor({
    model,
    searchFields = [],
    rangeFilters = {},
    defaultSort = { createdAt: -1 },
    defaultFilter = { status: { $in: ['approved', 'active'] }, availabilityStatus: { $in: ['available', 'sold_out'] } },
    ownerField = 'user',
    cacheCapacity = 300,
    cacheTtlMs = 60000,
  }) {
    if (!model) {
      throw new Error('BaseService requires a valid Mongoose model');
    }
    this.model = model;
    this.searchFields = searchFields;
    this.rangeFilters = rangeFilters;
    this.defaultSort = defaultSort;
    this.defaultFilter = defaultFilter;
    this.ownerField = ownerField;

    // O(1) in-memory cache for hot reads
    this.cache = new LRUCache(cacheCapacity, cacheTtlMs);
  }

  /**
   * Standard pagination calculation
   */
  paginate(page = 1, limit = 20) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit) || 20));
    return { skip: (p - 1) * l, page: p, limit: l };
  }

  /**
   * Standard pagination metadata envelope
   */
  buildPagination(page, limit, total) {
    const totalPages = Math.ceil(total / limit) || 1;
    return {
      page,
      limit,
      totalItems: total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  /**
   * Sort resolution
   */
  getSort(sortBy) {
    const sorts = {
      latest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      'price-low': { numericPrice: 1, priceValue: 1 },
      'price-high': { numericPrice: -1, priceValue: -1 },
      'area-low': { numericArea: 1 },
      'area-high': { numericArea: -1 },
    };
    return sorts[sortBy] || this.defaultSort;
  }

  /**
   * Query filter builder
   */
  buildFilter(query = {}) {
    const filter = { ...this.defaultFilter };
    const reserved = ['q', 'page', 'limit', 'sort', 'sortBy', 'search'];

    for (const [key, value] of Object.entries(query)) {
      if (reserved.includes(key)) continue;
      if (value === '' || value === undefined || value === null || value === 'all') continue;
      if (key.endsWith('Min') || key.endsWith('Max')) continue;
      filter[key] = value;
    }

    for (const [field, range] of Object.entries(this.rangeFilters)) {
      if (range.min && query[range.min]) {
        filter[field] = { ...filter[field], $gte: Number(query[range.min]) };
      }
      if (range.max && query[range.max]) {
        filter[field] = { ...filter[field], $lte: Number(query[range.max]) };
      }
    }

    return filter;
  }

  /**
   * Text search filter builder
   */
  buildSearchQuery(q) {
    if (!q || this.searchFields.length === 0) return {};
    return {
      $or: this.searchFields.map((field) => ({
        [field]: { $regex: q, $options: 'i' },
      })),
    };
  }

  async getAll(query = {}) {
    const filter = query.q
      ? { ...this.defaultFilter, ...this.buildSearchQuery(query.q.trim()) }
      : this.buildFilter(query);

    const sort = this.getSort(query.sort || query.sortBy);
    const { skip, page, limit } = this.paginate(query.page, query.limit);

    const [items, total] = await Promise.all([
      this.model.find(filter).sort(sort).skip(skip).limit(limit),
      this.model.countDocuments(filter),
    ]);

    return {
      items,
      pagination: this.buildPagination(page, limit, total),
    };
  }

  async getById(id) {
    const cacheKey = String(id);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const item = await this.model.findOne({
      _id: id,
      ...this.defaultFilter,
    });
    if (!item) {
      throw new ApiError(404, `${this.model.modelName || 'Item'} not found`);
    }

    this.cache.set(cacheKey, item);
    return item;
  }

  async getMy(userId) {
    return this.model.find({ [this.ownerField]: userId }).sort({ createdAt: -1 });
  }

  async create(data, userId) {
    const payload = { ...data, [this.ownerField]: userId };
    return this.model.create(payload);
  }

  async update(id, updates, userId, userRole) {
    const item = await this.model.findById(id);
    if (!item) {
      throw new ApiError(404, `${this.model.modelName || 'Item'} not found`);
    }
    const isOwner = item[this.ownerField] && String(userId) === String(item[this.ownerField]);
    const isAdmin = userRole === 'admin' || userRole === 'super-admin';
    if (!isOwner && !isAdmin) {
      throw new ApiError(403, 'Not authorized to modify this resource');
    }
    Object.assign(item, updates);
    const saved = await item.save();
    this.cache.delete(String(id));
    return saved;
  }

  async remove(id, userId, userRole) {
    const item = await this.model.findById(id);
    if (!item) {
      throw new ApiError(404, `${this.model.modelName || 'Item'} not found`);
    }
    const isOwner = item[this.ownerField] && String(userId) === String(item[this.ownerField]);
    const isAdmin = userRole === 'admin' || userRole === 'super-admin';
    if (!isOwner && !isAdmin) {
      throw new ApiError(403, 'Not authorized to delete this resource');
    }
    await item.deleteOne();
    this.cache.delete(String(id));
    return true;
  }

  async toggleStatus(id, userId, userRole) {
    const item = await this.model.findById(id);
    if (!item) {
      throw new ApiError(404, `${this.model.modelName || 'Item'} not found`);
    }
    const isOwner = item[this.ownerField] && String(userId) === String(item[this.ownerField]);
    const isAdmin = userRole === 'admin' || userRole === 'super-admin';
    if (!isOwner && !isAdmin) {
      throw new ApiError(403, 'Not authorized');
    }
    item.status = item.status === 'active' || item.status === 'approved' ? 'inactive' : 'active';
    await item.save();
    this.cache.delete(String(id));
    return item;
  }
}

module.exports = BaseService;
