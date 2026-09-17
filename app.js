require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const admin = require('firebase-admin');
const connectDB = require('./config/db');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Response compression (reduces egress bandwidth and function execution time)
app.use(compression());

// Security headers
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS configuration
const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:3000',
  'https://onevishwam.com',
  'https://www.onevishwam.com',
  'https://admin.onevishwam.com',
];

const envOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
  : [];

const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, curl, Postman, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
        return callback(null, true);
      }
      return callback(
        new Error('The CORS policy for this site does not allow access from the specified Origin.'),
        false
      );
    },
    credentials: true,
  })
);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Firebase Admin SDK — initialise once (no-op if already done by index.js)
if (!admin.apps.length) {
  admin.initializeApp({
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'onevishwam.firebasestorage.app',
  });
}

// Request logging (development / non-production)
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Normalize URL path prefixes from Firebase Emulator / Cloud Function URLs
// (e.g. /onevishwam/asia-south1/api/health -> /health)
app.use((req, res, next) => {
  const fnPrefixRegex = /^\/[^/]+\/[^/]+\/api(?=\/|$)/;
  if (fnPrefixRegex.test(req.url)) {
    req.url = req.url.replace(fnPrefixRegex, '') || '/';
  }
  next();
});

// Static uploads serving (served directly before DB connection check)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure MongoDB connection only for functional API requests (reused and safe for serverless Cloud Functions)
// Preflight OPTIONS, health endpoints, static assets, and favicon bypass DB connections to save compute/sockets.
app.use(async (req, res, next) => {
  if (
    req.method === 'OPTIONS' ||
    req.path === '/health' ||
    req.path === '/api/health' ||
    req.path.startsWith('/uploads') ||
    req.path === '/favicon.ico'
  ) {
    return next();
  }
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

// Health check routes
app.get(['/health', '/api/health'], (req, res) => {
  res.json({
    success: true,
    message: 'OneVishwam API is running',
    timestamp: new Date().toISOString(),
  });
});

app.get(['/health/db', '/api/health/db'], async (req, res) => {
  try {
    await connectDB();
    const mongoose = require('mongoose');
    await mongoose.connection.db.admin().ping();
    res.json({
      success: true,
      status: 'active',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      status: 'error',
      message: err.message,
    });
  }
});

// Mount API routes under /api (standard) and / (for Cloud Function stripped paths)
app.use('/api', routes);
app.use('/', routes);

// Global error handling middleware
app.use(errorHandler);

module.exports = app;
