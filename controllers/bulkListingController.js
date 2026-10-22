const xlsx = require('xlsx');
const mongoose = require('mongoose');
const modules = require('../modules');
const Property = require('../models/Property');
const BulkTemplateDownloadLog = require('../models/BulkTemplateDownloadLog');
const BulkUploadBatch = require('../models/BulkUploadBatch');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { parsePrice } = require('../utils/priceUtils');

const {
  CATEGORY_TO_MODULE,
  CATEGORY_CANONICAL_SLUG,
  normalizeCategory,
  findModule,
} = require('../config/constants');
const {
  validateFilenamePattern,
  normalizeRowKeys,
  mapHeaderToKey,
  normalizePropertyType,
  extractMultipartFileAndFields,
} = require('../services/bulkListingParser');


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

  // 3. Read Excel workbook and scan ALL sheets
  let workbook;
  try {
    workbook = xlsx.read(file.buffer, { type: 'buffer' });
  } catch (readErr) {
    throw new ApiError(400, `Failed to parse Excel file: ${readErr.message}`);
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new ApiError(400, 'Excel file contains no worksheets');
  }

  const allRowsWithSheet = [];
  const scannedSheets = [];
  const sheetBreakdown = {};

  for (const sName of workbook.SheetNames) {
    const lower = sName.toLowerCase().trim();
    // Skip non-data sheets (guidelines, instructions, readme)
    if (lower.includes('instruction') || lower.includes('guide') || lower.includes('readme')) {
      continue;
    }
    const ws = workbook.Sheets[sName];
    if (!ws) continue;
    const sheetRows = xlsx.utils.sheet_to_json(ws, { defval: '' });
    if (!sheetRows || sheetRows.length === 0) continue;

    let validRowsInSheet = 0;
    for (let rIdx = 0; rIdx < sheetRows.length; rIdx++) {
      const rawRow = sheetRows[rIdx];
      const vals = Object.values(rawRow).filter((v) => v !== '' && v !== null && v !== undefined);
      if (vals.length === 0) continue;

      // Filter out placeholder rows
      const titleCandidate = String(
        rawRow['Title*'] ||
          rawRow.Title ||
          rawRow.title ||
          rawRow['Product Name*'] ||
          rawRow['Item Name / Title*'] ||
          rawRow['Jewellery Name / Title*'] ||
          rawRow.Name ||
          rawRow.name ||
          ''
      );
      const priceCandidate = String(
        rawRow['Price (₹)*'] || rawRow['Price*'] || rawRow.Price || rawRow.price || ''
      );
      if (titleCandidate.toLowerCase().includes('sample') && priceCandidate.toLowerCase().includes('example')) {
        continue;
      }

      allRowsWithSheet.push({
        rawRow,
        sheetName: sName,
        rowNumberInSheet: rIdx + 2,
      });
      validRowsInSheet++;
    }

    if (validRowsInSheet > 0) {
      scannedSheets.push(sName);
      sheetBreakdown[sName] = validRowsInSheet;
    }
  }

  if (allRowsWithSheet.length === 0) {
    throw new ApiError(400, 'The uploaded Excel file contains no valid data rows across any worksheets');
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
    : (req.user?.name || 'Channel Partner');

  const defaultVendor = isOneVishwamUser
    ? 'One Vishwam'
    : (req.user?.name || 'Owner');

  const contributorName = req.user?.name || defaultVendor || 'Contributor';
  const contributorPhone = req.user?.phone || '';
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

  const mod = findModule(selectedCategory, false);
  if (!mod || !mod.model) {
    throw new ApiError(400, `Unsupported module for category: ${selectedCategory}`);
  }
  const moduleId = mod.id;
  const canonicalSlug = CATEGORY_CANONICAL_SLUG[moduleId] || moduleId;
  const batchTimestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
  const batchId = `BATCH_${canonicalSlug.toUpperCase()}_${batchTimestamp}_${randomPart}`;

  // 5. Transform and validate rows from all scanned sheets
  const documentsToInsert = [];
  const errors = [];

  let itemMediaMap = {};
  if (fields.itemMedia) {
    try {
      itemMediaMap = typeof fields.itemMedia === 'string' ? JSON.parse(fields.itemMedia) : fields.itemMedia;
    } catch (e) {
      console.warn('Failed to parse itemMedia from fields:', e);
    }
  }

  for (let i = 0; i < allRowsWithSheet.length; i++) {
    const item = allRowsWithSheet[i];
    const rawRow = item.rawRow;
    const sheetName = item.sheetName;
    const rowNum = `Sheet "${sheetName}" Row ${item.rowNumberInSheet}`;
    const r = normalizeRowKeys(rawRow);

    // Skip row if completely blank
    const values = Object.values(r).filter((v) => v !== '' && v !== null && v !== undefined);
    if (values.length === 0) continue;

    const clientMedia =
      itemMediaMap[i] ||
      itemMediaMap[String(i)] ||
      itemMediaMap[`${sheetName}_${item.rowNumberInSheet}`] ||
      {};

    try {
      if (moduleId === 'properties') {
        const title = r.title || r.name || '';
        const price = r.price ? String(r.price).trim() : '';
        const city = r.city ? String(r.city).trim().toLowerCase() : 'bengaluru';
        const propertyType = normalizePropertyType(r.propertyType, sheetName);
        const subcategory = r.subcategory || sheetName || propertyType;

        const projectName = r.projectName || r.apartmentName || '';
        const derivedTitle = title || projectName || (r.bhk ? `${r.bhk} in ${r.area || city}` : `${propertyType} in ${r.area || city}`);

        if (!derivedTitle && !projectName) {
          errors.push(`${rowNum}: Title or Property/Project Name is required`);
          continue;
        }
        if (!price) {
          errors.push(`${rowNum}: Price is required`);
          continue;
        }

        const numPrice = parsePrice(price);

        // Images: prioritize client uploaded Firebase URLs, fallback to row URLs (max 5 images)
        let imagesList = [];
        if (clientMedia.images && Array.isArray(clientMedia.images) && clientMedia.images.filter(Boolean).length > 0) {
          imagesList = clientMedia.images.filter(Boolean);
        } else {
          const discreteRowImages = [r.image1, r.image2, r.image3, r.image4, r.image5].filter(Boolean);
          if (discreteRowImages.length > 0) {
            imagesList = discreteRowImages;
          } else if (r.images) {
            imagesList = String(r.images).split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
          }
        }
        imagesList = imagesList.slice(0, 5);

        // Video: max 1 video (≤ 10MB)
        const videoUrl = clientMedia.video || clientMedia.videoUrl || r.video || r.videoUrl || '';

        // PDF: max 1 document (≤ 2MB)
        const pdfUrl = clientMedia.pdfUrl || clientMedia.brochure || r.pdfUrl || r.brochure || '';

        const amenitiesList = r.amenities
          ? String(r.amenities).split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean)
          : [];

        const doc = {
          title: derivedTitle,
          vendorName: r.vendorName || defaultVendor,
          channelPartnerName: defaultChannelPartner,
          propertyType,
          category: 'properties',
          subcategory,
          purpose: r.purpose || 'Sell',
          price: price.startsWith('₹') ? price : `₹ ${price}`,
          numericPrice: numPrice,
          priceSuffix: r.priceSuffix || r.negotiable || '',
          city,
          area: r.area || '',
          pincode: r.pincode ? String(r.pincode).trim() : '',
          address: r.address || `${r.area || ''}, ${city}`.trim(),
          description: r.description || `${propertyType} property in ${r.area || city}`,
          bankLoanDetails: r.bankLoanDetails || 'Available on request',
          loanApproved: Boolean(r.bankLoanDetails && !String(r.bankLoanDetails).toLowerCase().includes('no')),
          images: imagesList,
          videoUrl: videoUrl,
          pdfUrl: pdfUrl,
          brochure: pdfUrl,
          status: 'pending', // ALWAYS PENDING AS REQUIRED
          isBulkListing: true,
          bulkBatchId: batchId,
          bulkFilename: file.originalname,
          bulkUploadedAt: new Date(),
          createdBy: ownerId,
          origin: isOneVishwamUser ? 'in_house_project' : 'channel_partner_project',
          priority: isOneVishwamUser ? 1 : 0,
          isPriority: isOneVishwamUser,
          featured: isOneVishwamUser,
          contributor: contributorObj,
          details: {
            propertyName: projectName || derivedTitle,
            projectName: projectName,
            apartmentName: r.apartmentName || projectName,
            expectedPrice: price,
            bhk: r.bhk || '',
            facing: r.facing || '',
            furnishingStatus: r.furnishingStatus || '',
            possessionStatus: r.possessionStatus || '',
            bathrooms: r.bathrooms ? String(r.bathrooms) : '',
            balconies: r.balconies ? String(r.balconies) : '',
            superBuiltUpArea: r.superBuiltUpArea || '',
            carpetArea: r.carpetArea || '',
            builtUpArea: r.builtUpArea || '',
            plotArea: r.plotArea || r.totalLandArea || '',
            totalLandArea: r.totalLandArea || r.plotArea || '',
            plotDimensions: r.plotDimensions || r.dimensions || '',
            dimensions: r.dimensions || r.plotDimensions || '',
            totalLandExtent: r.totalLandExtent || '',
            surveyNumber: r.surveyNumber || '',
            landType: r.landType || '',
            roadAccessWidth: r.roadAccessWidth || '',
            roadFacingWidth: r.roadFacingWidth || '',
            approachRoadWidth: r.approachRoadWidth || '',
            waterAvailability: r.waterAvailability || '',
            electricityAvailable: r.electricityAvailable || '',
            currentCrop: r.currentCrop || '',
            soilType: r.soilType || '',
            farmhouseAvailable: r.farmhouseAvailable || '',
            fencingAvailable: r.fencingAvailable || '',
            expectedPricePerAcre: r.expectedPricePerAcre || '',
            commercialType: r.commercialType || '',
            industrialType: r.industrialType || '',
            plotType: r.plotType || '',
            washrooms: r.washrooms ? String(r.washrooms) : '',
            liftAvailable: r.liftAvailable || '',
            powerBackup: r.powerBackup || '',
            parkingCapacity: r.parkingCapacity || '',
            parkingAvailability: r.parkingAvailability || '',
            mainRoadFrontage: r.mainRoadFrontage || '',
            occupancyStatus: r.occupancyStatus || '',
            rentalIncome: r.rentalIncome || '',
            cornerPlot: r.cornerPlot || '',
            approvedLayout: r.approvedLayout || '',
            approvalAuthority: r.approvalAuthority || '',
            boundaryWall: r.boundaryWall || '',
            boundaryFencing: r.boundaryFencing || '',
            conversionStatus: r.conversionStatus || '',
            utilities: Array.isArray(r.utilities)
              ? r.utilities
              : (r.utilities ? String(r.utilities).split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean) : []),
            gatedCommunity: r.gatedCommunity || '',
            gardenTerrace: r.gardenTerrace || '',
            floors: r.floors || '',
            totalFloors: r.totalFloors || '',
            floor: r.floor || '',
            shedDimensions: r.shedDimensions || '',
            powerLoad: r.powerLoad || '',
            industrialZone: r.industrialZone || '',
            heavyVehicleAccess: r.heavyVehicleAccess || '',
            officeSpace: r.officeSpace || '',
            labourQuarters: r.labourQuarters || '',
            pollutionApproval: r.pollutionApproval || '',
            fireSafetyApproval: r.fireSafetyApproval || '',
            amenities: amenitiesList,
            negotiable: r.negotiable || r.priceSuffix || '',
            images: imagesList,
            videoUrl: videoUrl,
            pdfUrl: pdfUrl,
            brochure: pdfUrl,
          },
        };
        documentsToInsert.push(doc);
      } else if (moduleId === 'vehicles') {
        const brand = r.brand || r.make || '';
        const model = r.model || '';
        const price = r.price ? String(r.price).trim() : '';
        const city = r.city ? String(r.city).trim().toLowerCase() : 'bengaluru';

        if (!brand) {
          errors.push(`${rowNum}: Brand is required`);
          continue;
        }
        if (!model) {
          errors.push(`${rowNum}: Model is required`);
          continue;
        }
        if (!price) {
          errors.push(`${rowNum}: Price is required`);
          continue;
        }

        const numPrice = parsePrice(price);
        const year = parseInt(r.year, 10) || new Date().getFullYear();
        let imagesList = [];
        if (clientMedia.images && Array.isArray(clientMedia.images) && clientMedia.images.filter(Boolean).length > 0) {
          imagesList = clientMedia.images.filter(Boolean);
        } else {
          const discreteRowImages = [r.image1, r.image2, r.image3, r.image4, r.image5].filter(Boolean);
          if (discreteRowImages.length > 0) {
            imagesList = discreteRowImages;
          } else if (r.images) {
            imagesList = String(r.images).split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
          }
        }
        imagesList = imagesList.slice(0, 5);

        // Auto-detect wheeler category from sheetName if not provided
        let categoryVal = (r.category || '').toLowerCase();
        if (!categoryVal) {
          const sLower = sheetName.toLowerCase();
          if (sLower.includes('2-wheeler') || sLower.includes('bike')) categoryVal = '2-wheeler';
          else if (sLower.includes('commercial') || sLower.includes('3-wheeler')) categoryVal = 'commercial';
          else categoryVal = '4-wheeler';
        }
        const validCategory = ['2-wheeler', '3-wheeler', '4-wheeler', 'commercial'].includes(categoryVal)
          ? categoryVal
          : '4-wheeler';

        const fuelVal = (r.fuelType || 'Petrol').trim();
        const validFuel = ['Petrol', 'Diesel', 'Electric', 'CNG'].find(
          (f) => f.toLowerCase() === fuelVal.toLowerCase()
        ) || 'Petrol';

        const videoUrl = clientMedia.video || clientMedia.videoUrl || r.video || r.videoUrl || '';
        const pdfUrl = clientMedia.pdfUrl || clientMedia.brochure || r.pdfUrl || r.brochure || '';

        const doc = {
          title: r.title || `${brand} ${model} ${year}`,
          brand,
          make: brand,
          model,
          year,
          condition: (r.condition || 'old').toLowerCase() === 'new' ? 'new' : 'old',
          category: validCategory,
          wheelerType: validCategory,
          subcategory: r.subcategory || sheetName || validCategory,
          fuelType: validFuel,
          transmission: r.transmission || 'Manual',
          kmDriven: parseInt(r.kmDriven, 10) || 0,
          price: price.startsWith('₹') ? price : `₹ ${price}`,
          priceValue: numPrice,
          numericPrice: numPrice,
          location: r.location || r.area || city,
          city,
          pincode: r.pincode && /^\d{6}$/.test(String(r.pincode).trim()) ? String(r.pincode).trim() : '560001',
          description: r.description || `${brand} ${model} in good condition`,
          images: imagesList,
          videoUrl: videoUrl,
          pdfUrl: pdfUrl,
          brochure: pdfUrl,
          status: 'pending', // ALWAYS PENDING
          approvalStatus: 'pending',
          isBulkListing: true,
          bulkBatchId: batchId,
          bulkFilename: file.originalname,
          bulkUploadedAt: new Date(),
          createdBy: ownerId,
          lister: ownerId,
          user: ownerId,
          contributor: contributorObj,
          origin: isOneVishwamUser ? 'in_house_project' : 'channel_partner_project',
        };
        documentsToInsert.push(doc);
      } else if (moduleId === 'groceries') {
        const name = r.name || r.title || '';
        const price = r.price ? String(r.price).trim() : '';

        if (!name) {
          errors.push(`${rowNum}: Product Name is required`);
          continue;
        }
        if (!price) {
          errors.push(`${rowNum}: Price is required`);
          continue;
        }

        const discreteGroceryImages = [r.image1, r.image2, r.image3, r.image4, r.image5].filter(Boolean);
        let imagesList = [];
        if (clientMedia.images && Array.isArray(clientMedia.images) && clientMedia.images.filter(Boolean).length > 0) {
          imagesList = clientMedia.images.filter(Boolean);
        } else if (discreteGroceryImages.length > 0) {
          imagesList = discreteGroceryImages;
        } else if (r.images) {
          imagesList = String(r.images).split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
        }
        imagesList = imagesList.slice(0, 5);

        const doc = {
          name,
          category: r.category || sheetName || 'Daily Essentials',
          subcategory: r.subcategory || sheetName || '',
          price: price.startsWith('₹') ? price : `₹ ${price}`,
          numericPrice: parsePrice(price),
          unit: r.unit || 'kg',
          stock: parseInt(r.stock, 10) || 0,
          brand: r.brand || '',
          organic: String(r.organic).toLowerCase() === 'yes' || String(r.organic) === 'true',
          description: r.description || name,
          images: imagesList,
          status: 'pending', // ALWAYS PENDING
          isBulkListing: true,
          bulkBatchId: batchId,
          bulkFilename: file.originalname,
          bulkUploadedAt: new Date(),
          createdBy: ownerId,
        };
        documentsToInsert.push(doc);
      } else if (moduleId === 'garments') {
        const name = r.name || r.title || '';
        const price = r.price ? String(r.price).trim() : '';

        if (!name) {
          errors.push(`${rowNum}: Product Name is required`);
          continue;
        }
        if (!price) {
          errors.push(`${rowNum}: Price is required`);
          continue;
        }

        const cat = (r.category || sheetName || 'Unisex').trim();
        const validCat = ['Men', 'Women', 'Kids', 'Unisex'].find(
          (c) => c.toLowerCase() === cat.toLowerCase()
        ) || (cat.toLowerCase().includes('men') ? 'Men' : (cat.toLowerCase().includes('women') ? 'Women' : (cat.toLowerCase().includes('kid') ? 'Kids' : 'Unisex')));

        const discreteGarmentImages = [r.image1, r.image2, r.image3, r.image4, r.image5].filter(Boolean);
        let imagesList = [];
        if (clientMedia.images && Array.isArray(clientMedia.images) && clientMedia.images.filter(Boolean).length > 0) {
          imagesList = clientMedia.images.filter(Boolean);
        } else if (discreteGarmentImages.length > 0) {
          imagesList = discreteGarmentImages;
        } else if (r.images) {
          imagesList = String(r.images).split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
        }
        imagesList = imagesList.slice(0, 5);

        const doc = {
          name,
          category: validCat,
          subcategory: r.subcategory || sheetName || '',
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
          isBulkListing: true,
          bulkBatchId: batchId,
          bulkFilename: file.originalname,
          bulkUploadedAt: new Date(),
          createdBy: ownerId,
        };
        documentsToInsert.push(doc);
      } else if (moduleId === 'jewellery') {
        const name = r.name || r.title || '';
        const price = r.price ? String(r.price).trim() : '';
        const metalType = r.metalType || (sheetName.toLowerCase().includes('diamond') ? 'Diamond' : (sheetName.toLowerCase().includes('silver') ? 'Silver' : 'Gold'));

        if (!name) {
          errors.push(`${rowNum}: Jewellery Name / Title is required`);
          continue;
        }
        if (!price) {
          errors.push(`${rowNum}: Price is required`);
          continue;
        }

        const discreteJewelleryImages = [r.image1, r.image2, r.image3, r.image4, r.image5].filter(Boolean);
        let imagesList = [];
        if (clientMedia.images && Array.isArray(clientMedia.images) && clientMedia.images.filter(Boolean).length > 0) {
          imagesList = clientMedia.images.filter(Boolean);
        } else if (discreteJewelleryImages.length > 0) {
          imagesList = discreteJewelleryImages;
        } else if (r.images) {
          imagesList = String(r.images).split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
        }
        imagesList = imagesList.slice(0, 5);

        const doc = {
          title: name,
          name,
          metalType,
          purity: r.purity || (metalType === 'Gold' ? '22K' : (metalType === 'Silver' ? '925' : 'VVS1')),
          weightGrams: parseFloat(r.weightGrams) || 0,
          price: price.startsWith('₹') ? price : `₹ ${price}`,
          numericPrice: parsePrice(price),
          makingCharges: r.makingCharges || '₹ 0',
          category: r.category || 'Jewellery',
          subcategory: r.subcategory || sheetName || '',
          gender: r.gender || 'Women',
          certified: String(r.certified).toLowerCase() === 'yes',
          description: r.description || name,
          images: imagesList,
          status: 'pending', // ALWAYS PENDING
          isBulkListing: true,
          bulkBatchId: batchId,
          bulkFilename: file.originalname,
          bulkUploadedAt: new Date(),
          createdBy: ownerId,
        };
        documentsToInsert.push(doc);
      } else if (moduleId === 'electronics') {
        const title = r.title || r.name || '';
        const brand = r.brand || '';
        const model = r.model || '';
        const price = r.price ? String(r.price).trim() : '';

        if (!title && (!brand || !model)) {
          errors.push(`${rowNum}: Title or Brand & Model is required`);
          continue;
        }
        if (!price) {
          errors.push(`${rowNum}: Price is required`);
          continue;
        }

        const discreteImages = [r.image1, r.image2, r.image3, r.image4, r.image5].filter(Boolean);
        let imagesList = [];
        if (clientMedia.images && Array.isArray(clientMedia.images) && clientMedia.images.filter(Boolean).length > 0) {
          imagesList = clientMedia.images.filter(Boolean);
        } else if (discreteImages.length > 0) {
          imagesList = discreteImages;
        } else if (r.images) {
          imagesList = String(r.images).split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
        }
        imagesList = imagesList.slice(0, 5);

        const videoUrl = clientMedia.video || clientMedia.videoUrl || r.video || r.videoUrl || '';
        const pdfUrl = clientMedia.pdfUrl || clientMedia.brochure || r.pdfUrl || r.brochure || '';
        const finalTitle = title || `${brand} ${model}`.trim();
        const numPrice = parsePrice(price);

        const doc = {
          title: finalTitle,
          name: finalTitle,
          brand: brand || 'Generic',
          model: model || finalTitle,
          category: r.category || 'Consumer Electronics',
          subcategory: r.subcategory || sheetName || 'Electronics',
          condition: r.condition || 'Brand New Sealed',
          warranty: r.warranty || '1 Year Brand Warranty',
          price: price.startsWith('₹') ? price : `₹ ${price}`,
          numericPrice: numPrice,
          priceValue: numPrice,
          priceSuffix: r.priceSuffix || '',
          city: r.city ? String(r.city).trim().toLowerCase() : 'bengaluru',
          location: r.location || r.area || 'Bengaluru',
          description: r.description || `${finalTitle} with official warranty`,
          images: imagesList,
          videoUrl: videoUrl,
          pdfUrl: pdfUrl,
          brochure: pdfUrl,
          status: 'pending',
          approvalStatus: 'pending',
          isBulkListing: true,
          bulkBatchId: batchId,
          bulkFilename: file.originalname,
          bulkUploadedAt: new Date(),
          createdBy: ownerId,
          lister: ownerId,
          user: ownerId,
          contributor: contributorObj,
          origin: isOneVishwamUser ? 'in_house_project' : 'channel_partner_project',
        };
        documentsToInsert.push(doc);
      }
    } catch (rowErr) {
      errors.push(`${rowNum}: ${rowErr.message}`);
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

  // 7. Create BulkUploadBatch record
  const batchItems = inserted.map((i) => ({
    itemId: i._id,
    title: i.title || i.name || `${i.brand || ''} ${i.model || ''}`.trim() || 'Untitled',
    price: i.price || '',
    numericPrice: i.numericPrice || i.priceValue || 0,
    category: selectedCategory,
    subcategory: i.subcategory || i.propertyType || i.category || '',
    city: i.city || '',
    area: i.area || i.location || '',
    status: 'pending',
    images: Array.isArray(i.images) ? i.images.slice(0, 5) : [],
    video: i.videoUrl || i.video || '',
    pdfUrl: i.pdfUrl || i.brochure || '',
  }));

  let batchDoc = null;
  try {
    batchDoc = await BulkUploadBatch.create({
      batchId,
      filename: file.originalname,
      category: selectedCategory,
      itemCount: inserted.length,
      pendingCount: inserted.length,
      approvedCount: 0,
      rejectedCount: 0,
      listerId: ownerId,
      listerName: contributorName,
      listerEmail: userEmail,
      status: 'pending',
      items: batchItems,
    });
  } catch (batchErr) {
    console.error('Failed to create BulkUploadBatch document:', batchErr);
  }

  new ApiResponse(
    201,
    {
      batchId,
      batch: batchDoc,
      totalRows: allRowsWithSheet.length,
      scannedSheets,
      sheetBreakdown,
      insertedCount: inserted.length,
      failedCount: errors.length,
      errors: errors.slice(0, 20),
      category: selectedCategory,
      status: 'pending',
      items: inserted.map((i) => ({ _id: i._id, title: i.title || i.name, status: i.status })),
    },
    `Successfully uploaded ${inserted.length} product(s) across ${scannedSheets.length} sheet(s) into batch ${batchId}! All items are in pending review status.`
  ).send(res);
});

