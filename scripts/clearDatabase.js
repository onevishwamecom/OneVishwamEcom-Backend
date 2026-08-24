require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const COLLECTIONS_TO_CLEAR = [
  'properties',
  'vehicles',
  'groceries',
  'garments',
  'jewelleries',
  'finances',
  'financeofferings',
  'enquiries',
  'reviews',
  'propertyrequirements',
  'requirements',
  'wishlists',
  'activitylogs',
];

async function clearDatabase() {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/onevishwam';
    await mongoose.connect(uri);
    console.log(`Connected to MongoDB: ${uri}`);

    const db = mongoose.connection.db;
    let totalDeleted = 0;

    for (const name of COLLECTIONS_TO_CLEAR) {
      try {
        const res = await db.collection(name).deleteMany({});
        console.log(`Cleared ${name}: ${res.deletedCount} documents deleted`);
        totalDeleted += res.deletedCount;
      } catch (err) {
        console.log(`Skipped ${name}: ${err.message}`);
      }
    }

    console.log(`\nSuccessfully cleared MongoDB. Total documents deleted: ${totalDeleted}`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Failed to clear database:', err);
    process.exit(1);
  }
}

clearDatabase();
