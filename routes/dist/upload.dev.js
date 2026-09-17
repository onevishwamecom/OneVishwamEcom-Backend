"use strict";

var express = require('express');

var _require = require('../middleware/auth'),
    protect = _require.protect;

var upload = require('../middleware/upload');

var uploadFloorPlan = require('../middleware/uploadFloorPlan');

var uploadBrochure = require('../middleware/uploadBrochure');

var _require2 = require('firebase-admin/storage'),
    getStorage = _require2.getStorage;

var ApiResponse = require('../utils/ApiResponse');

var ApiError = require('../utils/ApiError');

var router = express.Router(); // POST /upload/images — product images (up to 10)

router.post('/images', protect, upload.array('images', 10), function (req, res) {
  if (!req.uploadedFiles || req.uploadedFiles.length === 0) {
    throw new ApiError(400, 'No images provided');
  }

  var urls = req.uploadedFiles.map(function (f) {
    return f.url;
  });
  new ApiResponse(200, {
    images: urls
  }, 'Images uploaded').send(res);
}); // POST /upload/video — single product video

router.post('/video', protect, upload.uploadVideo.single('video'), function (req, res) {
  if (!req.uploadedFile) {
    throw new ApiError(400, 'No video provided');
  }

  new ApiResponse(200, {
    videos: [req.uploadedFile.url]
  }, 'Video uploaded').send(res);
}); // POST /upload/media — images + optional video together

router.post('/media', protect, function _callee3(req, res, next) {
  var Busboy, _require3, Readable, path, rawBody, contentType, bb, parsed;

  return regeneratorRuntime.async(function _callee3$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          _context3.prev = 0;
          Busboy = require('busboy');
          _require3 = require('stream'), Readable = _require3.Readable;
          path = require('path');
          rawBody = req.rawBody;

          if (rawBody) {
            _context3.next = 7;
            break;
          }

          return _context3.abrupt("return", next(new ApiError(400, 'No file data received')));

        case 7:
          contentType = req.headers['content-type'] || '';
          bb = Busboy({
            headers: {
              'content-type': contentType
            },
            limits: {
              files: 11,
              fileSize: 50 * 1024 * 1024
            }
          });
          parsed = [];
          bb.on('file', function (fieldname, fileStream, info) {
            var filename = info.filename,
                mimeType = info.mimeType;
            var chunks = [];
            fileStream.on('data', function (c) {
              return chunks.push(c);
            });
            fileStream.on('end', function () {
              return parsed.push({
                fieldname: fieldname,
                originalname: filename || 'upload',
                mimetype: mimeType,
                buffer: Buffer.concat(chunks)
              });
            });
          });
          bb.on('finish', function _callee2() {
            var bucket, uploaded;
            return regeneratorRuntime.async(function _callee2$(_context2) {
              while (1) {
                switch (_context2.prev = _context2.next) {
                  case 0:
                    if (!(parsed.length === 0)) {
                      _context2.next = 2;
                      break;
                    }

                    return _context2.abrupt("return", next(new ApiError(400, 'No media files provided')));

                  case 2:
                    if (!(parsed.length > 11)) {
                      _context2.next = 4;
                      break;
                    }

                    return _context2.abrupt("return", next(new ApiError(400, 'Maximum 10 images + 1 video allowed')));

                  case 4:
                    _context2.prev = 4;
                    bucket = getStorage().bucket();
                    _context2.next = 8;
                    return regeneratorRuntime.awrap(Promise.all(parsed.map(function _callee(f) {
                      var isVideo, folder, ext, fname, storagePath;
                      return regeneratorRuntime.async(function _callee$(_context) {
                        while (1) {
                          switch (_context.prev = _context.next) {
                            case 0:
                              isVideo = /^video\//.test(f.mimetype);
                              folder = isVideo ? 'products/videos' : 'products/images';
                              ext = path.extname(f.originalname).toLowerCase() || (isVideo ? '.mp4' : '.jpg');
                              fname = "".concat(Date.now(), "-").concat(Math.floor(Math.random() * 1e9)).concat(ext);
                              storagePath = "".concat(folder, "/").concat(fname);
                              _context.next = 7;
                              return regeneratorRuntime.awrap(bucket.file(storagePath).save(f.buffer, {
                                metadata: {
                                  contentType: f.mimetype
                                },
                                resumable: false,
                                "public": true
                              }));

                            case 7:
                              return _context.abrupt("return", {
                                url: "https://storage.googleapis.com/".concat(bucket.name, "/").concat(storagePath),
                                isVideo: isVideo
                              });

                            case 8:
                            case "end":
                              return _context.stop();
                          }
                        }
                      });
                    })));

                  case 8:
                    uploaded = _context2.sent;
                    new ApiResponse(200, {
                      images: uploaded.filter(function (u) {
                        return !u.isVideo;
                      }).map(function (u) {
                        return u.url;
                      }),
                      videos: uploaded.filter(function (u) {
                        return u.isVideo;
                      }).map(function (u) {
                        return u.url;
                      })
                    }, 'Media uploaded').send(res);
                    _context2.next = 15;
                    break;

                  case 12:
                    _context2.prev = 12;
                    _context2.t0 = _context2["catch"](4);
                    next(_context2.t0);

                  case 15:
                  case "end":
                    return _context2.stop();
                }
              }
            }, null, null, [[4, 12]]);
          });
          bb.on('error', function (err) {
            return next(new ApiError(400, "Parse error: ".concat(err.message)));
          });
          Readable.from(rawBody).pipe(bb);
          _context3.next = 19;
          break;

        case 16:
          _context3.prev = 16;
          _context3.t0 = _context3["catch"](0);
          next(_context3.t0);

        case 19:
        case "end":
          return _context3.stop();
      }
    }
  }, null, null, [[0, 16]]);
}); // POST /upload/floor-plan-images — floor plan images (up to 10)

router.post('/floor-plan-images', protect, uploadFloorPlan.array('floorPlanImages', 10), function (req, res) {
  if (!req.uploadedFiles || req.uploadedFiles.length === 0) {
    throw new ApiError(400, 'No floor plan images provided');
  }

  var urls = req.uploadedFiles.map(function (f) {
    return f.url;
  });
  new ApiResponse(200, {
    floorPlanImages: urls
  }, 'Floor plan images uploaded').send(res);
}); // POST /upload/floor-plan-pdf — single floor plan PDF

router.post('/floor-plan-pdf', protect, uploadFloorPlan.single('floorPlanPdf'), function (req, res) {
  var uploaded = req.uploadedFile || req.uploadedFiles && req.uploadedFiles[0];
  if (!uploaded) throw new ApiError(400, 'No PDF file provided');
  new ApiResponse(200, {
    pdfUrl: uploaded.url
  }, 'Floor plan PDF uploaded').send(res);
}); // POST /upload/floor-plans — floor plan images (alias)

router.post('/floor-plans', protect, uploadFloorPlan.array('floorPlans', 10), function (req, res) {
  if (!req.uploadedFiles || req.uploadedFiles.length === 0) {
    throw new ApiError(400, 'No floor plan files provided');
  }

  var urls = req.uploadedFiles.map(function (f) {
    return f.url;
  });
  new ApiResponse(200, {
    floorPlans: urls
  }, 'Floor plans uploaded').send(res);
}); // POST /upload/brochure — single brochure PDF

router.post('/brochure', protect, uploadBrochure.single('brochure'), function (req, res) {
  if (!req.uploadedFile) throw new ApiError(400, 'No brochure provided');
  new ApiResponse(200, {
    brochureUrl: req.uploadedFile.url
  }, 'Brochure uploaded').send(res);
});
module.exports = router;