/**
 * POST /api/bulk-listing/download-log
 * Records a log whenever a lister downloads an official bulk listing template
 */
exports.recordTemplateDownloadLog = asyncHandler(async (req, res) => {
  const { category, filename, timestamp } = req.body;
  if (!category || !filename) {
    throw new ApiError(400, 'Category and filename are required');
  }

  const rawIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '';
  const ip = typeof rawIp === 'string' ? rawIp.split(',')[0].trim() : '';
  const userAgent = req.headers['user-agent'] || '';

  const listerId = req.auth?.id || req.user?._id || req.body.listerId || null;
  const listerName =
    req.user?.name ||
    req.user?.fullName ||
    req.auth?.name ||
    req.body.listerName ||
    (req.user?.email ? req.user.email.split('@')[0] : 'Lister');
  const listerEmail = (req.user?.email || req.auth?.email || req.body.listerEmail || '').toLowerCase();

  const log = await BulkTemplateDownloadLog.create({
    listerId,
    listerName,
    listerEmail,
    category: category.toLowerCase(),
    filename,
    timestamp: timestamp || '',
    ip,
    userAgent,
    downloadedAt: new Date(),
  });

  new ApiResponse(201, log, 'Template download logged successfully').send(res);
});

/**
 * GET /api/bulk-listing/download-logs
 * Retrieves audit log of all template downloads with pagination & category filtering (Admin)
 */
