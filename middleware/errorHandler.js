const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errors = Array.isArray(err.errors) ? err.errors : [];

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const messages = Object.values(err.errors).map((e) => e.message);
    message = messages.join(', ');
    if (errors.length === 0) {
      errors = Object.entries(err.errors).map(([field, errObj]) => ({
        field,
        message: errObj.message,
      }));
    }
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue).join(', ');
    message = `Duplicate value for ${field}`;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 400;
    message = 'File too large. Please upload a smaller file.';
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    statusCode = 400;
    message = 'Unexpected file field';
  }

  // Rate limit errors
  if (err.name === 'RateLimitError' || err.statusCode === 429) {
    statusCode = err.statusCode || 429;
    message = err.message || 'Too many requests, please try again later';
  }

  if (statusCode >= 500) {
    console.error(`[ERROR] ${req.method} ${req.originalUrl}`, err);
    if (process.env.NODE_ENV === 'production') {
      message = 'An unexpected internal error occurred. Please try again later.';
    }
  }

  const payload = {
    success: false,
    message,
  };

  if (errors.length > 0) {
    payload.errors = errors;
  }

  res.status(statusCode).json(payload);
};

module.exports = errorHandler;
