const createCRUDController = require('../baseController');
const Grocery = require('./model');

module.exports = createCRUDController({
  model: Grocery,
  searchFields: ['name', 'description', 'brand'],
  rangeFilters: {
    numericPrice: { min: 'priceMin', max: 'priceMax' },
  },
});
