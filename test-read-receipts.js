const io = require('socket.io-client');

// Test configuration
const BACKEND_URL = 'http://localhost:5000';
const USER1_TOKEN = 'your_user1_jwt_token_here';
const USER2_TOKEN = 'your_user2_jwt_token_here';

// Test users (replace with actual user IDs from your database)
const USER1_ID = 'user1_id_here';
const USER2_ID = 'user2_id_here';

async function testReadReceipts() {
  console.log('🧪 Starting read receipt test...');

  // Create socket connections for both users
  const user1Socket = io(BACKEND_URL);
  const user2Socket = io(BACKEND_URL);

  // Connect and authenticate user 1
  user1Socket.on('connect', () => {
    console.log('✅ User 1 connected');
    user1Socket.emit('authenticate', USER1_TOKEN);
  });

  user1Socket.on('authenticated', () => {
    console.log('✅ User 1 authenticated');
  });

  // Connect and authenticate user 2
  user2Socket.on('connect', () => {
    console.log('✅ User 2 connected');
    user2Socket.emit('authenticate', USER2_TOKEN);
  });

  user2Socket.on('authenticated', () => {
    console.log('✅ User 2 authenticated');
  });

  // Test sending a message from user 1 to user 2
  user1Socket.on('message_sent', (message) => {
    console.log('📝 Message sent by user 1:', message);
    
    // Wait a bit then simulate user 2 opening the chat
    setTimeout(() => {
      console.log(`📖 Testing chat_opened event for contact: ${USER1_ID}`);
      user2Socket.emit('chat_opened', { senderId: USER1_ID });
    }, 1000);
  });

  // Listen for read receipt on user 1
  user1Socket.on('messages_read_by_receiver', (data) => {
    console.log('📖 User 1 received read receipt:', data);
  });

  // Listen for chat opened confirmation on user 2
  user2Socket.on('chat_opened_confirmation', (data) => {
    console.log('📖 User 2 received chat opened confirmation:', data);
  });

  // Send a test message from user 1 to user 2
  setTimeout(() => {
    console.log('📝 Sending test message from user 1 to user 2...');
    user1Socket.emit('send_message', {
      receiverId: USER2_ID,
      content: 'Test message for read receipts',
      type: 'text'
    });
  }, 2000);

  // Cleanup after test
  setTimeout(() => {
    console.log('🧹 Cleaning up test connections...');
    user1Socket.disconnect();
    user2Socket.disconnect();
    process.exit(0);
  }, 10000);
}

// Handle errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Start the test
testReadReceipts().catch(console.error);
