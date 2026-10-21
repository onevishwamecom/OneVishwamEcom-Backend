require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const cp = require('child_process');
const path = require('path');
const mongoose = require('mongoose');
const Electronic = require('../modules/electronics/model');
const { parsePrice } = require('../utils/priceUtils');

const FRONTEND_DIR = path.join(__dirname, '..', '..', 'Vishwam-Frontend');

function getFallbackImages(item) {
  const cat = (item.category || '').toLowerCase();
  const title = (item.title || item.name || '').toLowerCase();

  if (cat.includes('air conditioner') || title.includes(' ac ') || title.includes('air conditioner') || title.includes('split ac')) {
    return [
      'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1585338107529-13afc5f02586?auto=format&fit=crop&w=1200&q=80',
    ];
  }
  if (cat.includes('television') || cat.includes('tv') || cat.includes('audio') || title.includes(' tv ') || title.includes('television') || title.includes('oled') || title.includes('qled') || title.includes('led')) {
    return [
      'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1577975882846-431adc8c2009?auto=format&fit=crop&w=1200&q=80',
    ];
  }
  if (cat.includes('refrigerator') || title.includes('refrigerator') || title.includes('fridge')) {
    return [
      'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?auto=format&fit=crop&w=1200&q=80',
    ];
  }
  if (cat.includes('washing') || title.includes('washing machine')) {
    return [
      'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?auto=format&fit=crop&w=1200&q=80',
    ];
  }
  if (cat.includes('microwave') || title.includes('microwave') || title.includes('oven')) {
    return [
      'https://images.unsplash.com/photo-1574269909862-7e1d70bb8078?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1585515320310-259814833e62?auto=format&fit=crop&w=1200&q=80',
    ];
  }
  if (cat.includes('chimney') || title.includes('chimney') || title.includes('hood') || title.includes('stove') || title.includes('hob')) {
    return [
      'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1507089947368-19c1da9775ae?auto=format&fit=crop&w=1200&q=80',
    ];
  }
  if (cat.includes('laptop') || title.includes('macbook') || title.includes('laptop') || title.includes('computer')) {
    return [
      'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?auto=format&fit=crop&w=1200&q=80',
    ];
  }
  if (cat.includes('phone') || title.includes('iphone') || title.includes('galaxy') || title.includes('smartphone')) {
    return [
      'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=1200&q=80',
    ];
  }
  return [
    'https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=1200&q=80',
  ];
}

async function main() {
  console.log('⚡ Starting Consumer Electronics Dump to MongoDB Atlas...');

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
    firebaseUid: lister.firebaseUid || '',
  };

  // 3. Extract dummyElectronics.js from git origin/StaticSite
  console.log('📥 Extracting dummyElectronics.js from origin/StaticSite...');
  const dummyFileContent = cp.execSync('git show origin/StaticSite:src/data/dummyElectronics.js', {
    cwd: FRONTEND_DIR,
    maxBuffer: 20 * 1024 * 1024,
  }).toString();

  const jsonString = dummyFileContent
    .replace(/^export\s+const\s+dummyElectronics\s*=\s*/m, '')
    .replace(/;\s*$/m, '')
    .trim();

  const items = JSON.parse(jsonString);
  console.log(`✅ Parsed ${items.length} electronic items from dummyElectronics.js`);

  // Clear existing items in electronics collection to avoid duplicates
  await Electronic.deleteMany({});
  console.log('🧹 Cleaned existing records in electronics collection');

  const documents = items.map((item, idx) => {
    const rawPrice = item.price ? String(item.price).trim() : '₹ 0';
    const numPrice = parsePrice(rawPrice);
    const imagesList = Array.isArray(item.images) && item.images.length > 0 ? item.images : getFallbackImages(item);
    const subcategory = item.category || 'Appliances & Gadgets';

    return {
      title: item.title || item.name || `${item.brand || ''} ${item.model || ''}`.trim() || `Electronic Product #${idx + 1}`,
      name: item.title || item.name || `${item.brand || ''} ${item.model || ''}`.trim(),
      brand: item.brand || 'Generic',
      model: item.model || item.title || '',
      category: 'Consumer Electronics',
      subcategory,
      condition: (item.condition || 'new').toLowerCase(),
      warranty: item.trustBannerText || item.priceNote || 'Official Brand Warranty',
      price: rawPrice.startsWith('₹') ? rawPrice : `₹ ${rawPrice}`,
      numericPrice: numPrice,
      priceValue: numPrice,
      priceSuffix: item.priceSuffix || '',
      priceNote: item.priceNote || '',
      location: item.location || 'Bengaluru',
      area: item.location?.split(',')?.[0]?.trim() || 'Indiranagar',
      city: 'bengaluru',
      pincode: item.pincode || '560038',
      description: item.description || item.subtitle || item.title,
      subtitle: item.subtitle || '',
      statusBadges: Array.isArray(item.statusBadges) ? item.statusBadges : [],
      cardPills: Array.isArray(item.cardPills) ? item.cardPills : [],
      keyAttributes: Array.isArray(item.keyAttributes) ? item.keyAttributes : [],
      overviewHighlights: Array.isArray(item.overviewHighlights) ? item.overviewHighlights : [],
      highlightBanner: item.highlightBanner || item.trustBannerText || '',
      trustBannerText: item.trustBannerText || '',
      loanApproved: Boolean(item.loanApproved),
      features: Array.isArray(item.features) ? item.features : [],
      specifications: Array.isArray(item.specifications) ? item.specifications : [],
      showroom: item.showroom || null,
      images: imagesList,
      status: 'approved',
      approvalStatus: 'approved',
      availabilityStatus: 'available',
      createdBy: lister._id,
      lister: lister._id,
      user: lister._id,
      contributor,
      origin: 'channel_partner_project',
    };
  });

  const inserted = await Electronic.insertMany(documents, { ordered: false });
  console.log(`🎉 Successfully inserted ${inserted.length} Consumer Electronics products into MongoDB Atlas under rakshitha0896@gmail.com!`);

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Dump failed:', err);
  process.exit(1);
});
