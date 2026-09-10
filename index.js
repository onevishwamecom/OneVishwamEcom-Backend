const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const functions = require("firebase-functions/v1");
require("dotenv").config();

// Import configured Express application and database
const app = require("./app");
const connectDB = require("./config/db");
const User = require("./models/User");

// Global options for 2nd Gen Firebase Functions
setGlobalOptions({
  region: "asia-south1",
  maxInstances: 2,
});

/**
 * Cloud Function entrypoint (Gen 2) for OneVishwam Express Backend.
 * Region: asia-south1 (Mumbai) gives optimal low latency to users in India.
 * Memory: 512MiB, maxInstances: 2 to guarantee execution inside zero-cost quotas.
 * Secret: MONGODB_URI bound via Google Cloud Secret Manager for production security.
 */
exports.api = onRequest(
  {
    region: "asia-south1",
    memory: "512MiB",
    timeoutSeconds: 60,
    maxInstances: 2,
    secrets: ["MONGODB_URI"],
    cors: true,
  },
  app
);

/**
 * Auth trigger: Cleanup MongoDB Atlas user record when deleted in Firebase Auth
 */
exports.cleanupDeletedUser = functions
  .region("asia-south1")
  .auth.user()
  .onDelete(async (user) => {
    try {
      await connectDB();
      const query = {
        $or: [{ firebaseUid: user.uid }],
      };
      if (user.email) {
        query.$or.push({ email: user.email.toLowerCase() });
      }
      const result = await User.deleteOne(query);
      console.log(
        `[Auth Trigger] Deleted user ${user.uid} (${user.email || "no-email"}) from MongoDB Atlas. Count: ${result.deletedCount}`
      );
    } catch (error) {
      console.error(`[Auth Trigger] Error deleting user ${user.uid} from MongoDB:`, error);
    }
  });
