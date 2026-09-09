const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
require("dotenv").config();

// Import configured Express application
const app = require("./app");

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
