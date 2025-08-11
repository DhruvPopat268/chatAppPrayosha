const express = require("express");
const Message = require("../models/messageModel");
const User = require("../models/authModel");
const router = express.Router();
const mongoose = require('mongoose');

// Get messages between two users
router.get('/:receiverId', async (req, res) => {
  try {
    const { receiverId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const messages = await Message.find({
      $or: [
        { senderId: req.user._id, receiverId: receiverId },
        { senderId: receiverId, receiverId: req.user._id }
      ]
    })
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .populate('senderId', 'username')
    .populate('receiverId', 'username')
    .lean();

    // 🔥 REMOVED: Automatic marking as read - let socket system handle read receipts
    // This prevents conflicts between API and socket-based read receipt systems
    console.log(`📖 API: Messages loaded, read status will be handled by socket system`);

    res.json(messages.reverse()); // Return in chronological order
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// Send a message
router.post('/', async (req, res) => {
  try {
    const { receiverId, content, type = 'text', fileName, fileSize } = req.body;

    if (!receiverId || !content) {
      return res.status(400).json({ error: "Receiver ID and content are required" });
    }

    const message = await Message.create({
      senderId: req.user._id,
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
router.put('/read/:senderId', async (req, res) => {
  try {
    const { senderId } = req.params;

    await Message.updateMany(
      {
        senderId: senderId,
        receiverId: req.user._id,
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
router.get('/unread/count', async (req, res) => {
  try {
    const unreadCounts = await Message.aggregate([
      {
        $match: {
          receiverId: new mongoose.Types.ObjectId(req.user._id),
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
router.delete('/:receiverId', async (req, res) => {
  try {
    const { receiverId } = req.params;
    // Delete messages where current user is sender or receiver and receiverId is the other party
    await Message.deleteMany({
      $or: [
        { senderId: req.user._id, receiverId: receiverId },
        { senderId: receiverId, receiverId: req.user._id }
      ]
    });
    res.json({ message: 'Chat history deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete chat history' });
  }
});

module.exports = router; 