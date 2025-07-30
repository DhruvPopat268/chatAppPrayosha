const express = require("express");
const jwt = require("jsonwebtoken");
const Message = require("../models/messageModel");
const User = require("../models/authModel");
const router = express.Router();
const mongoose = require('mongoose');

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid token" });
    }
    req.user = user;
    next();
  });
};

// Get messages between two users
router.get('/:receiverId', authenticateToken, async (req, res) => {
  try {
    const { receiverId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const messages = await Message.find({
      $or: [
        { senderId: req.user.userId, receiverId: receiverId },
        { senderId: receiverId, receiverId: req.user.userId }
      ]
    })
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .populate('senderId', 'username')
    .populate('receiverId', 'username')
    .lean();

    // Mark messages as read
    await Message.updateMany(
      {
        senderId: receiverId,
        receiverId: req.user.userId,
        isRead: false
      },
      { isRead: true }
    );

    res.json(messages.reverse()); // Return in chronological order
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// Send a message
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { receiverId, content, type = 'text', fileName, fileSize } = req.body;

    if (!receiverId || !content) {
      return res.status(400).json({ error: "Receiver ID and content are required" });
    }

    const message = await Message.create({
      senderId: req.user.userId,
      receiverId,
      content,
      type,
      fileName,
      fileSize
    });

    const populatedMessage = await Message.findById(message._id)
      .populate('senderId', 'username')
      .populate('receiverId', 'username');

    res.status(201).json(populatedMessage);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// Mark messages as read
router.put('/read/:senderId', authenticateToken, async (req, res) => {
  try {
    const { senderId } = req.params;

    await Message.updateMany(
      {
        senderId: senderId,
        receiverId: req.user.userId,
        isRead: false
      },
      { isRead: true }
    );

    res.json({ message: "Messages marked as read" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to mark messages as read" });
  }
});

// Get unread message count
router.get('/unread/count', authenticateToken, async (req, res) => {
  try {
    const unreadCounts = await Message.aggregate([
      {
        $match: {
          receiverId: new mongoose.Types.ObjectId(req.user.userId),
          isRead: false
        }
      },
      {
        $group: {
          _id: '$senderId',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json(unreadCounts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get unread count" });
  }
});

// Delete all messages between current user and receiver
router.delete('/:receiverId', authenticateToken, async (req, res) => {
  try {
    const { receiverId } = req.params;
    // Delete messages where current user is sender or receiver and receiverId is the other party
    await Message.deleteMany({
      $or: [
        { senderId: req.user.userId, receiverId: receiverId },
        { senderId: receiverId, receiverId: req.user.userId }
      ]
    });
    res.json({ message: 'Chat history deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete chat history' });
  }
});

module.exports = router; 