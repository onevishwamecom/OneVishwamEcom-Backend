require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Property = require('../modules/properties/model');

const properties = [
  {
    title: 'The Wadhwa The Address',
    subtitle: '4 BHK Flat for Rent in White Field, Bangalore',
    description: 'This furnished 4-bedroom, 3-bathroom Flat in White Field presents a compelling rental option for those desiring a lifestyle of comfort and convenience, with a monthly rent of 3.75 Lac. Spanning 1500 sq ft.',
    location: 'White Field, Bangalore',
    city: 'bengaluru', area: 'Whitefield', zone: 'Whitefield',
    price: '₹ 3.75 L', priceSuffix: '/ Per Month',
    category: 'apartment', propertyType: 'Flat', purpose: 'Rent',
    bhk: '4 BHK', bedrooms: 4, bathrooms: '3 Bath',
    areaSize: 1500, areaUnit: 'Sq.Ft.', area: '1500 Sq.Ft.',
    furnishing: 'Furnished', floor: '20th of 20 Floors',
    parking: '2 Covered + 2 Open', extraRoom: 'Pooja Room',
    pincode: '560066', country: 'India', state: 'Karnataka',
    loanApproved: true, status: 'active',
    projectCount: 120, totalUnits: 120, availableUnits: 5,
    agent: {
      name: 'Vinay Manoj Gagat',
      type: 'SY EXPERT',
      avatar: 'https://ui-avatars.com/api/?name=Vinay+Manoj&background=0D8ABC&color=fff',
    },
    images: [
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1560185893-a55cbc8c57e8?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1560185007-cde436f6a4d0?auto=format&fit=crop&w=800&q=80',
    ],
  },
  {
    title: 'Platina 11F-BKC',
    subtitle: 'Commercial Office Space in White Field, Bangalore',
    description: 'Premium office space in the IT corridor with high-speed internet, power backup, and modern amenities suitable for large teams.',
    location: 'White Field, Bangalore',
    city: 'bengaluru', area: 'Whitefield', zone: 'Whitefield',
    price: '₹ 5.21 L', priceSuffix: '/ Per Month',
    category: 'commercial', propertyType: 'Office', purpose: 'Rent',
    bhk: 'Office Space', bedrooms: 0, bathrooms: '2 Washrooms',
    areaSize: 1186, areaUnit: 'Sq.Ft.', area: '1186 Sq.Ft.',
    furnishing: 'Furnished', floor: '11th of 15 Floors',
    parking: '3 Covered', extraRoom: 'Pantry',
    pincode: '560066', country: 'India', state: 'Karnataka',
    loanApproved: false, status: 'active',
    projectCount: 1, totalUnits: 50, availableUnits: 3,
    agent: {
      name: 'Regus',
      type: 'PRO AGENT',
      avatar: 'https://ui-avatars.com/api/?name=Regus&background=1D4ED8&color=fff',
    },
    images: [
      'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
    ],
  },
  {
    title: 'Serenity Villa',
    subtitle: '3 BHK Villa for Sale in Sarjapur Road, Bangalore',
    description: 'A beautifully designed independent villa with modern architecture, spacious rooms, and a private garden.',
    location: 'Sarjapur Road, Bangalore',
    city: 'bengaluru', area: 'Sarjapur Road', zone: 'JP Nagar',
    price: '₹ 1.20 Cr', priceSuffix: 'Contact for Price',
    category: 'villa', propertyType: 'Villa', purpose: 'Sell',
    bhk: '3 BHK', bedrooms: 3, bathrooms: '4 Bath',
    areaSize: 2400, areaUnit: 'Sq.Ft.', area: '2400 Sq.Ft.',
    furnishing: 'Semi-Furnished', floor: 'Ground + 1',
    parking: '2 Covered', extraRoom: 'Garden Area',
    pincode: '560035', country: 'India', state: 'Karnataka',
    loanApproved: true, status: 'active',
    projectCount: 24, totalUnits: 24, availableUnits: 2,
    agent: {
      name: 'Priya Sharma',
      type: 'VILLA EXPERT',
      avatar: 'https://ui-avatars.com/api/?name=Priya+Sharma&background=8B5CF6&color=fff',
    },
    images: [
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=800&q=80',
    ],
  },
  {
    title: 'Greenfield Enclave',
    subtitle: '2 BHK Flat for Rent in HSR Layout, Bangalore',
    description: 'Well-ventilated 2 BHK apartment in a prime HSR Layout location. Close to metro station, restaurants, and shopping complexes.',
    location: 'HSR Layout, Bangalore',
    city: 'bengaluru', area: 'HSR Layout', zone: 'HSR Layout',
    price: '₹ 55 K', priceSuffix: '/ Per Month',
    category: 'apartment', propertyType: 'Flat', purpose: 'Rent',
    bhk: '2 BHK', bedrooms: 2, bathrooms: '2 Bath',
    areaSize: 1100, areaUnit: 'Sq.Ft.', area: '1100 Sq.Ft.',
    furnishing: 'Semi-Furnished', floor: '5th of 8 Floors',
    parking: '1 Covered', extraRoom: 'Balcony',
    pincode: '560102', country: 'India', state: 'Karnataka',
    loanApproved: false, status: 'active',
    projectCount: 200, totalUnits: 200, availableUnits: 8,
    agent: {
      name: 'Ankit Verma',
      type: 'RENTAL EXPERT',
      avatar: 'https://ui-avatars.com/api/?name=Ankit+Verma&background=F59E0B&color=fff',
    },
    images: [
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1560185893-a55cbc8c57e8?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1560185007-cde436f6a4d0?auto=format&fit=crop&w=800&q=80',
    ],
  },
  {
    title: 'The Imperial Penthouse',
    subtitle: '4 BHK Penthouse for Sale in Indiranagar, Bangalore',
    description: 'Luxurious 4 BHK penthouse offering breathtaking panoramic views of the Bangalore skyline.',
    location: 'Indiranagar, Bangalore',
    city: 'bengaluru', area: 'Indiranagar', zone: 'Indiranagar',
    price: '₹ 8.50 Cr', priceSuffix: 'Negotiable',
    category: 'apartment', propertyType: 'Penthouse', purpose: 'Sell',
    bhk: '4 BHK', bedrooms: 4, bathrooms: '5 Bath',
    areaSize: 3200, areaUnit: 'Sq.Ft.', area: '3200 Sq.Ft.',
    furnishing: 'Fully Furnished', floor: '35th of 36 Floors',
    parking: '3 Covered', extraRoom: 'Sea View Deck',
    pincode: '560038', country: 'India', state: 'Karnataka',
    loanApproved: true, status: 'active',
    projectCount: 1, totalUnits: 1, availableUnits: 1,
    agent: {
      name: 'Aditya Roy',
      type: 'LUXURY EXPERT',
      avatar: 'https://ui-avatars.com/api/?name=Aditya+Roy&background=EF4444&color=fff',
    },
    images: [
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1600573472550-8090b5e0745e?auto=format&fit=crop&w=800&q=80',
    ],
  },
  {
    title: 'CP High Street Plaza',
    subtitle: 'Commercial Shop for Rent in MG Road, Bangalore',
    description: 'Prime retail space in the heart of MG Road, one of Bangalore\'s most prestigious commercial addresses.',
    location: 'MG Road, Bangalore',
    city: 'bengaluru', area: 'MG Road', zone: 'MG Road',
    price: '₹ 2.80 L', priceSuffix: '/ Per Month',
    category: 'commercial', propertyType: 'Shop', purpose: 'Rent',
    bhk: 'Commercial Shop', bedrooms: 0, bathrooms: '1 Washroom',
    areaSize: 450, areaUnit: 'Sq.Ft.', area: '450 Sq.Ft.',
    furnishing: 'Unfurnished', floor: 'Ground Floor',
    parking: 'N/A', extraRoom: 'Storage Room',
    pincode: '560001', country: 'India', state: 'Karnataka',
    loanApproved: false, status: 'inactive',
    projectCount: 1, totalUnits: 15, availableUnits: 0,
    agent: {
      name: 'Deepak Mehta',
      type: 'COMMERCIAL EXPERT',
      avatar: 'https://ui-avatars.com/api/?name=Deepak+Mehta&background=6366F1&color=fff',
    },
    images: [
      'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1442850473887-0fb77cd0b337?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1560179707-f14e90ef3623?auto=format&fit=crop&w=800&q=80',
    ],
  },
  {
    title: 'Green Valley Agricultural Land',
    subtitle: 'Agricultural Land for Sale in Sarjapur Road, Bangalore',
    description: 'Prime agricultural land spread across 5 acres on Sarjapur Road. Fertile soil with existing borewell and drip irrigation setup.',
    location: 'Sarjapur Road, Bangalore',
    city: 'bengaluru', area: 'Sarjapur Road', zone: 'Sarjapur Road',
    price: '₹ 2.40 Cr', priceSuffix: 'Negotiable',
    category: 'land', propertyType: 'Agricultural Land', purpose: 'Sell',
    bhk: 'N/A', bedrooms: 0, bathrooms: 'N/A',
    areaSize: 5, areaUnit: 'Acre', area: '5 Acre',
    furnishing: 'N/A', floor: 'N/A',
    parking: 'Open', extraRoom: 'Borewell',
    pincode: '560035', country: 'India', state: 'Karnataka',
    loanApproved: true, status: 'active',
    projectCount: 1, totalUnits: 5, availableUnits: 5,
    agent: {
      name: 'Ravi Kumar',
      type: 'LAND EXPERT',
      avatar: 'https://ui-avatars.com/api/?name=Ravi+Kumar&background=22C55E&color=fff',
    },
    images: [
      'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1500076656116-558758c991c1?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1472162072942-cd5147eb3902?auto=format&fit=crop&w=800&q=80',
    ],
  },
  {
    title: 'North Bangalore Development Plot',
    subtitle: 'Development Plot for Sale in Yelahanka, Bangalore',
    description: 'Corner development plot in Yelahanka\'s fastest-growing corridor. 2.5 acres with road access on two sides.',
    location: 'Yelahanka, Bangalore',
    city: 'bengaluru', area: 'Yelahanka', zone: 'Yelahanka',
    price: '₹ 1.85 Cr', priceSuffix: 'Per Acre',
    category: 'land', propertyType: 'Plot', purpose: 'Sell',
    bhk: 'N/A', bedrooms: 0, bathrooms: 'N/A',
    areaSize: 2.5, areaUnit: 'Acre', area: '2.5 Acre',
    furnishing: 'N/A', floor: 'N/A',
    parking: 'Open', extraRoom: 'Corner Plot',
    pincode: '560064', country: 'India', state: 'Karnataka',
    loanApproved: true, status: 'active',
    projectCount: 1, totalUnits: 1, availableUnits: 1,
    agent: {
      name: 'Suresh Patel',
      type: 'LAND EXPERT',
      avatar: 'https://ui-avatars.com/api/?name=Suresh+Patel&background=16A34A&color=fff',
    },
    images: [
      'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=80',
    ],
  },
  {
    title: 'Riverside Farmhouse',
    subtitle: '4 BHK Farmhouse for Sale in Yelahanka, Bangalore',
    description: 'Sprawling farmhouse on 2 acres of land with a private garden, mango orchard, swimming pool, and guest house.',
    location: 'Yelahanka, Bangalore',
    city: 'bengaluru', area: 'Yelahanka', zone: 'Yelahanka',
    price: '₹ 3.50 Cr', priceSuffix: 'Onwards',
    category: 'villa', propertyType: 'Farmhouse', purpose: 'Sell',
    bhk: '4 BHK', bedrooms: 4, bathrooms: '3 Bath',
    areaSize: 2, areaUnit: 'Acre', area: '2 Acre',
    furnishing: 'Unfurnished', floor: 'Ground',
    parking: '4 Open', extraRoom: 'Pool',
    pincode: '560064', country: 'India', state: 'Karnataka',
    loanApproved: false, status: 'active',
    projectCount: 1, totalUnits: 1, availableUnits: 0,
    agent: {
      name: 'Neha Joshi',
      type: 'FARM EXPERT',
      avatar: 'https://ui-avatars.com/api/?name=Neha+Joshi&background=EC4899&color=fff',
    },
    images: [
      'https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=800&q=80',
    ],
  },
];

async function seed() {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/onevishwam';
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    await Property.deleteMany({});
    console.log('Cleared existing properties');

    const created = [];
    for (const data of properties) {
      const prop = await Property.create(data);
      created.push(prop);
    }
    console.log(`Seeded ${created.length} properties successfully`);

    const count = await Property.countDocuments();
    console.log(`Total properties in DB: ${count}`);

    await mongoose.disconnect();
    console.log('Done. Disconnected from MongoDB.');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
}

seed();
