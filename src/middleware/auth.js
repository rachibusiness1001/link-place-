const admin = require('firebase-admin');
const User = require('../models/User');

// Initialize Firebase Admin (Needs FIREBASE_SERVICE_ACCOUNT in .env)
try {
  if (!admin.apps.length && process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('=> Firebase Admin initialized');
  }
} catch (error) {
  console.error('=> Firebase Admin initialization error:', error);
}

// Middleware to verify Firebase token
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // For development without Firebase, allow a bypass token
    if (process.env.NODE_ENV === 'development' && token === 'dev-admin-token') {
      req.user = { uid: 'dev-admin', email: 'admin@dev.com', role: 'admin' };
      return next();
    }

    if (!admin.apps.length) {
      return res.status(500).json({ error: 'Firebase Admin not configured on server' });
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Find user in MongoDB
    const user = await User.findOne({ firebaseUid: decodedToken.uid });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found in database' });
    }

    if (user.isBlocked) {
      return res.status(403).json({ error: 'Your account has been blocked.' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
  next();
};

module.exports = { requireAuth, requireAdmin };
