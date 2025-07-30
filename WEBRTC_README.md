# WebRTC Voice Call Implementation

This document describes the WebRTC voice call functionality implemented in the chat application.

## Features

- **Voice Calls**: Make and receive voice calls between users
- **Call Signaling**: Complete WebRTC signaling through Socket.IO
- **Call Controls**: Mute, speaker toggle, and call end functionality
- **Ringtone**: Incoming call notifications with ringtone
- **Call UI**: Modal dialogs for incoming/outgoing calls and active call controls

## Architecture

### Frontend Components

1. **WebRTCManager** (`lib/webrtc.ts`): Core WebRTC functionality
   - Peer connection management
   - Media stream handling
   - Call state management
   - Signaling coordination

2. **Chat Page** (`app/chat/page.tsx`): Main chat interface
   - Voice call button integration
   - Call UI components
   - Audio stream rendering

3. **Test Component** (`components/webrtc-test.tsx`): Testing interface
   - Manual call testing
   - State debugging
   - Connection diagnostics

### Backend Components

1. **Socket.IO Server** (`backend/server.js`): Signaling server
   - Call request handling
   - WebRTC signaling relay
   - User connection management

## How to Use

### Making a Voice Call

1. Navigate to the chat page
2. Select a contact from the sidebar
3. Click the phone icon (📞) in the contact header
4. The call will be initiated and the recipient will receive an incoming call notification

### Receiving a Voice Call

1. When receiving a call, a modal will appear with:
   - Caller information
   - Accept/Decline buttons
   - Ringtone notification
2. Click "Accept" to join the call or "Decline" to reject

### During a Call

- **Mute/Unmute**: Click the microphone button to toggle audio
- **Speaker**: Click the speaker button to toggle speaker mode
- **End Call**: Click the red phone button to end the call

## Technical Details

### WebRTC Configuration

- **ICE Servers**: Google STUN servers for NAT traversal
- **Media Constraints**: Audio only for voice calls
- **Codec**: Default browser codecs (Opus for audio)

### Signaling Flow

1. **Call Initiation**: Caller sends `start_call` event
2. **Call Notification**: Server forwards to recipient as `incoming_call`
3. **Call Acceptance**: Recipient sends `accept_call` event
4. **Offer/Answer**: WebRTC offer/answer exchange
5. **ICE Candidates**: ICE candidate exchange for connection establishment
6. **Call End**: Either party can end the call

### State Management

The call state includes:
- `isIncoming`: Incoming call notification
- `isOutgoing`: Outgoing call in progress
- `isConnected`: Active call connection
- `isMuted`: Audio mute state
- `isSpeakerOn`: Speaker mode state
- `localStream`: Local audio stream
- `remoteStream`: Remote audio stream

## Testing

### Manual Testing

1. Open the test page at `/test`
2. Enter a test user ID
3. Use the test interface to simulate calls
4. Monitor call state changes in the debug panel

### Browser Testing

Test in multiple browsers:
- Chrome/Edge (recommended)
- Firefox
- Safari (may have limitations)

### Network Testing

Test different network conditions:
- Local network
- Different NAT types
- Firewall restrictions

## Troubleshooting

### Common Issues

1. **No Audio**: Check microphone permissions
2. **Call Not Connecting**: Verify STUN server connectivity
3. **One-way Audio**: Check audio device settings
4. **Call Drops**: Monitor network stability

### Debug Information

Use the browser console to monitor:
- WebRTC connection state
- ICE candidate gathering
- Media stream status
- Signaling events

### Browser Permissions

Ensure the browser has:
- Microphone access permission
- HTTPS connection (required for getUserMedia)
- WebRTC support enabled

## Future Enhancements

- Video call support
- Screen sharing
- Call recording
- Multiple participant calls
- Better error handling
- Call quality metrics
- Fallback to TURN servers

## Security Considerations

- All signaling goes through authenticated Socket.IO connections
- Media streams are peer-to-peer (not through server)
- User authentication required for call initiation
- Call data includes user verification

## Dependencies

- Socket.IO for signaling
- WebRTC API for peer connections
- MediaDevices API for audio access
- Browser WebRTC support 