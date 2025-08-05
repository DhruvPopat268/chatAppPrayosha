# Notification Setup Guide

## Getting Floating/Heads-up Notifications Like WhatsApp

Unfortunately, **floating/heads-up notifications are not supported in web push notifications**. This is a limitation of the Web Push API and browser security model. However, you can configure your browser and device settings to get the best possible notification experience.

## Browser Configuration

### Chrome/Edge (Desktop)
1. Go to `Settings` → `Privacy and Security` → `Site Settings` → `Notifications`
2. Find your site and click `Edit`
3. Change from "Show notifications" to **"Show notifications (including sound)"**
4. Enable **"Show notifications even when the site is closed"**

### Firefox (Desktop)
1. Go to `Settings` → `Privacy & Security` → `Permissions` → `Notifications`
2. Click `Settings` next to your site
3. Select `Allow` and check **"Show notifications even when Firefox is closed"**

### Mobile Chrome
1. Go to `Settings` → `Site Settings` → `Notifications`
2. Find your site and enable `Show notifications`
3. In Android `Settings` → `Apps` → `Chrome` → `Notifications`
4. Enable **"Show notifications"** and **"Allow notification dot"**

## Device Settings

### Android
1. Go to `Settings` → `Apps` → `Chrome` → `Notifications`
2. Enable **"Show notifications"**
3. Enable **"Allow notification dot"**
4. Set **"Importance"** to `High` or `Urgent`
5. Enable **"Show on lock screen"**

### iOS
1. Go to `Settings` → `Safari` → `Notifications`
2. Enable **"Allow Notifications"**
3. Enable **"Show on Lock Screen"**
4. Enable **"Show in History"**

## OneSignal Configuration

The app is configured with the following settings for optimal notification display:

```javascript
{
  // Enable sound and vibration
  sound: true,
  vibration: true,
  
  // Show notification even when app is in focus
  showWhenInFocus: true,
  
  // Enable notification badges
  badge: true,
  
  // Enable native prompts
  native_prompt_enabled: true
}
```

## Alternative Solutions

### 1. Progressive Web App (PWA)
Consider converting your web app to a PWA to get more native-like notification behavior.

### 2. Mobile App
For true floating notifications like WhatsApp, you would need to build a native mobile app.

### 3. Desktop App
Using Electron or similar frameworks can provide more control over notification display.

## Testing Notifications

Use the `/test` page to:
1. Test OneSignal initialization
2. Force subscription
3. Check notification settings
4. View detailed logs

## Troubleshooting

### Notifications not showing
1. Check browser notification permissions
2. Ensure OneSignal is properly initialized
3. Check device notification settings
4. Verify subscription ID is saved to backend

### Notifications only in tray
This is normal for web push notifications. Floating notifications require native app capabilities.

## Important Notes

- **Web push notifications are designed to be non-intrusive** for user privacy
- **Floating notifications are a native OS feature**, not available in web browsers
- **Notification display is controlled by the user's device settings**
- **The best experience comes from proper browser/device configuration**

## Current Status

✅ **Working**: Push notifications in notification tray  
❌ **Not Supported**: Floating/heads-up notifications  
✅ **Configurable**: Sound, vibration, and notification badges  
✅ **Available**: Notification settings guide in test page 