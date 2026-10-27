/**
 * Migration Script: Consolidate map URL fields to a single canonical `mapUrl`
 * ============================================================================
 * Run with: node scripts/cleanMapUrlFields.js
 *
 * Removes duplicate fields:
 * - googleMapsUrl
 * - googleMapUrl
 * - mapEmbedUrl
 * - resolvedLocationUrl
 * - locationUrl
 *
 * Ensures only `mapUrl` exists at document root and inside `details`.
 * ============================================================================
 */

require('dotenv').config();
const mongoose = require('mongoose');

const COLLECTIONS_TO_CLEAN = ['properties', 'vehicles', 'listings'];

async function runMigration() {
  console.log('━'.repeat(60));
  console.log('  Database Migration: Consolidate Map URL to mapUrl only');
  console.log('━'.repeat(60));

  const mongoUri = process.env.ATLAS_MONGODB_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ Missing MongoDB connection URI (ATLAS_MONGODB_URI or MONGODB_URI).');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB');

  const db = mongoose.connection.db;

  for (const colName of COLLECTIONS_TO_CLEAN) {
    const col = db.collection(colName);
    const count = await col.countDocuments();
    if (count === 0) continue;

    console.log(`\nProcessing collection: ${colName} (${count} documents)...`);
    const cursor = col.find({});
    let updatedCount = 0;

    while (await cursor.hasNext()) {
      const doc = await cursor.next();

      const existingMapUrl = (
        doc.mapUrl ||
        doc.locationUrl ||
        doc.googleMapsUrl ||
        doc.googleMapUrl ||
        doc.details?.mapUrl ||
        doc.details?.locationUrl ||
        doc.details?.googleMapsUrl ||
        doc.details?.googleMapUrl ||
        doc['Google Map URL'] ||
        doc['Location URL'] ||
        doc['Map URL'] ||
        ''
      ).trim();

      const updateOp = {
        $set: {
          mapUrl: existingMapUrl,
        },
        $unset: {
          googleMapsUrl: '',
          googleMapUrl: '',
          mapEmbedUrl: '',
          resolvedLocationUrl: '',
          locationUrl: '',
          lister: '',
          'details.mapUrl': '',
          'details.googleMapsUrl': '',
          'details.googleMapUrl': '',
          'details.mapEmbedUrl': '',
          'details.resolvedLocationUrl': '',
          'details.locationUrl': '',
        },
      };

      if (doc.details && typeof doc.details === 'object') {
        if (doc.details.approvalAuthority === doc.approval) {
          updateOp.$unset['details.approvalAuthority'] = '';
        }
        if (doc.details.vendorName === doc.vendorName) {
          updateOp.$unset['details.vendorName'] = '';
        }
        if (doc.details.channelPartnerName === doc.channelPartnerName) {
          updateOp.$unset['details.channelPartnerName'] = '';
        }
        if (doc.details.propertyName === doc.title) {
          updateOp.$unset['details.propertyName'] = '';
        }
        if (doc.details.expectedPrice === doc.price) {
          updateOp.$unset['details.expectedPrice'] = '';
        }
      }

      await col.updateOne({ _id: doc._id }, updateOp);
      updatedCount++;
    }

    console.log(`  -> Cleaned and consolidated ${updatedCount} documents in "${colName}".`);
  }

  console.log('\n✅ Migration completed successfully!');
  await mongoose.disconnect();
  process.exit(0);
}

runMigration().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
