const createCRUDController = require('../baseController');
const Garment = require('./model');

module.exports = createCRUDController({
  model: Garment,
  searchFields: ['name', 'description', 'brand'],
  rangeFilters: {
    numericPrice: { min: 'priceMin', max: 'priceMax' },
  },
});
