require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Jewellery = require('../modules/jewellery/model');

const jewellery = [
  {
    title: 'Classic Gold Necklace Set',
    name: 'Classic Gold Necklace Set',
    metalType: 'Gold',
    purity: '22K',
    weightGrams: 32.5,
    price: '₹ 1,85,000',
    numericPrice: 185000,
    makingCharges: '₹ 8,500',
    category: 'Gold',
    occasion: ['Wedding', 'Festival'],
    certified: true,
    certificationBody: 'BIS Hallmark',
    gender: 'Women',
    tryAtHome: true,
    aiRecommended: true,
    images: [
      'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80',
    ],
    store: { name: 'Vishwam Jewellers', city: 'Bangalore', pincode: '560001', address: 'Commercial Street, Bangalore - 560001', contactEmail: 'ceo@onevishwam.com' },
    status: 'active',
    featured: false,
  },
  {
    title: 'Elegant Diamond Pendant',
    name: 'Elegant Diamond Pendant',
    metalType: 'Diamond',
    purity: '18K',
    weightGrams: 4.2,
    price: '₹ 55,000',
    numericPrice: 55000,
    makingCharges: '₹ 3,200',
    category: 'Diamond',
    occasion: ['Engagement', 'Daily Wear'],
    certified: true,
    certificationBody: 'IGI',
    gender: 'Women',
    tryAtHome: true,
    aiRecommended: true,
    images: [
      'https://images.pexels.com/photos/20768279/pexels-photo-20768279.jpeg?auto=format&fit=crop&w=800&q=80',
    ],
    store: { name: 'Diamonds by Vishwam', city: 'Bangalore', pincode: '560001', address: 'MG Road, Bangalore - 560001', contactEmail: 'ceo@onevishwam.com' },
    status: 'active',
    featured: false,
  },
  {
    title: 'Silver Antique Bangles',
    name: 'Silver Antique Bangles',
    metalType: 'Silver',
    purity: '92.5%',
    weightGrams: 120,
    price: '₹ 18,000',
    numericPrice: 18000,
    makingCharges: '₹ 1,500',
    category: 'Silver',
    occasion: ['Festival', 'Daily Wear'],
    certified: true,
    certificationBody: 'BIS Hallmark',
    gender: 'Women',
    tryAtHome: false,
    aiRecommended: false,
    images: [
      'https://images.pexels.com/photos/7679824/pexels-photo-7679824.jpeg?auto=format&fit=crop&w=800&q=80',
    ],
    store: { name: 'Vishwam Jewellers', city: 'Mysore', pincode: '570001', address: 'Devaraja Market, Mysore - 570001', contactEmail: 'ceo@onevishwam.com' },
    status: 'active',
    featured: false,
  },
  {
    title: 'Platinum Wedding Band',
    name: 'Platinum Wedding Band',
    metalType: 'Platinum',
    purity: '950',
    weightGrams: 8.6,
    price: '₹ 95,000',
    numericPrice: 95000,
    makingCharges: '₹ 4,000',
    category: 'Platinum',
    occasion: ['Engagement', 'Wedding'],
    certified: true,
    certificationBody: 'SGL',
    gender: 'Men',
    tryAtHome: true,
    aiRecommended: true,
    images: [
      'https://images.pexels.com/photos/13292955/pexels-photo-13292955.jpeg?auto=format&fit=crop&w=800&q=80',
    ],
    store: { name: 'Platinum Gallery', city: 'Bangalore', pincode: '560038', address: 'Indiranagar, Bangalore - 560038', contactEmail: 'ceo@onevishwam.com' },
    status: 'active',
    featured: false,
  },
  {
    title: 'Gemstone Studded Ring',
    name: 'Gemstone Studded Ring',
    metalType: 'Gold',
    purity: '22K',
    weightGrams: 6.8,
    price: '₹ 32,000',
    numericPrice: 32000,
    makingCharges: '₹ 2,100',
    category: 'Gemstone',
    occasion: ['Anniversary', 'Gift'],
    certified: true,
    certificationBody: 'GIA',
    gender: 'Unisex',
    tryAtHome: true,
    aiRecommended: false,
    images: [
      'https://images.unsplash.com/photo-1608042314453-ae338d80c427?auto=format&fit=crop&w=800&q=80',
    ],
    store: { name: 'Vishwam Jewellers', city: 'Bangalore', pincode: '560011', address: 'Jayanagar, Bangalore - 560011', contactEmail: 'ceo@onevishwam.com' },
    status: 'active',
    featured: false,
  },
  {
    title: 'Bridal Gold Haram',
    name: 'Bridal Gold Haram',
    metalType: 'Gold',
    purity: '22K',
    weightGrams: 85,
    price: '₹ 4,80,000',
    numericPrice: 480000,
    makingCharges: '₹ 18,000',
    category: 'Bridal',
    occasion: ['Wedding'],
    certified: true,
    certificationBody: 'BIS Hallmark',
    gender: 'Women',
    tryAtHome: true,
    aiRecommended: true,
    images: [
      'https://images.pexels.com/photos/4889719/pexels-photo-4889719.jpeg?auto=format&fit=crop&w=800&q=80',
    ],
    store: { name: 'Vishwam Bridal Collection', city: 'Bangalore', pincode: '560003', address: 'Malleswaram, Bangalore - 560003', contactEmail: 'ceo@onevishwam.com' },
    status: 'active',
    featured: true,
  },
  {
    title: 'Antique Kundan Earrings',
    name: 'Antique Kundan Earrings',
    metalType: 'Gold',
    purity: '18K',
    weightGrams: 15.2,
    price: '₹ 42,000',
    numericPrice: 42000,
    makingCharges: '₹ 2,800',
    category: 'Antique',
    occasion: ['Wedding', 'Festive'],
    certified: false,
    certificationBody: '',
    gender: 'Women',
    tryAtHome: false,
    aiRecommended: false,
    images: [
      'https://images.pexels.com/photos/17368716/pexels-photo-17368716.jpeg?auto=format&fit=crop&w=800&q=80',
    ],
    store: { name: 'Heritage Jewels', city: 'Mysore', pincode: '570005', address: 'Chamrajpura, Mysore - 570005', contactEmail: 'ceo@onevishwam.com' },
    status: 'active',
    featured: false,
  },
  {
    title: 'Kids Gold Bracelet',
    name: 'Kids Gold Bracelet',
    metalType: 'Gold',
    purity: '14K',
    weightGrams: 3.2,
    price: '₹ 12,500',
    numericPrice: 12500,
    makingCharges: '₹ 800',
    category: 'Gold',
    occasion: ['Gift', 'Daily Wear'],
    certified: true,
    certificationBody: 'BIS Hallmark',
    gender: 'Kids',
    tryAtHome: false,
    aiRecommended: false,
    images: [
      'https://images.pexels.com/photos/34372550/pexels-photo-34372550.jpeg?auto=format&fit=crop&w=800&q=80',
    ],
    store: { name: 'Vishwam Jewellers', city: 'Bangalore', pincode: '560102', address: 'HSR Layout, Bangalore - 560102', contactEmail: 'ceo@onevishwam.com' },
    status: 'active',
    featured: false,
  },
];

async function seed() {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/onevishwam';
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    await Jewellery.deleteMany({});
    console.log('Cleared existing jewellery');

    const created = [];
    for (const data of jewellery) {
      const item = await Jewellery.create(data);
      created.push(item);
    }
    console.log(`Seeded ${created.length} jewellery items successfully`);

    const count = await Jewellery.countDocuments();
    console.log(`Total jewellery in DB: ${count}`);

    await mongoose.disconnect();
    console.log('Done. Disconnected from MongoDB.');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
}

seed();