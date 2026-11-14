const mongoose = require('mongoose');

const SearchLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userEmail: { type: String, required: true },
  domain: { type: String, required: true },
  anchor: { type: String, required: true },
  linkto: { type: String, required: true },
  type: { type: String, enum: ['normal', 'branded', 'anchor-hunt'], required: true },
  resultsCount: { type: Number, default: 0 },
  creditsUsed: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.models.SearchLog || mongoose.model('SearchLog', SearchLogSchema);
