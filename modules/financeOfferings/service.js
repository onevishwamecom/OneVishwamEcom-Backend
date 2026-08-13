const FinanceOffering = require('./model');
const ApiError = require('../../utils/ApiError');

const getAll = async (query) => {
  const filter = { status: query.status || 'active' };
  const sort = { order: 1, createdAt: -1 };
  const items = await FinanceOffering.find(filter).sort(sort);
  return { items, pagination: { totalItems: items.length } };
};

const getById = async (id) => {
  const item = await FinanceOffering.findById(id);
  if (!item) throw new ApiError(404, 'Finance offering not found');
  return item;
};

module.exports = { getAll, getById };
