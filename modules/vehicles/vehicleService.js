const BaseService = require('../../services/baseService');
const Vehicle = require('./model');
const ApiError = require('../../utils/ApiError');

/**
 * VehicleService - Encapsulates vehicle inventory business logic
 * Inherits standard pagination, CRUD, and ownership validation from BaseService.
 */
class VehicleService extends BaseService {
  constructor() {
    super({
      model: Vehicle,
      searchFields: ['brand', 'model', 'location', 'title'],
      rangeFilters: {
        priceValue: { min: 'minPrice', max: 'maxPrice' },
        kmDriven: { min: 'minKm', max: 'maxKm' },
      },
      defaultSort: { createdAt: -1 },
      defaultFilter: {
        status: { $in: ['approved', 'active'] },
        availabilityStatus: { $in: ['available', 'sold_out'] },
      },
      ownerField: 'user',
    });
  }

  /**
   * Extends base filter with vehicle-specific attributes
   */
  buildFilter(query = {}) {
    const filter = super.buildFilter(query);

    if (query.loanApproved !== undefined) {
      filter.loanApproved = query.loanApproved === 'true' || query.loanApproved === true;
    }
    if (query.featured !== undefined) {
      filter.featured = query.featured === 'true' || query.featured === true;
    }

    return filter;
  }

  /**
   * Fetches similar vehicles in same category
   */
  async getSimilar(id) {
    const vehicle = await this.model.findById(id);
    if (!vehicle) {
      throw new ApiError(404, 'Vehicle not found');
    }

    return this.model
      .find({
        _id: { $ne: id },
        category: vehicle.category,
        status: { $in: ['approved', 'active'] },
      })
      .limit(4)
      .sort({ featured: -1, createdAt: -1 });
  }
}

module.exports = new VehicleService();