exports.getTemplateDownloadLogs = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.category && req.query.category !== 'all') {
    filter.category = req.query.category.toLowerCase();
  }
  if (req.query.search) {
    const term = req.query.search.trim();
    filter.$or = [
      { listerName: { $regex: term, $options: 'i' } },
      { listerEmail: { $regex: term, $options: 'i' } },
      { filename: { $regex: term, $options: 'i' } },
      { category: { $regex: term, $options: 'i' } },
    ];
  }

  const [total, logs] = await Promise.all([
    BulkTemplateDownloadLog.countDocuments(filter),
    BulkTemplateDownloadLog.find(filter).sort({ downloadedAt: -1 }).skip(skip).limit(limit).lean(),
  ]);

  new ApiResponse(
    200,
    {
      logs,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
      limit,
    },
    'Template download logs fetched successfully'
  ).send(res);
});

/**
 * GET /api/bulk-listing/batches
 * Fetches bulk upload batches (Lister sees their own; Admin sees all batches)
 */
exports.getBulkBatches = asyncHandler(async (req, res) => {
  const isAdmin = req.auth?.role === 'admin' || req.auth?.accountType === 'admin';
  const userEmail = (req.user?.email || req.auth?.email || '').toLowerCase();
  const ownerId = req.auth?.id || req.user?._id;

  const filter = {};
  if (!isAdmin) {
    const or = [];
    if (ownerId) or.push({ listerId: ownerId });
    if (userEmail) or.push({ listerEmail: userEmail });
    filter.$or = or.length ? or : [{ listerEmail: '__none__' }];
  }

  if (req.query.category && req.query.category !== 'all') {
    filter.category = req.query.category.toLowerCase();
  }
  if (req.query.status && req.query.status !== 'all') {
    filter.status = req.query.status;
  }

  const batches = await BulkUploadBatch.find(filter).sort({ createdAt: -1 }).lean();

  // Populate live items from module collections so updates/deletions are immediately reflected
  const enrichedBatches = await Promise.all(
    batches.map(async (b) => {
      const mod = findModule(b.category, false);
      if (mod && mod.model) {
        const liveItems = await mod.model
          .find({ bulkBatchId: b.batchId })
          .select('_id title name brand model price numericPrice priceValue category subcategory propertyType city area location status images createdAt description')
          .sort({ createdAt: -1 })
          .lean();

        if (liveItems && liveItems.length > 0) {
          const pending = liveItems.filter((i) => i.status === 'pending').length;
          const approved = liveItems.filter((i) => i.status === 'approved').length;
          const rejected = liveItems.filter((i) => i.status === 'rejected' || i.status === 'cancelled').length;

          return {
            ...b,
            itemCount: liveItems.length,
            pendingCount: pending,
            approvedCount: approved,
            rejectedCount: rejected,
            status:
              pending === 0 && approved > 0
                ? 'approved'
                : approved > 0 && pending > 0
                ? 'partially_approved'
                : rejected === liveItems.length
                ? 'rejected'
                : 'pending',
            items: liveItems.map((it) => ({
              itemId: it._id,
              _id: it._id,
              title: it.title || it.name || `${it.brand || ''} ${it.model || ''}`.trim() || 'Untitled',
              price: it.price || '',
              numericPrice: it.numericPrice || it.priceValue || 0,
              category: b.category,
              subcategory: it.subcategory || it.propertyType || it.category || '',
              city: it.city || '',
              area: it.area || it.location || '',
              status: it.status || 'pending',
              images: Array.isArray(it.images) ? it.images : [],
              description: it.description || '',
              createdAt: it.createdAt,
            })),
          };
        }
      }
      return b;
    })
  );

  new ApiResponse(200, enrichedBatches, 'Bulk batches retrieved successfully').send(res);
});

