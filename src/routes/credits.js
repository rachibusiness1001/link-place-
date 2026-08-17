const express = require('express');
const router = express.Router();
const PromoCode = require('../models/PromoCode');
const Redemption = require('../models/Redemption');
const User = require('../models/User');

// Redeem a promo code
router.post('/redeem', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code is required' });
    
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const userId = req.user._id;

    // 1. Find the promo code
    const promo = await PromoCode.findOne({ code: code.toUpperCase() });
    if (!promo) return res.status(404).json({ error: 'Invalid promo code' });

    // 2. Check if active and not expired
    if (!promo.isActive) return res.status(400).json({ error: 'This promo code is inactive' });
    if (promo.expiresAt && new Date() > promo.expiresAt) return res.status(400).json({ error: 'This promo code has expired' });

    // 3. Check if max uses reached
    if (promo.maxUses > 0 && promo.currentUses >= promo.maxUses) {
      return res.status(400).json({ error: 'This promo code has reached its usage limit' });
    }

    // 4. Check if user already redeemed this code
    const existingRedemption = await Redemption.findOne({ userId, promoCodeId: promo._id });
    if (existingRedemption) {
      return res.status(400).json({ error: 'You have already redeemed this promo code' });
    }

    // 5. Apply credits
    const user = await User.findById(userId);
    user.credits += promo.credits;
    await user.save();

    // 6. Create redemption record
    const redemption = new Redemption({
      userId,
      promoCodeId: promo._id,
      code: promo.code,
      creditsAwarded: promo.credits
    });
    await redemption.save();

    // 7. Update promo code usage count
    promo.currentUses += 1;
    await promo.save();

    res.json({ message: 'Promo code redeemed successfully', creditsAwarded: promo.credits, newTotal: user.credits });
  } catch (error) {
    if (error.code === 11000) {
        return res.status(400).json({ error: 'You have already redeemed this promo code' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Get user credit balance
router.get('/balance', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const user = await User.findById(req.user._id);
    res.json({ credits: user.credits });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
