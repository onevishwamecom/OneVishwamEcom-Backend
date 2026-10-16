require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/db");
const mongoose = require("mongoose");

const PORT = process.env.PORT || 5001; // Express API server port (Atlas Live)

// Global process error handlers
process.on("uncaughtException", (err) => {
  console.error("FATAL: Uncaught Exception:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("WARNING: Unhandled Rejection at:", promise, "reason:", reason);
  // Do not crash server in production on non-fatal async rejections
  if (process.env.NODE_ENV !== "production") {
    // In local dev, allow developer to see rejection without hard crash unless critical
  }
});

// Start HTTP server for local development immediately
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Connect to MongoDB Atlas in background
connectDB().catch((err) => {
  console.error(`[DATABASE] Deferred connection warning: ${err.message}`);
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`${signal} received, shutting down gracefully`);
  server.close(async () => {
    try {
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close(false);
      }
    } catch (err) {
      console.warn("Error closing database connection during shutdown:", err.message);
    }
    console.log("Process terminated cleanly");
    process.exit(0);
  });
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
