const Finance = require('./model');
const ApiError = require('../../utils/ApiError');

const SORT_OPTIONS = {
  latest: { createdAt: -1 },
  'interest-low': { interestMin: 1 },
  'interest-high': { interestMin: -1 },
};

const TENURE_FILTERS = {
  '1–5 Years': ['1', '2', '3', '4', '5'],
  '1-5 Years': ['1', '2', '3', '4', '5'],
  '5–10 Years': ['5', '6', '7', '8', '9', '10'],
  '5-10 Years': ['5', '6', '7', '8', '9', '10'],
  '10–20 Years': ['10', '15', '20'],
  '10-20 Years': ['10', '15', '20'],
  '20+ Years': ['20', '25', '30'],
};

function parseAmount(value) {
  if (value == null || value === '') return 0;
  const cleaned = String(value).replace(/[₹,\s]/g, '');
  if (cleaned === '' || /^N\/A$/i.test(cleaned) || /^Varies$/i.test(cleaned)) return 0;
  const match = cleaned.match(/^0*(\d+)/);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  return isNaN(num) ? 0 : num;
}

function parseInterest(value) {
  if (value == null || value === '') return { min: 0, max: 0 };
  const cleaned = String(value).replace(/%/g, '').trim();
  if (/^N\/A$/i.test(cleaned) || /^Varies$/i.test(cleaned)) return { min: 0, max: 0 };
  const parts = cleaned.split(/[–-]/).map((p) => parseFloat(p.trim()));
  const nums = parts.filter((n) => !isNaN(n));
  if (nums.length === 0) return { min: 0, max: 0 };
  return { min: nums[0], max: nums.length > 1 ? nums[nums.length - 1] : nums[0] };
}

function toArray(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  return String(value).split(',').map((v) => v.trim()).filter(Boolean);
}

function deriveFields(data) {
  const payload = { ...data };

  if (payload.eligibility && typeof payload.eligibility === 'string') {
    payload.eligibility = payload.eligibility.split('\n').map((s) => s.trim()).filter(Boolean);
  }
  if (payload.documentsRequired && typeof payload.documentsRequired === 'string') {
    payload.documentsRequired = payload.documentsRequired.split('\n').map((s) => s.trim()).filter(Boolean);
  }
  if (payload.features && typeof payload.features === 'string') {
    payload.features = payload.features.split('\n').map((s) => s.trim()).filter(Boolean);
  }
  payload.eligibility = payload.eligibility || [];
  payload.documentsRequired = payload.documentsRequired || [];
  payload.features = payload.features || [];

  payload.status = payload.status || 'active';
  payload.featured = payload.featured === true || payload.featured === 'true';

  if (!payload.serviceName) {
    payload.serviceName = payload.category && payload.companyName
      ? `${payload.category} – ${payload.companyName}`
      : (payload.category || 'Finance Service');
  }

  if (!payload.location) {
    payload.location = [payload.area, payload.city].filter(Boolean).join(', ') || payload.city;
  }

  if (!payload.tenure) {
    payload.tenure = '1 – 5 years';
  }

  const { min: interestMin, max: interestMax } = parseInterest(payload.interestRate);
  payload.interestMin = interestMin;
  payload.interestMax = interestMax;
  payload.minAmountNumeric = parseAmount(payload.minAmount);
  payload.maxAmountNumeric = parseAmount(payload.maxAmount);

  return payload;
}

