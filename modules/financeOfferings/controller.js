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

module.exports = { getAll, getById };
