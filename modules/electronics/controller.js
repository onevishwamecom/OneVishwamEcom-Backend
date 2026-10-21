const createCRUDController = require('../baseController');
const Electronic = require('./model');

module.exports = createCRUDController({
  model: Electronic,
  searchFields: ['title', 'name', 'brand', 'model', 'category', 'subcategory', 'description', 'location', 'city'],
  rangeFilters: {
    numericPrice: { min: 'priceMin', max: 'priceMax' },
  },
});
