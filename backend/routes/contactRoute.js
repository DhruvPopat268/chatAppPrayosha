const express = require("express");
const Contact = require("../models/contactModel");
const User = require("../models/authModel");
const router = express.Router();

// Get all contacts for a user
router.get('/', async (req, res) => {
  try {
    const contacts = await Contact.find({ userId: req.user._id })
      .populate('contactId', 'username email _id')
      .select('-__v');
    
    // Filter out contacts with null contactId (deleted users) and map to frontend format
    const validContacts = contacts
      .filter(contact => contact.contactId !== null) // Filter out null references
      .map(contact => ({
        id: contact.contactId._id,
        name: contact.contactId.username,
        email: contact.contactId.email,
        avatar: "/placeholder.svg?height=40&width=40",
        lastMessage: "",
        timestamp: "Just now",
        online: false,
        unread: 0
      }));
    
    // Automatically cleanup orphaned contacts in the background
    const orphanedContacts = contacts.filter(contact => contact.contactId === null);
    if (orphanedContacts.length > 0) {
      const orphanedIds = orphanedContacts.map(contact => contact._id);
      Contact.deleteMany({ _id: { $in: orphanedIds } })
        .then(() => {
          console.log(`Auto-cleaned up ${orphanedContacts.length} orphaned contacts for user ${req.user._id}`);
        })
        .catch(err => {
          console.error('Error auto-cleaning orphaned contacts:', err);
        });
    }
    
    res.json(validContacts);
  } catch (err) {
    console.error('Error fetching contacts:', err);
    res.status(500).json({ error: "Failed to fetch contacts" });
  }
});

// Add a contact
router.post('/', async (req, res) => {
  const { contactId } = req.body;
  
  if (!contactId) {
    return res.status(400).json({ error: "Contact ID is required" });
  }

  // Prevent adding yourself as a contact
  if (contactId === req.user._id) {
    return res.status(400).json({ error: "Cannot add yourself as a contact" });
  }

  try {
    // Check if contact exists
    const contactUser = await User.findById(contactId);
    if (!contactUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if already a contact
    const existingContact = await Contact.findOne({
      userId: req.user._id,
      contactId: contactId
    });

    if (existingContact) {
      return res.status(400).json({ error: "User is already in your contacts" });
    }

    // Add contact (mutual relationship)
    const newContact = await Contact.create({
      userId: req.user._id,
      contactId: contactId
    });

    // Also add the reverse relationship
    const reverseContact = await Contact.create({
      userId: contactId,
      contactId: req.user._id
    });

    res.status(201).json({ 
      message: "Contact added successfully",
      contact: {
        id: contactUser._id,
        name: contactUser.username,
        email: contactUser.email,
        avatar: "/placeholder.svg?height=40&width=40"
      }
    });
  } catch (err) {
    console.error('Error adding contact:', err);
    
    // Handle specific mongoose errors
    if (err.code === 11000) {
      return res.status(400).json({ error: "Contact relationship already exists" });
    }
    
    if (err.message === 'One or both users do not exist') {
      return res.status(404).json({ error: "User not found" });
    }
    
    if (err.message === 'Cannot add yourself as a contact') {
      return res.status(400).json({ error: "Cannot add yourself as a contact" });
    }
    
    res.status(500).json({ error: "Failed to add contact" });
  }
});

// Remove a contact
router.delete('/:contactId', async (req, res) => {
  const { contactId } = req.params;

  try {
    // Remove both directions of the relationship
    await Contact.deleteMany({
      $or: [
        { userId: req.user._id, contactId: contactId },
        { userId: contactId, contactId: req.user._id }
      ]
    });

    res.json({ message: "Contact removed successfully" });
  } catch (err) {
    console.error('Error removing contact:', err);
    res.status(500).json({ error: "Failed to remove contact" });
  }
});

// Cleanup orphaned contacts (contacts that reference deleted users)
router.post('/cleanup', async (req, res) => {
  try {
    // Find all contacts for the current user
    const userContacts = await Contact.find({ userId: req.user._id });
    
    // Check which contacts reference valid users
    const validContactIds = [];
    const orphanedContactIds = [];
    
    for (const contact of userContacts) {
      const userExists = await User.findById(contact.contactId);
      if (userExists) {
        validContactIds.push(contact.contactId);
      } else {
        orphanedContactIds.push(contact._id);
      }
    }
    
    // Remove orphaned contacts
    if (orphanedContactIds.length > 0) {
      await Contact.deleteMany({ _id: { $in: orphanedContactIds } });
      console.log(`Cleaned up ${orphanedContactIds.length} orphaned contacts for user ${req.user._id}`);
    }
    
    res.json({ 
      message: "Cleanup completed",
      removedCount: orphanedContactIds.length,
      validContactsCount: validContactIds.length
    });
  } catch (err) {
    console.error('Error during contact cleanup:', err);
    res.status(500).json({ error: "Failed to cleanup contacts" });
  }
});

// Debug endpoint to check contact status
router.get('/debug', async (req, res) => {
  try {
    const contacts = await Contact.find({ userId: req.user._id })
      .populate('contactId', 'username email _id')
      .select('-__v');
    
    const contactStatus = contacts.map(contact => ({
      contactId: contact.contactId,
      hasValidReference: contact.contactId !== null,
      username: contact.contactId?.username || 'DELETED_USER',
      email: contact.contactId?.email || 'N/A'
    }));
    
    const orphanedCount = contactStatus.filter(c => !c.hasValidReference).length;
    const validCount = contactStatus.filter(c => c.hasValidReference).length;
    
    res.json({
      totalContacts: contacts.length,
      validContacts: validCount,
      orphanedContacts: orphanedCount,
      contacts: contactStatus
    });
  } catch (err) {
    console.error('Error in contact debug:', err);
    res.status(500).json({ error: "Failed to debug contacts" });
  }
});

module.exports = router; 