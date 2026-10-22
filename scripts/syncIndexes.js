require('dotenv').config();
const connectDB = require('../config/db');
const Property = require('../models/Property');
const Vehicle = require('../modules/vehicles/model');
const Electronic = require('../modules/electronics/model');
const Bedding = require('../modules/bedding/model');

async function syncAllIndexes() {
  console.log('🔄 Connecting to MongoDB Atlas...');
  await connectDB();
  console.log('✅ Connected. Synchronizing compound indexes for active marketplace models...');

  const models = [
    { name: 'Properties', model: Property },
    { name: 'Vehicles', model: Vehicle },
    { name: 'Consumer Electronics', model: Electronic },
    { name: 'Bedding & Comfort', model: Bedding },
  ];

  for (const { name, model } of models) {
    try {
      console.log(`⏳ Synchronizing indexes for ${name}...`);
      await model.syncIndexes();
      const indexes = await model.collection.indexes();
      console.log(`✅ ${name} indexes synchronized! Active index count: ${indexes.length}`);
    } catch (err) {
      console.error(`❌ Error syncing indexes for ${name}:`, err.message);
    }
  }

  console.log('🎉 All marketplace indexes synchronized successfully!');
  process.exit(0);
}

syncAllIndexes().catch((err) => {
  console.error('Fatal index sync error:', err);
  process.exit(1);
});
