const upload = require('../middleware/upload');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const userService = require('../services/userService');

const updateProfile = asyncHandler(async (req, res) => {
  const updates = { ...req.body };

  if (req.file) {
    updates.profileImage = req.file.path && req.file.path.startsWith('http')
      ? req.file.path
      : req.file.cloudinaryUrl || `/uploads/${req.file.filename}`;
  }

  const user = await userService.updateProfile(req.user._id, updates);
  new ApiResponse(200, { user }, 'Profile updated').send(res);
});

module.exports = { updateProfile };
