const xlsx = require('xlsx');
const mongoose = require('mongoose');
const modules = require('../modules');
const Property = require('../models/Property');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { parsePrice } = require('../utils/priceUtils');

// Mapping frontend categories to backend module ids
const CATEGORY_TO_MODULE = {
  properties: 'properties',
  'real-estate': 'properties',
  realestate: 'properties',
  vehicle: 'vehicles',
  vehicles: 'vehicles',
  grocery: 'groceries',
  groceries: 'groceries',
  garment: 'garments',
  garments: 'garments',
  jewellery: 'jewellery',
  jewelry: 'jewellery',
  bedding: 'garments',
  service: 'properties',
};

// Normalized category slug lookup
const CATEGORY_CANONICAL_SLUG = {
  properties: 'properties',
  'real-estate': 'properties',
  realestate: 'properties',
  vehicle: 'vehicle',
  vehicles: 'vehicle',
  grocery: 'grocery',
  groceries: 'grocery',
  garment: 'garment',
  garments: 'garment',
  jewellery: 'jewellery',
  jewelry: 'jewellery',
  bedding: 'bedding',
  service: 'service',
};

function findModule(type) {
  let mod = modules.find((m) => m.id === type);
  if (!mod) {
    mod = modules.find((m) => m.id === 'properties') || modules[0];
  }
  return mod;
}

/**
 * Validate that uploaded filename matches the expected pattern:
 * <Categoryname>_bulklisting_<timestamp>.xlsx (e.g. properties_bulklisting_20261016_134522.xlsx)
 * Timestamp format: YYYYMMDD_HHmmss (or 8-digit date with 4-6 digit time)
 */
function validateFilenamePattern(filename, selectedCategory) {
  if (!filename || typeof filename !== 'string') {
    throw new ApiError(400, 'Invalid file: filename is missing');
  }

  const cleanName = filename.trim();
  // Regex: matches <category>_bulklisting_<YYYYMMDD_HHmmss>.xlsx (allows optional browser copy suffix like ' (1)')
  const regex = /^([a-zA-Z0-9_-]+)_bulklisting_(\d{8}_\d{4,6})(?:\s*\(\d+\))?\.xlsx$/i;
  const match = cleanName.match(regex);

  if (!match) {
    const canonical = CATEGORY_CANONICAL_SLUG[selectedCategory?.toLowerCase()] || selectedCategory || 'category';
    throw new ApiError(
      400,
      `Invalid file name: "${cleanName}". The file name must match the downloaded template pattern: ${canonical}_bulklisting_YYYYMMDD_HHmmss.xlsx (e.g. ${canonical}_bulklisting_20261016_133000.xlsx).`
    );
  }

  const fileCategory = match[1].toLowerCase().replace(/[-_]/g, '');
  const normSelected = (selectedCategory || '').toLowerCase().replace(/[-_]/g, '');

  const normFileModule = CATEGORY_TO_MODULE[fileCategory] || fileCategory;
  const normSelectedModule = CATEGORY_TO_MODULE[normSelected] || normSelected;

  if (normFileModule !== normSelectedModule) {
    throw new ApiError(
      400,
      `Category mismatch: The file "${cleanName}" appears to be for "${match[1]}", but you selected "${selectedCategory}". Please upload the matching file or select the correct category.`
    );
  }

  return {
    category: match[1],
    timestamp: match[2],
  };
}

/**
 * Normalizes raw row object keys by removing trailing asterisks, trimming, and camelCasing
 */
function normalizeRowKeys(rawRow) {
  const normalized = {};
  for (const [key, val] of Object.entries(rawRow)) {
    if (!key) continue;
    // Remove '*', '(', ')', brackets and trim
    const cleanKey = key
      .replace(/\*/g, '')
      .replace(/\(.*?\)/g, '')
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim()
      .toLowerCase();

    // Map common human-readable headers to standard property names
    const mappedKey = mapHeaderToKey(cleanKey);
    normalized[mappedKey] = val;
  }
  return normalized;
}

