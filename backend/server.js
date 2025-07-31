const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const socketIo = require("socket.io");
const jwt = require("jsonwebtoken");

dotenv.config();

const authRoutes = require("./routes/authRoute");
const contactRoutes = require("./routes/contactRoute");
const messageRoutes = require("./routes/messageRoute");
const adminAuthRoutes = require("./routes/adminAuthRoute");
const User = require('./models/authModel');
const Session = require('./models/sessionModel');
const { cleanupExpiredSessions } = require('./utils/sessionUtils');

const app = express();
const server = http.createServer(app);
const allowedOrigins = [
  "http://localhost:3000",
  "https://chat-app-prayosha.vercel.app/",
  "https://chat-app-prayosha-git-master-dhruvs-projects-cffe63d8.vercel.app",
  "https://chat-app-prayosha-hl15k3spo-dhruvs-projects-cffe63d8.vercel.app",
  "https://chat-app-prayosha.vercel.app"
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"]
  }
});



app.use(express.json());

const authMiddleware = require('./middleware/authMiddleware');

app.use("/api/auth", authRoutes);
app.use("/api/contacts", authMiddleware, contactRoutes);
app.use("/api/messages", authMiddleware, messageRoutes);
app.use("/api/admin-auth", adminAuthRoutes);



// In-memory push subscriptions (userId -> subscription)
const pushSubscriptions = new Map();

const axios = require('axios');

