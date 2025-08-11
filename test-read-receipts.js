const { io } = require('socket.io-client');

// Configuration
const BACKEND_URL = 'http://localhost:3001'; // Change this to your backend URL
const TEST_USER_1_TOKEN = 'your-test-user-1-jwt-token'; // Replace with actual JWT token
const TEST_USER_2_TOKEN = 'your-test-user-2-jwt-token'; // Replace with actual JWT token

console.log('🧪 Testing Read Receipt Functionality');
console.log('=====================================');

// Test 1: User 1 connects and authenticates
console.log('\n📱 Test 1: User 1 connecting...');
const user1Socket = io(BACKEND_URL);

user1Socket.on('connect', () => {
  console.log('✅ User 1 connected to server');
  
  // Authenticate User 1
  user1Socket.emit('authenticate', TEST_USER_1_TOKEN);
});

user1Socket.on('authenticated', (data) => {
  console.log('✅ User 1 authenticated:', data);
  
  // Test 2: User 2 connects and authenticates
  console.log('\n📱 Test 2: User 2 connecting...');
  const user2Socket = io(BACKEND_URL);
  
  user2Socket.on('connect', () => {
    console.log('✅ User 2 connected to server');
    
    // Authenticate User 2
    user2Socket.emit('authenticate', TEST_USER_2_TOKEN);
  });
  
  user2Socket.on('authenticated', (data) => {
    console.log('✅ User 2 authenticated:', data);
    
    // Test 3: User 1 sends a message to User 2
    console.log('\n📝 Test 3: User 1 sending message to User 2...');
    user1Socket.emit('send_message', {
      receiverId: 'user2-id', // Replace with actual User 2 ID
      content: 'Hello User 2! This is a test message for read receipts.',
      type: 'text'
    });
    
    user1Socket.on('message_sent', (data) => {
      console.log('✅ Message sent successfully:', data);
      
      // Test 4: User 2 opens the chat (triggers read receipt)
      console.log('\n📖 Test 4: User 2 opening chat with User 1...');
      user2Socket.emit('chat_opened', {
        senderId: 'user1-id' // Replace with actual User 1 ID
      });
      
      // Listen for chat opened confirmation
      user2Socket.on('chat_opened_confirmation', (data) => {
        console.log('✅ Chat opened confirmation received:', data);
      });
      
      // Listen for chat opened errors
      user2Socket.on('chat_opened_error', (error) => {
        console.error('❌ Chat opened error:', error);
      });
    });
    
    // Listen for new message on User 2's side
    user2Socket.on('new_message', (message) => {
      console.log('✅ User 2 received new message:', message);
    });
    
    // Listen for read receipt on User 1's side
    user1Socket.on('messages_read_by_receiver', (data) => {
      console.log('✅ User 1 received read receipt:', data);
      console.log('🎯 READ RECEIPT TEST PASSED!');
      
      // Clean up and exit
      setTimeout(() => {
        console.log('\n🧹 Cleaning up connections...');
        user1Socket.disconnect();
        user2Socket.disconnect();
        process.exit(0);
      }, 2000);
    });
    
    // Listen for message errors
    user1Socket.on('message_error', (error) => {
      console.error('❌ Message error:', error);
    });
  });
  
  user2Socket.on('auth_error', (error) => {
    console.error('❌ User 2 authentication failed:', error);
  });
});

user1Socket.on('auth_error', (error) => {
  console.error('❌ User 1 authentication failed:', error);
});

user1Socket.on('connect_error', (error) => {
  console.error('❌ User 1 connection error:', error);
});

// Handle disconnections
user1Socket.on('disconnect', (reason) => {
  console.log('📴 User 1 disconnected:', reason);
});

// Timeout after 30 seconds
setTimeout(() => {
  console.log('⏰ Test timeout - cleaning up...');
  user1Socket.disconnect();
  process.exit(1);
}, 30000);

console.log('\n💡 Instructions:');
console.log('1. Replace TEST_USER_1_TOKEN with a valid JWT token for User 1');
console.log('2. Replace TEST_USER_2_TOKEN with a valid JWT token for User 2');
console.log('3. Replace user1-id and user2-id with actual user IDs from your database');
console.log('4. Make sure your backend server is running');
console.log('5. Run: node test-read-receipts.js');
