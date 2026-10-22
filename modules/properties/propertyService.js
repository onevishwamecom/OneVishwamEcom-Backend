const BaseService = require('../../services/baseService');
const Property = require('./model');
const ApiError = require('../../utils/ApiError');

const LISTED_WITHIN_DAYS = {
  Today: 0,
  'Last 3 Days': 3,
  'Last 7 Days': 7,
  'Last 30 Days': 30,
};

const SORT_OPTIONS = {
  latest: { priority: -1, createdAt: -1 },
  oldest: { priority: -1, createdAt: 1 },
  'price-low': { priority: -1, numericPrice: 1 },
  'price-high': { priority: -1, numericPrice: -1 },
  'area-low': { priority: -1, numericArea: 1 },
  'area-high': { priority: -1, numericArea: -1 },
  viewed: { priority: -1, viewsCount: -1 },
};

/**
 * PropertyService - Encapsulates property management business logic
 * Inherits standard pagination, CRUD, and ownership validation from BaseService.
 */
class PropertyService extends BaseService {
  constructor() {
    super({
      model: Property,
      searchFields: ['title', 'description', 'city', 'area', 'location', 'subtitle'],
      rangeFilters: {
        numericPrice: { min: 'priceMin', max: 'priceMax' },
        numericArea: { min: 'areaMin', max: 'areaMax' },
      },
      defaultSort: { priority: -1, createdAt: -1 },
      defaultFilter: {
        status: { $in: ['approved', 'active', 'available'] },
        availabilityStatus: { $in: ['available', 'sold_out', null] },
      },
      ownerField: 'user',
    });
  }

  getSort(sortBy) {
    return SORT_OPTIONS[sortBy] || this.defaultSort;
  }

  buildFilter(query = {}) {
    const filter = super.buildFilter(query);
    const reserved = ['q', 'page', 'limit', 'sort', 'sortBy', 'search', 'priceMin', 'priceMax', 'areaMin', 'areaMax', 'listedWithin'];

    for (const [key, value] of Object.entries(query)) {
      if (reserved.includes(key)) continue;
      if (value === '' || value === undefined || value === null || value === 'all') continue;
      if (key.endsWith('Min') || key.endsWith('Max')) continue;
      if (key === 'amenities') {
        filter.amenities = { $all: Array.isArray(value) ? value : value.split(',') };
        continue;
      }
      filter[key] = value;
    }

    if (query.listedWithin && LISTED_WITHIN_DAYS[query.listedWithin] !== undefined) {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - LISTED_WITHIN_DAYS[query.listedWithin]);
      filter.createdAt = { $gte: daysAgo };
    }

