require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Grocery = require('../modules/groceries/model');

const groceries = [
  {
    name: 'Organic Tomatoes',
    category: 'Fruits & Vegetables',
    subcategory: 'Vegetables',
    price: '₹ 40',
    numericPrice: 40,
    unit: 'kg',
    stock: 100,
    organic: true,
    brand: 'Green Leaf Farms',
    description: 'Farm-fresh organic red ripe juicy tomatoes harvested daily.',
    images: [
      'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'available',
  },
  {
    name: 'Basmati Rice Premium',
    category: 'Grains & Pulses',
    subcategory: 'Rice',
    price: '₹ 120',
    numericPrice: 120,
    unit: 'kg',
    stock: 250,
    organic: false,
    brand: 'Spice Mart Supermarket',
    description: 'Aromatic extra long grain premium royal aged Basmati rice.',
    images: [
      'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'available',
  },
  {
    name: 'Fresh Cow Milk',
    category: 'Dairy',
    subcategory: 'Milk',
    price: '₹ 56',
    numericPrice: 56,
    unit: 'litre',
    stock: 80,
    organic: true,
    brand: 'Nandini Dairy',
    description: 'Pure, pasteurized farm fresh cow milk with zero additives.',
    images: [
      'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'available',
  },
  {
    name: 'Organic Honey Pure',
    category: 'Packaged Foods',
    subcategory: 'Sweeteners',
    price: '₹ 320',
    numericPrice: 320,
    unit: '500g',
    stock: 50,
    organic: true,
    brand: 'Nature Choice',
    description: '100% raw unpasteurized natural forest wild flower honey.',
    images: [
      'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'available',
  },
  {
    name: 'Organic Whole Turmeric',
    category: 'Spices',
    subcategory: 'Spices',
    price: '₹ 85',
    numericPrice: 85,
    unit: '250g',
    stock: 120,
    organic: true,
    brand: 'Spice Valley',
    description: 'Curcumin-rich organic sun-dried whole turmeric roots.',
    images: [
      'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'available',
  },
  {
    name: 'Shimla Fresh Apples',
    category: 'Fruits & Vegetables',
    subcategory: 'Fruits',
    price: '₹ 180',
    numericPrice: 180,
    unit: 'kg',
    stock: 90,
    organic: false,
    brand: 'Fruit Paradise',
    description: 'Crisp, sweet and delicious mountain orchard hand-picked Shimla apples.',
    images: [
      'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'available',
  },
  {
    name: 'Toor Dal Organic',
    category: 'Grains & Pulses',
    subcategory: 'Pulses',
    price: '₹ 160',
    numericPrice: 160,
    unit: 'kg',
    stock: 140,
    organic: true,
    brand: 'Pure Farms',
    description: 'Unpolished protein-rich organic yellow pigeon peas.',
    images: [
      'https://images.unsplash.com/photo-1585994192701-f1a505c817ea?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'available',
  },
  {
    name: 'Pure Desi Ghee',
    category: 'Dairy',
    subcategory: 'Ghee',
    price: '₹ 650',
    numericPrice: 650,
    unit: '500ml',
    stock: 60,
    organic: true,
    brand: 'Vedic Dairy',
    description: 'Traditional bilona method cultured A2 cow ghee.',
    images: [
      'https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'available',
  },
];

async function seed() {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/onevishwam';
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    await Grocery.deleteMany({});
    console.log('Cleared existing groceries');

    const created = await Grocery.create(groceries);
    console.log(`Seeded ${created.length} groceries successfully`);

    await mongoose.disconnect();
    console.log('Done. Disconnected from MongoDB.');
    process.exit(0);
  } catch (err) {
    console.error('Seed groceries failed:', err.message);
    process.exit(1);
  }
}

seed();
