# Chat App

A real-time chat application with messaging capabilities.

## Features

- Real-time messaging
- User authentication
- Contact management
- Modern UI with dark/light theme support

## WebRTC Functionality - REMOVED ❌

All WebRTC voice and video calling functionality has been completely removed from the application. The app now focuses solely on text messaging.

### What was removed:
- Voice calling
- Video calling
- WebRTC peer connections
- Media stream handling
- Call UI components
- WebRTC signaling
- ICE candidate handling

### Current functionality:
- ✅ Real-time text messaging
- ✅ User authentication
- ✅ Contact management
- ✅ Message history
- ✅ Modern UI

## Development

### Prerequisites
- Node.js 18+
- pnpm (recommended) or npm

### Installation
```bash
# Install dependencies
pnpm install

# Start the backend server
cd backend
npm install
npm start

# Start the frontend (in another terminal)
pnpm dev
```

### Environment Variables
Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

## Troubleshooting

### Messaging Issues
1. Check browser console for detailed logs
2. Ensure both users are online
3. Verify socket connection is established

### Connection Problems
1. Check backend server is running
2. Verify environment variables are set correctly
3. Ensure database connection is working

## Browser Support
- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

## License
MIT
