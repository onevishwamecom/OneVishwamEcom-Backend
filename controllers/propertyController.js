const Property = require('../models/Property');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Property Intake Controller
 * Handles 94-question property submissions, paginated queries, details, and status updates.
 */

// @desc    Create a new property listing
// @route   POST /api/properties
// @access  Private (Authenticated User / Channel Partner)
const createProperty = asyncHandler(async (req, res) => {
  const userId = req.user?._id || req.auth?.id;
  if (!userId) {
    throw new ApiError(401, 'Authentication required to create a property listing');
  }

  const data = { ...req.body };

  // Remove forgeable fields
  delete data._id;
  delete data.status; // Always pending upon creation

  data.createdBy = userId;
  data.user = userId;
  data.status = 'pending';

  // Server-side enforcement of Channel Partner identity & in-house tagging
  if (req.user?.partnerName || req.auth?.partnerName) {
    data.channelPartnerName = req.user?.partnerName || req.auth?.partnerName;
  }
  if (req.user?.origin || req.auth?.origin) {
    data.origin = req.user?.origin || req.auth?.origin;
  } else if (req.user?.role === 'in_house' || req.auth?.role === 'in_house') {
    data.origin = 'in_house_project';
    data.channelPartnerName = 'One Vishwam';
  }

  // Handle uploaded files if passed via multipart
  const uploadedDocs = Array.isArray(data.documents) ? [...data.documents] : [];
  const uploadedImages = Array.isArray(data.images) ? [...data.images] : [];

  if (req.files && Array.isArray(req.files) && req.files.length > 0) {
    for (const file of req.files) {
      const fileUrl =
        file.path && file.path.startsWith('http')
          ? file.path
          : file.firebaseUrl || file.cloudinaryUrl || `/uploads/${file.filename}`;
      const mime = file.mimetype || file.type || '';

      uploadedDocs.push({
        url: fileUrl,
        filename: file.originalname || file.filename || 'Document',
        fileType: mime,
      });

      if (mime.startsWith('image/')) {
        uploadedImages.push(fileUrl);
      } else if (mime.includes('pdf')) {
        data.brochure = fileUrl;
        data.pdfUrl = fileUrl;
      }
    }
  }

  data.documents = uploadedDocs;
  if (uploadedImages.length > 0) {
    data.images = uploadedImages;
  }

  // Sync dual-compatibility fields from details
  const d = data.details || {};
  if (!data.title) {
    data.title = d.apartmentName || d.projectName || d.propertyName || `${data.propertyType} Property`;
  }
  if (!data.price) {
    data.price = d.expectedPrice || d.expectedPricePerAcre || '';
  }

  const property = await Property.create(data);
  const populated = await Property.findById(property._id).populate(
    'createdBy',
    'fullName name email phoneNumber'
  );

  new ApiResponse(
    201,
    { property: populated || property },
    'Property listing submitted successfully. It is now pending admin approval.'
  ).send(res);
});

// @desc    Get paginated property listings with filters
// @route   GET /api/properties
// @access  Public / Private
const getProperties = asyncHandler(async (req, res) => {
  const { type, propertyType, status, city, area, search, sort = 'latest' } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const filter = {};

  // Status filtering: default to approved/active for public, or explicit query
  if (status) {
    filter.status = status;
  } else if (!req.auth || (req.auth.role !== 'admin' && req.auth.role !== 'super-admin')) {
    filter.status = { $in: ['approved', 'active'] };
  } else {
    filter.status = { $ne: 'deleted' };
  }

  // Property Type filter
  const targetType = type || propertyType;
  if (targetType && targetType !== 'all') {
    filter.propertyType = targetType;
  }

  // City & Area filter
  if (city && city !== 'all') {
    filter.city = city.toLowerCase();
  }
  if (area && area !== 'all') {
    filter.area = new RegExp(area.trim(), 'i');
  }

  // Search filter
  if (search && search.trim()) {
    const q = search.trim();
    filter.$or = [
      { title: { $regex: q, $options: 'i' } },
      { vendorName: { $regex: q, $options: 'i' } },
      { channelPartnerName: { $regex: q, $options: 'i' } },
      { 'details.propertyName': { $regex: q, $options: 'i' } },
      { 'details.projectName': { $regex: q, $options: 'i' } },
      { 'details.apartmentName': { $regex: q, $options: 'i' } },
    ];
  }

  // Sort orders
  const sortMap = {
    latest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    'price-low': { numericPrice: 1 },
    'price-high': { numericPrice: -1 },
  };
  const sortOption = sortMap[sort] || { createdAt: -1 };

  const [properties, total] = await Promise.all([
    Property.find(filter)
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'fullName name email phoneNumber')
      .lean(),
    Property.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;

  new ApiResponse(
    200,
    {
      properties,
      items: properties,
      total,
      totalPages,
      page,
      limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    'Properties fetched successfully'
  ).send(res);
});

// @desc    Get single property by ID
// @route   GET /api/properties/:id
// @access  Public
const getPropertyById = asyncHandler(async (req, res) => {
  const property = await Property.findById(req.params.id)
    .populate('createdBy', 'fullName name email phoneNumber avatar')
    .populate('user', 'fullName name email phoneNumber avatar');

  if (!property || property.status === 'deleted') {
    throw new ApiError(404, 'Property listing not found');
  }

  new ApiResponse(200, { property, item: property }, 'Property fetched successfully').send(res);
});

// @desc    Update property listing status (Admin only)
// @route   PATCH /api/properties/:id/status
// @access  Private (Admin Only)
const updatePropertyStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const ALLOWED_ADMIN_STATUSES = ['approved', 'rejected', 'pending', 'changes-required'];

  if (!status || !ALLOWED_ADMIN_STATUSES.includes(status)) {
    throw new ApiError(
      400,
      `Invalid status. Must be one of: ${ALLOWED_ADMIN_STATUSES.join(', ')}`
    );
  }

  const property = await Property.findById(req.params.id);
  if (!property) {
    throw new ApiError(404, 'Property listing not found');
  }

  property.status = status;
  await property.save();

  new ApiResponse(
    200,
    { property },
    `Property status updated to "${status}" successfully`
  ).send(res);
});

module.exports = {
  createProperty,
  getProperties,
  getPropertyById,
  updatePropertyStatus,
};