/**
 * GET /api/bulk-listing/batches/:batchId
 * Retrieves detailed info of a single bulk upload batch with all its items
 */
exports.getBulkBatchById = asyncHandler(async (req, res) => {
  const { batchId } = req.params;
  const batch = await BulkUploadBatch.findOne({ batchId }).lean();
  if (!batch) {
    throw new ApiError(404, 'Bulk upload batch not found');
  }

  const mod = findModule(batch.category, false);
  if (mod && mod.model) {
    const liveItems = await mod.model
      .find({ bulkBatchId: batch.batchId })
      .sort({ createdAt: -1 })
      .lean();

    batch.items = liveItems.map((it) => ({
      itemId: it._id,
      _id: it._id,
      title: it.title || it.name || `${it.brand || ''} ${it.model || ''}`.trim() || 'Untitled',
      price: it.price || '',
      numericPrice: it.numericPrice || it.priceValue || 0,
      category: batch.category,
      subcategory: it.subcategory || it.propertyType || it.category || '',
      city: it.city || '',
      area: it.area || it.location || '',
      status: it.status || 'pending',
      images: Array.isArray(it.images) ? it.images : [],
      description: it.description || '',
      raw: it,
      createdAt: it.createdAt,
    }));
    batch.itemCount = liveItems.length;
    batch.pendingCount = liveItems.filter((i) => i.status === 'pending').length;
    batch.approvedCount = liveItems.filter((i) => i.status === 'approved').length;
    batch.rejectedCount = liveItems.filter((i) => i.status === 'rejected' || i.status === 'cancelled').length;
  }

  new ApiResponse(200, batch, 'Batch details fetched successfully').send(res);
});

