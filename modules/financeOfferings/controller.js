const ApiResponse = require('../../utils/ApiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const financeOfferingService = require('./service');

const getAll = asyncHandler(async (req, res) => {
  const result = await financeOfferingService.getAll(req.query);
  new ApiResponse(200, result, 'Finance offerings fetched successfully').send(res);
});

const getById = asyncHandler(async (req, res) => {
  const item = await financeOfferingService.getById(req.params.id);
  new ApiResponse(200, { item }, 'Finance offering fetched successfully').send(res);
});

const getSimilar = asyncHandler(async (req, res) => {
  const items = await financeOfferingService.getSimilar(req.params.id);
  new ApiResponse(200, { items }, 'Similar finance offerings fetched successfully').send(res);
});

const getMy = asyncHandler(async (req, res) => {
  const items = await financeOfferingService.getMy(req.user?._id);
  new ApiResponse(200, { items }, 'Finance offerings fetched successfully').send(res);
});

const create = asyncHandler(async (req, res) => {
  const item = await financeOfferingService.create(req.body);
  new ApiResponse(201, { item }, 'Finance offering created successfully').send(res);
});

const update = asyncHandler(async (req, res) => {
  const item = await financeOfferingService.update(req.params.id, req.body);
  new ApiResponse(200, { item }, 'Finance offering updated successfully').send(res);
});

const remove = asyncHandler(async (req, res) => {
  await financeOfferingService.remove(req.params.id);
  new ApiResponse(200, null, 'Finance offering deleted successfully').send(res);
});

const toggleStatus = asyncHandler(async (req, res) => {
  const item = await financeOfferingService.toggleStatus(req.params.id);
  new ApiResponse(200, { item }, 'Finance offering status updated successfully').send(res);
});

module.exports = {
  getAll,
  list: getAll,
  getById,
  getOne: getById,
  getSimilar,
  getMy,
  create,
  update,
  remove,
  delete: remove,
  toggleStatus,
};
