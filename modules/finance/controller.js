const createCRUDController = require('../baseController');
const Finance = require('./model');

module.exports = createCRUDController({
  model: Finance,
  searchFields: ['name', 'description', 'provider'],
  rangeFilters: {},
  defaultFilter: { status: 'active' },
});
