module.exports = {
  name: 'Bedding',
  slug: 'bedding',
  ownerField: 'lister',
  searchableFields: ['title', 'name', 'brand', 'model', 'description', 'city', 'area'],
  filterableFields: [
    'category',
    'subcategory',
    'brand',
    'condition',
    'city',
    'area',
    'state',
    'status',
    'approvalStatus',
    'availabilityStatus',
  ],
  rangeFilters: {
    numericPrice: { min: 'minPrice', max: 'maxPrice' },
  },
  defaultSort: { createdAt: -1 },
  populate: [
    { path: 'user', select: 'name email phone avatar' },
    { path: 'lister', select: 'name email phone businessName' },
  ],
};
