const { initializeApp, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

let app;
if (!getApps().length) {
  app = initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'onevishwam',
  });
} else {
  app = getApps()[0];
}

const admin = {
  app,
  apps: getApps(),
  auth: () => getAuth(app),
  getAuth: () => getAuth(app),
};

module.exports = admin;
