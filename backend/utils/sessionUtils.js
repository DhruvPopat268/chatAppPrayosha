const Session = require('../models/sessionModel');

// Clean up expired sessions - now works with 1-day TTL
const cleanupExpiredSessions = async () => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Mark sessions older than 1 day as inactive (they will be deleted by TTL)
    const result = await Session.updateMany(
      { 
        lastActivity: { $lt: oneDayAgo },
        isActive: true 
      },
      { isActive: false }
    );
    
    if (result.modifiedCount > 0) {
      console.log(`🧹 Session Cleanup: Marked ${result.modifiedCount} sessions as inactive (will be deleted by TTL in ~1 day)`);
    }
    
    return {
      markedInactive: result.modifiedCount,
      message: "Sessions marked inactive. TTL will delete them automatically after 1 day."
    };
  } catch (error) {
    console.error('Error cleaning up expired sessions:', error);
    return { error: error.message };
  }
};

// Force cleanup - manually delete sessions older than 1 day
const forceCleanupOldSessions = async () => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Delete all sessions older than 1 day (both active and inactive)
    const result = await Session.deleteMany({
      lastActivity: { $lt: oneDayAgo }
    });
    
    console.log(`🧹 Force Cleanup: Deleted ${result.deletedCount} old sessions`);
    return result.deletedCount;
  } catch (error) {
    console.error('Error in force cleanup:', error);
    return 0;
  }
};

// Get active sessions count for a user
const getActiveSessionsCount = async (username) => {
  try {
    const count = await Session.countDocuments({ 
      username: username, 
      isActive: true 
    });
    return count;
  } catch (error) {
    console.error('Error getting active sessions count:', error);
    return 0;
  }
};

// Deactivate all sessions for a user
const deactivateAllUserSessions = async (username) => {
  try {
    const result = await Session.updateMany(
      { username: username, isActive: true },
      { isActive: false }
    );
    return result.modifiedCount;
  } catch (error) {
    console.error('Error deactivating user sessions:', error);
    return 0;
  }
};

module.exports = {
  cleanupExpiredSessions,
  forceCleanupOldSessions,
  getActiveSessionsCount,
  deactivateAllUserSessions
}; 