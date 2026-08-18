require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Vehicle = require('../modules/vehicles/model');
const connectDB = require('../config/db');

const AUTOMOBILES = [
  {
    id: 1,
    brand: 'Maruti Suzuki',
    model: 'Brezza',
    year: 2026,
    condition: 'new',
    category: '4-wheeler',
    wheelerType: '4-wheeler',
    fuelType: 'Petrol',
    price: '₹ 7.40 Lakh',
    kmDriven: 0,
    location: 'Bangalore',
    showroom: {
      name: 'Maruti Suzuki Arena',
      address: 'No. 12, Hosur Road, Electronic City, Bangalore - 560100',
      phone: '9364862542',
      mapsLink: 'https://maps.google.com/?q=Maruti+Suzuki+Arena+Electronic+City+Bangalore',
    },
    loanApproved: true,
    featured: true,
    variants: 19,
    pincode: '560100',
    images: [
      'https://imgd.aeplcdn.com/1920x1080/n/cw/ec/212741/2026-brezza-exterior-right-front-three-quarter.jpeg?isig=0&q=80',
      'https://imgd.aeplcdn.com/1920x1080/n/cw/ec/212741/2026-brezza-exterior-right-side-view.jpeg?isig=0&q=80',
    ],
  },
  {
    id: 2,
    brand: 'Hyundai',
    model: 'Verna',
    year: 2026,
    condition: 'new',
    category: '4-wheeler',
    wheelerType: '4-wheeler',
    fuelType: 'Petrol',
    price: '₹ 10.99 Lakh',
    kmDriven: 0,
    location: 'Bangalore',
    showroom: {
      name: 'Hyundai Star Motors',
      address: '45, Outer Ring Road, Marathahalli, Bangalore - 560037',
      phone: '9364862542',
      mapsLink: 'https://maps.google.com/?q=Hyundai+Showroom+Marathahalli+Bangalore',
    },
    loanApproved: true,
    featured: true,
    variants: 33,
    pincode: '560037',
    images: [
      'https://imgd.aeplcdn.com/1920x1080/n/cw/ec/204398/verna-exterior-right-front-three-quarter.png?isig=0&q=80',
      'https://imgd.aeplcdn.com/1920x1080/n/cw/ec/204398/verna-exterior-left-side-view.jpeg?isig=0&q=80',
    ],
  },
  {
    id: 3,
    brand: 'Tata Motors',
    model: 'Nexon',
    year: 2025,
    condition: 'new',
    category: '4-wheeler',
    wheelerType: '4-wheeler',
    fuelType: 'Petrol',
    price: '₹ 7.40 Lakh',
    kmDriven: 0,
    location: 'Mysore',
    showroom: {
      name: 'Tata Motors Passenger Cars',
      address: '78, Mysore-Bangalore Road, Vijayanagar, Mysore - 570017',
      phone: '9364862542',
      mapsLink: 'https://maps.google.com/?q=Tata+Motors+Mysore+Vijayanagar',
    },
    loanApproved: true,
    featured: true,
    variants: 82,
    pincode: '570017',
    images: [
      'https://imgd.aeplcdn.com/1920x1080/n/cw/ec/141867/nexon-exterior-right-front-three-quarter-79.png?isig=0&q=80',
      'https://imgd.aeplcdn.com/1920x1080/n/cw/ec/141867/nexon-facelift-exterior-front-view.jpeg?isig=0&q=80',
    ],
  },
  {
    id: 4,
    brand: 'Tata Motors',
    model: 'Altroz',
    year: 2025,
    condition: 'new',
    category: '4-wheeler',
    wheelerType: '4-wheeler',
    fuelType: 'Petrol',
    price: '₹ 6.30 Lakh',
    kmDriven: 0,
    location: 'Hubli',
    showroom: {
      name: 'Tata Motors Passenger Cars',
      address: 'Plot 22, Vidyanagar, Hubli - 580031',
      phone: '9364862542',
      mapsLink: 'https://maps.google.com/?q=Tata+Motors+Hubli+Vidyanagar',
    },
    loanApproved: true,
    featured: false,
    variants: 27,
    pincode: '580031',
    images: [
      'https://imgd.aeplcdn.com/1920x1080/n/cw/ec/199863/altroz-exterior-right-front-three-quarter-13.png?isig=0&q=80',
      'https://imgd.aeplcdn.com/1920x1080/n/cw/ec/199863/altroz-facelift-exterior-left-front-three-quarter-5.jpeg?isig=0&q=80',
    ],
  },
  {
    id: 5,
    brand: 'Hyundai',
    model: 'i20',
    year: 2023,
    condition: 'new',
    category: '4-wheeler',
    wheelerType: '4-wheeler',
    fuelType: 'Petrol',
    price: '₹ 6.00 Lakh',
    kmDriven: 0,
    location: 'Mangalore',
    showroom: {
      name: 'Hyundai Motor Zone',
      address: '10, Falnir Road, Kodialbail, Mangalore - 575003',
      phone: '9364862542',
      mapsLink: 'https://maps.google.com/?q=Hyundai+Showroom+Falnir+Road+Mangalore',
    },
    loanApproved: true,
    featured: false,
    variants: 15,
    pincode: '575003',
    images: [
      'https://imgd.aeplcdn.com/1920x1080/n/cw/ec/150603/i20-exterior-right-front-three-quarter-13.png?isig=0&q=80',
      'https://imgd.aeplcdn.com/1920x1080/n/cw/ec/150603/i20-exterior-right-side-view.jpeg?isig=0&q=80',
    ],
  },
  {
    id: 6,
    brand: 'Tata Motors',
    model: 'Punch',
    year: 2026,
    condition: 'new',
    category: '4-wheeler',
    wheelerType: '4-wheeler',
    fuelType: 'Petrol',
    price: '₹ 5.70 Lakh',
    kmDriven: 0,
    location: 'Bangalore',
    showroom: {
      name: 'Tata Motors Passenger Cars',
      address: '99, Bannerghatta Road, JP Nagar, Bangalore - 560078',
      phone: '9364862542',
      mapsLink: 'https://maps.google.com/?q=Tata+Motors+JP+Nagar+Bangalore',
    },
    loanApproved: true,
    featured: true,
    variants: 26,
    pincode: '560078',
    images: [
      'https://imgd.aeplcdn.com/1920x1080/n/cw/ec/172825/punch-exterior-right-front-three-quarter-250.png?isig=0&q=80',
      'https://imgd.aeplcdn.com/1920x1080/n/cw/ec/172825/punch-facelift-exterior-front-view.jpeg?isig=0&q=80',
    ],
  },
  {
    id: 7,
    brand: 'Hyundai',
    model: 'Exter',
    year: 2026,
    condition: 'new',
    category: '4-wheeler',
    wheelerType: '4-wheeler',
    fuelType: 'Petrol',
    price: '₹ 5.81 Lakh',
    kmDriven: 0,
    location: 'Mysore',
    showroom: {
      name: 'Hyundai Prime Motors',
      address: '55, Bogadi Road, Vijayanagar, Mysore - 570012',
      phone: '9364862542',
      mapsLink: 'https://maps.google.com/?q=Hyundai+Showroom+Bogadi+Road+Mysore',
    },
    loanApproved: true,
    featured: false,
    variants: 32,
    pincode: '570012',
    images: [
      'https://imgd.aeplcdn.com/1920x1080/n/cw/ec/216807/exter-exterior-right-front-three-quarter.png?isig=0&q=80',
      'https://imgd.aeplcdn.com/1920x1080/n/cw/ec/216807/exter-exterior-right-side-view.jpeg?isig=0&q=80',
    ],
  },
  {
    id: 8,
    brand: 'Maruti Suzuki',
    model: 'Fronx',
    year: 2023,
    condition: 'new',
    category: '4-wheeler',
    wheelerType: '4-wheeler',
    fuelType: 'Petrol',
    price: '₹ 6.85 Lakh',
    kmDriven: 0,
    location: 'Bangalore',
    showroom: {
      name: 'Maruti Suzuki NEXA',
      address: '32, Sarjapur Road, Bellandur, Bangalore - 560103',
      phone: '9364862542',
      mapsLink: 'https://maps.google.com/?q=Maruti+NEXA+Sarjapur+Road+Bangalore',
    },
    loanApproved: true,
    featured: true,
    variants: 14,
    pincode: '560103',
    images: [
      'https://imgd.aeplcdn.com/1920x1080/n/cw/ec/130591/fronx-exterior-right-front-three-quarter-109.png?isig=0&q=80',
      'https://imgd.aeplcdn.com/1920x1080/n/cw/ec/130591/fronx-exterior-right-side-view-2.jpeg?isig=0&q=80',
    ],
  },
];

