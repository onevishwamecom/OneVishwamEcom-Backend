const ApiResponse = require('../../utils/ApiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const propertyService = require('./propertyService');

const getAll = asyncHandler(async (req, res) => {
  const result = await propertyService.getAll(req.query);
  new ApiResponse(200, result, 'Properties fetched successfully').send(res);
});

const getById = asyncHandler(async (req, res) => {
  const result = await propertyService.getById(req.params.id);
  new ApiResponse(200, result, 'Property fetched successfully').send(res);
});

const getFeatured = asyncHandler(async (req, res) => {
  const result = await propertyService.getFeatured();
  new ApiResponse(200, result, 'Featured properties fetched').send(res);
});

const getLatest = asyncHandler(async (req, res) => {
  const result = await propertyService.getLatest(req.query.limit);
  new ApiResponse(200, result, 'Latest properties fetched').send(res);
});

const getSimilar = asyncHandler(async (req, res) => {
  const result = await propertyService.getSimilar(req.params.id);
  new ApiResponse(200, result, 'Similar properties fetched').send(res);
});

const create = asyncHandler(async (req, res) => {
  const result = await propertyService.create(req.body, req.files, req.user._id);
  new ApiResponse(201, result, 'Property created successfully').send(res);
});

const update = asyncHandler(async (req, res) => {
  const result = await propertyService.update(req.params.id, req.body, req.files, req.user._id, req.user.role);
  new ApiResponse(200, result, 'Property updated successfully').send(res);
});

const remove = asyncHandler(async (req, res) => {
  await propertyService.remove(req.params.id, req.user._id, req.user.role);
  new ApiResponse(200, null, 'Property deleted successfully').send(res);
});

const toggleStatus = asyncHandler(async (req, res) => {
  const result = await propertyService.toggleStatus(req.params.id, req.user._id, req.user.role);
  new ApiResponse(200, result, 'Property status updated').send(res);
});

const getMyProperties = asyncHandler(async (req, res) => {
  const result = await propertyService.getMyProperties(req.user._id);
  new ApiResponse(200, result, 'Your properties fetched').send(res);
});

module.exports = { getAll, getById, getFeatured, getLatest, getSimilar, create, update, remove, toggleStatus, getMyProperties };
