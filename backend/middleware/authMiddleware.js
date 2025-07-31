const jwt = require("jsonwebtoken");
const Session = require("../models/sessionModel");
const User = require("../models/authModel");

const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if session exists and is active
    const session = await Session.findOne({
      token: token,
      isActive: true,
      userId: decoded.userId
    });

    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session. Please login again.' });
    }

    // Get user details
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found.' });
    }

    // Update last activity
    await Session.updateOne(
      { _id: session._id },
      { lastActivity: new Date() }
    );

    // Add user and session info to request
    req.user = user;
    req.session = session;
    req.token = token;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token.' });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please login again.' });
    }
    
    return res.status(500).json({ error: 'Authentication error.' });
  }
};

module.exports = authMiddleware; 