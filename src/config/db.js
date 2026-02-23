const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/booking');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return true;
  } catch (error) {
    console.log(`MongoDB Connection Error: ${error.message}`);
    console.log('Server will continue without database connection (demo mode)');
    return false;
  }
};

module.exports = connectDB;
