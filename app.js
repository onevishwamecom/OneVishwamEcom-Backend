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
      // Allow requests with no origin (like mobile apps, curl, or Postman)
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

// Ensure MongoDB connection for every request (reusable and safe for serverless)
app.use(async (req, res, next) => {
  if (req.path === '/health') return next();
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

// Static uploads serving
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API routes
app.use('/api', routes);

// Root / Health check route
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'OneVishwam API is running',
    timestamp: new Date().toISOString(),
  });
});

// Global error handling middleware
app.use(errorHandler);

module.exports = app;

