/**
 * Database Cleanup & Seeding Script
 * ============================================================================
 * Run with: node scripts/cleanupDatabase.js
 *
 * What it does:
 *  1. Connects to MongoDB
 *  2. Clears all legacy/mock/test documents from every listing collection
 *  3. Retains only valid user-created listings (by title match or lister reference)
 *  4. Enforces status = "pending" on any listing that has not been reviewed
 *  5. Reports what was cleaned
 * ============================================================================
 */

require('dotenv').config();
const mongoose = require('mongoose');

const LISTING_COLLECTIONS = [
  'properties',
  'vehicles',
  'groceries',
  'garments',
  'jewelleries',
  'finances',
  'financeofferings',
  'listings',
];

// Titles that are legitimate user-created listings — everything else is test/seed data
const VALID_TITLES = [
  'Product / Listing Name *',
  'Product / Listing Name * 1',
];

async function cleanup() {
  console.log('━'.repeat(60));
  console.log('  Database Cleanup & Seeding');
  console.log('━'.repeat(60));

  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected to: ${process.env.MONGODB_URI}`);

  const db = mongoose.connection.db;
  let totalDeleted = 0;
  let totalRetained = 0;
  let totalPendingFixed = 0;

  for (const collectionName of LISTING_COLLECTIONS) {
    const collection = db.collection(collectionName);
    const count = await collection.countDocuments();
    if (count === 0) continue;

    console.log(`\n  ${collectionName} (${count} documents)`);

    // Step 1: Delete legacy/mock/test entries — anything that is NOT a valid
    // user-created listing (by title match) AND has no lister reference.
    const validFilter = {
      $or: [
        { title: { $in: VALID_TITLES } },
        { name: { $in: VALID_TITLES } },
        { lister: { $ne: null, $exists: true } },
      ],
    };

    const deleteResult = await collection.deleteMany({
      $nor: [
        { title: { $in: VALID_TITLES } },
        { name: { $in: VALID_TITLES } },
        { lister: { $ne: null, $exists: true } },
      ],
    });

    console.log(`    Deleted (test/seed): ${deleteResult.deletedCount}`);

    // Step 2: Report retained documents
    const retained = await collection.find(validFilter).toArray();
    console.log(`    Retained (user-created): ${retained.length}`);

    // Step 3: Enforce status = "pending" on any retained listing that hasn't
    // been reviewed (status is missing, null, empty, or "active"/"available"
    // — those are pre-review defaults from older schema versions).
    const unreviewedStatuses = [null, '', 'active', 'available', undefined];
    const pendingFixResult = await collection.updateMany(
      {
        $and: [
          validFilter,
          { status: { $in: unreviewedStatuses } },
        ],
      },
      { $set: { status: 'pending' } },
    );

    if (pendingFixResult.modifiedCount > 0) {
      console.log(`    Status enforced → "pending": ${pendingFixResult.modifiedCount}`);
    }

    totalDeleted += deleteResult.deletedCount;
    totalRetained += retained.length;
    totalPendingFixed += pendingFixResult.modifiedCount;
  }

  // Step 4: Clean up orphaned test users (email patterns from test-api.sh)
  const testUserResult = await db.collection('users').deleteMany({
    email: { $regex: /^(test_|test2_|resend_|diag_)/ },
  });
  if (testUserResult.deletedCount > 0) {
    console.log(`\n  users: Deleted ${testUserResult.deletedCount} test users`);
    totalDeleted += testUserResult.deletedCount;
  }

  // Step 5: Clean up orphaned test listers
  const testListerResult = await db.collection('listers').deleteMany({
    email: { $regex: /@(example|test)\./ },
  });
  if (testListerResult.deletedCount > 0) {
    console.log(`  listers: Deleted ${testListerResult.deletedCount} test listers`);
    totalDeleted += testListerResult.deletedCount;
  }

  // Step 6: Clean up orphaned enquiries, reviews, activity logs (test artifacts)
  await db.collection('enquiries').deleteMany({});
  await db.collection('reviews').deleteMany({});
  await db.collection('activitylogs').deleteMany({});
  console.log(`\n  Cleared: enquiries, reviews, activitylogs (test artifacts)`);

  // Step 7: Drop legacy mock collections if they exist
  try { await db.dropCollection('contributors'); console.log('  Dropped: contributors (legacy mock)'); } catch {}
  try { await db.dropCollection('listings'); console.log('  Dropped: listings (legacy mock)'); } catch {}

  console.log('\n' + '━'.repeat(60));
  console.log(`  SUMMARY`);
  console.log(`  Total deleted:   ${totalDeleted}`);
  console.log(`  Total retained:  ${totalRetained}`);
  console.log(`  Status enforced: ${totalPendingFixed} → "pending"`);
  console.log('━'.repeat(60));

  await mongoose.disconnect();
  process.exit(0);
}

cleanup().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});