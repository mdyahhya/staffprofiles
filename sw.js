const CACHE_NAME = 'vvpiet-staff-v1.0.1';
const DATA_CACHE_NAME = 'vvpiet-data-v1.0.1';

// iOS Safari has limited storage, so keep cache minimal
const FILES_TO_CACHE = [
  // Only essential offline assets
  // Do NOT cache main app files for fresh updates
];

// Detect if running on iOS
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

// Install event with iOS considerations
self.addEventListener('install', (evt) => {
  console.log('[ServiceWorker] Install');
  
  evt.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Pre-caching essential files');
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  
  // iOS Safari may delay activation, force it
  self.skipWaiting();
});

// Activate event with aggressive cache cleanup for iOS
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
  
  // iOS Safari requires explicit claim
  self.clients.claim();
});

// Enhanced fetch with iOS Safari optimizations
self.addEventListener('fetch', (evt) => {
  const { request } = evt;
  const url = new URL(request.url);
  
  // Skip chrome-extension and non-http(s) requests
  if (!request.url.startsWith('http')) {
    return;
  }

  // Handle API requests (Supabase, etc.) - Network first with cache fallback
  if (url.pathname.includes('/api/') || 
      url.hostname.includes('supabase') || 
      url.hostname.includes('googleapis')) {
    
    evt.respondWith(
      caches.open(DATA_CACHE_NAME).then((cache) => {
        return fetch(request, {
          // iOS Safari benefits from these settings
          cache: 'no-cache',
          mode: 'cors'
        })
        .then((response) => {
          // Cache successful responses
          if (response && response.status === 200) {
            // Clone before caching
            const responseClone = response.clone();
            
            // iOS Safari has limited storage, cache selectively
            if (request.method === 'GET') {
              cache.put(request.url, responseClone);
            }
          }
          return response;
        })
        .catch((error) => {
          console.log('[ServiceWorker] Network failed, trying cache:', error);
          // Network failed, try cache
          return cache.match(request);
        });
      })
    );
    return;
  }

  // For app files - Always fetch fresh (important for iOS Safari)
  if (url.pathname.endsWith('.html') || 
      url.pathname.endsWith('.js') || 
      url.pathname.endsWith('.css') ||
      url.pathname === '/' ||
      url.pathname === '/index.html') {
    
    evt.respondWith(
      fetch(request, {
        cache: 'no-store', // Force fresh content
        mode: 'same-origin'
      })
      .then((response) => {
        // Always return fresh content for app files
        if (response && response.ok) {
          return response;
        }
        throw new Error('Network response was not ok');
      })
      .catch(() => {
        // Only if network completely fails, try cache
        console.log('[ServiceWorker] App file network failed, trying cache');
        return caches.match(request);
      })
    );
    return;
  }

  // For static assets (images, fonts, etc.) - Cache first
  evt.respondWith(
    caches.match(request).then((response) => {
      if (response) {
        return response;
      }
      
      return fetch(request).then((response) => {
        // Don't cache if response is not good
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Clone the response for caching
        const responseToCache = response.clone();
        
        caches.open(CACHE_NAME).then((cache) => {
          // iOS Safari storage is limited, be selective
          if (request.url.includes('.jpg') || 
              request.url.includes('.png') || 
              request.url.includes('.svg') ||
              request.url.includes('.ico')) {
            cache.put(request, responseToCache);
          }
        });

        return response;
      });
    })
  );
});

// Background sync with iOS limitations
self.addEventListener('sync', (event) => {
  console.log('[ServiceWorker] Background sync:', event.tag);
  
  if (event.tag === 'profile-sync') {
    event.waitUntil(syncProfiles());
  }
});

// Sync function with iOS considerations
function syncProfiles() {
  console.log('[ServiceWorker] Syncing profiles...');
  
  // iOS Safari has limited background execution time
  return new Promise((resolve) => {
    // Keep sync operation lightweight for iOS
    setTimeout(resolve, 1000);
  });
}

// Enhanced push notifications with iOS support
self.addEventListener('push', (event) => {
  console.log('[ServiceWorker] Push received');
  
  let notificationData = {
    title: 'VVPIET Staff Profiles',
    body: 'New update available',
    icon: '/stafflogo.jpg',
    badge: '/stafflogo.jpg',
    tag: 'vvpiet-notification',
    requireInteraction: false, // iOS shows notifications briefly
    vibrate: [200, 100, 200], // iOS doesn't support vibration in PWA
    data: {
      url: '/'
    }
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      notificationData = { ...notificationData, ...payload };
    } catch (e) {
      notificationData.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      requireInteraction: notificationData.requireInteraction,
      vibrate: notificationData.vibrate,
      data: notificationData.data,
      // iOS specific options
      silent: false,
      renotify: true
    })
  );
});

// Handle notification clicks with iOS considerations
self.addEventListener('notificationclick', (event) => {
  console.log('[ServiceWorker] Notification clicked');
  
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // Try to focus existing window first (important for iOS)
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Open new window if no existing window found
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Enhanced message handling with iOS considerations
self.addEventListener('message', (event) => {
  console.log('[ServiceWorker] Message received:', event.data);
  
  const { action, data } = event.data;
  
  switch (action) {
    case 'forceRefresh':
      // Clear all caches and force refresh
      caches.keys().then(names => {
        return Promise.all(
          names.map(name => {
            console.log('[ServiceWorker] Deleting cache:', name);
            return caches.delete(name);
          })
        );
      }).then(() => {
        // Notify all clients to refresh
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({ type: 'REFRESH' });
          });
        });
      });
      break;
      
    case 'checkUpdate':
      // Check for updates (iOS Safari handles this differently)
      self.registration.update().then(() => {
        console.log('[ServiceWorker] Update check completed');
      });
      break;
      
    case 'skipWaiting':
      // Force activation of new service worker
      self.skipWaiting();
      break;
      
    default:
      console.log('[ServiceWorker] Unknown action:', action);
  }
});

// iOS specific optimizations
self.addEventListener('activate', (event) => {
  // Clear old caches more aggressively on iOS to manage storage
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== DATA_CACHE_NAME) {
            console.log('[ServiceWorker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Ensure the new service worker takes control immediately
      return self.clients.claim();
    })
  );
});

// Handle service worker updates for iOS
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[ServiceWorker] SW loaded with iOS optimizations');
