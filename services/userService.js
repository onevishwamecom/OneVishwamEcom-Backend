const User = require('../models/User');
const ApiError = require('../utils/ApiError');

const updateProfile = async (userId, updates) => {
  const allowed = ['fullName', 'mobile', 'city', 'area', 'pincode'];
  const data = {};

  for (const key of allowed) {
    if (updates[key] !== undefined) data[key] = updates[key];
  }

  if (updates.profileImage !== undefined) {
    data.profileImage = updates.profileImage;
  }

  if (data.mobile) {
    const existingMobile = await User.findOne({ mobile: data.mobile, _id: { $ne: userId } });
    if (existingMobile) throw new ApiError(409, 'Mobile number already registered');
  }

  const user = await User.findByIdAndUpdate(userId, data, { new: true, runValidators: true });
  if (!user) throw new ApiError(404, 'User not found');

  return user.toProfileJSON();
};

module.exports = { updateProfile };
