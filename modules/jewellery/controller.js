const createCRUDController = require('../baseController');
const Jewellery = require('./model');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');

function parseOccasion(occasion) {
  if (!occasion) return [];
  if (Array.isArray(occasion)) return occasion;
  return occasion.split(/[,/]/).map(s => s.trim()).filter(Boolean);
}

function parsePrice(priceStr) {
  if (!priceStr) return 0;
  const cleaned = priceStr.replace(/[₹,]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function transformCreateData(req, data) {
  const material = data.material || data.metalType || 'Gold';
  const city = data.city || 'Bangalore';
  
  return {
    ...data,
    name: data.name || data.title,
    title: data.title || data.name,
    metalType: data.metalType || data.material || 'Gold',
    purity: data.purity || '',
    weightGrams: data.weightUnit === 'grams' ? (data.weight || 0) : (data.weight || 0) * 1000,
    makingCharges: data.makingCharges || '₹ 0',
    category: data.category || material,
    occasion: parseOccasion(data.occasion),
    certified: data.certified || false,
    certificationBody: data.certificationBody || '',
    gender: data.gender || 'Women',
    tryAtHome: data.tryAtHome || false,
    aiRecommended: data.aiRecommended || false,
    store: data.store || {
      name: 'Vishwam Jewellers',
      city: city.charAt(0).toUpperCase() + city.slice(1).toLowerCase(),
      pincode: data.pincode || '560001',
      address: '',
    },
    numericPrice: parsePrice(data.price),
    images: data.images || [],
    status: 'pending',
    featured: false,
  };
}

function transformUpdateData(req, item) {
  const data = { ...req.body };
  
  if (data.metalType) item.metalType = data.metalType;
  if (data.purity !== undefined) item.purity = data.purity;
  if (data.weight !== undefined) {
    item.weightGrams = data.weightUnit === 'grams' ? data.weight : data.weight * 1000;
  }
  if (data.makingCharges !== undefined) item.makingCharges = data.makingCharges;
  if (data.category) item.category = data.category;
  if (data.occasion !== undefined) item.occasion = parseOccasion(data.occasion);
  if (data.certified !== undefined) item.certified = data.certified;
  if (data.certificationBody !== undefined) item.certificationBody = data.certificationBody;
  if (data.gender) item.gender = data.gender;
  if (data.tryAtHome !== undefined) item.tryAtHome = data.tryAtHome;
  if (data.aiRecommended !== undefined) item.aiRecommended = data.aiRecommended;
  if (data.store) item.store = data.store;
  if (data.price !== undefined) item.numericPrice = parsePrice(data.price);
  if (data.images) item.images = data.images;
  if (data.name) { item.name = data.name; item.title = data.name; }
  
  return item;
}

function buildJewelleryFilter(query) {
  const filter = { status: { $in: ['approved', 'active'] } };
  
  // Category exact match
  if (query.category) {
    filter.category = query.category;
  }
  
  // Search across multiple fields
  if (query.search || query.q) {
    const searchTerm = query.search || query.q;
    filter.$or = [
      { name: { $regex: searchTerm, $options: 'i' } },
      { title: { $regex: searchTerm, $options: 'i' } },
      { description: { $regex: searchTerm, $options: 'i' } },
      { category: { $regex: searchTerm, $options: 'i' } },
      { metalType: { $regex: searchTerm, $options: 'i' } },
      { 'store.city': { $regex: searchTerm, $options: 'i' } },
    ];
  }
  
  // Occasions - match if any selected occasion is in the product's occasion array
  if (query.occasions) {
    const occasions = Array.isArray(query.occasions) ? query.occasions : query.occasions.split(',');
    if (occasions.length > 0) {
      filter.occasion = { $in: occasions };
    }
  }
  
  // Budget range
  if (query.budgetMin || query.budgetMax) {
    filter.numericPrice = {};
    if (query.budgetMin) filter.numericPrice.$gte = Number(query.budgetMin);
    if (query.budgetMax) filter.numericPrice.$lte = Number(query.budgetMax);
  }
  
  // Metals - match if metalType + " " + purity contains the option OR metalType contains it
  if (query.metals) {
    const metals = Array.isArray(query.metals) ? query.metals : query.metals.split(',');
    if (metals.length > 0) {
      filter.$or = filter.$or || [];
      metals.forEach(metal => {
        filter.$or.push(
          { $expr: { $regexMatch: { input: { $concat: ['$metalType', ' ', '$purity'] }, regex: metal, options: 'i' } } },
          { metalType: { $regex: metal, $options: 'i' } }
        );
      });
    }
  }
  
  // Weight range
  if (query.weightMin || query.weightMax) {
    filter.weightGrams = {};
    if (query.weightMin) filter.weightGrams.$gte = Number(query.weightMin);
    if (query.weightMax) filter.weightGrams.$lte = Number(query.weightMax);
  }
  
  // Genders - exact match
  if (query.genders) {
    const genders = Array.isArray(query.genders) ? query.genders : query.genders.split(',');
    if (genders.length > 0) {
      filter.gender = { $in: genders };
    }
  }
  
  // Availability - only Try At Home actually filters
  if (query.availability) {
    const availability = Array.isArray(query.availability) ? query.availability : query.availability.split(',');
    if (availability.includes('Try At Home')) {
      filter.tryAtHome = true;
    }
  }
  
  return filter;
}

function getSort(sortBy) {
  const sorts = {
    latest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    'price-low': { numericPrice: 1 },
    'price-high': { numericPrice: -1 },
  };
  return sorts[sortBy] || sorts.latest;
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

const base = createCRUDController({
  model: Jewellery,
  searchFields: ['name', 'title', 'description', 'category', 'metalType', 'store.city'],
  rangeFilters: {
    numericPrice: { min: 'budgetMin', max: 'budgetMax' },
    weightGrams: { min: 'weightMin', max: 'weightMax' },
  },
  defaultSort: { createdAt: -1 },
  defaultFilter: { status: { $in: ['approved', 'active'] } },
  transformCreateData,
  transformUpdateData,
});

// Override getAll with custom filter logic
const getAll = async (req, res) => {
  const filter = buildJewelleryFilter(req.query);
  const sort = getSort(req.query.sortBy || req.query.sort);
  const { skip, page, limit } = paginate(req.query.page, req.query.limit);
  
  const [items, total] = await Promise.all([
    Jewellery.find(filter).sort(sort).skip(skip).limit(limit),
    Jewellery.countDocuments(filter),
  ]);
  
  new ApiResponse(200, { items, pagination: buildPagination(page, limit, total) }, 'Fetched successfully').send(res);
};

const getById = async (req, res) => {
  const item = await Jewellery.findOne({ _id: req.params.id, status: { $in: ['approved', 'active'] } });
  if (!item) {
    throw new ApiError(404, 'Item not found');
  }
  new ApiResponse(200, { item }, 'Fetched successfully').send(res);
};

const getMy = async (req, res) => {
  const items = await Jewellery.find({ user: req.user._id }).sort({ createdAt: -1 });
  new ApiResponse(200, { items }, 'Your listings fetched').send(res);
};

const getSimilar = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await Jewellery.findById(id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }
    
    const similar = await Jewellery.find({
      _id: { $ne: id },
      category: item.category,
      status: { $in: ['approved', 'active'] },
    })
      .limit(4)
      .sort({ featured: -1, createdAt: -1 });
    
    res.json({ data: { items: similar } });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch similar items' });
  }
};

const toggleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await Jewellery.findById(id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }
    
    item.status = item.status === 'active' ? 'inactive' : 'active';
    await item.save();
    
    res.json({ data: { item }, message: `Status changed to ${item.status}` });
  } catch (err) {
    res.status(500).json({ message: 'Failed to toggle status' });
  }
};

module.exports = {
  getAll,
  getById,
  getMy,
  create: base.create,
  update: base.update,
  remove: base.remove,
  getSimilar,
  toggleStatus,
};