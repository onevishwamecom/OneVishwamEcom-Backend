const ApiError = require('../utils/ApiError');
const {
  CATEGORY_CANONICAL_SLUG,
  normalizeCategory,
} = require('../config/constants');

/**
 * Validate that uploaded filename matches expected pattern:
 * <Categoryname>_bulklisting_<timestamp>.xlsx (e.g. properties_bulklisting_20261016_134522.xlsx)
 */
function validateFilenamePattern(filename, selectedCategory) {
  if (!filename || typeof filename !== 'string') {
    throw new ApiError(400, 'Invalid file: filename is missing');
  }

  const cleanName = filename.trim();
  const regex = /^([a-zA-Z0-9_-]+)_bulklisting_(\d{8}_\d{4,6})(?:\s*\(\d+\))?\.xlsx$/i;
  const match = cleanName.match(regex);

  if (!match) {
    const canonical =
      CATEGORY_CANONICAL_SLUG[selectedCategory?.toLowerCase()] ||
      CATEGORY_CANONICAL_SLUG[normalizeCategory(selectedCategory)] ||
      selectedCategory ||
      'category';
    throw new ApiError(
      400,
      `Invalid file name: "${cleanName}". The file name must match the downloaded template pattern: ${canonical}_bulklisting_YYYYMMDD_HHmmss.xlsx (e.g. ${canonical}_bulklisting_20261016_133000.xlsx).`
    );
  }

  const normFileModule = normalizeCategory(match[1]);
  const normSelectedModule = normalizeCategory(selectedCategory);

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
    const cleanKey = key
      .replace(/\*/g, '')
      .replace(/\(.*?\)/g, '')
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim()
      .toLowerCase();

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
    jewellerynametitle: 'title',
    description: 'description',
    category: 'category',
    subcategory: 'subcategory',
    price: 'price',
    pricetotal: 'price',
    expectedprice: 'price',
    pricesuffix: 'priceSuffix',
    city: 'city',
    citytaluk: 'city',
    area: 'area',
    locality: 'area',
    arealocality: 'area',
    villagelocality: 'area',
    areaindustrialestate: 'area',
    address: 'address',
    images: 'images',
    imageurls: 'images',
    imagesmax51mbeach: 'images',
    image1: 'image1',
    image2: 'image2',
    image3: 'image3',
    image4: 'image4',
    image5: 'image5',
    video: 'video',
    videourl: 'video',
    videomax110mb: 'video',
    pdf: 'pdfUrl',
    pdfurl: 'pdfUrl',
    pdfbrochure: 'pdfUrl',
    pdfbrochuremax12mb: 'pdfUrl',
    pdfbrochuremax2mb: 'pdfUrl',
    brochure: 'pdfUrl',
    brochureurl: 'pdfUrl',
    uploadmediaaction: 'uploadMediaAction',
    uploadmedia: 'uploadMediaAction',

    // Properties common & subcategory-specific
    propertytype: 'propertyType',
    purpose: 'purpose',
    bhk: 'bhk',
    bathrooms: 'bathrooms',
    balconies: 'balconies',
    superbuiltuparea: 'superBuiltUpArea',
    carpetarea: 'carpetArea',
    builtuparea: 'builtUpArea',
    plotarea: 'plotArea',
    plotdimensions: 'plotDimensions',
    dimensions: 'dimensions',
    dimensionsarea: 'dimensions',
    totallandextent: 'totalLandExtent',
    totallandarea: 'totalLandArea',
    shedbuiltuparea: 'shedDimensions',
    sheddimensions: 'shedDimensions',
    commercialtype: 'commercialType',
    industrialtype: 'industrialType',
    plottype: 'plotType',
    facing: 'facing',
    cornerplot: 'cornerPlot',
    approvedlayout: 'approvedLayout',
    approvalauthority: 'approvalAuthority',
    boundarywall: 'boundaryWall',
    boundarywallfencing: 'boundaryWall',
    boundaryfencing: 'boundaryFencing',
    conversionstatus: 'conversionStatus',
    utilitiesavailable: 'utilities',
    utilities: 'utilities',
    gatedcommunity: 'gatedCommunity',
    gardenterrace: 'gardenTerrace',
    floors: 'floors',
    floorsg1g2: 'floors',
    totalfloors: 'totalFloors',
    totalfloorstowers: 'totalFloors',
    totalfloorsfloorlevel: 'totalFloors',
    floor: 'floor',
    furnishingstatus: 'furnishingStatus',
    possessionstatus: 'possessionStatus',
    parking: 'parkingAvailability',
    parkingavailability: 'parkingAvailability',
    parkingcapacity: 'parkingCapacity',
    bankloanavailable: 'bankLoanDetails',
    bankloanapproved: 'bankLoanDetails',
    bankloandetails: 'bankLoanDetails',
    amenities: 'amenities',
    vendorname: 'vendorName',
    buildername: 'vendorName',
    projectname: 'projectName',
    projectapartmentname: 'projectName',
    apartmentname: 'apartmentName',
    housevillaname: 'apartmentName',
    layoutprojectname: 'projectName',
    propertyprojectname: 'projectName',
    negotiable: 'negotiable',
    pricepersqft: 'pricePerSqFt',
    priceperacre: 'expectedPricePerAcre',
    expectedpriceperacre: 'expectedPricePerAcre',
    mainroadfrontage: 'mainRoadFrontage',
    roadaccesswidth: 'roadAccessWidth',
    roadfacingwidth: 'roadFacingWidth',
    approachroadwidth: 'approachRoadWidth',
    washrooms: 'washrooms',
    liftavailable: 'liftAvailable',
    powerbackup: 'powerBackup',
    occupancystatus: 'occupancyStatus',
    rentalincome: 'rentalIncome',
    wateravailability: 'waterAvailability',
    electricityavailability: 'electricityAvailable',
    currentcropplantation: 'currentCrop',
    currentcrop: 'currentCrop',
    soiltype: 'soilType',
    fencingavailable: 'fencingAvailable',
    farmhouseavailable: 'farmhouseAvailable',
    surveynumber: 'surveyNumber',
    landtype: 'landType',
    powerload: 'powerLoad',
    industrialzone: 'industrialZone',
    industrialzonearea: 'industrialZone',
    heavyvehicleaccess: 'heavyVehicleAccess',
    heavyvehiclecontaineraccess: 'heavyVehicleAccess',
    officespace: 'officeSpace',
    officespaceavailable: 'officeSpace',
    labourquarters: 'labourQuarters',
    labourquartersavailable: 'labourQuarters',
    pollutionboardnocstatus: 'pollutionApproval',
    pollutionapproval: 'pollutionApproval',
    firesafetyapproval: 'fireSafetyApproval',

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
function normalizePropertyType(type, sheetName = '') {
  const combined = `${type || ''} ${sheetName || ''}`.trim().toLowerCase();
  if (combined.includes('flat') || combined.includes('apartment')) return 'Flat/Villa';
  if (
    combined.includes('independent') ||
    combined.includes('house') ||
    (combined.includes('villa') && !combined.includes('flat'))
  ) {
    return 'Independent House';
  }
  if (combined.includes('plot') || (combined.includes('land') && !combined.includes('agri'))) return 'Plot/Land';
  if (combined.includes('agri') || combined.includes('farm') || combined.includes('plantation')) return 'Agricultural';
  if (
    combined.includes('comm') ||
    combined.includes('office') ||
    combined.includes('shop') ||
    combined.includes('retail') ||
    combined.includes('showroom')
  ) {
    return 'Commercial';
  }
  if (
    combined.includes('indus') ||
    combined.includes('shed') ||
    combined.includes('factory') ||
    combined.includes('warehouse')
  ) {
    return 'Industrial';
  }
  if (combined.includes('layout') || combined.includes('residential')) return 'Residential';
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

module.exports = {
  validateFilenamePattern,
  normalizeRowKeys,
  mapHeaderToKey,
  normalizePropertyType,
  extractMultipartFileAndFields,
};
