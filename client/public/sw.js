const CACHE_NAME = 'permis-peche-v1.0.0';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/src/main.tsx',
  '/src/index.css',
  // Add other static assets as needed
];

// Install event - cache resources
self.addEventListener('install', event => {
  console.log('[SW] Install event');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[SW] Skip waiting');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activate event');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Claim clients');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle API requests differently
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // If online, return fresh response and cache if it's a GET request
          if (request.method === 'GET' && response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // If offline, try to serve from cache
          if (request.method === 'GET') {
            return caches.match(request).then(response => {
              if (response) {
                return response;
              }
              // Return offline response for API calls
              return new Response(
                JSON.stringify({ 
                  error: 'Offline', 
                  message: 'This request requires internet connectivity' 
                }),
                {
                  status: 503,
                  statusText: 'Service Unavailable',
                  headers: { 'Content-Type': 'application/json' }
                }
              );
            });
          }
          // For non-GET requests, return error
          return new Response(
            JSON.stringify({ 
              error: 'Offline', 
              message: 'Cannot perform this action while offline' 
            }),
            {
              status: 503,
              statusText: 'Service Unavailable',  
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
    );
    return;
  }

  // Handle app shell and static assets
  event.respondWith(
    caches.match(request)
      .then(response => {
        // Return cached version or fetch from network
        if (response) {
          return response;
        }
        
        return fetch(request).then(response => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => {
              // Only cache GET requests
              if (request.method === 'GET') {
                cache.put(request, responseToCache);
              }
            });

          return response;
        });
      })
      .catch(() => {
        // If both cache and network fail, return app shell for navigation requests
        if (request.mode === 'navigate') {
          return caches.match('/');
        }
      })
  );
});

// Background sync for offline data
self.addEventListener('sync', event => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'permit-sync') {
    event.waitUntil(
      syncPermits().then(() => {
        console.log('[SW] Permits synced successfully');
        // Notify clients of successful sync
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'SYNC_SUCCESS',
              message: 'Permits synchronized successfully'
            });
          });
        });
      }).catch(error => {
        console.error('[SW] Sync failed:', error);
        // Notify clients of sync failure
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'SYNC_FAILED',
              message: 'Failed to synchronize permits'
            });
          });
        });
      })
    );
  }
});

// Sync function for permits
async function syncPermits() {
  try {
    // This would integrate with the IndexedDB offline storage
    // to sync pending permits when connection is restored
    const response = await fetch('/api/permits/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Sync failed');
    }
    
    return response.json();
  } catch (error) {
    console.error('[SW] Sync error:', error);
    throw error;
  }
}

// Handle messages from clients
self.addEventListener('message', event => {
  console.log('[SW] Received message:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

// Push notification handling (for future use)
self.addEventListener('push', event => {
  console.log('[SW] Push received:', event);
  
  const options = {
    body: event.data ? event.data.text() : 'Nouvelle notification',
    icon: '/manifest-icon-192.png',
    badge: '/manifest-icon-96.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Voir détails',
        icon: '/icons/checkmark.png'
      },
      {
        action: 'close',
        title: 'Fermer',
        icon: '/icons/xmark.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Permis de Pêche', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification click received:', event);
  
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      self.clients.openWindow('/')
    );
  }
});
