const CACHE_NAME = 'vvpiet-staff-v1.0.0';
const DATA_CACHE_NAME = 'vvpiet-data-v1.0.0';

// Only cache essential files, not the app code itself
const FILES_TO_CACHE = [
  // Add only images and static assets here
  // Do NOT add the main HTML/CSS/JS files
];

// Install event
self.addEventListener('install', (evt) => {
  console.log('[ServiceWorker] Install');
  evt.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Pre-caching offline page');
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (evt) => {
  console.log('[ServiceWorker] Activate');
  evt.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME && key !== DATA_CACHE_NAME) {
          console.log('[ServiceWorker] Removing old cache', key);
          return caches.delete(key);
        }
      }));
    })
  );
  self.clients.claim();
});

// Fetch event
self.addEventListener('fetch', (evt) => {
  const { request } = evt;
  const url = new URL(request.url);

  // Handle API requests (cache data but always try network first)
  if (url.pathname.includes('/api/') || url.hostname.includes('supabase')) {
    evt.respondWith(
      caches.open(DATA_CACHE_NAME).then((cache) => {
        return fetch(request)
          .then((response) => {
            // If the request was good, clone it and store it in the cache.
            if (response.status === 200) {
              cache.put(request.url, response.clone());
            }
            return response;
          })
          .catch(() => {
            // Network request failed, try to get it from the cache.
            return cache.match(request);
          });
      })
    );
    return;
  }

  // For app files, always fetch from network to get latest version
  if (url.pathname.endsWith('.html') || 
      url.pathname.endsWith('.js') || 
      url.pathname.endsWith('.css') ||
      url.pathname === '/') {
    
    evt.respondWith(
      fetch(request)
        .then((response) => {
          // Always return fresh content for app files
          return response;
        })
        .catch(() => {
          // Only if network fails, try cache as fallback
          return caches.match(request);
        })
    );
    return;
  }

  // For other requests (images, etc.), use cache-first strategy
  evt.respondWith(
    caches.match(request).then((response) => {
      return response || fetch(request);
    })
  );
});

// Handle background sync for offline data
self.addEventListener('sync', (event) => {
  if (event.tag === 'profile-sync') {
    event.waitUntil(syncProfiles());
  }
});

// Sync profiles when online
function syncProfiles() {
  // This would sync offline data to Supabase when connection is restored
  return Promise.resolve();
}

// Handle push notifications (future feature)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New update available',
    icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTkyIiBoZWlnaHQ9IjE5MiIgdmlld0JveD0iMCAwIDE5MiAxOTIiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxOTIiIGhlaWdodD0iMTkyIiBmaWxsPSIjOEI1Q0Y2IiByeD0iMzIiLz4KPHN2ZyB4PSI0OCIgeT0iNDgiIHdpZHRoPSI5NiIgaGVpZ2h0PSI5NiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJ3aGl0ZSI+CjxwYXRoIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0tMiAxNWwtNS01aDNWOGg0djRoM2wtNSA1eiIvPgo8L3N2Zz4KPC9zdmc+',
    badge: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTkyIiBoZWlnaHQ9IjE5MiIgdmlld0JveD0iMCAwIDE5MiAxOTIiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxOTIiIGhlaWdodD0iMTkyIiBmaWxsPSIjOEI1Q0Y2IiByeD0iMzIiLz4KPHN2ZyB4PSI0OCIgeT0iNDgiIHdpZHRoPSI5NiIgaGVpZ2h0PSI5NiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJ3aGl0ZSI+CjxwYXRoIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0tMiAxNWwtNS01aDNWOGg0djRoM2wtNSA1eiIvPgo8L3N2Zz4KPC9zdmc+',
    tag: 'vvpiet-notification',
    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification('VVPIET Staff Profiles', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});

console.log('[ServiceWorker] Loaded');

// Add this to your sw.js after the existing code
self.addEventListener('message', (event) => {
  if (event.data.action === 'forceRefresh') {
    // Clear all caches and force refresh
    caches.keys().then(names => {
      names.forEach(name => caches.delete(name));
    });
    self.clients.matchAll().then(clients => {
      clients.forEach(client => client.postMessage({type: 'REFRESH'}));
    });
  }
});
