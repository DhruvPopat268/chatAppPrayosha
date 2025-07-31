const Session = require('../models/sessionModel');

// Clean up expired sessions
const cleanupExpiredSessions = async () => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const result = await Session.updateMany(
      { 
        lastActivity: { $lt: sevenDaysAgo },
        isActive: true 
      },
      { isActive: false }
    );
    
    if (result.modifiedCount > 0) {
      console.log(`Cleaned up ${result.modifiedCount} expired sessions`);
    }
  } catch (error) {
    console.error('Error cleaning up expired sessions:', error);
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
  getActiveSessionsCount,
  deactivateAllUserSessions
}; 