// OneSignal Service Worker
try {
  importScripts('https://cdn.onesignal.com/sdks/web/v17/OneSignalSDK.sw.js');
} catch (error) {
  console.error('Failed to load OneSignal SDK:', error);
  // Fallback to older version if needed
  try {
    importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');
  } catch (fallbackError) {
    console.error('Failed to load OneSignal SDK fallback:', fallbackError);
  }
} 