require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Vehicle = require('../modules/vehicles/model');

const vehicles = [
  {
    brand: 'Honda', model: 'Activa 6G', year: 2025,
    condition: 'new', category: '2-wheeler', fuelType: 'Petrol',
    price: '\u20b9 85,000', priceValue: 85000, kmDriven: 0,
    location: 'Bangalore', city: 'bengaluru', pincode: '560001',
    showroom: { name: 'Honda Dream Showroom', address: 'No. 45, MG Road, Ashok Nagar, Bangalore - 560001', phone: '9364862542', mapsLink: 'https://maps.google.com/?q=Honda+Showroom+Bangalore+MG+Road' },
      contactEmail: 'ceo@onevishwam.com',
    loanApproved: true, featured: true, variants: 3,
    images: ['https://images.pexels.com/photos/35584620/pexels-photo-35584620.jpeg?auto=compress&cs=tinysrgb&w=800', 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80'],
    status: 'active',
  },
  {
    brand: 'Bajaj', model: 'Pulsar NS200', year: 2020,
    condition: 'old', category: '2-wheeler', fuelType: 'Petrol',
    price: '\u20b9 65,000', priceValue: 65000, kmDriven: 28500,
    location: 'Mysore', city: 'mysore', pincode: '570015',
    showroom: { name: 'Bajaj Pro Showroom', address: '12, KRS Road, Bannimantap, Mysore - 570015', phone: '9364862542', mapsLink: 'https://maps.google.com/?q=Bajaj+Showroom+Mysore' },
      contactEmail: 'ceo@onevishwam.com',
    loanApproved: false, featured: false, variants: 0,
    images: ['https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80'],
    status: 'active',
  },
  {
    brand: 'Toyota', model: 'Urban Cruiser Hyryder', year: 2025,
    condition: 'new', category: '4-wheeler', fuelType: 'Electric',
    price: '\u20b9 19.50 Lakh', priceValue: 1950000, kmDriven: 0,
    location: 'Bangalore', city: 'bengaluru', pincode: '560017',
    showroom: { name: 'Toyota Liva Motors', address: '88, Old Airport Road, Domlur, Bangalore - 560017', phone: '9364862542', mapsLink: 'https://maps.google.com/?q=Toyota+Showroom+Bangalore+Airport+Road' },
      contactEmail: 'ceo@onevishwam.com',
    loanApproved: true, featured: true, variants: 4,
    images: ['https://images.unsplash.com/photo-1550355291-bbee04a92027?auto=format&fit=crop&w=800&q=80', 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=800&q=80'],
    status: 'active',
  },
  {
    brand: 'Maruti Suzuki', model: 'Swift VXI', year: 2019,
    condition: 'old', category: '4-wheeler', fuelType: 'Petrol',
    price: '\u20b9 4,25,000', priceValue: 425000, kmDriven: 45200,
    location: 'Hubli', city: 'hubli', pincode: '580030',
    showroom: { name: 'Maruti Suzuki Arena', address: 'Survey No. 120, Gokul Road, Hubli - 580030', phone: '9364862542', mapsLink: 'https://maps.google.com/?q=Maruti+Showroom+Hubli' },
      contactEmail: 'ceo@onevishwam.com',
    loanApproved: false, featured: false, variants: 3,
    images: ['https://images.unsplash.com/photo-1544636331-e26879cd4d9b?auto=format&fit=crop&w=800&q=80', 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=800&q=80'],
    status: 'active',
  },
  {
    brand: 'Tata Motors', model: 'Ace Gold', year: 2024,
    condition: 'new', category: 'commercial', fuelType: 'Diesel',
    price: '\u20b9 6,85,000', priceValue: 685000, kmDriven: 0,
    location: 'Mangalore', city: 'mangalore', pincode: '575010',
    showroom: { name: 'Tata Motors Commercial', address: 'NH-66, Panambur, Mangalore - 575010', phone: '9364862542', mapsLink: 'https://maps.google.com/?q=Tata+Motors+Mangalore' },
      contactEmail: 'ceo@onevishwam.com',
    loanApproved: true, featured: true, variants: 3,
    images: ['https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=800&q=80'],
    status: 'active',
  },
  {
    brand: 'Ashok Leyland', model: 'Dost+', year: 2018,
    condition: 'old', category: 'commercial', fuelType: 'Diesel',
    price: '\u20b9 9,50,000', priceValue: 950000, kmDriven: 125000,
    location: 'Bangalore', city: 'bengaluru', pincode: '560058',
    showroom: { name: 'Ashok Leyland Truck Zone', address: 'Plot 56, Peenya Industrial Area, Bangalore - 560058', phone: '9364862542', mapsLink: 'https://maps.google.com/?q=Ashok+Leyland+Peenya+Bangalore' },
      contactEmail: 'ceo@onevishwam.com',
    loanApproved: false, featured: false, variants: 2,
    images: ['https://images.pexels.com/photos/2199293/pexels-photo-2199293.jpeg?auto=compress&cs=tinysrgb&w=800'],
    status: 'active',
  },
  {
    brand: 'Bajaj', model: 'RE 4S CNG', year: 2025,
    condition: 'new', category: '3-wheeler', fuelType: 'CNG',
    price: '\u20b9 2,55,000', priceValue: 255000, kmDriven: 0,
    location: 'Mysore', city: 'mysore', pincode: '570016',
    showroom: { name: 'Bajaj 3W Hub', address: '22, Mysore-Nanjangud Road, Metagalli, Mysore - 570016', phone: '9364862542', mapsLink: 'https://maps.google.com/?q=Bajaj+3W+Mysore' },
      contactEmail: 'ceo@onevishwam.com',
    loanApproved: true, featured: true, variants: 2,
    images: ['https://images.pexels.com/photos/17899648/pexels-photo-17899648.jpeg?auto=compress&cs=tinysrgb&w=800'],
    status: 'active',
  },
  {
    brand: 'Ola Electric', model: 'S1 Pro', year: 2025,
    condition: 'new', category: '2-wheeler', fuelType: 'Electric',
    price: '\u20b9 1,29,999', priceValue: 129999, kmDriven: 0,
    location: 'Bangalore', city: 'bengaluru', pincode: '560066',
    showroom: { name: 'Ola Experience Centre', address: '1st Floor, VR Mall, Whitefield, Bangalore - 560066', phone: '9364862542', mapsLink: 'https://maps.google.com/?q=Ola+Experience+Whitefield' },
      contactEmail: 'ceo@onevishwam.com',
    loanApproved: false, featured: true, variants: 2,
    images: ['https://images.pexels.com/photos/3671151/pexels-photo-3671151.jpeg?auto=format&fit=crop&w=800&q=80', 'https://images.unsplash.com/photo-1591637333184-19aa84b3e01f?auto=format&fit=crop&w=800&q=80'],
    status: 'active',
  },
];

async function seed() {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/onevishwam';
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    await Vehicle.deleteMany({});
    console.log('Cleared existing vehicles');

    const created = [];
    for (const data of vehicles) {
      const vehicle = await Vehicle.create(data);
      created.push(vehicle);
    }
    console.log(`Seeded ${created.length} vehicles successfully`);

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
