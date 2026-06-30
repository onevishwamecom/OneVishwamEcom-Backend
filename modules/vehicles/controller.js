const createCRUDController = require('../baseController');
const Vehicle = require('./model');

module.exports = createCRUDController({
  model: Vehicle,
  searchFields: ['title', 'description', 'make', 'model', 'location', 'city'],
  rangeFilters: {
    numericPrice: { min: 'priceMin', max: 'priceMax' },
    year: { min: 'yearMin', max: 'yearMax' },
  },
});
