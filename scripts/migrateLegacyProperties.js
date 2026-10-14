#!/usr/bin/env node

/**
 * Migration Script: Normalize Legacy Property Documents to Updated Schema
 * -----------------------------------------------------------------------
 * Safe migration with dry-run support, batch execution via bulkWrite,
 * preserving all existing media, dates, and references.
 *
 * Usage:
 *   node scripts/migrateLegacyProperties.js --dry-run
 *   node scripts/migrateLegacyProperties.js
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");

const isDryRun = process.argv.includes("--dry-run");

const MONGODB_URI =
  process.env.ATLAS_MONGODB_URI ||
  process.env.MONGODB_URI ||
  "mongodb+srv://onevishwamecom_db_user:VishwamPass123@onevishwam.372aojy.mongodb.net/onevishwam?retryWrites=true&w=majority";

function parseNumeric(val, fallback = 0) {
  if (typeof val === "number" && !Number.isNaN(val)) return val;
  if (!val) return fallback;
  const cleaned = String(val).replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  return Number.isNaN(num) ? fallback : num;
}

function normalizeDocument(doc) {
  const existingDetails = typeof doc.details === "object" && doc.details !== null ? doc.details : {};

  // 1. Details subdocument construction
  const details = {
    propertyName: existingDetails.propertyName || doc.propertyName || doc.title || "Untitled Property",
    dimensions: existingDetails.dimensions || doc.dimensions || "",
    facing: existingDetails.facing || doc.facing || "",
    cornerPlot: existingDetails.cornerPlot || (doc.cornerPlot === true || doc.cornerPlot === "Yes" ? "Yes" : "No"),
    approvedLayout: existingDetails.approvedLayout || (doc.approvedLayout === true || doc.approvedLayout === "Yes" ? "Yes" : "No"),
    approvalAuthority: existingDetails.approvalAuthority || doc.approvalAuthority || doc.approval || "",
    boundaryWall: existingDetails.boundaryWall || (doc.boundaryWall === true || doc.boundaryWall === "Yes" ? "Yes" : "No"),
    amenities: Array.isArray(existingDetails.amenities)
      ? existingDetails.amenities
      : Array.isArray(doc.amenities)
      ? doc.amenities
      : [],
    utilities: Array.isArray(existingDetails.utilities)
      ? existingDetails.utilities
      : Array.isArray(doc.utilities)
      ? doc.utilities
      : [],
    expectedPrice: String(
      existingDetails.expectedPrice ||
      doc.expectedPrice ||
      doc.price ||
      doc.numericPrice ||
      doc.rawPrice ||
      "0"
    ),
    negotiable:
      existingDetails.negotiable === "Yes" || doc.negotiable === true || doc.negotiable === "Yes"
        ? "Yes"
        : "No",
    channelPartnerName:
      existingDetails.channelPartnerName ||
      doc.channelPartnerName ||
      doc.vendorName ||
      "One Vishwam",
    vendorName:
      existingDetails.vendorName ||
      doc.vendorName ||
      "One Vishwam",
  };

  for (const [k, v] of Object.entries(existingDetails)) {
    if (!(k in details) && v !== undefined) {
      details[k] = v;
    }
  }

  // 2. Numeric and raw pricing
  const numPrice = parseNumeric(doc.numericPrice || doc.rawPrice || doc.price, 0);

  // 3. Location normalization
  const city = (doc.city || "bengaluru").toLowerCase().trim();
  const state = doc.state || "karnataka";
  const area = doc.area || "";
  const location = doc.location || (area ? `${area}, ${city === "bengaluru" ? "Bengaluru" : city}` : (city === "bengaluru" ? "Bengaluru" : city));

  // 4. Agent subdocument
  const agent = {
    name: doc.agent?.name || doc.channelPartnerName || doc.vendorName || "One Vishwam",
    type: doc.origin === "in_house_project" ? "In-House" : (doc.agent?.type || "Channel Partner"),
    avatar: doc.agent?.avatar || "",
  };

  // 5. Normalized top-level fields
  const normalized = {
    vendorName: doc.vendorName || "One Vishwam",
    channelPartnerName: doc.channelPartnerName || doc.vendorName || "One Vishwam",
    propertyType: doc.propertyType || doc.subcategory || "Residential",
    status: (doc.status === "active" ? "approved" : doc.status) || "approved",
    origin: doc.origin || "channel_partner_project",
    details,
    bankLoanDetails: doc.bankLoanDetails || (doc.loanApproved ? "Approved by Bank" : "N/A"),
    loanApproved: Boolean(doc.loanApproved),
    documents: Array.isArray(doc.documents) ? doc.documents : [],
    images: Array.isArray(doc.images) ? doc.images : [],
    video: doc.video ?? null,
    videoUrl: doc.videoUrl ?? null,
    videos: Array.isArray(doc.videos) ? doc.videos : (doc.videoUrl ? [doc.videoUrl] : []),
    brochure: doc.brochure ?? null,
    pdfUrl: doc.pdfUrl ?? "",
    floorPlanImages: Array.isArray(doc.floorPlanImages) ? doc.floorPlanImages : (Array.isArray(doc.floorPlans) ? doc.floorPlans : []),
    title: doc.title || details.propertyName || "Untitled Property",
    subtitle: doc.subtitle || "",
    description: doc.description || (typeof doc.details === "string" ? doc.details : (details.description || "")),
    category: "real-estate",
    subcategory: doc.subcategory || doc.propertyType || "Residential",
    purpose: doc.purpose || "Sell",
    price: String(doc.price || numPrice || "0"),
    numericPrice: numPrice,
    rawPrice: numPrice,
    priceType: doc.priceType || "fixed",
    priceSuffix: doc.priceSuffix || "",
    negotiable: Boolean(doc.negotiable === true || doc.negotiable === "Yes"),
    country: "India",
    state,
    city,
    area,
    pincode: doc.pincode ? String(doc.pincode).trim() : "",
    address: doc.address || location || "",
    landmark: doc.landmark || "",
    location,
    contact: doc.contact || "",
    contactEmail: doc.contactEmail || doc.email || "",
    email: doc.email || doc.contactEmail || "",
    featured: Boolean(doc.featured),
    verified: Boolean(doc.verified),
    viewsCount: typeof doc.viewsCount === "number" ? doc.viewsCount : 0,
    recentlyAdded: Boolean(doc.recentlyAdded),
    user: doc.user || doc.createdBy,
    createdBy: doc.createdBy || doc.user,
    lister: doc.lister || doc.user || doc.createdBy,
    agent,
  };

  return normalized;
}

async function runMigration() {
  console.log("==================================================");
  console.log("🚀 MONGODB ATLAS LEGACY PROPERTIES MIGRATION");
  console.log(`Mode: ${isDryRun ? "🔍 DRY-RUN (Preview Only, No DB writes)" : "⚡ LIVE EXECUTION (Writing to Atlas)"}`);
  console.log("==================================================");

  try {
    console.log("Connecting to MongoDB Atlas...");
    await mongoose.connect(MONGODB_URI);
    console.log("✔ Connected to database successfully.\n");

    const collection = mongoose.connection.db.collection("properties");
    const totalCount = await collection.countDocuments();
    console.log(`Found ${totalCount} property records in properties collection.`);

    if (totalCount === 0) {
      console.log("No records to migrate.");
      await mongoose.disconnect();
      process.exit(0);
    }

    const cursor = collection.find({});
    const bulkOps = [];
    let sampleLogged = false;

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      const normalized = normalizeDocument(doc);

      if (isDryRun && !sampleLogged && doc.title !== "test123") {
        console.log("\n--- [DRY-RUN SAMPLE DOCUMENT COMPARISON] ---");
        console.log(`Document ID: ${doc._id} | Title: "${doc.title}"`);
        console.log("\n[BEFORE (Existing)]: ", {
          title: doc.title,
          category: doc.category,
          propertyType: doc.propertyType,
          price: doc.price,
          numericPrice: doc.numericPrice,
          details: doc.details,
          agent: doc.agent,
          origin: doc.origin,
        });

        console.log("\n[AFTER (Normalized)]: ", {
          title: normalized.title,
          category: normalized.category,
          subcategory: normalized.subcategory,
          propertyType: normalized.propertyType,
          price: normalized.price,
          numericPrice: normalized.numericPrice,
          details: normalized.details,
          agent: normalized.agent,
          origin: normalized.origin,
        });
        console.log("--------------------------------------------\n");
        sampleLogged = true;
      }

      bulkOps.push({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: {
              ...normalized,
              updatedAt: new Date(),
            },
          },
        },
      });
    }

    if (isDryRun) {
      console.log(`✔ DRY-RUN COMPLETED: ${bulkOps.length} documents validated and transformed in memory.`);
      console.log("No changes were committed to MongoDB Atlas.");
      console.log("\nTo execute the live migration, run:");
      console.log("  node scripts/migrateLegacyProperties.js\n");
    } else {
      console.log(`Writing updates for ${bulkOps.length} documents using bulkWrite...`);
      const result = await collection.bulkWrite(bulkOps, { ordered: false });
      console.log("✔ LIVE MIGRATION COMPLETED SUCCESSFULLY!");
      console.log(` - Matched Documents:  ${result.matchedCount}`);
      console.log(` - Modified Documents: ${result.modifiedCount}`);
    }

    await mongoose.disconnect();
    console.log("✔ Connection closed gracefully.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed with error:", error);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
}

runMigration();
