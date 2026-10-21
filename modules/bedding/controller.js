const createCRUDController = require('../baseController');
const Bedding = require('./model');

module.exports = createCRUDController({
  model: Bedding,
  searchFields: ['title', 'name', 'brand', 'model', 'category', 'subcategory', 'description', 'location', 'city'],
  rangeFilters: {
    numericPrice: { min: 'priceMin', max: 'priceMax' },
  },
});