// Function to validate OneSignal playerId
async function validateOneSignalPlayerId(playerId) {
  try {
    if (!process.env.ONESIGNAL_REST_API_KEY) {
      console.error('OneSignal REST API key not configured');
      return false;
    }

    const response = await axios.get(`https://onesignal.com/api/v1/players/${playerId}`, {
      headers: {
        'Authorization': `Basic ${process.env.ONESIGNAL_REST_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    console.log("OneSignal playerId validation response:", response.data);
    // If we get a successful response, the playerId is valid
    return response.status === 200 && response.data;
  } catch (error) {
    console.log('Sending OneSignal notification with app_id:', process.env.ONESIGNAL_APP_ID);

    console.log('PlayerId validation failed:', error.response?.data || error.message);
    return false;
  }
}

// Function to send OneSignal call notification
async function sendCallNotification(receiverId, callerId, callType, roomId) {
  try {
    const user = await User.findById(receiverId);
    const playerId = user?.oneSignalPlayerId;

    if (!playerId) {
      console.log('No OneSignal playerId found for user', receiverId, '. User may not have subscribed to notifications.');
      return false;
    }

    console.log('Found playerId for user', receiverId, ':', playerId);
    
    // Check if OneSignal environment variables are set
    if (!process.env.ONESIGNAL_APP_ID || !process.env.ONESIGNAL_REST_API_KEY) {
      console.error('OneSignal environment variables not configured');
      return false;
    }
    
    const caller = await User.findById(callerId);
    const callTypeText = callType === 'video' ? 'Video Call' : 'Voice Call';
    
    console.log('Sending OneSignal call notification with app_id:', process.env.ONESIGNAL_APP_ID);
    console.log('Sending OneSignal call notification to player_id:', playerId);
    
    const notificationResponse = await axios.post('https://onesignal.com/api/v1/notifications', {
      app_id: process.env.ONESIGNAL_APP_ID,
      include_player_ids: [playerId],
      headings: { en: `${caller?.username || 'Someone'} is calling` },
      contents: { en: `Incoming ${callTypeText}` },
      url: '/chat',
      data: {
        type: 'call',
        callType: callType,
        callerId: callerId,
        receiverId: receiverId,
        roomId: roomId,
        callerName: caller?.username || 'Unknown'
      },
      // Add call-specific styling
      chrome_web_icon: callType === 'video' ? 'https://cdn-icons-png.flaticon.com/512/2991/2991110.png' : 'https://cdn-icons-png.flaticon.com/512/455/455705.png',
      priority: 10, // High priority for calls
      sound: 'default' // Play notification sound
    }, {
      headers: {
        'Authorization': `Basic ${process.env.ONESIGNAL_REST_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Check if the notification was actually sent successfully
    if (notificationResponse.data.id === '' || notificationResponse.data.errors) {
      console.error('OneSignal call notification failed for user', receiverId, ':', notificationResponse.data);
      
      // If the player is not subscribed, clear the invalid playerId
      if (notificationResponse.data.errors && notificationResponse.data.errors.includes('All included players are not subscribed')) {
        console.log('Clearing invalid playerId for user', receiverId);
        try {
          await User.updateOne({ _id: receiverId }, { $unset: { oneSignalPlayerId: 1 } });
          console.log('Invalid playerId cleared for user', receiverId);
        } catch (clearError) {
          console.error('Error clearing invalid playerId:', clearError);
        }
      }
      return false;
    } else {
      console.log('OneSignal call notification sent successfully to user', receiverId, 'with ID:', notificationResponse.data.id);
      return true;
    }
  } catch (err) {
    console.error('OneSignal call notification error for user', receiverId, ':', err.response?.data || err.message);
    
    // If the error is about invalid player ID, clear it
    if (err.response?.data?.errors && err.response.data.errors.includes('All included players are not subscribed')) {
      console.log('Player ID appears to be invalid. Clearing it for user', receiverId);
      try {
        await User.updateOne({ _id: receiverId }, { $unset: { oneSignalPlayerId: 1 } });
        console.log('Invalid playerId cleared for user', receiverId);
      } catch (clearError) {
        console.error('Error clearing invalid playerId:', clearError);
      }
    }
    return false;
  }
}

// Save OneSignal player ID for user
app.post('/api/save-onesignal-id', async (req, res) => {
  try {
    const { userId, playerId } = req.body;
    console.log('Received save-onesignal-id request:', { userId, playerId });

    if (!userId || !playerId) {
      console.error('Missing userId or playerId:', { userId, playerId });
      return res.status(400).json({ error: 'Missing userId or playerId' });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      console.error('User not found:', userId);
      return res.status(404).json({ error: 'User not found' });
    }

    // Update user with playerId
    const result = await User.updateOne({ _id: userId }, { $set: { oneSignalPlayerId: playerId } });
    console.log('Update result:', result);

    if (result.modifiedCount > 0) {
      console.log('PlayerId saved successfully for user:', userId);
      res.json({ success: true, message: 'PlayerId saved successfully' });
    } else {
      console.log('No changes made for user:', userId);
      res.json({ success: true, message: 'PlayerId already exists' });
    }
  } catch (error) {
    console.error('Error saving playerId:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Debug endpoint to check user notification status
app.get('/api/debug/notifications/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isOnline = connectedUsers.has(userId);
    const status = userStatus.get(userId);

    res.json({
      userId,
      username: user.username,
      oneSignalPlayerId: user.oneSignalPlayerId,
      isOnline,
      lastSeen: status?.lastSeen,
      hasPlayerId: !!user.oneSignalPlayerId,
      envVarsConfigured: {
        ONESIGNAL_APP_ID: !!process.env.ONESIGNAL_APP_ID,
        ONESIGNAL_REST_API_KEY: !!process.env.ONESIGNAL_REST_API_KEY
      }
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Debug endpoint to check all users with OneSignal playerIds
app.get('/api/debug/onesignal-users', async (req, res) => {
  try {
    const users = await User.find({ oneSignalPlayerId: { $exists: true, $ne: null } })
      .select('username oneSignalPlayerId createdAt');

    res.json({
      totalUsersWithPlayerId: users.length,
      users: users
    });
  } catch (error) {
    console.error('Debug OneSignal users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Debug endpoint to validate a specific user's OneSignal playerId
app.get('/api/debug/validate-player/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.oneSignalPlayerId) {
      return res.json({
        userId,
        username: user.username,
        hasPlayerId: false,
        message: 'No playerId found'
      });
    }

    // Try to validate the playerId with OneSignal
    try {
      const response = await axios.get(`https://onesignal.com/api/v1/players/${user.oneSignalPlayerId}`, {
        headers: {
          'Authorization': `Basic ${process.env.ONESIGNAL_REST_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      res.json({
        userId,
        username: user.username,
        playerId: user.oneSignalPlayerId,
        hasPlayerId: true,
        oneSignalData: response.data,
        isValid: true
      });
    } catch (oneSignalError) {
      res.json({
        userId,
        username: user.username,
        playerId: user.oneSignalPlayerId,
        hasPlayerId: true,
        isValid: false,
        error: oneSignalError.response?.data || oneSignalError.message
      });
    }
  } catch (error) {
    console.error('Debug validate player error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint to clear invalid playerId and force re-subscription
app.post('/api/debug/clear-player/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Clear the playerId
    await User.updateOne({ _id: userId }, { $unset: { oneSignalPlayerId: 1 } });

    res.json({
      success: true,
      message: 'PlayerId cleared successfully. User will need to re-subscribe to notifications.',
      userId,
      username: user.username
    });
  } catch (error) {
    console.error('Clear player error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint to clear all invalid playerIds
app.post('/api/debug/clear-all-invalid-players', async (req, res) => {
  try {
    const users = await User.find({ oneSignalPlayerId: { $exists: true, $ne: null } });
    const results = [];

    for (const user of users) {
      const isValid = await validateOneSignalPlayerId(user.oneSignalPlayerId);
      if (!isValid) {
        await User.updateOne({ _id: user._id }, { $unset: { oneSignalPlayerId: 1 } });
        results.push({
          userId: user._id,
          username: user.username,
          playerId: user.oneSignalPlayerId,
          cleared: true
        });
      } else {
        results.push({
          userId: user._id,
          username: user.username,
          playerId: user.oneSignalPlayerId,
          cleared: false
        });
      }
    }

    res.json({
      success: true,
      message: 'Invalid playerIds cleared successfully.',
      results
    });
  } catch (error) {
    console.error('Clear all invalid players error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Socket.IO connection handling
const connectedUsers = new Map(); // userId -> socketId
// Track last seen for users
const userStatus = new Map(); // userId -> { online: boolean, lastSeen: number }

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Authenticate user and store their socket connection
  socket.on('authenticate', (token) => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.userId;
      connectedUsers.set(userId, socket.id);
      socket.userId = userId;
      userStatus.set(userId, { online: true });
      // Broadcast to ALL users that this user is online
      io.emit('user_status', { userId, online: true });
      console.log(`User ${userId} authenticated and connected. Connected users:`, Array.from(connectedUsers.keys()));
    } catch (error) {
      console.error('Authentication failed:', error);
      socket.emit('auth_error', 'Authentication failed');
    }
  });

  // Handle sending messages
  socket.on('send_message', async (data) => {
    try {
      const { receiverId, content, type, fileName, fileSize } = data;

      // Save message to database
      const Message = require('./models/messageModel');
      const message = await Message.create({
        senderId: socket.userId,
        receiverId,
        content,
        type: type || 'text',
        fileName,
        fileSize
      });

      const populatedMessage = await Message.findById(message._id)
        .populate('senderId', 'username')
        .populate('receiverId', 'username');

      // Send to receiver if online
      console.log('Connected users before message:', Array.from(connectedUsers.keys()));
      console.log('Checking if user', receiverId, 'is connected:', connectedUsers.has(receiverId));
      const receiverSocketId = connectedUsers.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('new_message', populatedMessage);
      } else {
        // User is offline, send push notification via OneSignal if playerId is set
        console.log('User', receiverId, 'is not connected. Attempting to send push notification via OneSignal.');
        const user = await User.findById(receiverId);
        const playerId = user?.oneSignalPlayerId;

        if (playerId) {
          console.log('Found playerId for user', receiverId, ':', playerId);
          
          // Send notification directly to playerId (skip validation)

          try {
            // Check if OneSignal environment variables are set
            if (!process.env.ONESIGNAL_APP_ID || !process.env.ONESIGNAL_REST_API_KEY) {
              console.error('OneSignal environment variables not configured');
              return;
            }
            
            console.log('Sending OneSignal notification with app_id:', process.env.ONESIGNAL_APP_ID);
            console.log('Sending OneSignal notification to player_id:', playerId);
            
            console.log("About to send OneSignal payload:", JSON.stringify({
              app_id: process.env.ONESIGNAL_APP_ID,
              include_player_ids: [playerId],
            }, null, 2));
            
            const notificationResponse = await axios.post('https://onesignal.com/api/v1/notifications', {
              app_id: process.env.ONESIGNAL_APP_ID,
              include_player_ids: [playerId],
              headings: { en: populatedMessage.senderId.username + ' sent a message' },
              contents: { en: content },
              url: '/chat',
              data: {
                messageId: message._id.toString(),
                senderId: socket.userId,
                type: type || 'text'
              }
            }, {
              headers: {
                'Authorization': `Basic ${process.env.ONESIGNAL_REST_API_KEY}`,
                'Content-Type': 'application/json'
              }
            });
            
            // Check if the notification was actually sent successfully
            if (notificationResponse.data.id === '' || notificationResponse.data.errors) {
              console.error('OneSignal notification failed for user', receiverId, ':', notificationResponse.data);
              
              // If the player is not subscribed, clear the invalid playerId
              if (notificationResponse.data.errors && notificationResponse.data.errors.includes('All included players are not subscribed')) {
                console.log('Clearing invalid playerId for user', receiverId);
                try {
                  await User.updateOne({ _id: receiverId }, { $unset: { oneSignalPlayerId: 1 } });
                  console.log('Invalid playerId cleared for user', receiverId);
                } catch (clearError) {
                  console.error('Error clearing invalid playerId:', clearError);
                }
              }
            } else {
              console.log('OneSignal notification sent successfully to user', receiverId, 'with ID:', notificationResponse.data.id);
            }
          } catch (err) {
            console.error('OneSignal push notification error for user', receiverId, ':', err.response?.data || err.message);
            
            // If the error is about invalid player ID, clear it
            if (err.response?.data?.errors && err.response.data.errors.includes('All included players are not subscribed')) {
              console.log('Player ID appears to be invalid. Clearing it for user', receiverId);
              try {
                await User.updateOne({ _id: receiverId }, { $unset: { oneSignalPlayerId: 1 } });
                console.log('Invalid playerId cleared for user', receiverId);
              } catch (clearError) {
                console.error('Error clearing invalid playerId:', clearError);
              }
            }
          }
        } else {
          console.log('No OneSignal playerId found for user', receiverId, '. User may not have subscribed to notifications.');
        }
      }

      // Send back to sender for confirmation
      socket.emit('message_sent', populatedMessage);
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('message_error', 'Failed to send message');
    }
  });

  // Handle typing indicators
  socket.on('typing_start', (data) => {
    const { receiverId } = data;
    const receiverSocketId = connectedUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('user_typing', { userId: socket.userId });
    }
  });

  socket.on('typing_stop', (data) => {
    const { receiverId } = data;
    const receiverSocketId = connectedUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('user_stopped_typing', { userId: socket.userId });
    }
  });

  // WebRTC Call Signaling
  socket.on('start_call', async (data) => {
    const { receiverId, callType, roomId } = data;
    const receiverSocketId = connectedUsers.get(receiverId);

    if (receiverSocketId) {
      // User is online, send via Socket.IO
      io.to(receiverSocketId).emit('incoming_call', {
        callerId: socket.userId,
        receiverId,
        callType,
        roomId
      });
    } else {
      // User is offline, send push notification via OneSignal
      console.log('User', receiverId, 'is not connected. Attempting to send call notification via OneSignal.');
      
      await sendCallNotification(receiverId, socket.userId, callType, roomId);
    }
  });

  socket.on('accept_call', (data) => {
    const { callerId, roomId } = data;
    const callerSocketId = connectedUsers.get(callerId);

    if (callerSocketId) {
      io.to(callerSocketId).emit('call_accepted', {
        callerId,
        receiverId: socket.userId,
        callType: data.callType,
        roomId
      });
    }
  });

  socket.on('reject_call', (data) => {
    const { callerId } = data;
    const callerSocketId = connectedUsers.get(callerId);

    if (callerSocketId) {
      io.to(callerSocketId).emit('call_rejected');
    }
  });

  socket.on('end_call', (data) => {
    const { callerId, receiverId } = data;
    const callerSocketId = connectedUsers.get(callerId);
    const receiverSocketId = connectedUsers.get(receiverId);

    if (callerSocketId) {
      io.to(callerSocketId).emit('call_ended');
    }
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('call_ended');
    }
  });

  // WebRTC Signaling (Offer/Answer/ICE)
  socket.on('offer', (data) => {
    const { roomId } = data;
    console.log(`Offer received in room: ${roomId}`);
    // Broadcast to all users in the room (for now, just the other party)
    socket.broadcast.emit('offer', data);
  });

  socket.on('answer', (data) => {
    const { roomId } = data;
    console.log(`Answer received in room: ${roomId}`);
    // Broadcast to all users in the room (for now, just the other party)
    socket.broadcast.emit('answer', data);
  });

  socket.on('ice_candidate', (data) => {
    const { roomId } = data;
    console.log(`ICE candidate received in room: ${roomId}`);
    // Broadcast to all users in the room (for now, just the other party)
    socket.broadcast.emit('ice_candidate', data);
  });

  // Listen for status requests
  socket.on('request_status', (data) => {
    const { userId } = data;
    if (connectedUsers.has(userId)) {
      socket.emit('user_status', { userId, online: true });
    } else {
      const status = userStatus.get(userId);
      socket.emit('user_status', { userId, online: false, lastSeen: status?.lastSeen });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    if (socket.userId) {
      connectedUsers.delete(socket.userId);
      userStatus.set(socket.userId, { online: false, lastSeen: Date.now() });
      // Notify others this user is offline
      io.emit('user_status', { userId: socket.userId, online: false, lastSeen: Date.now() });
      console.log(`User ${socket.userId} disconnected. Connected users now:`, Array.from(connectedUsers.keys()));
    }
    console.log('User disconnected:', socket.id);
  });
});

// Debug endpoint to check OneSignal configuration
app.get('/api/debug/onesignal-config', (req, res) => {
  res.json({
    appId: process.env.ONESIGNAL_APP_ID,
    hasRestApiKey: !!process.env.ONESIGNAL_REST_API_KEY,
    restApiKeyLength: process.env.ONESIGNAL_REST_API_KEY ? process.env.ONESIGNAL_REST_API_KEY.length : 0,
    appIdValid: process.env.ONESIGNAL_APP_ID && process.env.ONESIGNAL_APP_ID.length === 36
  });
});

// Debug endpoint to test OneSignal notification directly
app.post('/api/debug/test-notification/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (!user.oneSignalPlayerId) {
      return res.status(400).json({ error: 'User has no playerId' });
    }
    
    // Test notification
    const notificationResponse = await axios.post('https://onesignal.com/api/v1/notifications', {
      app_id: process.env.ONESIGNAL_APP_ID,
      include_player_ids: [user.oneSignalPlayerId],
      headings: { en: 'Test Notification' },
      contents: { en: 'This is a test notification from debug endpoint' },
      url: '/chat'
    }, {
      headers: {
        'Authorization': `Basic ${process.env.ONESIGNAL_REST_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    res.json({
      success: true,
      response: notificationResponse.data,
      playerId: user.oneSignalPlayerId,
      userId: user._id,
      username: user.username
    });
  } catch (error) {
    console.error('Test notification error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Test notification failed', 
      details: error.response?.data || error.message 
    });
  }
});

// Debug endpoint to test OneSignal notification directly
app.post('/api/debug/test-call-notification', async (req, res) => {
  try {
    const { receiverId, callerId, callType } = req.body;
    
    if (!receiverId || !callerId || !callType) {
      return res.status(400).json({ error: 'Missing required fields: receiverId, callerId, callType' });
    }

    const roomId = 'test-room-' + Date.now();
    const success = await sendCallNotification(receiverId, callerId, callType, roomId);
    
    res.json({
      success,
      message: success ? 'Call notification sent successfully' : 'Failed to send call notification',
      testData: {
        receiverId,
        callerId,
        callType,
        roomId
      }
    });
  } catch (error) {
    console.error('Test call notification error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB Connected");
    server.listen(process.env.PORT, () => {
      console.log(`🚀 Server running on http://localhost:${process.env.PORT}`);
      console.log(`🔌 Socket.IO server ready`);
    });
    
    // Set up session cleanup job (run every 6 hours)
    setInterval(cleanupExpiredSessions, 6 * 60 * 60 * 1000);
    console.log("🧹 Session cleanup job scheduled");
  })
  .catch(err => {
    console.error("❌ MongoDB connection error:", err);
  });
