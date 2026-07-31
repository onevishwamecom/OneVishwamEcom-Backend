const Vehicle = require('./model');
const ApiError = require('../../utils/ApiError');

const SORT_OPTIONS = {
  latest: { createdAt: -1 },
  'price-low': { priceValue: 1 },
  'price-high': { priceValue: -1 },
};

function buildFilter(query) {
  const filter = { status: 'active' };
  const reserved = ['q', 'page', 'limit', 'sort', 'sortBy', 'search', 'minPrice', 'maxPrice', 'minKm', 'maxKm'];

  for (const [key, value] of Object.entries(query)) {
    if (reserved.includes(key)) continue;
    if (key.endsWith('Min') || key.endsWith('Max')) continue;
    if (value === '' || value === undefined) continue;
    filter[key] = value;
  }

  if (query.minPrice || query.maxPrice) {
    filter.priceValue = {};
    if (query.minPrice) filter.priceValue.$gte = Number(query.minPrice);
    if (query.maxPrice) filter.priceValue.$lte = Number(query.maxPrice);
  }
  if (query.minKm || query.maxKm) {
    filter.kmDriven = {};
    if (query.minKm) filter.kmDriven.$gte = Number(query.minKm);
    if (query.maxKm) filter.kmDriven.$lte = Number(query.maxKm);
  }

  if (query.loanApproved !== undefined) {
    filter.loanApproved = query.loanApproved === 'true' || query.loanApproved === true;
  }
  if (query.featured !== undefined) {
    filter.featured = query.featured === 'true' || query.featured === true;
  }

  return filter;
}

function buildSearchQuery(q) {
  return {
    $or: [
      { brand: { $regex: q, $options: 'i' } },
      { model: { $regex: q, $options: 'i' } },
      { location: { $regex: q, $options: 'i' } },
      { title: { $regex: q, $options: 'i' } },
    ],
  };
}

function getSort(sortBy) {
  return SORT_OPTIONS[sortBy] || SORT_OPTIONS.latest;
}

function paginate(page = 1, limit = 20) {
  const p = Math.max(1, Number(page));
  const l = Math.min(100, Math.max(1, Number(limit)));
  return { skip: (p - 1) * l, page: p, limit: l };
}

function buildPagination(page, limit, total) {
  const totalPages = Math.ceil(total / limit);
  return { page, limit, totalItems: total, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 };
}

const getAll = async (query) => {
  const filter = query.q || query.search ? buildSearchQuery((query.q || query.search).trim()) : buildFilter(query);
  const sort = getSort(query.sort || query.sortBy);
  const { skip, page, limit } = paginate(query.page, query.limit);

  const [items, total] = await Promise.all([
    Vehicle.find(filter).sort(sort).skip(skip).limit(limit),
    Vehicle.countDocuments(filter),
  ]);

  return { items, pagination: buildPagination(page, limit, total) };
};

const getById = async (id) => {
  const vehicle = await Vehicle.findByIdAndUpdate(id, { $inc: { views: 1 } }, { new: true });
  if (!vehicle) throw new ApiError(404, 'Vehicle not found');
  return vehicle;
};

const getSimilar = async (id) => {
  const vehicle = await Vehicle.findById(id);
  if (!vehicle) throw new ApiError(404, 'Vehicle not found');

  const similar = await Vehicle.find({
    _id: { $ne: vehicle._id },
    status: 'active',
    category: vehicle.category,
  })
    .sort({ createdAt: -1 })
    .limit(4);

  return similar;
};

const create = async (data, userId) => {
  const payload = {
    ...data,
    user: userId,
    listedDate: new Date(),
  };
  if (payload.make && !payload.brand) payload.brand = payload.make;
  if (payload.brand && !payload.make) payload.make = payload.brand;

  const vehicle = await Vehicle.create(payload);
  return vehicle;
};

const update = async (id, data, userId, userRole) => {
  const vehicle = await Vehicle.findById(id);
  if (!vehicle) throw new ApiError(404, 'Vehicle not found');
  if (vehicle.user && userId.toString() !== vehicle.user.toString() && userRole !== 'admin') {
    throw new ApiError(403, 'Not authorized to update this listing');
  }

  if (data.make && !data.brand) data.brand = data.make;
  if (data.brand && !data.make) data.make = data.brand;

  Object.assign(vehicle, data);
  await vehicle.save();
  return vehicle;
};

const remove = async (id, userId, userRole) => {
  const vehicle = await Vehicle.findById(id);
  if (!vehicle) throw new ApiError(404, 'Vehicle not found');
  if (vehicle.user && userId.toString() !== vehicle.user.toString() && userRole !== 'admin') {
    throw new ApiError(403, 'Not authorized to delete this listing');
  }
  await vehicle.deleteOne();
};

const toggleStatus = async (id, userId, userRole) => {
  const vehicle = await Vehicle.findById(id);
  if (!vehicle) throw new ApiError(404, 'Vehicle not found');
  if (vehicle.user && userId.toString() !== vehicle.user.toString() && userRole !== 'admin') {
    throw new ApiError(403, 'Not authorized');
  }
  vehicle.status = vehicle.status === 'active' ? 'inactive' : 'active';
  await vehicle.save();
  return vehicle;
};

const getMy = async (userId) => {
  return Vehicle.find({ user: userId }).sort({ createdAt: -1 });
};

module.exports = { getAll, getById, getSimilar, create, update, remove, toggleStatus, getMy };
