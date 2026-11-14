module.exports = {
  name: 'Properties',
  slug: 'properties',
  ownerField: 'createdBy',
  searchableFields: ['title', 'subtitle', 'description', 'city', 'area', 'address', 'propertyType'],
  filterableFields: [
    'propertyType',
    'category',
    'purpose',
    'city',
    'area',
    'status',
    'possessionStatus',
    'verified',
    'featured',
    'availabilityStatus',
  ],
  rangeFilters: {
    numericPrice: { min: 'minPrice', max: 'maxPrice' },
  },
  defaultSort: { priority: -1, createdAt: -1 },
  populate: [
    { path: 'createdBy', select: 'name email phone avatar' },
    { path: 'listerId', select: 'name email phone businessName' },
  ],
};
