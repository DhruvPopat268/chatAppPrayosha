const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['text', 'image', 'file', 'voice'],
    default: 'text'
  },
  fileName: String,
  fileSize: String,
  isRead: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for efficient querying of conversations
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });

// TTL index: auto-delete messages 1 hour after creation
// MongoDB TTL monitor runs ~once per minute, so deletions are approximate
messageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60, name: 'message_ttl_1h' });

module.exports = mongoose.model("Message", messageSchema); 