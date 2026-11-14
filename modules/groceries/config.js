module.exports = {
  name: 'Groceries',
  slug: 'groceries',
  ownerField: 'createdBy',
  searchableFields: ['name', 'description', 'brand', 'category', 'subcategory'],
  filterableFields: ['category', 'subcategory', 'brand', 'organic', 'status', 'availabilityStatus'],
  rangeFilters: {
    numericPrice: { min: 'minPrice', max: 'maxPrice' },
  },
  defaultSort: { createdAt: -1 },
  populate: [],
  validationRules: {
    name: { type: 'string', required: true },
    price: { type: 'string', required: true },
  },
};
