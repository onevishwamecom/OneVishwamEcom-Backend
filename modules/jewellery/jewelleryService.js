const BaseService = require('../../services/baseService');
const Jewellery = require('./model');
const ApiError = require('../../utils/ApiError');

function parseOccasion(occasion) {
  if (!occasion) return [];
  if (Array.isArray(occasion)) return occasion;
  return occasion.split(/[,/]/).map((s) => s.trim()).filter(Boolean);
}

/**
 * JewelleryService - Encapsulates jewellery business logic & filtering
 * Inherits standard pagination, CRUD, and ownership validation from BaseService.
 */
class JewelleryService extends BaseService {
  constructor() {
    super({
      model: Jewellery,
      searchFields: ['name', 'title', 'description', 'category', 'metalType', 'store.city'],
      rangeFilters: {
        numericPrice: { min: 'budgetMin', max: 'budgetMax' },
        weightGrams: { min: 'weightMin', max: 'weightMax' },
      },
      defaultSort: { createdAt: -1 },
      defaultFilter: { status: { $in: ['approved', 'active'] } },
      ownerField: 'user',
    });
  }

  buildFilter(query = {}) {
    const filter = { ...this.defaultFilter };

    if (query.category) {
      filter.category = query.category;
    }

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

    if (query.occasions) {
      const occasions = parseOccasion(query.occasions);
      if (occasions.length > 0) {
        filter.occasion = { $in: occasions };
      }
    }

    if (query.budgetMin || query.budgetMax) {
      filter.numericPrice = {};
      if (query.budgetMin) filter.numericPrice.$gte = Number(query.budgetMin);
      if (query.budgetMax) filter.numericPrice.$lte = Number(query.budgetMax);
    }

    if (query.metals) {
      const metals = Array.isArray(query.metals) ? query.metals : query.metals.split(',');
      if (metals.length > 0) {
        filter.$or = filter.$or || [];
        metals.forEach((metal) => {
          filter.$or.push(
            { $expr: { $regexMatch: { input: { $concat: ['$metalType', ' ', '$purity'] }, regex: metal, options: 'i' } } },
            { metalType: { $regex: metal, $options: 'i' } }
          );
        });
      }
    }

    if (query.weightMin || query.weightMax) {
      filter.weightGrams = {};
      if (query.weightMin) filter.weightGrams.$gte = Number(query.weightMin);
      if (query.weightMax) filter.weightGrams.$lte = Number(query.weightMax);
    }

    if (query.genders) {
      const genders = Array.isArray(query.genders) ? query.genders : query.genders.split(',');
      if (genders.length > 0) {
        filter.gender = { $in: genders };
      }
    }

    if (query.availability) {
      const availability = Array.isArray(query.availability) ? query.availability : query.availability.split(',');
      if (availability.includes('Try At Home')) {
        filter.tryAtHome = true;
      }
    }

    return filter;
  }

  async getSimilar(id) {
    const item = await this.model.findById(id);
    if (!item) {
      throw new ApiError(404, 'Item not found');
    }
    return this.model
      .find({
        _id: { $ne: id },
        category: item.category,
        status: { $in: ['approved', 'active'] },
      })
      .limit(4)
      .sort({ featured: -1, createdAt: -1 });
  }
}

module.exports = new JewelleryService();
