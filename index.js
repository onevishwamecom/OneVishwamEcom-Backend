const { onRequest } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const app = require('./app');

// Set global options for all 2nd Gen Firebase Functions
setGlobalOptions({
  region: process.env.FIREBASE_REGION || 'asia-south1',
  maxInstances: 10,
});

/**
 * Cloud Function entrypoint for OneVishwam Express Backend.
 * All Express routes (/api/..., /health, etc.) are served through this function.
 */
exports.api = onRequest(
  {
    cors: true,
    timeoutSeconds: 60,
    memory: '512MiB',
  },
  app
);