/**
 * POST /api/bulk-listing/batches/:batchId/items
 * Adds a new item directly into an existing batch in pending status
 */
exports.addItemToBatch = asyncHandler(async (req, res) => {
  const { batchId } = req.params;
  const batch = await BulkUploadBatch.findOne({ batchId });
  if (!batch) {
    throw new ApiError(404, 'Bulk upload batch not found');
  }

  const mod = findModule(batch.category, false);
  if (!mod || !mod.model) {
    throw new ApiError(400, 'Invalid category for this batch');
  }

  const { title, name, price, subcategory, city, area, location, description, images, brand, model } = req.body;
  const itemTitle = (title || name || `${brand || ''} ${model || ''}`.trim() || 'New Item').trim();
  const rawPrice = String(price || '0').trim();
  const numPrice = parsePrice(rawPrice);
  const formattedPrice = rawPrice.startsWith('₹') ? rawPrice : `₹ ${rawPrice}`;

  const ownerId = req.auth?.id || req.user?._id || batch.listerId;
  const userEmail = (req.user?.email || req.auth?.email || batch.listerEmail || '').toLowerCase();
  const isOneVishwamUser = userEmail === 'ceo@onevishwam.com' || userEmail.endsWith('@onevishwam.com');

  const contributorObj = {
    _id: ownerId,
    name: batch.listerName || req.user?.name || 'Contributor',
    email: userEmail,
    type: req.auth?.accountType || 'lister',
    createdAt: new Date(),
  };

  const imagesList = Array.isArray(images) ? images : (images ? [images] : []);

  const newDocData = {
    title: itemTitle,
    name: itemTitle,
    price: formattedPrice,
    numericPrice: numPrice,
    priceValue: numPrice,
    category: batch.category,
    subcategory: subcategory || 'General',
    city: city ? String(city).trim().toLowerCase() : 'bengaluru',
    area: area || location || '',
    location: area || location || city || '',
    description: description || itemTitle,
    images: imagesList,
    status: 'pending', // ALWAYS PENDING AS REQUIRED
    isBulkListing: true,
    bulkBatchId: batch.batchId,
    bulkFilename: batch.filename,
    bulkUploadedAt: new Date(),
    createdBy: ownerId,
    origin: isOneVishwamUser ? 'in_house_project' : 'channel_partner_project',
    contributor: contributorObj,
  };

  if (moduleId === 'properties') {
    newDocData.propertyType = normalizePropertyType(subcategory);
    newDocData.purpose = req.body.purpose || 'Sell';
    newDocData.vendorName = batch.listerName || 'Owner';
    newDocData.details = {
      propertyName: itemTitle,
      expectedPrice: formattedPrice,
      bhk: req.body.bhk || '',
      amenities: [],
    };
  } else if (moduleId === 'vehicles') {
    newDocData.brand = brand || itemTitle.split(' ')[0] || 'Brand';
    newDocData.model = model || itemTitle.split(' ').slice(1).join(' ') || 'Model';
    newDocData.year = parseInt(req.body.year, 10) || new Date().getFullYear();
    newDocData.condition = 'old';
    newDocData.fuelType = req.body.fuelType || 'Petrol';
    newDocData.wheelerType = '4-wheeler';
  } else if (moduleId === 'groceries') {
    newDocData.stock = parseInt(req.body.stock, 10) || 10;
    newDocData.unit = req.body.unit || 'kg';
  } else if (moduleId === 'garments') {
    newDocData.size = req.body.size || 'Free Size';
    newDocData.gender = 'unisex';
    newDocData.quantity = 1;
  } else if (moduleId === 'jewellery') {
    newDocData.metalType = req.body.metalType || 'Gold';
    newDocData.purity = req.body.purity || '22K';
    newDocData.weightGrams = parseFloat(req.body.weightGrams) || 1;
  } else if (moduleId === 'electronics') {
    newDocData.brand = brand || itemTitle.split(' ')[0] || 'Brand';
    newDocData.model = model || itemTitle.split(' ').slice(1).join(' ') || 'Model';
    newDocData.condition = req.body.condition || 'Brand New Sealed';
    newDocData.warranty = req.body.warranty || '1 Year Brand Warranty';
  }

  const createdDoc = await mod.model.create(newDocData);

  // Append to batch
  batch.items.push({
    itemId: createdDoc._id,
    title: itemTitle,
    price: formattedPrice,
    numericPrice: numPrice,
    category: batch.category,
    subcategory: subcategory || '',
    city: createdDoc.city || '',
    area: createdDoc.area || '',
    status: 'pending',
    images: imagesList,
  });
  batch.itemCount = batch.items.length;
  batch.pendingCount += 1;
  await batch.save();

  new ApiResponse(
    201,
    {
      item: createdDoc,
      batch,
    },
    'Item added to batch successfully in pending status'
  ).send(res);
});

