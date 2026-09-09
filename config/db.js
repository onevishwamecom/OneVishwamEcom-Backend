const mongoose = require('mongoose');
const Admin = require('../models/Admin');

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

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not defined');
  }

  const opts = {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    maxPoolSize: process.env.MONGO_MAX_POOL_SIZE ? parseInt(process.env.MONGO_MAX_POOL_SIZE, 10) : 10,
    autoIndex: process.env.NODE_ENV !== 'production',
  };

  cachedPromise = mongoose.connect(process.env.MONGODB_URI, opts)
    .then(async (conn) => {
      cachedConnection = conn.connection;
      console.log(`[DATABASE] MongoDB Atlas connected: ${conn.connection.host}`);
      if (!isBootstrapped) {
        await bootstrapAdmin();
        isBootstrapped = true;
      }
      return cachedConnection;
    })
    .catch((err) => {
      cachedPromise = null;
      console.error(`[DATABASE] MongoDB Atlas connection error: ${err.message}`);
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
