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
    enum: ['text', 'image', 'file', 'voice', 'link'],
    default: 'text'
  },
  // Optional link preview fields for hyperlink messages
  linkUrl: { type: String },
  linkTitle: { type: String },
  linkDescription: { type: String },
  linkImage: { type: String },
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

// Note: No TTL on messages by default; persistence is desired

module.exports = mongoose.model("Message", messageSchema); 