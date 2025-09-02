/**
 * Enhanced Service Worker for CouponCycle PWA
 * Implements intelligent caching strategies for better offline experience
 */

const CACHE_NAME = 'couponcycle-v1';
const STATIC_CACHE = 'couponcycle-static-v1';
const DYNAMIC_CACHE = 'couponcycle-dynamic-v1';
const IMAGE_CACHE = 'couponcycle-images-v1';

// Resources to cache immediately
const STATIC_ASSETS = [
  '/',
  '/benefits',
  '/cards',
  '/loyalty',
  '/offline', // Offline fallback page
  '/favicon.png',
  '/manifest.json',
  '/_next/static/css/',
  '/_next/static/js/',
];

// Network-first routes (always try network first)
const NETWORK_FIRST_ROUTES = [
  '/api/',
  '/auth/',
];

// Cache-first routes (use cache if available)
const CACHE_FIRST_ROUTES = [
  '/images/',
  '/_next/static/',
  '/favicon',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then((cache) => {
        return cache.addAll(STATIC_ASSETS);
      }),
      self.skipWaiting() // Activate immediately
    ])
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && 
                cacheName !== STATIC_CACHE && 
                cacheName !== DYNAMIC_CACHE &&
                cacheName !== IMAGE_CACHE) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      self.clients.claim() // Take control of all clients
    ])
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-HTTP requests
  if (!url.protocol.startsWith('http')) return;

  // API requests - network first with fallback
  if (NETWORK_FIRST_ROUTES.some(route => url.pathname.startsWith(route))) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Static assets - cache first
  if (CACHE_FIRST_ROUTES.some(route => url.pathname.startsWith(route))) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // Images - cache with expiration
  if (request.destination === 'image') {
    event.respondWith(imageStrategy(request));
    return;
  }

  // HTML pages - stale while revalidate
  if (request.mode === 'navigate') {
    event.respondWith(staleWhileRevalidateStrategy(request));
    return;
  }

  // Default strategy
  event.respondWith(networkFirstStrategy(request));
});

/**
 * Network first strategy - try network, fallback to cache
 */
async function networkFirstStrategy(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Network failed, trying cache for:', request.url);
    
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return cache.match('/offline');
    }
    
    throw error;
  }
}

/**
 * Cache first strategy - use cache if available, otherwise network
 */
async function cacheFirstStrategy(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('Cache first strategy failed for:', request.url);
    throw error;
  }
}

/**
 * Image caching strategy with size limits
 */
async function imageStrategy(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.status === 200) {
      // Limit image cache size
      const cacheKeys = await cache.keys();
      if (cacheKeys.length > 50) {
        // Remove oldest entries
        await cache.delete(cacheKeys[0]);
      }
      
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Return placeholder image for failed image loads
    return new Response(
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250" viewBox="0 0 400 250"><rect width="400" height="250" fill="#f3f4f6"/><text x="200" y="125" text-anchor="middle" fill="#6b7280">Image Unavailable</text></svg>',
      {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'no-cache'
        }
      }
    );
  }
}

/**
 * Stale while revalidate - return cache immediately, update in background
 */
async function staleWhileRevalidateStrategy(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await cache.match(request);
  
  // Fetch from network in background
  const networkPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => {
    // Network failed, but we might have cache
    return cachedResponse;
  });
  
  // Return cache immediately if available, otherwise wait for network
  return cachedResponse || networkPromise;
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('Background sync triggered:', event.tag);
  
  if (event.tag === 'benefit-status-sync') {
    event.waitUntil(syncBenefitStatuses());
  }
});

/**
 * Sync benefit status updates when connection is restored
 */
async function syncBenefitStatuses() {
  try {
    // Get pending updates from IndexedDB or similar storage
    const pendingUpdates = await getPendingUpdates();
    
    for (const update of pendingUpdates) {
      try {
        await fetch('/api/benefits', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(update)
        });
        
        // Remove from pending updates on success
        await removePendingUpdate(update.id);
      } catch (error) {
        console.error('Failed to sync update:', error);
      }
    }
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// Placeholder functions for pending updates storage
async function getPendingUpdates() {
  // Implement IndexedDB or similar storage for offline updates
  return [];
}

async function removePendingUpdate(id) {
  // Remove synced update from storage
}

// Push notifications (for future implementation)
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  
  const options = {
    body: data.body,
    icon: '/favicon.png',
    badge: '/favicon.png',
    actions: [
      {
        action: 'view',
        title: 'View Benefits'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ],
    data: data.url
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow(event.notification.data || '/benefits')
    );
  }
});