/**
 * PUT /api/bulk-listing/batches/:batchId/items/:itemId
 * Edits details of an item within a batch (title, price, subcategory, location, etc.)
 */
exports.updateBatchItem = asyncHandler(async (req, res) => {
  const { batchId, itemId } = req.params;
  const batch = await BulkUploadBatch.findOne({ batchId });
  if (!batch) {
    throw new ApiError(404, 'Bulk upload batch not found');
  }

  const mod = findModule(batch.category, false);
  if (!mod || !mod.model) {
    throw new ApiError(400, 'Invalid category for this batch');
  }

  const product = await mod.model.findById(itemId);
  if (!product) {
    throw new ApiError(404, 'Item not found');
  }

  const isAdmin = req.auth?.role === 'admin' || req.auth?.accountType === 'admin';
  const updates = { ...req.body };

  if (updates.title) {
    product.title = updates.title;
    product.name = updates.title;
  }
  if (updates.name) {
    product.title = updates.name;
    product.name = updates.name;
  }
  if (updates.price) {
    const rawPrice = String(updates.price).trim();
    product.price = rawPrice.startsWith('₹') ? rawPrice : `₹ ${rawPrice}`;
    product.numericPrice = parsePrice(rawPrice);
    product.priceValue = parsePrice(rawPrice);
  }
  if (updates.city) product.city = String(updates.city).trim().toLowerCase();
  if (updates.area) product.area = updates.area;
  if (updates.location) {
    product.location = updates.location;
    product.area = updates.location;
  }
  if (updates.subcategory) {
    product.subcategory = updates.subcategory;
    if (moduleId === 'properties') product.propertyType = normalizePropertyType(updates.subcategory);
  }
  if (updates.description) product.description = updates.description;
  if (Array.isArray(updates.images)) product.images = updates.images;
  if (updates.video !== undefined) {
    product.video = updates.video;
    product.videoUrl = updates.video;
  } else if (updates.videoUrl !== undefined) {
    product.video = updates.videoUrl;
    product.videoUrl = updates.videoUrl;
  }
  if (updates.pdfUrl !== undefined) {
    product.pdfUrl = updates.pdfUrl;
    product.brochure = updates.pdfUrl;
  } else if (updates.brochure !== undefined) {
    product.pdfUrl = updates.brochure;
    product.brochure = updates.brochure;
  }

  // Status updates: Admin can approve/reject; if lister edits, status remains pending
  if (isAdmin && updates.status) {
    product.status = updates.status;
  } else if (!isAdmin) {
    product.status = 'pending';
  }

  product.updatedAt = new Date();
  await product.save();

  // Also update inside batch.items subdocument
  const itemIndex = batch.items.findIndex(
    (it) => String(it.itemId) === String(itemId) || String(it._id) === String(itemId)
  );
  if (itemIndex > -1) {
    if (updates.title || updates.name) batch.items[itemIndex].title = product.title || product.name;
    if (updates.price) {
      batch.items[itemIndex].price = product.price;
      batch.items[itemIndex].numericPrice = product.numericPrice;
    }
    if (updates.subcategory) batch.items[itemIndex].subcategory = product.subcategory;
    if (updates.city) batch.items[itemIndex].city = product.city;
    if (updates.area || updates.location) batch.items[itemIndex].area = product.area || product.location;
    if (updates.status) batch.items[itemIndex].status = product.status;
    if (Array.isArray(updates.images)) batch.items[itemIndex].images = product.images;
    if (updates.video !== undefined || updates.videoUrl !== undefined) {
      batch.items[itemIndex].video = product.video || product.videoUrl || '';
    }
    if (updates.pdfUrl !== undefined || updates.brochure !== undefined) {
      batch.items[itemIndex].pdfUrl = product.pdfUrl || product.brochure || '';
    }
    await batch.save();
  }

  new ApiResponse(
    200,
    {
      item: product,
      batch,
    },
    'Batch item updated successfully'
  ).send(res);
});

