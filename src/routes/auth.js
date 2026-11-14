const express = require('express');
const router = express.Router();
const User = require('../models/User');
const admin = require('firebase-admin');

// Sync user from Firebase to MongoDB
router.post('/sync', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    }
    const token = authHeader.split('Bearer ')[1];
    
    // For development without Firebase
    let uid = 'dev-uid';
    let email = 'dev@user.com';
    let name = 'Dev User';
    let avatar = '';

    if (process.env.NODE_ENV !== 'development' || token !== 'dev-token') {
      if (!admin.apps.length) return res.status(500).json({ error: 'Firebase Admin not configured' });
      const decodedToken = await admin.auth().verifyIdToken(token);
      uid = decodedToken.uid;
      email = decodedToken.email;
      name = decodedToken.name || '';
      avatar = decodedToken.picture || '';
    }

    let user = await User.findOne({ firebaseUid: uid });
    if (!user) {
      user = new User({
        firebaseUid: uid,
        email,
        name,
        avatar,
        credits: 50 // Give 50 free credits on sign up
      });
      await user.save();
    } else {
      user.lastLoginAt = new Date();
      await user.save();
    }

    res.json(user);
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