function mapHeaderToKey(header) {
  const map = {
    // General
    title: 'title',
    name: 'name',
    productname: 'name',
    itemname: 'name',
    itemnametitle: 'title',
    description: 'description',
    category: 'category',
    subcategory: 'subcategory',
    price: 'price',
    expectedprice: 'price',
    pricesuffix: 'priceSuffix',
    city: 'city',
    area: 'area',
    locality: 'area',
    arealocality: 'area',
    address: 'address',
    pincode: 'pincode',
    images: 'images',
    imageurls: 'images',

    // Properties
    propertytype: 'propertyType',
    purpose: 'purpose',
    bhk: 'bhk',
    bathrooms: 'bathrooms',
    balconies: 'balconies',
    superbuiltuparea: 'superBuiltUpArea',
    facing: 'facing',
    furnishingstatus: 'furnishingStatus',
    possessionstatus: 'possessionStatus',
    bankloanavailable: 'bankLoanDetails',
    bankloandetails: 'bankLoanDetails',
    amenities: 'amenities',
    vendorname: 'vendorName',
    buildername: 'vendorName',
    negotiable: 'negotiable',

    // Vehicles
    brand: 'brand',
    model: 'model',
    make: 'make',
    year: 'year',
    vehicletype: 'category',
    vehicletypecategory: 'category',
    wheelertype: 'wheelerType',
    condition: 'condition',
    fueltype: 'fuelType',
    transmission: 'transmission',
    kmdriven: 'kmDriven',
    location: 'location',
    locationarea: 'location',

    // Groceries & Garments
    unit: 'unit',
    stock: 'stock',
    stockquantity: 'stock',
    quantity: 'quantity',
    organic: 'organic',
    size: 'size',
    color: 'color',
    material: 'material',
    gender: 'gender',

    // Jewellery
    metaltype: 'metalType',
    purity: 'purity',
    weightgrams: 'weightGrams',
    makingcharges: 'makingCharges',
    certified: 'certified',
  };

  const key = header.replace(/\s+/g, '');
  return map[key] || header;
}

/**
 * Normalizes property types to match Property model enum
 */
function normalizePropertyType(type) {
  if (!type) return 'Residential';
  const t = String(type).trim().toLowerCase();
  if (t.includes('flat') || t.includes('villa') || t.includes('apartment')) return 'Flat/Villa';
  if (t.includes('plot') || t.includes('land') || t.includes('layout')) return 'Plot/Land';
  if (t.includes('indep') || t.includes('house')) return 'Independent House';
  if (t.includes('agri') || t.includes('farm')) return 'Agricultural';
  if (t.includes('comm') || t.includes('office') || t.includes('shop')) return 'Commercial';
  if (t.includes('indus') || t.includes('shed') || t.includes('factory')) return 'Industrial';
  return 'Residential';
}

/**
 * Helper to extract multipart file and fields using busboy or req.file
 */
async function extractMultipartFileAndFields(req) {
  if (req.file && req.file.buffer) {
    return {
      file: {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        buffer: req.file.buffer,
      },
      fields: req.body || {},
    };
  }

  const Busboy = require('busboy');
  const { Readable } = require('stream');

  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      return reject(new ApiError(400, 'Expected multipart/form-data with Excel file'));
    }

    let bb;
    try {
      bb = Busboy({
        headers: { 'content-type': contentType },
        limits: { files: 1, fileSize: 30 * 1024 * 1024 },
      });
    } catch (e) {
      return reject(new ApiError(400, 'Invalid multipart headers: ' + e.message));
    }

    let uploadedFile = null;
    const fields = {};

    bb.on('field', (name, val) => {
      fields[name] = val;
    });

    bb.on('file', (fieldname, fileStream, info) => {
      const { filename, mimeType } = info;
      const chunks = [];
      fileStream.on('data', (c) => chunks.push(c));
      fileStream.on('end', () => {
        uploadedFile = {
          fieldname,
          originalname: filename || 'upload.xlsx',
          mimetype: mimeType,
          buffer: Buffer.concat(chunks),
        };
      });
    });

    bb.on('finish', () => {
      resolve({ file: uploadedFile, fields });
    });

    bb.on('error', (err) => {
      reject(new ApiError(400, `Parse error: ${err.message}`));
    });

    if (req.rawBody && req.rawBody.length) {
      Readable.from(req.rawBody).pipe(bb);
    } else {
      req.pipe(bb);
    }
  });
}

/**
 * POST /api/listings/bulk-upload
 * Handles Excel file parsing, validation, and batch insertion with pending status
 */
