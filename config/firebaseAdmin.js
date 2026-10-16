const { initializeApp, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getStorage } = require('firebase-admin/storage');

let app;
if (!getApps().length) {
  app = initializeApp({
    projectId: process.env.FB_PROJECT_ID || process.env.GCLOUD_PROJECT || 'onevishwam',
    storageBucket: process.env.FB_STORAGE_BUCKET || 'onevishwam.firebasestorage.app',
  });
} else {
  app = getApps()[0];
}

const admin = {
  app,
  apps: getApps(),
  auth: () => getAuth(app),
  getAuth: () => getAuth(app),
  storage: () => getStorage(app),
  getStorage: () => getStorage(app),
};

module.exports = admin;
