const createCRUDController = require('../baseController');
const Jewellery = require('./model');

module.exports = createCRUDController({
  model: Jewellery,
  searchFields: ['name', 'description'],
  rangeFilters: {
    numericPrice: { min: 'priceMin', max: 'priceMax' },
    weight: { min: 'weightMin', max: 'weightMax' },
  },
});