exports.bulkUploadListings = asyncHandler(async (req, res) => {
  // 1. Extract file and fields
  const { file, fields } = await extractMultipartFileAndFields(req);

  if (!file || !file.buffer || file.buffer.length === 0) {
    throw new ApiError(400, 'No file uploaded or file is empty');
  }

  const selectedCategory = (fields.category || fields._type || '').trim().toLowerCase();
  if (!selectedCategory) {
    throw new ApiError(400, 'Category is required for bulk upload');
  }

  // 2. Validate filename pattern
  validateFilenamePattern(file.originalname, selectedCategory);

  // 3. Read Excel workbook
  let workbook;
  try {
    workbook = xlsx.read(file.buffer, { type: 'buffer' });
  } catch (readErr) {
    throw new ApiError(400, `Failed to parse Excel file: ${readErr.message}`);
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new ApiError(400, 'Excel file contains no sheets');
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

  if (!rawRows || rawRows.length === 0) {
    throw new ApiError(400, 'The uploaded Excel sheet contains no data rows');
  }

  // 4. Resolve Lister & Contributor identity
  const isValidObjectId = (val) => val && mongoose.Types.ObjectId.isValid(String(val));
  const ownerId = isValidObjectId(req.auth?.id)
    ? req.auth.id
    : (isValidObjectId(req.user?._id) ? req.user._id : new mongoose.Types.ObjectId());

  const userEmail = (req.user?.email || req.auth?.email || '').toLowerCase();
  const isOneVishwamUser =
    userEmail === 'ceo@onevishwam.com' ||
    userEmail.endsWith('@onevishwam.com') ||
    req.user?.role === 'in_house' ||
    req.auth?.role === 'in_house';

  const defaultChannelPartner = isOneVishwamUser
    ? 'One Vishwam'
    : (req.user?.partnerName || req.auth?.partnerName || req.user?.name || req.auth?.name || 'Channel Partner');

  const defaultVendor = isOneVishwamUser
    ? 'One Vishwam'
    : (req.user?.name || req.auth?.name || req.user?.partnerName || 'Owner');

  const contributorName =
    req.user?.name ||
    req.user?.fullName ||
    req.auth?.name ||
    defaultVendor ||
    (userEmail ? userEmail.split('@')[0] : '') ||
    'Contributor';

  const contributorPhone = req.user?.phone || req.user?.phoneNumber || req.user?.mobile || '';
  const contributorCity = req.user?.city || '';

  const contributorObj = {
    _id: ownerId,
    id: ownerId,
    name: contributorName,
    email: userEmail || '',
    contact: contributorPhone,
    phone: contributorPhone,
    city: contributorCity,
    type: req.auth?.accountType || 'lister',
    createdAt: new Date(),
  };

  const moduleId = CATEGORY_TO_MODULE[selectedCategory] || 'properties';
  const mod = findModule(moduleId);
  if (!mod || !mod.model) {
    throw new ApiError(400, `Unsupported module for category: ${selectedCategory}`);
  }

  // 5. Transform and validate rows
  const documentsToInsert = [];
  const errors = [];

  for (let i = 0; i < rawRows.length; i++) {
    const rawRow = rawRows[i];
    const rowNum = i + 2; // Row 1 is header
    const r = normalizeRowKeys(rawRow);

    // Skip row if completely blank
    const values = Object.values(r).filter((v) => v !== '' && v !== null && v !== undefined);
    if (values.length === 0) continue;

    // Skip if it looks like an instruction row or header repeat
    if (r.title && String(r.title).toLowerCase().includes('sample') && String(r.price).includes('example')) {
      continue;
    }

    try {
      if (moduleId === 'properties') {
        const title = r.title || r.name || '';
        const price = r.price ? String(r.price).trim() : '';
        const city = r.city ? String(r.city).trim().toLowerCase() : 'bengaluru';
        const propertyType = normalizePropertyType(r.propertyType);

        if (!title) {
          errors.push(`Row ${rowNum}: Title is required`);
          continue;
        }
        if (!price) {
          errors.push(`Row ${rowNum}: Price is required`);
          continue;
        }

        const numPrice = parsePrice(price);
        const imagesList = r.images
          ? String(r.images).split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean)
          : [];

        const amenitiesList = r.amenities
          ? String(r.amenities).split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean)
          : [];

        const doc = {
          title,
          vendorName: r.vendorName || defaultVendor,
          channelPartnerName: defaultChannelPartner,
          propertyType,
          category: 'properties',
          subcategory: r.subcategory || propertyType,
          purpose: r.purpose || 'Sell',
          price: price.startsWith('₹') ? price : `₹ ${price}`,
          numericPrice: numPrice,
          priceSuffix: r.priceSuffix || '',
          city,
          area: r.area || '',
          pincode: r.pincode ? String(r.pincode).trim() : '',
          address: r.address || `${r.area || ''}, ${city}`.trim(),
          description: r.description || `${propertyType} property in ${r.area || city}`,
          bankLoanDetails: r.bankLoanDetails || 'Available on request',
          loanApproved: Boolean(r.bankLoanDetails && !String(r.bankLoanDetails).toLowerCase().includes('no')),
          images: imagesList,
          status: 'pending', // ALWAYS PENDING AS REQUIRED
          createdBy: ownerId,
          origin: isOneVishwamUser ? 'in_house_project' : 'channel_partner_project',
          priority: isOneVishwamUser ? 1 : 0,
          isPriority: isOneVishwamUser,
          featured: isOneVishwamUser,
          contributor: contributorObj,
          details: {
            propertyName: title,
            expectedPrice: price,
            bhk: r.bhk || '',
            facing: r.facing || '',
            furnishingStatus: r.furnishingStatus || '',
            possessionStatus: r.possessionStatus || '',
            bathrooms: r.bathrooms ? String(r.bathrooms) : '',
            balconies: r.balconies ? String(r.balconies) : '',
            superBuiltUpArea: r.superBuiltUpArea || '',
            amenities: amenitiesList,
          },
        };
        documentsToInsert.push(doc);
      } else if (moduleId === 'vehicles') {
        const brand = r.brand || r.make || '';
        const model = r.model || '';
        const price = r.price ? String(r.price).trim() : '';
        const city = r.city ? String(r.city).trim().toLowerCase() : 'bengaluru';

        if (!brand) {
          errors.push(`Row ${rowNum}: Brand is required`);
          continue;
        }
        if (!model) {
          errors.push(`Row ${rowNum}: Model is required`);
          continue;
        }
        if (!price) {
          errors.push(`Row ${rowNum}: Price is required`);
          continue;
        }

        const numPrice = parsePrice(price);
        const year = parseInt(r.year, 10) || new Date().getFullYear();
        const imagesList = r.images
          ? String(r.images).split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean)
          : [];

        const categoryVal = (r.category || '4-wheeler').toLowerCase();
        const validCategory = ['2-wheeler', '3-wheeler', '4-wheeler', 'commercial'].includes(categoryVal)
          ? categoryVal
          : '4-wheeler';

        const fuelVal = (r.fuelType || 'Petrol').trim();
        const validFuel = ['Petrol', 'Diesel', 'Electric', 'CNG'].find(
          (f) => f.toLowerCase() === fuelVal.toLowerCase()
        ) || 'Petrol';

        const doc = {
          title: r.title || `${brand} ${model} ${year}`,
          brand,
          make: brand,
          model,
          year,
          condition: (r.condition || 'old').toLowerCase() === 'new' ? 'new' : 'old',
          category: validCategory,
          wheelerType: validCategory,
          subcategory: r.subcategory || validCategory,
          fuelType: validFuel,
          transmission: r.transmission || 'Manual',
          kmDriven: parseInt(r.kmDriven, 10) || 0,
          price: price.startsWith('₹') ? price : `₹ ${price}`,
          priceValue: numPrice,
          location: r.location || r.area || city,
          city,
          pincode: r.pincode && /^\d{6}$/.test(String(r.pincode).trim()) ? String(r.pincode).trim() : '560001',
          description: r.description || `${brand} ${model} in good condition`,
          images: imagesList,
          status: 'pending', // ALWAYS PENDING
          createdBy: ownerId,
        };
        documentsToInsert.push(doc);
      } else if (moduleId === 'groceries') {
        const name = r.name || r.title || '';
        const price = r.price ? String(r.price).trim() : '';

        if (!name) {
          errors.push(`Row ${rowNum}: Product Name is required`);
          continue;
        }
        if (!price) {
          errors.push(`Row ${rowNum}: Price is required`);
          continue;
        }

        const imagesList = r.images
          ? String(r.images).split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean)
          : [];

        const doc = {
          name,
          category: r.category || 'Daily Essentials',
          subcategory: r.subcategory || '',
          price: price.startsWith('₹') ? price : `₹ ${price}`,
          numericPrice: parsePrice(price),
          unit: r.unit || 'kg',
          stock: parseInt(r.stock, 10) || 0,
          brand: r.brand || '',
          organic: String(r.organic).toLowerCase() === 'yes' || String(r.organic) === 'true',
          description: r.description || name,
          images: imagesList,
          status: 'pending', // ALWAYS PENDING
          createdBy: ownerId,
        };
        documentsToInsert.push(doc);
      } else if (moduleId === 'garments') {
        const name = r.name || r.title || '';
        const price = r.price ? String(r.price).trim() : '';

        if (!name) {
          errors.push(`Row ${rowNum}: Product Name is required`);
          continue;
        }
        if (!price) {
          errors.push(`Row ${rowNum}: Price is required`);
          continue;
        }

        const cat = (r.category || 'Unisex').trim();
        const validCat = ['Men', 'Women', 'Kids', 'Unisex'].find(
          (c) => c.toLowerCase() === cat.toLowerCase()
        ) || 'Unisex';

        const imagesList = r.images
          ? String(r.images).split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean)
          : [];

        const doc = {
          name,
          category: validCat,
          subcategory: r.subcategory || '',
          size: r.size || 'Free Size',
          color: r.color || '',
          material: r.material || '',
          price: price.startsWith('₹') ? price : `₹ ${price}`,
          numericPrice: parsePrice(price),
          quantity: parseInt(r.quantity, 10) || 1,
          brand: r.brand || '',
          gender: validCat.toLowerCase() === 'men' ? 'male' : (validCat.toLowerCase() === 'women' ? 'female' : 'unisex'),
          description: r.description || name,
          images: imagesList,
          status: 'pending', // ALWAYS PENDING
          createdBy: ownerId,
        };
        documentsToInsert.push(doc);
      } else if (moduleId === 'jewellery') {
        const name = r.name || r.title || '';
        const price = r.price ? String(r.price).trim() : '';
        const metalType = r.metalType || 'Gold';

        if (!name) {
          errors.push(`Row ${rowNum}: Jewellery Name / Title is required`);
          continue;
        }
        if (!price) {
          errors.push(`Row ${rowNum}: Price is required`);
          continue;
        }

        const imagesList = r.images
          ? String(r.images).split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean)
          : [];

        const doc = {
          title: name,
          name,
          metalType,
          purity: r.purity || '22K',
          weightGrams: parseFloat(r.weightGrams) || 0,
          price: price.startsWith('₹') ? price : `₹ ${price}`,
          numericPrice: parsePrice(price),
          makingCharges: r.makingCharges || '₹ 0',
          category: r.category || 'Jewellery',
          subcategory: r.subcategory || '',
          gender: r.gender || 'Women',
          certified: String(r.certified).toLowerCase() === 'yes',
          description: r.description || name,
          images: imagesList,
          status: 'pending', // ALWAYS PENDING
          createdBy: ownerId,
        };
        documentsToInsert.push(doc);
      }
    } catch (rowErr) {
      errors.push(`Row ${rowNum}: ${rowErr.message}`);
    }
  }

  if (documentsToInsert.length === 0) {
    throw new ApiError(
      400,
      `No valid products found to upload. ${errors.length > 0 ? 'Validation issues: ' + errors.join('; ') : 'Please verify your Excel file.'}`
    );
  }

  // 6. Insert documents into MongoDB
  const inserted = await mod.model.insertMany(documentsToInsert, { ordered: false });

  new ApiResponse(
    201,
    {
      totalRows: rawRows.length,
      insertedCount: inserted.length,
      failedCount: errors.length,
      errors: errors.slice(0, 20),
      category: selectedCategory,
      status: 'pending',
      items: inserted.map((i) => ({ _id: i._id, title: i.title || i.name, status: i.status })),
    },
    `Successfully uploaded ${inserted.length} product(s)! All items are in pending review status and will be reviewed by the admin.`
  ).send(res);
});
