"use strict";

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance"); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(source, true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(source).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var Property = require('./model');

var createCRUDController = require('../baseController');

var ApiResponse = require('../../utils/ApiResponse');

var ApiError = require('../../utils/ApiError');

var asyncHandler = require('../../utils/asyncHandler');

var propertyService = require('./propertyService');

var NUMERIC_FIELDS = ['bedrooms', 'balconies', 'floors', 'totalFloors', 'areaSize', 'projectCount', 'totalUnits', 'availableUnits'];

function extractNumber(val) {
  if (val == null || val === '') return undefined;
  if (typeof val === 'number') return val;
  var m = String(val).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function sanitizeNumericFields(data) {
  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = NUMERIC_FIELDS[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var field = _step.value;

      if (field in data) {
        data[field] = extractNumber(data[field]);
      }
    }
  } catch (err) {
    _didIteratorError = true;
    _iteratorError = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion && _iterator["return"] != null) {
        _iterator["return"]();
      }
    } finally {
      if (_didIteratorError) {
        throw _iteratorError;
      }
    }
  }

  return data;
}

var base = createCRUDController({
  model: Property,
  ownerField: 'user',
  defaultFilter: {
    status: {
      $ne: 'deleted'
    }
  },
  searchFields: ['title', 'description', 'city', 'area', 'location', 'subtitle'],
  rangeFilters: {
    numericPrice: {
      min: 'priceMin',
      max: 'priceMax'
    },
    numericArea: {
      min: 'areaMin',
      max: 'areaMax'
    }
  },
  transformCreateData: function transformCreateData(req, data) {
    return sanitizeNumericFields(_objectSpread({}, data, {
      subtitle: data.subtitle || data.title
    }));
  },
  transformUpdateData: function transformUpdateData(req, data) {
    return sanitizeNumericFields(data);
  }
});
var getAll = asyncHandler(function _callee(req, res) {
  var result;
  return regeneratorRuntime.async(function _callee$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          _context.next = 2;
          return regeneratorRuntime.awrap(propertyService.getAll(req.query));

        case 2:
          result = _context.sent;
          new ApiResponse(200, result, 'Properties fetched successfully').send(res);

        case 4:
        case "end":
          return _context.stop();
      }
    }
  });
});
var getById = asyncHandler(function _callee2(req, res) {
  var item;
  return regeneratorRuntime.async(function _callee2$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          _context2.next = 2;
          return regeneratorRuntime.awrap(propertyService.getById(req.params.id));

        case 2:
          item = _context2.sent;
          new ApiResponse(200, {
            item: item
          }, 'Property fetched successfully').send(res);

        case 4:
        case "end":
          return _context2.stop();
      }
    }
  });
});
var getFeatured = asyncHandler(function _callee3(req, res) {
  var result;
  return regeneratorRuntime.async(function _callee3$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          _context3.next = 2;
          return regeneratorRuntime.awrap(propertyService.getFeatured());

        case 2:
          result = _context3.sent;
          new ApiResponse(200, result, 'Featured properties fetched').send(res);

        case 4:
        case "end":
          return _context3.stop();
      }
    }
  });
});
var getLatest = asyncHandler(function _callee4(req, res) {
  var result;
  return regeneratorRuntime.async(function _callee4$(_context4) {
    while (1) {
      switch (_context4.prev = _context4.next) {
        case 0:
          _context4.next = 2;
          return regeneratorRuntime.awrap(propertyService.getLatest(req.query.limit));

        case 2:
          result = _context4.sent;
          new ApiResponse(200, result, 'Latest properties fetched').send(res);

        case 4:
        case "end":
          return _context4.stop();
      }
    }
  });
});
var getSimilar = asyncHandler(function _callee5(req, res) {
  var result;
  return regeneratorRuntime.async(function _callee5$(_context5) {
    while (1) {
      switch (_context5.prev = _context5.next) {
        case 0:
          _context5.next = 2;
          return regeneratorRuntime.awrap(propertyService.getSimilar(req.params.id));

        case 2:
          result = _context5.sent;
          new ApiResponse(200, result, 'Similar properties fetched').send(res);

        case 4:
        case "end":
          return _context5.stop();
      }
    }
  });
});
var create = base.create;
var update = base.update;
var remove = asyncHandler(function _callee6(req, res) {
  return regeneratorRuntime.async(function _callee6$(_context6) {
    while (1) {
      switch (_context6.prev = _context6.next) {
        case 0:
          _context6.next = 2;
          return regeneratorRuntime.awrap(propertyService.remove(req.params.id, req.user._id, req.user.role));

        case 2:
          new ApiResponse(200, null, 'Property deleted successfully').send(res);

        case 3:
        case "end":
          return _context6.stop();
      }
    }
  });
});
var toggleStatus = asyncHandler(function _callee7(req, res) {
  var item;
  return regeneratorRuntime.async(function _callee7$(_context7) {
    while (1) {
      switch (_context7.prev = _context7.next) {
        case 0:
          _context7.next = 2;
          return regeneratorRuntime.awrap(propertyService.toggleStatus(req.params.id, req.user._id, req.user.role));

        case 2:
          item = _context7.sent;
          new ApiResponse(200, {
            item: item
          }, 'Property status updated').send(res);

        case 4:
        case "end":
          return _context7.stop();
      }
    }
  });
});
var getMyProperties = asyncHandler(function _callee8(req, res) {
  var items;
  return regeneratorRuntime.async(function _callee8$(_context8) {
    while (1) {
      switch (_context8.prev = _context8.next) {
        case 0:
          _context8.next = 2;
          return regeneratorRuntime.awrap(propertyService.getMyProperties(req.user._id));

        case 2:
          items = _context8.sent;
          new ApiResponse(200, {
            items: items
          }, 'Your properties fetched').send(res);

        case 4:
        case "end":
          return _context8.stop();
      }
    }
  });
});
var uploadBrochure = asyncHandler(function _callee9(req, res) {
  var property, url;
  return regeneratorRuntime.async(function _callee9$(_context9) {
    while (1) {
      switch (_context9.prev = _context9.next) {
        case 0:
          _context9.next = 2;
          return regeneratorRuntime.awrap(Property.findById(req.params.id));

        case 2:
          property = _context9.sent;

          if (property) {
            _context9.next = 5;
            break;
          }

          throw new ApiError(404, 'Property not found');

        case 5:
          if (!(property.user && req.user._id.toString() !== property.user.toString() && req.user.role !== 'admin')) {
            _context9.next = 7;
            break;
          }

          throw new ApiError(403, 'Not authorized');

        case 7:
          if (req.file) {
            _context9.next = 9;
            break;
          }

          throw new ApiError(400, 'No PDF file provided');

        case 9:
          url = req.file.path && req.file.path.startsWith('http') ? req.file.path : req.file.cloudinaryUrl || "/uploads/".concat(req.file.filename);
          property.brochure = url;
          _context9.next = 13;
          return regeneratorRuntime.awrap(property.save());

        case 13:
          new ApiResponse(200, {
            brochure: url
          }, 'Brochure uploaded successfully').send(res);

        case 14:
        case "end":
          return _context9.stop();
      }
    }
  });
});
var uploadFloorPlanImages = asyncHandler(function _callee10(req, res) {
  var property, files, urls;
  return regeneratorRuntime.async(function _callee10$(_context10) {
    while (1) {
      switch (_context10.prev = _context10.next) {
        case 0:
          _context10.next = 2;
          return regeneratorRuntime.awrap(Property.findById(req.params.id));

        case 2:
          property = _context10.sent;

          if (property) {
            _context10.next = 5;
            break;
          }

          throw new ApiError(404, 'Property not found');

        case 5:
          if (!(property.user && req.user._id.toString() !== property.user.toString() && req.user.role !== 'admin')) {
            _context10.next = 7;
            break;
          }

          throw new ApiError(403, 'Not authorized');

        case 7:
          files = req.files || (req.file ? [req.file] : []);

          if (!(files.length === 0)) {
            _context10.next = 10;
            break;
          }

          throw new ApiError(400, 'No floor plan image files provided');

        case 10:
          urls = files.map(function (f) {
            return f.path && f.path.startsWith('http') ? f.path : f.cloudinaryUrl || "/uploads/".concat(f.filename);
          });
          property.floorPlanImages = Array.from(new Set([].concat(_toConsumableArray(property.floorPlanImages || []), _toConsumableArray(urls))));
          _context10.next = 14;
          return regeneratorRuntime.awrap(property.save());

        case 14:
          new ApiResponse(200, {
            floorPlanImages: property.floorPlanImages,
            item: property
          }, 'Floor plan images uploaded successfully').send(res);

        case 15:
        case "end":
          return _context10.stop();
      }
    }
  });
});
var uploadFloorPlanPdf = asyncHandler(function _callee11(req, res) {
  var property, file, url;
  return regeneratorRuntime.async(function _callee11$(_context11) {
    while (1) {
      switch (_context11.prev = _context11.next) {
        case 0:
          _context11.next = 2;
          return regeneratorRuntime.awrap(Property.findById(req.params.id));

        case 2:
          property = _context11.sent;

          if (property) {
            _context11.next = 5;
            break;
          }

          throw new ApiError(404, 'Property not found');

        case 5:
          if (!(property.user && req.user._id.toString() !== property.user.toString() && req.user.role !== 'admin')) {
            _context11.next = 7;
            break;
          }

          throw new ApiError(403, 'Not authorized');

        case 7:
          file = req.file || req.files && req.files[0];

          if (file) {
            _context11.next = 10;
            break;
          }

          throw new ApiError(400, 'No PDF file provided');

        case 10:
          url = file.path && file.path.startsWith('http') ? file.path : file.cloudinaryUrl || "/uploads/".concat(file.filename);
          property.pdfUrl = url;
          _context11.next = 14;
          return regeneratorRuntime.awrap(property.save());

        case 14:
          new ApiResponse(200, {
            pdfUrl: url,
            item: property
          }, 'Floor plan PDF uploaded successfully').send(res);

        case 15:
        case "end":
          return _context11.stop();
      }
    }
  });
});
var uploadFloorPlan = asyncHandler(function _callee12(req, res) {
  var property, files, imageFiles, pdfFiles, imageUrls, pdfUrl;
  return regeneratorRuntime.async(function _callee12$(_context12) {
    while (1) {
      switch (_context12.prev = _context12.next) {
        case 0:
          _context12.next = 2;
          return regeneratorRuntime.awrap(Property.findById(req.params.id));

        case 2:
          property = _context12.sent;

          if (property) {
            _context12.next = 5;
            break;
          }

          throw new ApiError(404, 'Property not found');

        case 5:
          if (!(property.user && req.user._id.toString() !== property.user.toString() && req.user.role !== 'admin')) {
            _context12.next = 7;
            break;
          }

          throw new ApiError(403, 'Not authorized');

        case 7:
          files = req.files || (req.file ? [req.file] : []);

          if (!(files.length === 0)) {
            _context12.next = 10;
            break;
          }

          throw new ApiError(400, 'No files provided');

        case 10:
          imageFiles = files.filter(function (f) {
            return f.mimetype !== 'application/pdf';
          });
          pdfFiles = files.filter(function (f) {
            return f.mimetype === 'application/pdf';
          });

          if (imageFiles.length > 0) {
            imageUrls = imageFiles.map(function (f) {
              return f.path && f.path.startsWith('http') ? f.path : f.cloudinaryUrl || "/uploads/".concat(f.filename);
            });
            property.floorPlanImages = Array.from(new Set([].concat(_toConsumableArray(property.floorPlanImages || []), _toConsumableArray(imageUrls))));
          }

          if (pdfFiles.length > 0) {
            pdfUrl = pdfFiles[0].path && pdfFiles[0].path.startsWith('http') ? pdfFiles[0].path : pdfFiles[0].cloudinaryUrl || "/uploads/".concat(pdfFiles[0].filename);
            property.pdfUrl = pdfUrl;
          }

          _context12.next = 16;
          return regeneratorRuntime.awrap(property.save());

        case 16:
          new ApiResponse(200, {
            floorPlanImages: property.floorPlanImages,
            pdfUrl: property.pdfUrl,
            item: property
          }, 'Floor plan uploaded successfully').send(res);

        case 17:
        case "end":
          return _context12.stop();
      }
    }
  });
});
var deleteFloorPlanImage = asyncHandler(function _callee13(req, res) {
  var property, imageUrl;
  return regeneratorRuntime.async(function _callee13$(_context13) {
    while (1) {
      switch (_context13.prev = _context13.next) {
        case 0:
          _context13.next = 2;
          return regeneratorRuntime.awrap(Property.findById(req.params.id));

        case 2:
          property = _context13.sent;

          if (property) {
            _context13.next = 5;
            break;
          }

          throw new ApiError(404, 'Property not found');

        case 5:
          if (!(property.user && req.user._id.toString() !== property.user.toString() && req.user.role !== 'admin')) {
            _context13.next = 7;
            break;
          }

          throw new ApiError(403, 'Not authorized');

        case 7:
          imageUrl = req.body.imageUrl;

          if (imageUrl) {
            _context13.next = 10;
            break;
          }

          throw new ApiError(400, 'Image URL required');

        case 10:
          property.floorPlanImages = (property.floorPlanImages || []).filter(function (url) {
            return url !== imageUrl;
          });
          _context13.next = 13;
          return regeneratorRuntime.awrap(property.save());

        case 13:
          new ApiResponse(200, {
            floorPlanImages: property.floorPlanImages,
            item: property
          }, 'Floor plan image deleted successfully').send(res);

        case 14:
        case "end":
          return _context13.stop();
      }
    }
  });
});
var deleteFloorPlanPdf = asyncHandler(function _callee14(req, res) {
  var property;
  return regeneratorRuntime.async(function _callee14$(_context14) {
    while (1) {
      switch (_context14.prev = _context14.next) {
        case 0:
          _context14.next = 2;
          return regeneratorRuntime.awrap(Property.findById(req.params.id));

        case 2:
          property = _context14.sent;

          if (property) {
            _context14.next = 5;
            break;
          }

          throw new ApiError(404, 'Property not found');

        case 5:
          if (!(property.user && req.user._id.toString() !== property.user.toString() && req.user.role !== 'admin')) {
            _context14.next = 7;
            break;
          }

          throw new ApiError(403, 'Not authorized');

        case 7:
          property.pdfUrl = '';
          _context14.next = 10;
          return regeneratorRuntime.awrap(property.save());

        case 10:
          new ApiResponse(200, {
            pdfUrl: '',
            item: property
          }, 'Floor plan PDF deleted successfully').send(res);

        case 11:
        case "end":
          return _context14.stop();
      }
    }
  });
});
module.exports = {
  getAll: getAll,
  getById: getById,
  getFeatured: getFeatured,
  getLatest: getLatest,
  getSimilar: getSimilar,
  create: create,
  update: update,
  remove: remove,
  toggleStatus: toggleStatus,
  getMyProperties: getMyProperties,
  uploadBrochure: uploadBrochure,
  uploadFloorPlanImages: uploadFloorPlanImages,
  uploadFloorPlanPdf: uploadFloorPlanPdf,
  uploadFloorPlan: uploadFloorPlan,
  deleteFloorPlanImage: deleteFloorPlanImage,
  deleteFloorPlanPdf: deleteFloorPlanPdf
};