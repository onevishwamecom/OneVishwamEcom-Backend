const mongoose = require('mongoose');
const Admin = require('../models/Admin');

let isConnecting = false;
let isBootstrapped = false;

const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) {
    return mongoose.connection;
  }

  if (isConnecting) {
    // Wait for in-flight connection attempt
    while (isConnecting) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    if (mongoose.connection.readyState >= 1) {
      return mongoose.connection;
    }
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not defined');
  }

  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      isConnecting = true;
      attempt++;
      const conn = await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 15000,
        socketTimeoutMS: 45000,
        maxPoolSize: process.env.MONGO_MAX_POOL_SIZE ? parseInt(process.env.MONGO_MAX_POOL_SIZE, 10) : 10,
      });
      console.log(`MongoDB connected: ${conn.connection.host}`);
      
      if (!isBootstrapped) {
        await bootstrapAdmin();
        isBootstrapped = true;
      }
      return conn.connection;
    } catch (error) {
      if (attempt >= maxRetries) {
        console.error(`MongoDB connection error (attempt ${attempt}/${maxRetries}): ${error.message}`);
        throw error;
      }
      console.warn(`MongoDB connection attempt ${attempt} failed (${error.message}). Retrying in 2s...`);
      await new Promise((res) => setTimeout(res, 2000));
    } finally {
      isConnecting = false;
    }
  }
};

/**
 * Create the default super-admin from env vars if it doesn't already exist.
 * Runs on every startup — safe because it's a no-op when the admin exists.
 */
const bootstrapAdmin = async () => {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  const name = process.env.ADMIN_BOOTSTRAP_NAME || 'Super Admin';

  if (!email || !password) {
    console.log('[ADMIN] No ADMIN_BOOTSTRAP_* env vars set — skipping admin bootstrap.');
    return;
  }

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
};

module.exports = connectDB;