function buildFilter(query) {
  const filter = { status: { $in: ['approved', 'active'] } };
  const reserved = [
    'q', 'page', 'limit', 'sort', 'sortBy', 'search',
    'loanTypes', 'amountMin', 'amountMax', 'interestMin', 'interestMax', 'tenure',
    'providerTypes', 'serviceModes', 'localities', 'postedBy', 'availability',
  ];

  for (const [key, value] of Object.entries(query)) {
    if (reserved.includes(key)) continue;
    if (value === '' || value === undefined || value === null) continue;
    filter[key] = value;
  }

  if (query.search || query.q) {
    const term = (query.search || query.q).trim();
    if (term) {
      filter.$or = [
        { serviceName: { $regex: term, $options: 'i' } },
        { companyName: { $regex: term, $options: 'i' } },
        { category: { $regex: term, $options: 'i' } },
        { location: { $regex: term, $options: 'i' } },
        { description: { $regex: term, $options: 'i' } },
      ];
    }
  }

  if (query.loanTypes) {
    const terms = toArray(query.loanTypes);
    if (terms.length) {
      const regexes = terms.map((t) => new RegExp(escapeRegex(t), 'i'));
      filter.serviceName = { $in: regexes };
    }
  }

  if (query.amountMin) {
    filter.minAmountNumeric = { $gte: Number(query.amountMin) };
  }
  if (query.amountMax) {
    filter.maxAmountNumeric = { $lte: Number(query.amountMax) };
  }

  if (query.interestMin) {
    filter.interestMax = { $gte: Number(query.interestMin) };
  }
  if (query.interestMax) {
    filter.interestMin = { ...(filter.interestMin || {}), $lte: Number(query.interestMax) };
  }

  if (query.tenure) {
    const nums = TENURE_FILTERS[query.tenure];
    if (nums) {
      filter.tenure = { $in: nums.map((n) => new RegExp(`\\b${n}\\b`, 'i')) };
    } else {
      filter.tenure = { $regex: query.tenure, $options: 'i' };
    }
  }

  for (const key of ['providerTypes', 'serviceModes', 'localities', 'postedBy', 'availability']) {
    if (query[key]) {
      const values = toArray(query[key]);
      if (values.length) {
        const field = key === 'localities' ? 'area' : key === 'providerTypes' ? 'providerType' : key === 'serviceModes' ? 'serviceMode' : key;
        filter[field] = { $in: values };
      }
    }
  }

  return filter;
}

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getSort(sortBy) {
  return SORT_OPTIONS[sortBy] || SORT_OPTIONS.latest;
}

function paginate(page = 1, limit = 100) {
  const p = Math.max(1, Number(page));
  const l = Math.min(200, Math.max(1, Number(limit)));
  return { skip: (p - 1) * l, page: p, limit: l };
}

function buildPagination(page, limit, total) {
  const totalPages = Math.ceil(total / limit);
  return { page, limit, totalItems: total, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 };
}

const getAll = async (query) => {
  const filter = buildFilter(query);
  const sort = getSort(query.sortBy || query.sort);
  const { skip, page, limit } = paginate(query.page, query.limit);

  const [items, total] = await Promise.all([
    Finance.find(filter).sort(sort).skip(skip).limit(limit),
    Finance.countDocuments(filter),
  ]);

  return { items, pagination: buildPagination(page, limit, total) };
};

const getById = async (id) => {
  const item = await Finance.findOne({ _id: id, status: { $in: ['approved', 'active'] } });
  if (!item) throw new ApiError(404, 'Service not found');
  return item;
};

const getSimilar = async (id) => {
  const item = await Finance.findById(id);
  if (!item) throw new ApiError(404, 'Service not found');

  const items = await Finance.find({
    _id: { $ne: item._id },
    status: { $in: ['approved', 'active'] },
    category: item.category,
  })
    .sort({ createdAt: -1 })
    .limit(4);

  return items;
};

const create = async (data, userId) => {
  const payload = deriveFields({ ...data, user: userId });
  const item = await Finance.create(payload);
  return item;
};

const update = async (id, data, userId, userRole) => {
  const item = await Finance.findById(id);
  if (!item) throw new ApiError(404, 'Service not found');
  if (item.user && userId.toString() !== item.user.toString() && userRole !== 'admin') {
    throw new ApiError(403, 'Not authorized to update this service');
  }

  const payload = deriveFields({ ...item.toObject(), ...data });
  Object.assign(item, payload);
  await item.save();
  return item;
};

const remove = async (id, userId, userRole) => {
  const item = await Finance.findById(id);
  if (!item) throw new ApiError(404, 'Service not found');
  if (item.user && userId.toString() !== item.user.toString() && userRole !== 'admin') {
    throw new ApiError(403, 'Not authorized to delete this service');
  }
  await item.deleteOne();
};

const toggleStatus = async (id, userId, userRole) => {
  const item = await Finance.findById(id);
  if (!item) throw new ApiError(404, 'Service not found');
  if (item.user && userId.toString() !== item.user.toString() && userRole !== 'admin') {
    throw new ApiError(403, 'Not authorized');
  }
  item.status = item.status === 'active' ? 'inactive' : 'active';
  await item.save();
  return item;
};

const getMy = async (userId) => {
  return Finance.find({ user: userId }).sort({ createdAt: -1 });
};

module.exports = { getAll, getById, getSimilar, create, update, remove, toggleStatus, getMy, parseAmount, parseInterest };