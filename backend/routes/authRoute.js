const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/authModel");
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

// Update login route to username only
router.post("/login", async (req, res) => {
  const { username } = req.body;
  if (!username)
    return res.status(400).json({ error: "username is required" });
  try {
    const user = await User.findOne({ username });
    if (!user)
      return res.status(400).json({ error: "Invalid username" });
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
    res.json({
      token,
      user: { id: user._id, username: user.username },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

  router.post("/logout", (req, res) => {
    // Frontend should delete token, but sending OK response
    res.json({ message: "Logged out successfully" });
  });

// Admin-only delete user route
router.delete("/:id", isAdmin, async (req, res) => {
  const { id } = req.params;
  try {
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
  

module.exports = router;
