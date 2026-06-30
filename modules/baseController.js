const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

function createCRUDController({
  model,
  searchFields = [],
  rangeFilters = {},
  defaultSort = { createdAt: -1 },
  defaultFilter = { status: 'available' },
  ownerField = 'user',
}) {

  function buildFilter(query) {
    const filter = { ...defaultFilter };
    const reserved = ['q', 'page', 'limit', 'sort'];

    for (const [key, value] of Object.entries(query)) {
      if (reserved.includes(key)) continue;
      if (key.endsWith('Min') || key.endsWith('Max')) continue;
      filter[key] = value;
    }

    for (const [field, range] of Object.entries(rangeFilters)) {
      if (range.min && query[range.min]) {
        filter[field] = { ...filter[field], $gte: Number(query[range.min]) };
      }
      if (range.max && query[range.max]) {
        filter[field] = { ...filter[field], $lte: Number(query[range.max]) };
      }
    }

    return filter;
  }

  function buildSearchQuery(q) {
    return {
      $or: searchFields.map(field => ({
        [field]: { $regex: q, $options: 'i' },
      })),
    };
  }

  function getSort(sortBy) {
    const sorts = {
      latest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      'price-low': { numericPrice: 1 },
      'price-high': { numericPrice: -1 },
      'area-low': { numericArea: 1 },
      'area-high': { numericArea: -1 },
    };
    return sorts[sortBy] || defaultSort;
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

  const getAll = asyncHandler(async (req, res) => {
    const filter = buildFilter(req.query);
    const sort = getSort(req.query.sort);
    const { skip, page, limit } = paginate(req.query.page, req.query.limit);
    let items, total;

    if (req.query.q) {
      const searchFilter = { ...defaultFilter, ...buildSearchQuery(req.query.q.trim()) };
      [items, total] = await Promise.all([
        model.find(searchFilter).sort(sort).skip(skip).limit(limit),
        model.countDocuments(searchFilter),
      ]);
    } else {
      [items, total] = await Promise.all([
        model.find(filter).sort(sort).skip(skip).limit(limit),
        model.countDocuments(filter),
      ]);
    }

    new ApiResponse(200, { items, pagination: buildPagination(page, limit, total), filters: req.query }, 'Fetched successfully').send(res);
  });

  const getById = asyncHandler(async (req, res) => {
    const item = await model.findById(req.params.id);
    if (!item) throw new ApiError(404, 'Not found');
    new ApiResponse(200, { item }, 'Fetched successfully').send(res);
  });

  const getMy = asyncHandler(async (req, res) => {
    const items = await model.find({ [ownerField]: req.user._id }).sort({ createdAt: -1 });
    new ApiResponse(200, { items }, 'Your listings fetched').send(res);
  });

  const create = asyncHandler(async (req, res) => {
    const data = { ...req.body, [ownerField]: req.user._id };
    if (req.files && req.files.length > 0) {
      data.images = req.files.map(f => f.path && f.path.startsWith('http') ? f.path : (f.cloudinaryUrl || `/uploads/${f.filename}`));
    }
    const item = await model.create(data);
    new ApiResponse(201, { item }, 'Created successfully').send(res);
  });

  const update = asyncHandler(async (req, res) => {
    const item = await model.findById(req.params.id);
    if (!item) throw new ApiError(404, 'Not found');
    if (item[ownerField] && req.user._id.toString() !== item[ownerField].toString() && req.user.role !== 'admin') {
      throw new ApiError(403, 'Not authorized');
    }
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(f => f.path && f.path.startsWith('http') ? f.path : (f.cloudinaryUrl || `/uploads/${f.filename}`));
      req.body.images = req.body.replaceImages === 'true' ? newImages : [...(item.images || []), ...newImages];
    }
    Object.assign(item, req.body);
    await item.save();
    new ApiResponse(200, { item }, 'Updated successfully').send(res);
  });

  const remove = asyncHandler(async (req, res) => {
    const item = await model.findById(req.params.id);
    if (!item) throw new ApiError(404, 'Not found');
    if (item[ownerField] && req.user._id.toString() !== item[ownerField].toString() && req.user.role !== 'admin') {
      throw new ApiError(403, 'Not authorized');
    }
    await item.deleteOne();
    new ApiResponse(200, null, 'Deleted successfully').send(res);
  });

  return { getAll, getById, getMy, create, update, remove };
}

module.exports = createCRUDController;
