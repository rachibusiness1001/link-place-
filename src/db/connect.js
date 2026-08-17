const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
  if (isConnected) {
    console.log('=> using existing database connection');
    return;
  }

  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is missing in .env');
    return;
  }

  try {
    const db = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    isConnected = db.connections[0].readyState;
    console.log('=> Database connected successfully');
  } catch (error) {
    console.error('=> Database connection error:', error);
  }
};

module.exports = connectDB;
