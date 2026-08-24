require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Garment = require('../modules/garments/model');

const garments = [
  {
    brand: 'Zudio',
    name: 'Slim Fit Cotton Shirt',
    category: 'Men',
    subcategory: 'Casuals',
    gender: 'male',
    material: 'Cotton',
    size: 'L',
    price: '₹ 799',
    numericPrice: 799,
    description: '100% pure breathable cotton slim fit shirt for everyday casual wear.',
    images: [
      'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'available',
  },
  {
    brand: 'Biba',
    name: 'Embroidered Silk Kurta Set',
    category: 'Women',
    subcategory: 'Ethnic Wear',
    gender: 'female',
    material: 'Silk',
    size: 'M',
    price: '₹ 3,150',
    numericPrice: 3150,
    description: 'Designer embroidered silk kurta with matching dupatta and pants.',
    images: [
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'available',
  },
  {
    brand: 'Dennis Lingo',
    name: 'Slim Fit Casual Blazer',
    category: 'Men',
    subcategory: 'Formals',
    gender: 'male',
    material: 'Polyester Blend',
    size: 'XL',
    price: '₹ 2,799',
    numericPrice: 2799,
    description: 'Modern single-breasted blazer perfect for business casual and parties.',
    images: [
      'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'available',
  },
  {
    brand: 'Fabindia',
    name: 'Handloom Cotton Saree',
    category: 'Women',
    subcategory: 'Ethnic Wear',
    gender: 'female',
    material: 'Handloom Cotton',
    size: 'Free Size',
    price: '₹ 2,490',
    numericPrice: 2490,
    description: 'Authentic handwoven Indian cotton saree with traditional border.',
    images: [
      'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'available',
  },
  {
    brand: 'Levis',
    name: '511 Slim Fit Denim Jeans',
    category: 'Men',
    subcategory: 'Casuals',
    gender: 'male',
    material: 'Denim',
    size: '32',
    price: '₹ 2,199',
    numericPrice: 2199,
    description: 'Classic durable stretch denim jeans in timeless dark blue wash.',
    images: [
      'https://images.unsplash.com/photo-1542272604-780c96856592?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'available',
  },
  {
    brand: 'Zara',
    name: 'Floral Print Midi Dress',
    category: 'Women',
    subcategory: 'Western',
    gender: 'female',
    material: 'Chiffon',
    size: 'S',
    price: '₹ 2,990',
    numericPrice: 2990,
    description: 'Lightweight flowy chiffon midi dress with elegant summer floral print.',
    images: [
      'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'available',
  },
  {
    brand: 'Puma',
    name: 'Active Training Tracksuit',
    category: 'Unisex',
    subcategory: 'Sportswear',
    gender: 'unisex',
    material: 'Polyester',
    size: 'L',
    price: '₹ 3,499',
    numericPrice: 3499,
    description: 'High-performance moisture-wicking athletic jacket and pants set.',
    images: [
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'available',
  },
  {
    brand: 'Gini & Jony',
    name: 'Kids Party Wear Set',
    category: 'Kids',
    subcategory: 'Party Wear',
    gender: 'unisex',
    material: 'Cotton',
    size: '6-7Y',
    price: '₹ 1,499',
    numericPrice: 1499,
    description: 'Comfortable and stylish premium cotton outfit for kids.',
    images: [
      'https://images.unsplash.com/photo-1622290291468-a28f7a7dc6a8?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'available',
  },
];

async function seed() {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/onevishwam';
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    await Garment.deleteMany({});
    console.log('Cleared existing garments');

    const created = await Garment.create(garments);
    console.log(`Seeded ${created.length} garments successfully`);

    await mongoose.disconnect();
    console.log('Done. Disconnected from MongoDB.');
    process.exit(0);
  } catch (err) {
    console.error('Seed garments failed:', err.message);
    process.exit(1);
  }
}

seed();
