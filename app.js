require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const connectDB = require('./config/db');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

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

// Ensure MongoDB connection for every request (reused and safe for serverless Cloud Functions)
app.use(async (req, res, next) => {
  if (req.path === '/health' || req.path === '/api/health') return next();
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

// Static uploads serving
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check routes
app.get(['/health', '/api/health'], (req, res) => {
  res.json({
    success: true,
    message: 'OneVishwam API is running',
    timestamp: new Date().toISOString(),
  });
});

// Mount API routes under /api (standard) and / (for Cloud Function stripped paths)
app.use('/api', routes);
app.use('/', routes);

// Global error handling middleware
app.use(errorHandler);

module.exports = app;
