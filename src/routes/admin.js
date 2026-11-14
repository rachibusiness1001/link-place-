const express = require('express');
const router = express.Router();
const User = require('../models/User');
const SearchLog = require('../models/SearchLog');
const PromoCode = require('../models/PromoCode');

// Get Dashboard Stats
router.get('/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalSearches = await SearchLog.countDocuments();
    const totalCreditsDistributed = await PromoCode.aggregate([{ $match: { isActive: true } }, { $group: { _id: null, total: { $sum: { $multiply: ["$credits", "$currentUses"] } } } }]);
    
    // Recent users
    const recentUsers = await User.find().sort({ createdAt: -1 }).limit(5);

    res.json({
      totalUsers,
      totalSearches,
      creditsDistributed: totalCreditsDistributed[0]?.total || 0,
      recentUsers
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all users
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user (block/unblock, plan change, add credits)
router.put('/users/:id', async (req, res) => {
  try {
    const { isBlocked, plan, addCredits } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (isBlocked !== undefined) user.isBlocked = isBlocked;
    if (plan !== undefined) user.plan = plan;
    if (addCredits) user.credits += addCredits;

    await user.save();
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create promo code
router.post('/promo-codes', async (req, res) => {
  try {
    const { code, credits, maxUses, expiresAt } = req.body;
    
    const newCode = new PromoCode({
      code: code.toUpperCase(),
      credits,
      maxUses,
      expiresAt: expiresAt || null,
      createdBy: req.user ? req.user._id : null
    });

    await newCode.save();
    res.json(newCode);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Promo code already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Get all promo codes
router.get('/promo-codes', async (req, res) => {
  try {
    const codes = await PromoCode.find().sort({ createdAt: -1 });
    res.json(codes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deactivate promo code
router.put('/promo-codes/:id/deactivate', async (req, res) => {
  try {
    const code = await PromoCode.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    res.json(code);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get search logs
router.get('/search-logs', async (req, res) => {
  try {
    const logs = await SearchLog.find().sort({ createdAt: -1 }).limit(100);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
