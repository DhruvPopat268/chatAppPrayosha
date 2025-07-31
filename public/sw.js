// OneSignal Service Worker - This file should be replaced by OneSignalSDKWorker.js
// For now, we'll redirect to OneSignal's service worker
self.addEventListener('install', function(event) {
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  // Take control of all clients immediately
  event.waitUntil(self.clients.claim());
});

// Handle push events (this will be handled by OneSignal)
self.addEventListener('push', function(event) {
  // Let OneSignal handle push notifications
  if (event.data) {
    const data = event.data.json();
    const title = data.title || data.headings?.en || 'New Message';
    const options = {
      body: data.body || data.contents?.en || '',
      icon: data.chrome_web_icon || '/placeholder-logo.png',
      badge: '/placeholder-logo.png',
      data: data.url || data.data || '/',
      requireInteraction: data.data?.type === 'call', // Keep call notifications visible
      actions: data.data?.type === 'call' ? [
        {
          action: 'accept',
          title: 'Accept',
          icon: '/placeholder-logo.png'
        },
        {
          action: 'decline',
          title: 'Decline',
          icon: '/placeholder-logo.png'
        }
      ] : undefined
    };
    
    event.waitUntil(self.registration.showNotification(title, options));
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  // Handle call notification actions
  if (event.action === 'accept') {
    // Handle call acceptance
    event.waitUntil(
      clients.openWindow('/chat')
    );
    return;
  }
  
  if (event.action === 'decline') {
    // Handle call decline
    return;
  }
  
  // Default notification click behavior
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(function(clientList) {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(event.notification.data);
    })
  );
}); 