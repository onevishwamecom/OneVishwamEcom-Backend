const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

async function syncUser() {
  try {
    await connectDB();
    console.log('[SYNC] Connected to MongoDB Atlas.');

    const sampleUser = {
      firebaseUid: 'GJIyrlHsa6aXNAp6ulXVQ25DPb62',
      email: 'tejashassan2k@gmail.com',
      fullName: 'TEJAS HK',
      phoneNumber: '9876543210',
      mobile: '9876543210',
      role: 'user',
      status: 'active',
      accountStatus: 'active',
    };

    const user = await User.findOneAndUpdate(
      { firebaseUid: sampleUser.firebaseUid },
      { $set: sampleUser },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    console.log('[SYNC] Successfully synced user to MongoDB Atlas:', JSON.stringify(user, null, 2));
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('[SYNC ERROR]:', err);
    process.exit(1);
  }
}

syncUser();