function parsePriceToNumber(priceStr) {
  if (!priceStr) return 0;
  const cleaned = String(priceStr).replace(/₹/g, '').trim();
  const lakhMatch = cleaned.match(/^([\d.]+)\s*Lakh/i);
  if (lakhMatch) return Math.round(parseFloat(lakhMatch[1]) * 100000);
  const croreMatch = cleaned.match(/^([\d.]+)\s*Cr/i);
  if (croreMatch) return Math.round(parseFloat(croreMatch[1]) * 10000000);
  const num = parseFloat(cleaned.replace(/[^\d.]/g, ''));
  return isNaN(num) ? 0 : Math.round(num);
}

function toVehicle(doc) {
  return {
    brand: doc.brand,
    make: doc.brand,
    model: doc.model,
    title: `${doc.brand} ${doc.model}`.trim(),
    year: doc.year,
    condition: doc.condition,
    category: doc.category,
    wheelerType: (doc.wheelerType || doc.category || '').toLowerCase(),
    fuelType: doc.fuelType,
    price: doc.price,
    priceValue: parsePriceToNumber(doc.price),
    kmDriven: doc.kmDriven || 0,
    location: doc.location,
    city: String(doc.location || '').toLowerCase(),
    pincode: doc.pincode,
    showroom: doc.showroom || null,
    loanApproved: doc.loanApproved || false,
    featured: doc.featured || false,
    variants: doc.variants || 1,
    images: doc.images || [],
    listedBy: 'Dealer',
    status: 'active',
  };
}

async function seed() {
  try {
    await connectDB();
    console.log('MongoDB connected');

    const brands = [...new Set(AUTOMOBILES.map((d) => d.brand))];
    const models = [...new Set(AUTOMOBILES.map((d) => d.model))];
    await Vehicle.deleteMany({ brand: { $in: brands } });
    console.log(`Cleared prior vehicles for brands: ${brands.join(', ')}`);

    const docs = AUTOMOBILES.slice(0, 8).map(toVehicle);
    const created = await Vehicle.insertMany(docs, { ordered: false });
    console.log(`Seeded ${created.length} automobiles successfully`);

    const count = await Vehicle.countDocuments();
    console.log(`Total vehicles in DB: ${count}`);

    await mongoose.disconnect();
    console.log('Done. Disconnected from MongoDB.');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
}

seed();
