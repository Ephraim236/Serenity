const mongoose = require('mongoose');

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI;
  
  // Check if MongoDB URI is configured
  if (!mongoUri) {
    console.log('MONGODB_URI not configured - server running in demo mode');
    console.log('Environment:', process.env.NODE_ENV);
    console.log('Available env vars:', Object.keys(process.env).filter(k => k.includes('MONGO') || k.includes('DB') || k.includes('DATABASE')));
    return false;
  }
  
  // Check if already connected
  if (mongoose.connection.readyState === 1) {
    console.log(`MongoDB Already Connected: ${mongoose.connection.host}`);
    return true;
  }
  
  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 4500,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return true;
  } catch (error) {
    console.log(`MongoDB Connection Error: ${error.message}`);
    console.log('Server will continue without database connection (demo mode)');
    return false;
  }
};

module.exports = connectDB;