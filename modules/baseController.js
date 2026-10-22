const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const BaseService = require('../services/baseService');

/**
 * BaseController - Core Object-Oriented base controller class
 * Wraps BaseService with Express HTTP request/response handlers and edge caching.
 */
class BaseController {
  constructor(options = {}) {
    if (options instanceof BaseService) {
      this.service = options;
      this.model = options.model;
    } else {
      this.service = new BaseService(options);
      this.model = options.model;
    }

    this.transformCreateData = options.transformCreateData;
    this.transformUpdateData = options.transformUpdateData;
    this.ownerField = options.ownerField || 'user';

    this.getAll = this.getAll.bind(this);
    this.getById = this.getById.bind(this);
    this.getMy = this.getMy.bind(this);
    this.create = this.create.bind(this);
    this.update = this.update.bind(this);
    this.remove = this.remove.bind(this);
  }

  getAll = asyncHandler(async (req, res) => {
    const result = await this.service.getAll(req.query);
    const response = new ApiResponse(200, result, 'Fetched successfully');
    // Apply Edge CDN and browser cache headers for anonymous public reads
    if (!req.headers.authorization) {
      response.setCache(60, 120, 300);
    }
    response.send(res);
  });

  getById = asyncHandler(async (req, res) => {
    const item = await this.service.getById(req.params.id);
    const response = new ApiResponse(200, { item }, 'Fetched successfully');
    if (!req.headers.authorization) {
      response.setCache(60, 120, 300);
    }
    response.send(res);
  });

  getMy = asyncHandler(async (req, res) => {
    const items = await this.service.getMy(req.user._id);
    new ApiResponse(200, { items }, 'Your listings fetched').send(res);
  });

  create = asyncHandler(async (req, res) => {
    let data = { ...req.body, [this.ownerField]: req.user._id };
    if (req.files && req.files.length > 0) {
      data.images = req.files.map((f) =>
        f.path && f.path.startsWith('http') ? f.path : f.cloudinaryUrl || `/uploads/${f.filename}`
      );
    }
    if (this.transformCreateData) {
      data = await this.transformCreateData(req, data);
    }
    const item = await this.model.create(data);
    new ApiResponse(201, { item }, 'Created successfully').send(res);
  });

  update = asyncHandler(async (req, res) => {
    const item = await this.model.findById(req.params.id);
    if (!item) throw new ApiError(404, 'Not found');
    if (
      item[this.ownerField] &&
      req.user._id.toString() !== item[this.ownerField].toString() &&
      req.user.role !== 'admin'
    ) {
      throw new ApiError(403, 'Not authorized');
    }
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map((f) =>
        f.path && f.path.startsWith('http') ? f.path : f.cloudinaryUrl || `/uploads/${f.filename}`
      );
      req.body.images = req.body.replaceImages === 'true' ? newImages : [...(item.images || []), ...newImages];
    }
    Object.assign(item, req.body);
    if (this.transformUpdateData) {
      const transformed = await this.transformUpdateData(req, item);
      Object.assign(item, transformed);
    }
    await item.save();
    new ApiResponse(200, { item }, 'Updated successfully').send(res);
  });

  remove = asyncHandler(async (req, res) => {
    const item = await this.model.findById(req.params.id);
    if (!item) throw new ApiError(404, 'Not found');
    if (
      item[this.ownerField] &&
      req.user._id.toString() !== item[this.ownerField].toString() &&
      req.user.role !== 'admin'
    ) {
      throw new ApiError(403, 'Not authorized');
    }
    await item.deleteOne();
    new ApiResponse(200, null, 'Deleted successfully').send(res);
  });
}

/**
 * Factory wrapper ensuring full backwards compatibility with modules calling createCRUDController()
 */
function createCRUDController(options) {
  const controller = new BaseController(options);
  return {
    getAll: controller.getAll,
    getById: controller.getById,
    getMy: controller.getMy,
    create: controller.create,
    update: controller.update,
    remove: controller.remove,
  };
}

createCRUDController.BaseController = BaseController;
module.exports = createCRUDController;
