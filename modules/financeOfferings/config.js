module.exports = {
  name: 'Finance Offerings',
  slug: 'finance-offerings',
  ownerField: 'createdBy',
  searchableFields: ['bankName', 'loanType', 'features'],
  filterableFields: ['bankName', 'loanType', 'category', 'status', 'isActive'],
  rangeFilters: {
    interestRateMin: { min: 'minInterest', max: 'maxInterest' },
  },
  defaultSort: { createdAt: -1 },
  populate: [],
};
