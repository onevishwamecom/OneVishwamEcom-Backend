const Property = require('./model');
const ApiError = require('../../utils/ApiError');

const LISTED_WITHIN_DAYS = {
  'Today': 0, 'Last 3 Days': 3, 'Last 7 Days': 7, 'Last 30 Days': 30,
};

const SORT_OPTIONS = {
  latest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  'price-low': { numericPrice: 1 },
  'price-high': { numericPrice: -1 },
  'area-low': { numericArea: 1 },
  'area-high': { numericArea: -1 },
  viewed: { viewsCount: -1 },
};

function buildFilter(query) {
  const filter = { status: { $ne: 'deleted' } };
  const reserved = ['q', 'page', 'limit', 'sort', 'sortBy'];

  for (const [key, value] of Object.entries(query)) {
    if (reserved.includes(key)) continue;
    if (key.endsWith('Min') || key.endsWith('Max')) continue;
    if (key === 'amenities') {
      filter.amenities = { $all: Array.isArray(value) ? value : value.split(',') };
      continue;
    }
    filter[key] = value;
  }

  if (query.priceMin || query.priceMax) {
    filter.numericPrice = {};
    if (query.priceMin) filter.numericPrice.$gte = Number(query.priceMin);
    if (query.priceMax) filter.numericPrice.$lte = Number(query.priceMax);
  }
  if (query.areaMin || query.areaMax) {
    filter.numericArea = {};
    if (query.areaMin) filter.numericArea.$gte = Number(query.areaMin);
    if (query.areaMax) filter.numericArea.$lte = Number(query.areaMax);
  }

  if (query.listedWithin && LISTED_WITHIN_DAYS[query.listedWithin] !== undefined) {
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - LISTED_WITHIN_DAYS[query.listedWithin]);
    filter.createdAt = { $gte: daysAgo };
  }

  return filter;
}

function buildSearchQuery(q) {
  return {
    status: { $ne: 'deleted' },
    $or: [
      { title: { $regex: q, $options: 'i' } },
      { description: { $regex: q, $options: 'i' } },
      { city: { $regex: q, $options: 'i' } },
      { area: { $regex: q, $options: 'i' } },
      { location: { $regex: q, $options: 'i' } },
      { propertyType: { $regex: q, $options: 'i' } },
      { subtitle: { $regex: q, $options: 'i' } },
    ],
  };
}

function getSort(query) {
  const sortBy = query.sort || query.sortBy || 'latest';
  return SORT_OPTIONS[sortBy] || SORT_OPTIONS.latest;
}

function paginate(page = 1, limit = 20) {
  const p = Math.max(1, Number(page));
  const l = Math.min(100, Math.max(1, Number(limit)));
  return { skip: (p - 1) * l, page: p, limit: l };
}

function buildPagination(page, limit, total) {
  const totalPages = Math.ceil(total / limit);
  return {
    page, limit, totalItems: total, totalPages,
    currentPage: page,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

const getAll = async (query) => {
  const filter = query.q ? buildSearchQuery(query.q.trim()) : buildFilter(query);
  const sort = getSort(query);
  const { skip, page, limit } = paginate(query.page, query.limit);

  let items, total;
  if (query.q) {
    [items, total] = await Promise.all([
      Property.find(filter).sort(sort).skip(skip).limit(limit),
      Property.countDocuments(filter),
    ]);
  } else {
    [items, total] = await Promise.all([
      Property.find(filter).sort(sort).skip(skip).limit(limit),
      Property.countDocuments(filter),
    ]);
  }

  return { items, pagination: buildPagination(page, limit, total) };
};

const getById = async (id) => {
  const property = await Property.findOneAndUpdate(
    { _id: id, status: { $ne: 'deleted' } },
    { $inc: { viewsCount: 1 } },
    { new: true }
  );
  if (!property) throw new ApiError(404, 'Property not found');
  return { property };
};

const getFeatured = async () => {
  const items = await Property.find({ featured: true, status: { $ne: 'deleted' } })
    .sort({ createdAt: -1 })
    .limit(6);
  return { items };
};

const getLatest = async (limit = 6) => {
  const l = Math.min(20, Number(limit));
  const items = await Property.find({ status: { $ne: 'deleted' } })
    .sort({ createdAt: -1 })
    .limit(l);
  return { items };
};

const getSimilar = async (id) => {
  const property = await Property.findById(id);
  if (!property) throw new ApiError(404, 'Property not found');

  const similar = await Property.find({
    _id: { $ne: property._id },
    status: { $ne: 'deleted' },
    $or: [
      { city: property.city },
      { area: property.area },
      { propertyType: property.propertyType },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(4);

  return { items: similar };
};

const create = async (data, files, userId) => {
  const payload = { ...data, user: userId };
  payload.subtitle = payload.subtitle || payload.title;

  if (files && files.length > 0) {
    payload.images = files.map(f => {
      if (f.path && f.path.startsWith('http')) return f.path;
      if (f.cloudinaryUrl) return f.cloudinaryUrl;
      return `/uploads/${f.filename}`;
    });
  }

  const property = await Property.create(payload);
  return { property };
};

const update = async (id, data, files, userId, userRole) => {
  const property = await Property.findById(id);
  if (!property) throw new ApiError(404, 'Property not found');

  if (property.user && userId.toString() !== property.user.toString() && userRole !== 'admin') {
    throw new ApiError(403, 'Not authorized to update this property');
  }

  if (files && files.length > 0) {
    const newImages = files.map(f => {
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
  return { property };
};

const remove = async (id, userId, userRole) => {
  const property = await Property.findById(id);
  if (!property) throw new ApiError(404, 'Property not found');

  if (property.user && userId.toString() !== property.user.toString() && userRole !== 'admin') {
    throw new ApiError(403, 'Not authorized to delete this property');
  }

  property.status = 'deleted';
  await property.save();
};

const toggleStatus = async (id, userId, userRole) => {
  const property = await Property.findById(id);
  if (!property) throw new ApiError(404, 'Property not found');

  if (property.user && userId.toString() !== property.user.toString() && userRole !== 'admin') {
    throw new ApiError(403, 'Not authorized');
  }

  const statusFlow = { active: 'inactive', inactive: 'active' };
  property.status = statusFlow[property.status] || 'active';
  await property.save();
  return { property };
};

const getMyProperties = async (userId) => {
  const items = await Property.find({ user: userId, status: { $ne: 'deleted' } })
    .sort({ createdAt: -1 });
  return { items };
};

module.exports = { getAll, getById, getFeatured, getLatest, getSimilar, create, update, remove, toggleStatus, getMyProperties };
