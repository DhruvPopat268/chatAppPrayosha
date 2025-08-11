const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/authModel");
const Session = require("../models/sessionModel");
const router = express.Router();

// Middleware to check if request is from admin (simple username check for now)
function isAdmin(req, res, next) {
  // For simplicity, check for a hardcoded admin username in the request body or header
  // In production, use proper authentication/authorization
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  if (
    (req.body && req.body.admin === true) ||
    (req.headers['x-admin'] === 'true') ||
    (req.body && req.body.username === adminUsername)
  ) {
    return next();
  }
  return res.status(403).json({ error: 'Only admin can perform this action' });
}

// Admin-only signup route (no password)
router.post("/signup", isAdmin, async (req, res) => {
  const { username } = req.body;
  if (!username)
    return res.status(400).json({ error: "Username is required" });

  try {
    const existing = await User.findOne({ username });
    if (existing)
      return res.status(400).json({ error: "Username already taken" });

    const newUser = await User.create({
      username
    });

    res.status(201).json({ user: { username, id: newUser._id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get('/', async (req, res) => {
    try {
      const users = await User.find({ }); // return only basic fields
      res.status(200).json(users);
    } catch (err) {
      res.status(500).json({ message: 'Failed to fetch users', error: err.message });
    }
  });

// Search users endpoint
router.get('/search', async (req, res) => {
  const { q } = req.query;
  
  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    // Search for users whose username contains the query (case-insensitive)
    const users = await User.find({
      username: { $regex: q, $options: 'i' }
    }).select('_id username'); // Only return id and username for security

    res.status(200).json(users);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Updated login route with session management
router.post("/login", async (req, res) => {
  const { username } = req.body;
  if (!username)
    return res.status(400).json({ error: "username is required" });
  
  try {
    const user = await User.findOne({ username });
    if (!user)
      return res.status(400).json({ error: "Invalid username" });

    // Check if user already has an active session
    const existingSession = await Session.findOne({ 
      username: user.username, 
      isActive: true 
    });

    if (existingSession) {
      // Deactivate the existing session
      await Session.updateOne(
        { _id: existingSession._id },
        { isActive: false }
      );
      console.log(`Deactivated existing session for user: ${username}`);
    }

    // Generate new token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    // Create new session
    const session = await Session.create({
      userId: user._id,
      username: user.username,
      token: token,
      isActive: true,
      lastActivity: new Date(),
      userAgent: req.headers['user-agent'] || '',
      ipAddress: req.ip || req.connection.remoteAddress || ''
    });

    console.log(`New session created for user: ${username}, sessionId: ${session._id}`);

    res.json({
      token,
      user: { id: user._id, username: user.username },
      sessionId: session._id
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: "Server error" });
  }
});

// Updated logout route
router.post("/logout", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (token) {
      // Deactivate the session
      await Session.updateOne(
        { token: token, isActive: true },
        { isActive: false }
      );
      console.log('Session deactivated on logout');
    }
    
    res.json({ message: "Logged out successfully" });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get active sessions for a user (admin only)
router.get("/sessions/:username", isAdmin, async (req, res) => {
  try {
    const { username } = req.params;
    const sessions = await Session.find({ 
      username: username, 
      isActive: true 
    }).select('-token'); // Don't send tokens for security
    
    res.json({ sessions });
  } catch (err) {
    console.error('Get sessions error:', err);
    res.status(500).json({ error: "Server error" });
  }
});

// Force logout all sessions for a user (admin only)
router.post("/force-logout/:username", isAdmin, async (req, res) => {
  try {
    const { username } = req.params;
    const result = await Session.updateMany(
      { username: username, isActive: true },
      { isActive: false }
    );
    
    console.log(`Force logged out ${result.modifiedCount} sessions for user: ${username}`);
    res.json({ message: `Force logged out ${result.modifiedCount} sessions` });
  } catch (err) {
    console.error('Force logout error:', err);
    res.status(500).json({ error: "Server error" });
  }
});

// Test endpoint to check session status (for debugging)
router.get("/session-status", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.json({ 
        authenticated: false, 
        message: 'No token provided' 
      });
    }

    const session = await Session.findOne({
      token: token,
      isActive: true
    });

    if (!session) {
      return res.json({ 
        authenticated: false, 
        message: 'No active session found' 
      });
    }

    res.json({
      authenticated: true,
      session: {
        id: session._id,
        username: session.username,
        lastActivity: session.lastActivity,
        userAgent: session.userAgent,
        ipAddress: session.ipAddress
      }
    });
  } catch (err) {
    console.error('Session status error:', err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin-only delete user route
router.delete("/:id", isAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    // First, deactivate all sessions for this user
    await Session.updateMany(
      { userId: id, isActive: true },
      { isActive: false }
    );
    
    const deleted = await User.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Update username (admin only)
router.put('/:id', isAdmin, async (req, res) => {
  const { id } = req.params;
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username is required' });
  try {
    // Check if username already exists for another user
    const existing = await User.findOne({ username, _id: { $ne: id } });
    if (existing) return res.status(400).json({ error: 'Username already taken' });
    const updated = await User.findByIdAndUpdate(id, { username }, { new: true });
    if (!updated) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, user: { id: updated._id, username: updated.username } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});
  

module.exports = router;