    return filter;
  }

  buildSearchQuery(q) {
    return {
      status: { $in: ['approved', 'active', 'available'] },
      availabilityStatus: { $in: ['available', 'sold_out', null] },
      $or: this.searchFields.map((field) => ({
        [field]: { $regex: q, $options: 'i' },
      })),
    };
  }

  async getAll(query = {}) {
    const filter = query.q ? this.buildSearchQuery(query.q.trim()) : this.buildFilter(query);
    const sort = this.getSort(query.sort || query.sortBy);
    const { skip, page, limit } = this.paginate(query.page, query.limit);

    const [items, total] = await Promise.all([
      this.model.find(filter).sort(sort).skip(skip).limit(limit),
      this.model.countDocuments(filter),
    ]);

    return {
      items,
      pagination: {
        ...this.buildPagination(page, limit, total),
        currentPage: page,
      },
    };
  }

  async getById(id) {
    const cacheKey = String(id);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const property = await this.model.findOneAndUpdate(
      {
        _id: id,
        status: { $in: ['approved', 'active', 'available'] },
        availabilityStatus: { $in: ['available', 'sold_out', null] },
      },
      { $inc: { viewsCount: 1 } },
      { new: true }
    );
    if (!property) throw new ApiError(404, 'Property not found');
    this.cache.set(cacheKey, property);
    return property;
  }

  async getFeatured() {
    const items = await this.model
      .find({
        featured: true,
        status: { $in: ['approved', 'active'] },
        availabilityStatus: { $in: ['available', 'sold_out', null] },
      })
      .sort({ priority: -1, createdAt: -1 })
      .limit(6)
      .lean();
    return { items };
  }

  async getLatest(limit = 6) {
    const l = Math.min(20, Number(limit) || 6);
    const items = await this.model
      .find({
        status: { $in: ['approved', 'active'] },
        availabilityStatus: { $in: ['available', 'sold_out', null] },
      })
      .sort({ priority: -1, createdAt: -1 })
      .limit(l)
      .lean();
    return { items };
  }

  async getSimilar(id) {
    const property = await this.model.findById(id).lean();
    if (!property) throw new ApiError(404, 'Property not found');

    const similar = await this.model
      .find({
        _id: { $ne: property._id },
        status: { $in: ['approved', 'active'] },
        availabilityStatus: { $in: ['available', 'sold_out'] },
        $or: [{ city: property.city }, { area: property.area }],
      })
      .sort({ priority: -1, createdAt: -1 })
      .limit(4)
      .lean();

    return { items: similar };
  }

  async create(data, files, userId) {
    const payload = { ...data, user: userId };
    payload.subtitle = payload.subtitle || payload.title;

    if (files && files.length > 0) {
      payload.images = files.map((f) => {
        if (f.path && f.path.startsWith('http')) return f.path;
        if (f.cloudinaryUrl) return f.cloudinaryUrl;
        return `/uploads/${f.filename}`;
      });
    }

    return this.model.create(payload);
  }

  async update(id, data, files, userId, userRole) {
    const property = await this.model.findById(id);
    if (!property) throw new ApiError(404, 'Property not found');

    if (property.user && userId.toString() !== property.user.toString() && userRole !== 'admin') {
      throw new ApiError(403, 'Not authorized to update this property');
    }

    if (files && files.length > 0) {
      const newImages = files.map((f) => {
        if (f.path && f.path.startsWith('http')) return f.path;
        if (f.cloudinaryUrl) return f.cloudinaryUrl;
        return `/uploads/${f.filename}`;
      });
      if (data.replaceImages === 'true') {
        data.images = newImages;
      } else {
        data.images = [...(property.images || []), ...newImages];
      }
    }

    Object.assign(property, data);
    await property.save();
    this.cache.delete(String(id));
    return property;
  }

  async remove(id, userId, userRole) {
    const property = await this.model.findById(id);
    if (!property) throw new ApiError(404, 'Property not found');

    if (property.user && userId.toString() !== property.user.toString() && userRole !== 'admin') {
      throw new ApiError(403, 'Not authorized to delete this property');
    }

    property.status = 'deleted';
    await property.save();
    this.cache.delete(String(id));
  }

  async toggleStatus(id, userId, userRole) {
    const property = await this.model.findById(id);
    if (!property) throw new ApiError(404, 'Property not found');

    if (property.user && userId.toString() !== property.user.toString() && userRole !== 'admin') {
      throw new ApiError(403, 'Not authorized');
    }

    const statusFlow = { active: 'inactive', inactive: 'active' };
    property.status = statusFlow[property.status] || 'active';
    await property.save();
    this.cache.delete(String(id));
    return property;
  }

  async getMyProperties(userId) {
    return this.model
      .find({
        $or: [{ user: userId }, { lister: userId }, { listerId: String(userId) }],
        status: { $ne: 'deleted' },
      })
      .sort({ createdAt: -1 });
  }
}

const propertyService = new PropertyService();

module.exports = {
  PropertyService,
  propertyService,
  getAll: (q) => propertyService.getAll(q),
  getById: (id) => propertyService.getById(id),
  getFeatured: () => propertyService.getFeatured(),
  getLatest: (l) => propertyService.getLatest(l),
  getSimilar: (id) => propertyService.getSimilar(id),
  create: (d, f, u) => propertyService.create(d, f, u),
  update: (id, d, f, u, r) => propertyService.update(id, d, f, u, r),
  remove: (id, u, r) => propertyService.remove(id, u, r),
  toggleStatus: (id, u, r) => propertyService.toggleStatus(id, u, r),
  getMyProperties: (u) => propertyService.getMyProperties(u),
};
