const mongoose = require('mongoose');
const dns = require('dns');
const Admin = require('../models/Admin');

// Ensure fast DNS SRV resolution for MongoDB Atlas on macOS/Node.js
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {}

let cachedConnection = null;
let cachedPromise = null;
let isBootstrapped = false;

/**
 * Global MongoDB Connection with Serverless Connection Caching.
 * Reuses active connection pool across Cloud Function invocations
 * to prevent MongoDB Atlas connection spikes.
 */
const connectDB = async () => {
  // 1. If connection is already open and ready, return immediately
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // 2. If a connection attempt is currently in-flight, await the existing promise
  if (cachedPromise) {
    return cachedPromise;
  }

  const activeClusterUri =
    'mongodb+srv://onevishwamecom_db_user:VishwamPass123@onevishwam.372aojy.mongodb.net/onevishwam?retryWrites=true&w=majority';

  let mongoUri = process.env.ATLAS_MONGODB_URI || process.env.MONGODB_URI || activeClusterUri;

  // Sanitize against legacy/outdated environment variables in Cloud Functions
  if (!mongoUri.includes('372aojy.mongodb.net') || !mongoUri.includes('VishwamPass123')) {
    mongoUri = activeClusterUri;
  }

  const opts = {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
    socketTimeoutMS: 30000,
    maxPoolSize: process.env.MONGO_MAX_POOL_SIZE ? parseInt(process.env.MONGO_MAX_POOL_SIZE, 10) : 10,
    autoIndex: false,
  };

  cachedPromise = mongoose
    .connect(mongoUri, opts)
    .then(async (conn) => {
      cachedConnection = conn.connection;
      console.log(`[DATABASE] MongoDB Atlas connected successfully: ${conn.connection.host}`);
      if (!isBootstrapped) {
        await bootstrapAdmin();
        isBootstrapped = true;
      }
      return cachedConnection;
    })
    .catch((err) => {
      cachedPromise = null;
      console.error(`[DATABASE] MongoDB Atlas Connection Error: ${err.message}`);
      throw err;
    });

  return cachedPromise;
};

/**
 * Create the default super-admin from env vars if it doesn't already exist.
 * Runs on startup — safe because it's a no-op when the admin exists.
 */
const bootstrapAdmin = async () => {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  const name = process.env.ADMIN_BOOTSTRAP_NAME || 'Super Admin';

  if (!email || !password) {
    return;
  }

  try {
    const existing = await Admin.findOne({ email: email.toLowerCase() });
    if (existing) {
      return;
    }

    await Admin.create({
      email: email.toLowerCase(),
      password,
      name,
      role: 'super-admin',
      isActive: true,
    });
    console.log(`[ADMIN] Bootstrap admin created: ${email}`);
  } catch (err) {
    console.warn(`[ADMIN] Bootstrap check warning: ${err.message}`);
  }
};

module.exports = connectDB;