/**
 * DELETE /api/bulk-listing/batches/:batchId/items/:itemId
 * Deletes an item from the batch and from the product collection
 */
exports.deleteBatchItem = asyncHandler(async (req, res) => {
  const { batchId, itemId } = req.params;
  const batch = await BulkUploadBatch.findOne({ batchId });
  if (!batch) {
    throw new ApiError(404, 'Bulk upload batch not found');
  }

  const mod = findModule(batch.category, false);
  if (mod && mod.model) {
    await mod.model.findByIdAndDelete(itemId);
  }

  // Remove from batch.items
  batch.items = batch.items.filter(
    (it) => String(it.itemId) !== String(itemId) && String(it._id) !== String(itemId)
  );
  batch.itemCount = batch.items.length;
  batch.pendingCount = batch.items.filter((i) => i.status === 'pending').length;
  batch.approvedCount = batch.items.filter((i) => i.status === 'approved').length;
  batch.rejectedCount = batch.items.filter((i) => i.status === 'rejected' || i.status === 'cancelled').length;
  await batch.save();

  new ApiResponse(200, { batchId, itemId, remainingItems: batch.itemCount }, 'Item deleted from batch').send(res);
});

/**
 * DELETE /api/bulk-listing/batches/:batchId
 * Deletes an entire batch and all its uploaded products
 */
exports.deleteBatch = asyncHandler(async (req, res) => {
  const { batchId } = req.params;
  const batch = await BulkUploadBatch.findOne({ batchId });
  if (!batch) {
    throw new ApiError(404, 'Bulk upload batch not found');
  }

  const mod = findModule(batch.category, false);
  if (mod && mod.model) {
    await mod.model.deleteMany({ bulkBatchId: batchId });
  }

  await BulkUploadBatch.deleteOne({ batchId });

  new ApiResponse(200, { batchId }, 'Bulk upload batch and all its items deleted').send(res);
});

