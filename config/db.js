
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    console.log('MONGO_URI exists:', Boolean(process.env.MONGO_URI));

    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI environment variable is missing');
    }

    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log('MongoDB connected successfully:', conn.connection.host);

    return conn;
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    throw error;
  }
};

module.exports = connectDB;