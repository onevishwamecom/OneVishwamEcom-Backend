module.exports = {
  name: 'Finance',
  slug: 'finance',
  ownerField: 'createdBy',
  searchableFields: ['serviceName', 'companyName', 'description', 'city', 'features'],
  filterableFields: [
    'category',
    'subcategory',
    'providerType',
    'city',
    'status',
    'featured',
    'availabilityStatus',
  ],
  rangeFilters: {
    interestRate: { min: 'minInterest', max: 'maxInterest' },
    minAmountNumeric: { min: 'minAmount', max: 'maxAmount' },
  },
  defaultSort: { createdAt: -1 },
  populate: [],
};
