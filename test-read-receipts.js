// 🧪 Read Receipts Test Script
// Run this in your browser console to test read receipts functionality

console.log('🧪 Read Receipts Test Script Loaded');

// Test functions
const testReadReceipts = {
  // Check if socket is connected
  checkSocketConnection: () => {
    const socket = window.socketManager?.getSocket();
    if (socket) {
      console.log('✅ Socket connected:', socket.connected);
      console.log('🔌 Socket ID:', socket.id);
      return true;
    } else {
      console.log('❌ Socket not available');
      return false;
    }
  },

  // Check current user
  checkCurrentUser: () => {
    const user = window.getCurrentUser?.();
    if (user) {
      console.log('✅ Current user:', user);
      return user;
    } else {
      console.log('❌ No current user found');
      return null;
    }
  },

  // Check selected contact
  checkSelectedContact: () => {
    // This depends on your React component state
    console.log('ℹ️ Check the selected contact in the UI');
    return null;
  },

  // Test sending chat_opened event
  testChatOpened: (contactId) => {
    if (!contactId) {
      console.log('❌ Please provide a contact ID');
      return;
    }

    if (window.socketManager?.isSocketConnected()) {
      console.log(`📖 Testing chat_opened event for contact: ${contactId}`);
      window.socketManager.sendChatOpened(contactId);
      console.log('✅ chat_opened event sent');
    } else {
      console.log('❌ Socket not connected');
    }
  },

  // Test read receipts request
  testReadReceiptsRequest: (lastSeen) => {
    if (!lastSeen) {
      lastSeen = Date.now() - (5 * 60 * 1000); // 5 minutes ago
    }

    if (window.socketManager?.isSocketConnected()) {
      console.log(`📖 Testing read receipts request since: ${new Date(lastSeen).toISOString()}`);
      window.socketManager.requestReadReceipts(lastSeen);
      console.log('✅ read receipts request sent');
    } else {
      console.log('❌ Socket not connected');
    }
  },

  // Check message read status
  checkMessageReadStatus: () => {
    // This depends on your React component state
    console.log('ℹ️ Check message read status in the UI');
    console.log('Look for:');
    console.log('  - Single gray tick (⚪) = sent but not read');
    console.log('  - Double blue ticks (🔵🔵) = read');
  },

  // Run all tests
  runAllTests: () => {
    console.log('🚀 Running all read receipts tests...');
    
    const socketOk = this.checkSocketConnection();
    const userOk = this.checkCurrentUser();
    
    if (socketOk && userOk) {
      console.log('✅ Basic setup is working');
      console.log('📱 Now test by:');
      console.log('  1. Send a message to another user');
      console.log('  2. Check that it shows single tick (⚪)');
      console.log('  3. Have the other user open the chat');
      console.log('  4. Check that your message now shows double ticks (🔵🔵)');
    } else {
      console.log('❌ Setup issues found, fix them first');
    }
  }
};

// Make test functions globally available
window.testReadReceipts = testReadReceipts;

console.log('📋 Available test functions:');
console.log('  - testReadReceipts.checkSocketConnection()');
console.log('  - testReadReceipts.checkCurrentUser()');
console.log('  - testReadReceipts.testChatOpened(contactId)');
console.log('  - testReadReceipts.testReadReceiptsRequest(lastSeen)');
console.log('  - testReadReceipts.checkMessageReadStatus()');
console.log('  - testReadReceipts.runAllTests()');
console.log('');
console.log('💡 Run testReadReceipts.runAllTests() to start testing!');
