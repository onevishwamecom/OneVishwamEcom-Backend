module.exports = {
  name: 'Jewellery',
  slug: 'jewellery',
  ownerField: 'createdBy',
  searchableFields: ['title', 'name', 'description', 'metalType', 'category', 'subcategory', 'store'],
  filterableFields: [
    'category',
    'subcategory',
    'metalType',
    'purity',
    'occasion',
    'gender',
    'certified',
    'featured',
    'status',
    'availabilityStatus',
  ],
  rangeFilters: {
    numericPrice: { min: 'minPrice', max: 'maxPrice' },
    weightGrams: { min: 'minWeight', max: 'maxWeight' },
  },
  defaultSort: { createdAt: -1 },
  populate: [],
};
