const FinanceOffering = require('./model');
const ApiError = require('../../utils/ApiError');

const getAll = async (query = {}) => {
  const filter = {};
  if (query.status) {
    filter.status = query.status;
  } else {
    filter.status = 'active';
  }
  if (query.availabilityStatus) {
    filter.availabilityStatus = query.availabilityStatus;
  } else {
    filter.availabilityStatus = { $ne: 'sold_out' };
  }
  if (query.type) {
    filter.type = query.type;
  }
  const sort = { order: 1, createdAt: -1 };
  const items = await FinanceOffering.find(filter).sort(sort);
  return { items, pagination: { totalItems: items.length } };
};

const getById = async (id) => {
  const item = await FinanceOffering.findById(id);
  if (!item) throw new ApiError(404, 'Finance offering not found');
  return item;
};

const getSimilar = async (id) => {
  const current = await FinanceOffering.findById(id);
  if (!current) throw new ApiError(404, 'Finance offering not found');
  const items = await FinanceOffering.find({
    _id: { $ne: current._id },
    type: current.type,
    status: 'active',
  }).limit(4);
  return items;
};

const getMy = async (userId) => {
  return await FinanceOffering.find({ status: 'active' }).sort({ order: 1 });
};

const create = async (data) => {
  return await FinanceOffering.create(data);
};

const update = async (id, data) => {
  const item = await FinanceOffering.findById(id);
  if (!item) throw new ApiError(404, 'Finance offering not found');
  Object.assign(item, data);
  return await item.save();
};

const remove = async (id) => {
  const item = await FinanceOffering.findById(id);
  if (!item) throw new ApiError(404, 'Finance offering not found');
  return await item.deleteOne();
};

const toggleStatus = async (id) => {
  const item = await FinanceOffering.findById(id);
  if (!item) throw new ApiError(404, 'Finance offering not found');
  item.status = item.status === 'active' ? 'inactive' : 'active';
  return await item.save();
};

module.exports = { getAll, getById, getSimilar, getMy, create, update, remove, toggleStatus };
