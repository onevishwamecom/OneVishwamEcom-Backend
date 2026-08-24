const mongoose = require('mongoose');
const Admin = require('../models/Admin');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB connected: ${conn.connection.host}`);
    await bootstrapAdmin();
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
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