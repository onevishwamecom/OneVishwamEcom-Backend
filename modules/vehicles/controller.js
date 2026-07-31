const ApiResponse = require('../../utils/ApiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const vehicleService = require('./vehicleService');

const getAll = asyncHandler(async (req, res) => {
  const result = await vehicleService.getAll(req.query);
  new ApiResponse(200, result, 'Vehicles fetched successfully').send(res);
});

const getById = asyncHandler(async (req, res) => {
  const item = await vehicleService.getById(req.params.id);
  new ApiResponse(200, { item }, 'Vehicle fetched successfully').send(res);
});

const getSimilar = asyncHandler(async (req, res) => {
  const items = await vehicleService.getSimilar(req.params.id);
  new ApiResponse(200, { items }, 'Similar vehicles fetched').send(res);
});

const create = asyncHandler(async (req, res) => {
  const item = await vehicleService.create(req.body, req.user._id);
  new ApiResponse(201, { item }, 'Vehicle listing created successfully').send(res);
});

const update = asyncHandler(async (req, res) => {
  const item = await vehicleService.update(req.params.id, req.body, req.user._id, req.user.role);
  new ApiResponse(200, { item }, 'Vehicle listing updated successfully').send(res);
});

const remove = asyncHandler(async (req, res) => {
  await vehicleService.remove(req.params.id, req.user._id, req.user.role);
  new ApiResponse(200, null, 'Vehicle listing deleted successfully').send(res);
});

const toggleStatus = asyncHandler(async (req, res) => {
  const item = await vehicleService.toggleStatus(req.params.id, req.user._id, req.user.role);
  new ApiResponse(200, { item }, 'Vehicle status updated').send(res);
});

const getMy = asyncHandler(async (req, res) => {
  const items = await vehicleService.getMy(req.user._id);
  new ApiResponse(200, { items }, 'Your vehicle listings fetched').send(res);
});

module.exports = { getAll, getById, getSimilar, create, update, remove, toggleStatus, getMy };
