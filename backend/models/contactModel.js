const mongoose = require("mongoose");

const contactSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  contactId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  }
}, { 
  timestamps: true
});

// Compound index to ensure unique relationships
contactSchema.index({ userId: 1, contactId: 1 }, { unique: true });

// Pre-save middleware to validate that both users exist
contactSchema.pre('save', async function(next) {
  try {
    const User = mongoose.model('User');
    
    // Check if both users exist
    const [user1, user2] = await Promise.all([
      User.findById(this.userId),
      User.findById(this.contactId)
    ]);
    
    if (!user1 || !user2) {
      return next(new Error('One or both users do not exist'));
    }
    
    // Prevent self-contact
    if (this.userId.toString() === this.contactId.toString()) {
      return next(new Error('Cannot add yourself as a contact'));
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model("Contact", contactSchema); 