module.exports = {
  name: 'Garments',
  slug: 'garments',
  ownerField: 'createdBy',
  searchableFields: ['name', 'description', 'brand', 'category', 'subcategory', 'material', 'color'],
  filterableFields: ['category', 'subcategory', 'brand', 'size', 'color', 'gender', 'status', 'availabilityStatus'],
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
