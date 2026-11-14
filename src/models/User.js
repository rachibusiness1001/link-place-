const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: { type: String },
  avatar: { type: String },
  firebaseUid: { type: String, required: true, unique: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  plan: { type: String, enum: ['free', 'starter', 'pro'], default: 'free' },
  credits: { type: Number, default: 0 },
  totalSearches: { type: Number, default: 0 },
  totalExports: { type: Number, default: 0 },
  isBlocked: { type: Boolean, default: false },
  lastLoginAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
