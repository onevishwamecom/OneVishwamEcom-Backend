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

  const mongoUri =
    process.env.MONGODB_URI ||
    (process.env.MONGODB_USERNAME && process.env.MONGODB_PASSWORD
      ? `mongodb+srv://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@cluster0.jcvxsia.mongodb.net/onevishwam?retryWrites=true&w=majority`
      : 'mongodb://127.0.0.1:27017/onevishwam');

  if (!mongoUri) {
    throw new Error('MONGODB_URI environment variable is not defined');
  }

  const opts = {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
    socketTimeoutMS: 20000,
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
      return null;
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
