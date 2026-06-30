const Requirement = require('./model');
const ApiResponse = require('../../utils/ApiResponse');
const asyncHandler = require('../../utils/asyncHandler');

const createRequirement = asyncHandler(async (req, res) => {
  const data = { ...req.body };
  if (req.user) data.user = req.user._id;
  const requirement = await Requirement.create(data);
  new ApiResponse(201, { requirement }, 'Requirement submitted').send(res);
});

const getAllRequirements = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, serviceType } = req.query;
  const filter = serviceType ? { serviceType } : {};
  const p = Math.max(1, Number(page));
  const l = Math.min(100, Math.max(1, Number(limit)));
  const [requirements, total] = await Promise.all([
    Requirement.find(filter).sort({ createdAt: -1 }).skip((p - 1) * l).limit(l),
    Requirement.countDocuments(filter),
  ]);
  new ApiResponse(200, { requirements, pagination: { page: p, limit: l, totalItems: total, totalPages: Math.ceil(total / l) } }, 'Requirements fetched').send(res);
});

module.exports = { createRequirement, getAllRequirements };
