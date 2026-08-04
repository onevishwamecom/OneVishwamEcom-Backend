const ApiResponse = require('../../utils/ApiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const financeService = require('./financeService');

const getAll = asyncHandler(async (req, res) => {
  const result = await financeService.getAll(req.query);
  new ApiResponse(200, result, 'Finance services fetched successfully').send(res);
});

const getById = asyncHandler(async (req, res) => {
  const item = await financeService.getById(req.params.id);
  new ApiResponse(200, { item }, 'Finance service fetched successfully').send(res);
});

const getSimilar = asyncHandler(async (req, res) => {
  const items = await financeService.getSimilar(req.params.id);
  new ApiResponse(200, { items }, 'Similar finance services fetched').send(res);
});

const create = asyncHandler(async (req, res) => {
  const item = await financeService.create(req.body, req.user._id);
  new ApiResponse(201, { item }, 'Finance service created successfully').send(res);
});

const update = asyncHandler(async (req, res) => {
  const item = await financeService.update(req.params.id, req.body, req.user._id, req.user.role);
  new ApiResponse(200, { item }, 'Finance service updated successfully').send(res);
});

const remove = asyncHandler(async (req, res) => {
  await financeService.remove(req.params.id, req.user._id, req.user.role);
  new ApiResponse(200, null, 'Finance service deleted successfully').send(res);
});

const toggleStatus = asyncHandler(async (req, res) => {
  const item = await financeService.toggleStatus(req.params.id, req.user._id, req.user.role);
  new ApiResponse(200, { item }, 'Finance service status updated').send(res);
});

const getMy = asyncHandler(async (req, res) => {
  const items = await financeService.getMy(req.user._id);
  new ApiResponse(200, { items }, 'Your finance services fetched').send(res);
});

module.exports = { getAll, getById, getSimilar, create, update, remove, toggleStatus, getMy };