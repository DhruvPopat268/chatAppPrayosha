const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  username: {
    type: String,
    required: true,
    index: true
  },
  token: {
    type: String,
    required: true,
    unique: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  userAgent: String,
  ipAddress: String
}, { 
  timestamps: true 
});

// Index for efficient querying
sessionSchema.index({ userId: 1, isActive: 1 });
sessionSchema.index({ username: 1, isActive: 1 });
sessionSchema.index({ token: 1, isActive: 1 });

// TTL: delete sessions 7 days after creation
// Uses Mongoose timestamps -> createdAt
sessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60, name: 'session_ttl_createdAt_7d' });

module.exports = mongoose.model("Session", sessionSchema); 