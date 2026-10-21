require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const cp = require('child_process');
const path = require('path');
const mongoose = require('mongoose');
const { createRequire } = require('module');

const FRONTEND_DIR = path.join(__dirname, '..', '..', 'Vishwam-Frontend');
const feRequire = createRequire(path.join(FRONTEND_DIR, 'package.json'));
const { initializeApp } = feRequire('firebase/app');
const { getStorage, ref, uploadBytes, getDownloadURL } = feRequire('firebase/storage');

const Bedding = require('../modules/bedding/model');
const { parsePrice } = require('../utils/priceUtils');

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'AIzaSyDTJdsA9aZEC35Pol7RYb3sHSoxDOKnnPQ',
  authDomain: 'onevishwam.firebaseapp.com',
  projectId: process.env.FB_PROJECT_ID || 'onevishwam',
  storageBucket: process.env.STORAGE_BUCKET || 'onevishwam.firebasestorage.app',
};

async function run() {
  console.log('🛏️ Starting Bedding & Sleep Comfort Dump with Firebase Storage Images...');

  const mongoUri = process.env.ATLAS_MONGODB_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI or ATLAS_MONGODB_URI is not set in environment or .env');
    process.exit(1);
  }

  // 1. Connect to MongoDB
  console.log('🔄 Connecting to MongoDB Atlas...');
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });
  console.log('✅ Connected to MongoDB Atlas');

  // 2. Resolve Lister Account: rakshitha0896@gmail.com
  let lister = await mongoose.connection.collection('listers').findOne({ email: 'rakshitha0896@gmail.com' });
  if (!lister) {
    lister = await mongoose.connection.collection('users').findOne({ email: 'rakshitha0896@gmail.com' });
  }

  const listerId = lister ? lister._id : new mongoose.Types.ObjectId('6ac87ee1fff40c7e9e1d9db6');
  const contributorData = {
    _id: listerId,
    id: listerId,
    name: lister?.name || 'swathi',
    email: 'rakshitha0896@gmail.com',
    contact: lister?.phone || '918546996622',
    phone: lister?.phone || '918546996622',
    city: lister?.city || 'Bengaluru',
    type: 'lister',
    firebaseUid: lister?.firebaseUid || 'T6aQdU80Z1g8CYbUgXhHALTSmZj1',
  };

  console.log(`👤 Using Lister: ${contributorData.name} (${contributorData.email}) [${listerId}]`);

  // 3. Initialize Firebase Storage
  const fbApp = initializeApp(firebaseConfig);
  const storage = getStorage(fbApp);
  console.log(`✅ Initialized Firebase Storage [Bucket: ${firebaseConfig.storageBucket}]`);

  // 4. Extract dummyBedding.js from git origin/StaticSite
  console.log('📥 Extracting dummyBedding.js from origin/StaticSite...');
  const dummyFileContent = cp.execSync('git show origin/StaticSite:src/data/dummyBedding.js', {
    cwd: FRONTEND_DIR,
    maxBuffer: 10 * 1024 * 1024,
  }).toString();

  const imports = [...dummyFileContent.matchAll(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"];/g)];
  console.log(`Found ${imports.length} image imports in dummyBedding.js`);

  const varDeclarations = imports
    .map((m) => `const ${m[1]} = "${m[2].replace('../assets/', 'src/assets/')}";`)
    .join('\n');

  const transformed = varDeclarations + '\n' + dummyFileContent
    .replace(/import\s+.*?;/g, '')
    .replace(/export\s+const\s+dummyBedding\s*=/, 'const dummyBedding =') + '\nmodule.exports = dummyBedding;';

  const tmpModulePath = path.join(__dirname, 'temp_dummy_bedding.cjs');
  require('fs').writeFileSync(tmpModulePath, transformed);
  const rawItems = require(tmpModulePath);
  require('fs').unlinkSync(tmpModulePath);

  console.log(`✅ Parsed ${rawItems.length} bedding items from dummyBedding.js`);

  // 5. Upload images to Firebase Storage
  const uploadedUrls = {};

  const documentsToInsert = [];

  for (let idx = 0; idx < rawItems.length; idx++) {
    const item = rawItems[idx];
    const itemTitle = item.title || item.model || `Bedding ${idx + 1}`;
    console.log(`\n🛏️ [${idx + 1}/${rawItems.length}] Processing: ${item.brand} - ${itemTitle}`);

    const firebaseUrlList = [];

    const rawImageList = Array.isArray(item.images) ? item.images : [];
    for (let imgIdx = 0; imgIdx < rawImageList.length; imgIdx++) {
      const imgPath = rawImageList[imgIdx];
      if (!imgPath || typeof imgPath !== 'string') continue;

      if (imgPath.startsWith('http://') || imgPath.startsWith('https://')) {
        firebaseUrlList.push(imgPath);
        continue;
      }

      if (uploadedUrls[imgPath]) {
        firebaseUrlList.push(uploadedUrls[imgPath]);
        continue;
      }

      try {
        console.log(`   Uploading image [${imgIdx + 1}/${rawImageList.length}]: ${imgPath}`);
        const imageBuffer = cp.execSync(`git show origin/StaticSite:"${imgPath}"`, {
          cwd: FRONTEND_DIR,
          encoding: 'buffer',
          maxBuffer: 25 * 1024 * 1024,
        });

        const ext = path.extname(imgPath).toLowerCase();
        const contentType = ext === '.png' ? 'image/png' : (ext === '.webp' ? 'image/webp' : 'image/jpeg');
        const filename = path.basename(imgPath);
        const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `bedding/${safeFilename}`;
        const storageRef = ref(storage, storagePath);

        await uploadBytes(storageRef, imageBuffer, { contentType });
        const downloadUrl = await getDownloadURL(storageRef);

        console.log(`   ✅ Uploaded -> ${downloadUrl}`);
        uploadedUrls[imgPath] = downloadUrl;
        firebaseUrlList.push(downloadUrl);
      } catch (uploadErr) {
        console.warn(`   ⚠️ Failed to upload image "${imgPath}":`, uploadErr.message);
      }
    }

    const rawPrice = item.price || '₹ 8,009';
    const numPrice = parsePrice(rawPrice) || 8009;

    documentsToInsert.push({
      title: item.title || item.name || item.model,
      name: item.title || item.name || item.model,
      brand: item.brand || 'Peps',
      model: item.model || item.title,
      category: 'Bedding & Sleep Comfort',
      subcategory: item.category || 'Mattresses',
      condition: item.condition || 'new',
      warranty: item.warranty || '10-Year Brand Warranty',
      price: rawPrice,
      numericPrice: numPrice,
      priceValue: numPrice,
      priceType: 'fixed',
      priceSuffix: item.priceSuffix || '(Inclusive of all taxes)',
      priceNote: item.priceNote || '',
      description: item.description || `Authentic ${item.brand || 'Peps'} ${item.title || 'Bedding Product'}. Direct Factory Warranty.`,
      statusBadges: Array.isArray(item.statusBadges) ? item.statusBadges : [{ label: 'Verified', variant: 'green' }],
      cardPills: Array.isArray(item.cardPills) && item.cardPills.length > 0 ? item.cardPills : ['10-Year Warranty', 'Authentic Brand'],
      keyAttributes: Array.isArray(item.keyAttributes) ? item.keyAttributes : [],
      overviewHighlights: Array.isArray(item.overviewHighlights) ? item.overviewHighlights : [],
      variants: Array.isArray(item.variants) ? item.variants : [],
      specifications: Array.isArray(item.specifications) ? item.specifications : [],
      features: Array.isArray(item.features) ? item.features : ['Direct Brand Warranty', 'Doorstep Delivery Available'],
      highlightBanner: item.highlightBanner || null,
      trustBannerText: item.trustBannerText || '100% Brand Genuine & Direct Factory Warranty',
      loanApproved: Boolean(item.loanApproved !== false),
      images: firebaseUrlList.slice(0, 5),
      videoUrl: '',
      documents: [],
      pdfUrl: '',
      brochure: '',
      location: item.location || 'Indiranagar Flagship Lounge, Bangalore',
      area: 'Indiranagar',
      city: 'bengaluru',
      state: 'Karnataka',
      pincode: item.pincode || '560038',
      showroom: item.showroom || {
        name: 'Peps Great Sleep Store',
        phone: '8546996622',
        email: 'ceo@onevishwam.com',
        type: 'Official Experience Lounge',
      },
      status: 'approved',
      approvalStatus: 'approved',
      availabilityStatus: 'available',
      createdBy: listerId,
      lister: listerId,
      user: listerId,
      contributor: contributorData,
      origin: 'channel_partner_project',
      isBulkListing: false,
    });
  }

  // 6. Reset & insert into MongoDB Atlas
  console.log(`\n🧹 Replacing existing bedding documents with complete Firebase Storage images...`);
  await Bedding.deleteMany({});
  const result = await Bedding.insertMany(documentsToInsert);
  console.log(`🎉 Successfully inserted ${result.length} bedding items with Firebase Storage URLs!`);

  const count = await Bedding.countDocuments();
  console.log(`📊 Total documents now in 'beddings': ${count}`);

  await mongoose.disconnect();
  console.log('🔌 Disconnected from MongoDB');
}

run().catch((err) => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
