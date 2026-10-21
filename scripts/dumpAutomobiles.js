require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const cp = require('child_process');
const path = require('path');
const mongoose = require('mongoose');
const crypto = require('crypto');
const { createRequire } = require('module');

const FRONTEND_DIR = path.join(__dirname, '..', '..', 'Vishwam-Frontend');
const feRequire = createRequire(path.join(FRONTEND_DIR, 'package.json'));
const { initializeApp } = feRequire('firebase/app');
const { getStorage, ref, uploadBytes, getDownloadURL } = feRequire('firebase/storage');
const Vehicle = require('../modules/vehicles/model');
const { parsePrice } = require('../utils/priceUtils');

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyDTJdsA9aZEC35Pol7RYb3sHSoxDOKnnPQ",
  authDomain: "onevishwam.firebaseapp.com",
  projectId: process.env.FB_PROJECT_ID || "onevishwam",
  storageBucket: process.env.STORAGE_BUCKET || "onevishwam.firebasestorage.app",
};

async function main() {
  console.log('🚗 Starting Automobile Dump to MongoDB & Firebase Storage...');

  // 1. Connect to MongoDB
  const mongoUri = process.env.ATLAS_MONGODB_URI;
  if (!mongoUri) throw new Error('ATLAS_MONGODB_URI is missing in .env');
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB Atlas');

  // 2. Find target Lister account: rakshitha0896@gmail.com
  const lister = await mongoose.connection.db.collection('listers').findOne({ email: 'rakshitha0896@gmail.com' });
  if (!lister) {
    throw new Error('Could not find lister account for rakshitha0896@gmail.com in listers collection');
  }
  console.log(`✅ Found target account: ${lister.name} (${lister.email}) [ID: ${lister._id}]`);

  const contributor = {
    _id: lister._id,
    id: lister._id,
    name: lister.name || 'Swathi',
    email: lister.email,
    contact: lister.phone || '918546996622',
    phone: lister.phone || '918546996622',
    city: lister.city || 'Bengaluru',
    type: 'lister',
    firebaseUid: lister.firebaseUid || 'T6aQdU80Z1g8CYbUgXhHALTSmZj1',
  };

  // 3. Initialize Firebase Client Storage
  const fbApp = initializeApp(firebaseConfig);
  const storage = getStorage(fbApp);
  console.log(`✅ Initialized Firebase Storage [Bucket: ${firebaseConfig.storageBucket}]`);

  // 4. Extract dummyAutomobiles.js from git origin/StaticSite
  console.log('📥 Extracting dummyAutomobiles.js from origin/StaticSite...');
  const dummyFileContent = cp.execSync('git show origin/StaticSite:src/data/dummyAutomobiles.js', {
    cwd: FRONTEND_DIR,
    maxBuffer: 10 * 1024 * 1024,
  }).toString();

  const imports = [...dummyFileContent.matchAll(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"];/g)];
  const varDeclarations = imports.map(m => `const ${m[1]} = "${m[2].replace('../assets/', 'src/assets/')}";`).join('\n');

  const transformed = varDeclarations + '\n' + dummyFileContent
    .replace(/import\s+.*?;/g, '')
    .replace(/export\s+const\s+dummyAutomobiles\s*=/, 'const dummyAutomobiles =') + '\nmodule.exports = dummyAutomobiles;';

  const tmpModulePath = path.join(__dirname, 'temp_dummy_automobiles.cjs');
  require('fs').writeFileSync(tmpModulePath, transformed);
  const rawAutomobiles = require(tmpModulePath);
  require('fs').unlinkSync(tmpModulePath);

  console.log(`✅ Extracted ${rawAutomobiles.length} automobile templates from StaticSite`);

  // Cache to avoid re-uploading identical images if run again
  const uploadedUrls = {};

  // 5. Process each automobile
  for (let idx = 0; idx < rawAutomobiles.length; idx++) {
    const item = rawAutomobiles[idx];
    console.log(`\n🚙 [${idx + 1}/${rawAutomobiles.length}] Processing: ${item.brand} ${item.model} (${item.title})`);

    const firebaseUrlList = [];

    for (let imgIdx = 0; imgIdx < (item.images || []).length; imgIdx++) {
      const gitPath = item.images[imgIdx]; // e.g. src/assets/automobiles/swift/1.png
      if (uploadedUrls[gitPath]) {
        firebaseUrlList.push(uploadedUrls[gitPath]);
        continue;
      }

      console.log(`   Uploading image [${imgIdx + 1}/${item.images.length}]: ${gitPath}`);
      const imageBuffer = cp.execSync(`git show origin/StaticSite:${gitPath}`, {
        cwd: FRONTEND_DIR,
        encoding: 'buffer',
        maxBuffer: 20 * 1024 * 1024,
      });

      const ext = path.extname(gitPath).toLowerCase();
      const contentType = ext === '.png' ? 'image/png' : (ext === '.webp' ? 'image/webp' : 'image/jpeg');
      const filename = path.basename(gitPath);
      const modelFolder = path.basename(path.dirname(gitPath));

      const storagePath = `automobiles/${modelFolder}/${filename}`;
      const storageRef = ref(storage, storagePath);

      await uploadBytes(storageRef, imageBuffer, {
        contentType,
      });

      const downloadUrl = await getDownloadURL(storageRef);

      console.log(`   Uploaded -> ${downloadUrl}`);
      uploadedUrls[gitPath] = downloadUrl;
      firebaseUrlList.push(downloadUrl);
    }

    // Compute numerical price
    const parsedPriceVal = parsePrice(item.price);

    // Build complete vehicle document maintaining exact dummy JSON structure
    const vehicleDoc = {
      ...item,
      images: firebaseUrlList,
      priceValue: parsedPriceVal,
      numericPrice: parsedPriceVal,
      city: 'bengaluru',
      state: 'Karnataka',
      status: 'approved',
      approvalStatus: 'approved',
      availabilityStatus: 'available',
      featured: true,
      loanApproved: true,
      createdBy: lister._id,
      lister: lister._id,
      user: lister._id,
      listerId: lister.phone || String(lister._id),
      contactEmail: lister.email,
      contributor,
      origin: 'in_house_project',
      listedDate: new Date(),
    };

    // Upsert into vehicles collection
    const result = await Vehicle.findOneAndUpdate(
      { brand: item.brand, model: item.model },
      { $set: vehicleDoc },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log(`   ✅ Saved to MongoDB vehicles collection! [_id: ${result._id}]`);
  }

  // 6. Verification
  console.log('\n🔍 Verifying vehicles in database...');
  const count = await Vehicle.countDocuments({ createdBy: lister._id });
  const totalInDb = await Vehicle.countDocuments();
  console.log(`✅ Total vehicles in MongoDB: ${totalInDb}`);
  console.log(`✅ Vehicles owned by ${lister.email}: ${count}`);

  const sample = await Vehicle.findOne({ 'contributor.email': 'rakshitha0896@gmail.com' });
  console.log('\nSample Saved Vehicle:');
  console.log({
    _id: sample._id,
    title: sample.title,
    brand: sample.brand,
    model: sample.model,
    price: sample.price,
    numericPrice: sample.numericPrice,
    imagesCount: sample.images?.length,
    firstImage: sample.images?.[0],
    variantsCount: sample.variants?.length,
    status: sample.status,
    contributor: sample.contributor?.email,
  });

  await mongoose.disconnect();
  console.log('\n🎉 Automobile dump and Firebase upload finished successfully!');
}

main().catch((err) => {
  console.error('❌ Error during automobile dump:', err);
  process.exit(1);
});
