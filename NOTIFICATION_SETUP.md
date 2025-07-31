# Web Push Notification Setup Guide

## Prerequisites

1. **OneSignal Account**: Sign up at [OneSignal.com](https://onesignal.com)
2. **HTTPS or Localhost**: Push notifications require HTTPS (except for localhost)

## Environment Variables Setup

### Backend (.env file in backend directory)
```env
ONESIGNAL_APP_ID=your_onesignal_app_id_here
ONESIGNAL_REST_API_KEY=your_onesignal_rest_api_key_here
```

### Frontend (.env.local file in root directory)
```env
NEXT_PUBLIC_ONESIGNAL_APP_ID=your_onesignal_app_id_here
```

## OneSignal Dashboard Setup

1. **Create a new app** in OneSignal dashboard
2. **Choose Web Push** as the platform
3. **Configure your website**:
   - Site Name: Your app name
   - Site URL: Your domain (or localhost for development)
   - Default Notification Icon: Upload your app icon
4. **Get your credentials**:
   - App ID: Copy from the dashboard
   - REST API Key: Copy from Settings > Keys & IDs

## Service Worker Configuration

The app uses OneSignal's service worker. Make sure these files exist:
- `/public/OneSignalSDKWorker.js` - OneSignal's service worker
- `/public/sw.js` - Custom service worker (handles additional features)

## Testing Notifications

1. **Enable notifications** in your browser
2. **Use the debug menu** in the chat app:
   - "Test Notification" - Sends a test notification
   - "Check Notification Status" - Shows configuration status
3. **Check browser console** for detailed logs

## Troubleshooting

### Common Issues:

1. **"OneSignal environment variables not configured"**
   - Check that ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY are set in backend .env

2. **"No OneSignal playerId found for user"**
   - User hasn't granted notification permission
   - OneSignal initialization failed
   - Check browser console for errors

3. **"All included players are not subscribed"**
   - Player ID is invalid or expired
   - User revoked notification permission
   - OneSignal configuration is incorrect

4. **Notifications not showing**
   - Check browser notification settings
   - Ensure HTTPS is used (except localhost)
   - Verify service worker is registered

### Debug Endpoints:

- `GET /api/debug/onesignal-config` - Check OneSignal configuration
- `GET /api/debug/onesignal-users` - List users with player IDs
- `GET /api/debug/validate-onesignal-user/:userId` - Validate specific user
- `POST /api/debug/test-notification/:userId` - Send test notification

## Browser Compatibility

- Chrome 42+
- Firefox 44+
- Safari 16+ (macOS 13+)
- Edge 17+

## Security Notes

- Keep your REST API key secure
- Use HTTPS in production
- Validate user permissions before sending notifications 