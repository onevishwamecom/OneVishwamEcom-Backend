const BaseService = require('../../services/baseService');
const Bedding = require('./model');

/**
 * BeddingService - Encapsulates Bedding & Comfort inventory logic
 * Inherits standard pagination, filtering, CRUD, and ownership validation from BaseService.
 */
class BeddingService extends BaseService {
  constructor() {
    super({
      model: Bedding,
      searchFields: ['title', 'name', 'brand', 'model', 'category', 'subcategory', 'description', 'location', 'city'],
      rangeFilters: {
        numericPrice: { min: 'priceMin', max: 'priceMax' },
      },
      defaultSort: { createdAt: -1 },
      defaultFilter: {
        status: { $in: ['approved', 'active'] },
        availabilityStatus: { $in: ['available', 'sold_out'] },
      },
      ownerField: 'user',
    });
  }
}

module.exports = new BeddingService();
