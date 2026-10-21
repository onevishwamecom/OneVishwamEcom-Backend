require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Electronic = require('../modules/electronics/model');

const electronics = [
  {
    title: 'Sony Bravia XR 55" 4K OLED Smart TV (XR-55A80L)',
    name: 'Sony Bravia XR 55" 4K OLED Smart TV (XR-55A80L)',
    brand: 'Sony',
    model: 'XR-55A80L',
    category: 'Consumer Electronics',
    subcategory: 'Television & Home Audio',
    condition: 'Brand New Sealed',
    warranty: '2 Years Comprehensive Sony Warranty',
    price: '₹ 1,44,990',
    numericPrice: 144990,
    priceValue: 144990,
    priceSuffix: 'Inclusive of Taxes',
    city: 'bengaluru',
    location: 'Indiranagar, Bengaluru',
    area: 'Indiranagar',
    pincode: '560038',
    description: 'Cognitive Processor XR delivers pure OLED blacks and vibrant brightness. Features Acoustic Surface Audio+, Dolby Vision, 120Hz gaming support for PS5, and Google TV.',
    images: [
      'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1577975882846-431adc8c2009?auto=format&fit=crop&w=1200&q=80',
    ],
    status: 'approved',
    approvalStatus: 'approved',
    statusBadges: [{ label: 'Official Warranty', className: 'bg-emerald-600 text-white' }],
    cardPills: ['55" 4K OLED', 'Cognitive XR', '120Hz Gaming'],
    highlightBanner: 'Free Installation & Wall Mount Included',
    origin: 'in_house_project',
  },
  {
    title: 'Apple MacBook Pro 14" (M3 Pro, 18GB RAM, 512GB SSD) - Space Black',
    name: 'Apple MacBook Pro 14" (M3 Pro, 18GB RAM, 512GB SSD) - Space Black',
    brand: 'Apple',
    model: 'MacBook Pro 14" M3 Pro',
    category: 'Consumer Electronics',
    subcategory: 'Laptops & Computers',
    condition: 'Brand New Sealed',
    warranty: '1 Year Apple International Warranty + AppleCare Eligible',
    price: '₹ 1,99,900',
    numericPrice: 199900,
    priceValue: 199900,
    priceSuffix: 'MRP Incl. GST',
    city: 'bengaluru',
    location: 'Koramangala, Bengaluru',
    area: 'Koramangala',
    pincode: '560034',
    description: 'Powered by Apple M3 Pro chip with 11-core CPU and 14-core GPU. Liquid Retina XDR display with ProMotion 120Hz, up to 18 hours of battery life, MagSafe 3, and stunning Space Black anodized finish.',
    images: [
      'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?auto=format&fit=crop&w=1200&q=80',
    ],
    status: 'approved',
    approvalStatus: 'approved',
    statusBadges: [{ label: 'Apple Authorized', className: 'bg-blue-600 text-white' }],
    cardPills: ['M3 Pro Chip', '18GB Unified RAM', 'Liquid Retina XDR'],
    origin: 'in_house_project',
  },
  {
    title: 'Samsung Galaxy S24 Ultra 5G (12GB RAM, 256GB) - Titanium Gray',
    name: 'Samsung Galaxy S24 Ultra 5G (12GB RAM, 256GB) - Titanium Gray',
    brand: 'Samsung',
    model: 'Galaxy S24 Ultra',
    category: 'Consumer Electronics',
    subcategory: 'Smartphones & Tablets',
    condition: 'Brand New Sealed',
    warranty: '1 Year Samsung India Warranty',
    price: '₹ 1,29,999',
    numericPrice: 129999,
    priceValue: 129999,
    priceSuffix: 'Inclusive of Taxes',
    city: 'bengaluru',
    location: 'Whitefield, Bengaluru',
    area: 'Whitefield',
    pincode: '560066',
    description: 'Galaxy AI is here. Strong titanium frame, Corning Gorilla Armor anti-reflective display, 200MP camera with Quad Telephoto system, built-in S Pen, and Snapdragon 8 Gen 3 for Galaxy.',
    images: [
      'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=1200&q=80',
    ],
    status: 'approved',
    approvalStatus: 'approved',
    statusBadges: [{ label: 'Galaxy AI Enabled', className: 'bg-indigo-600 text-white' }],
    cardPills: ['Snapdragon 8 Gen 3', '200MP Camera', 'S Pen Included'],
    origin: 'in_house_project',
  },
  {
    title: 'LG C3 65" 4K Smart OLED evo TV (OLED65C3PSA)',
    name: 'LG C3 65" 4K Smart OLED evo TV (OLED65C3PSA)',
    brand: 'LG',
    model: 'OLED65C3PSA',
    category: 'Consumer Electronics',
    subcategory: 'Television & Home Audio',
    condition: 'Brand New Sealed',
    warranty: '3 Years LG Panel Warranty + 1 Year Comprehensive',
    price: '₹ 1,89,990',
    numericPrice: 189990,
    priceValue: 189990,
    priceSuffix: 'Inclusive of All Taxes',
    city: 'bengaluru',
    location: 'HSR Layout, Bengaluru',
    area: 'HSR Layout',
    pincode: '560102',
    description: 'Self-lit LG OLED evo with Brightness Booster. α9 AI Processor Gen6, Dolby Vision IQ and Dolby Atmos. 4x HDMI 2.1 ports with 0.1ms response time and G-Sync/FreeSync certification.',
    images: [
      'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=1200&q=80',
    ],
    status: 'approved',
    approvalStatus: 'approved',
    statusBadges: [{ label: '3-Year Panel Warranty', className: 'bg-emerald-600 text-white' }],
    cardPills: ['65" OLED evo', 'α9 Gen6 AI', 'HDMI 2.1 4K 120Hz'],
    origin: 'in_house_project',
  },
  {
    title: 'Apple iPhone 15 Pro Max (256GB) - Natural Titanium',
    name: 'Apple iPhone 15 Pro Max (256GB) - Natural Titanium',
    brand: 'Apple',
    model: 'iPhone 15 Pro Max',
    category: 'Consumer Electronics',
    subcategory: 'Smartphones & Tablets',
    condition: 'Brand New Sealed',
    warranty: '1 Year Apple Official Warranty',
    price: '₹ 1,48,900',
    numericPrice: 148900,
    priceValue: 148900,
    priceSuffix: 'MRP Incl. GST',
    city: 'bengaluru',
    location: 'MG Road, Bengaluru',
    area: 'MG Road',
    pincode: '560001',
    description: 'Forged in aerospace-grade titanium with textured matte glass back. Powered by A17 Pro chip with console-level gaming graphics. Custom Action button and 5x optical telephoto lens.',
    images: [
      'https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=1200&q=80',
    ],
    status: 'approved',
    approvalStatus: 'approved',
    statusBadges: [{ label: 'Apple Certified', className: 'bg-blue-600 text-white' }],
    cardPills: ['A17 Pro Bionic', '5x Telephoto', 'Titanium Design'],
    origin: 'in_house_project',
  },
];

async function seed() {
  try {
    const mongoUri = process.env.ATLAS_MONGODB_URI;
    if (!mongoUri) throw new Error('ATLAS_MONGODB_URI is required');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB Atlas');

    const existingCount = await Electronic.countDocuments();
    console.log(`Found ${existingCount} existing electronic products in collection.`);

    if (existingCount === 0) {
      await Electronic.insertMany(electronics);
      console.log(`✅ Seeded ${electronics.length} verified electronic listings into electronics collection.`);
    } else {
      console.log('Collection already populated; skipping duplicate seed.');
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
}

seed();
