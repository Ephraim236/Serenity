const mongoose = require('mongoose');

let connectionPromise = null;

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI;
  
  // Check if MongoDB URI is configured
  if (!mongoUri) {
    console.log('MONGODB_URI not configured - server running in demo mode');
    return false;
  }
  
  // Check if already connected
  if (mongoose.connection.readyState === 1) {
    console.log(`MongoDB Already Connected: ${mongoose.connection.host}`);
    return true;
  }
  
  // If a connection attempt is already in progress, wait for it
  if (connectionPromise) {
    try {
      await connectionPromise;
      return true;
    } catch (error) {
      connectionPromise = null;
      return false;
    }
  }

  try {
    // Create new connection promise
    connectionPromise = mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 4500,
    });
    
    const conn = await connectionPromise;
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    connectionPromise = null;
    return true;
  } catch (error) {
    console.log(`MongoDB Connection Error: ${error.message}`);
    console.log('Server will continue without database connection (demo mode)');
    connectionPromise = null;
    return false;
  }
};

// Handle connection events for better debugging
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected. Attempting to reconnect...');
  // In serverless, we typically don't auto-reconnect as the instance may be frozen
});

mongoose.connection.on('connected', () => {
  console.log('MongoDB connected');
});

module.exports = connectDB;