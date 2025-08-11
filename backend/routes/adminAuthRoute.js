const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Admin = require("../models/adminModel");
const router = express.Router();

// Middleware to verify admin JWT token
const verifyAdminToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: "Access token required" });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(decoded.adminId);
    if (!admin) {
      return res.status(401).json({ error: "Invalid token" });
    }
    
    req.admin = admin;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

// Admin signup
router.post("/signup", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "Username and password are required" });
  try {
    const existing = await Admin.findOne({ username });
    if (existing)
      return res.status(400).json({ error: "Username already taken" });
    const hashedPassword = await bcrypt.hash(password, 10);
    const newAdmin = await Admin.create({ username, password: hashedPassword });
    res.status(201).json({ admin: { username: newAdmin.username, id: newAdmin._id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "Username and password are required" });
  try {
    const admin = await Admin.findOne({ username });
    if (!admin)
      return res.status(400).json({ error: "Invalid username or password" });
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch)
      return res.status(400).json({ error: "Invalid username or password" });
    const token = jwt.sign({ adminId: admin._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
    // Set httpOnly cookie for admin session
    res.cookie('admin_session', admin._id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    res.json({ token, admin: { id: admin._id, username: admin.username } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Update admin profile (username and password) - Now uses JWT token
router.put("/profile", verifyAdminToken, async (req, res) => {
  const { username, password, currentPassword } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: "Username and new password are required" });
  }
  
  try {
    const admin = req.admin; // From middleware
    
    // Only verify current password if it's provided
    if (currentPassword) {
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, admin.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }
    }
    
    // Check if new username is already taken by another admin
    if (username !== admin.username) {
      const existingAdmin = await Admin.findOne({ username });
      if (existingAdmin) {
        return res.status(400).json({ error: "Username already taken" });
      }
    }
    
    // Hash new password and update admin
    const hashedPassword = await bcrypt.hash(password, 10);
    admin.username = username;
    admin.password = hashedPassword;
    await admin.save();
    
    res.json({ 
      success: true, 
      admin: { id: admin._id, username: admin.username } 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Validate admin token
router.get("/validate", verifyAdminToken, async (req, res) => {
  try {
    res.json({ 
      valid: true, 
      admin: { id: req.admin._id, username: req.admin.username } 
    });
  } catch (err) {
    res.status(401).json({ valid: false, error: "Invalid token" });
  }
});

// Manual session cleanup trigger (admin only)
router.post("/cleanup-sessions", verifyAdminToken, async (req, res) => {
  try {
    const { forceCleanup } = require('../utils/sessionUtils');
    const deletedCount = await forceCleanup();
    
    res.json({ 
      success: true, 
      message: "Session cleanup completed",
      deletedCount 
    });
  } catch (err) {
    console.error('Error triggering cleanup:', err);
    res.status(500).json({ error: "Failed to trigger cleanup" });
  }
});

module.exports = router; 