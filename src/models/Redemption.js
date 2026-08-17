const mongoose = require('mongoose');

const RedemptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  promoCodeId: { type: mongoose.Schema.Types.ObjectId, ref: 'PromoCode', required: true },
  code: { type: String, required: true },
  creditsAwarded: { type: Number, required: true }
}, { timestamps: true });

// Ensure a user can only redeem a specific code once
RedemptionSchema.index({ userId: 1, promoCodeId: 1 }, { unique: true });

module.exports = mongoose.models.Redemption || mongoose.model('Redemption', RedemptionSchema);
