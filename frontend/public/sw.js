const CACHE_NAME = 'khotwatok-cache-v4';

// Pre-cache core shell assets
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/favicon.ico',
  '/favicon-32x32.png',
  '/favicon-16x16.png',
  '/logo.png',
  '/manifest.json',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching app shell');
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Cleaning old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Message Event (for skipping waiting on update)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // ALWAYS BYPASS cache for local dev, Vite HMR, APIs, Auth, and non-GET requests
  if (
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/@') ||
    url.pathname.includes('node_modules') ||
    url.pathname.includes('/api/') || 
    url.pathname.includes('/auth/') || 
    event.request.method !== 'GET'
  ) {
    return;
  }

  // Network-First for HTML/SPA entry points to prevent stale UI bundles
  if (url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/');
      })
    );
    return;
  }

  // Stale-While-Revalidate strategy for internal static assets and media
  if (
    url.origin === self.location.origin &&
    (url.pathname.includes('/assets/') ||
     url.pathname.endsWith('.js') ||
     url.pathname.endsWith('.css') ||
     url.pathname.endsWith('.svg') ||
     url.pathname.endsWith('.png') ||
     url.pathname.endsWith('.jpg') ||
     url.pathname.endsWith('.jpeg') ||
     url.pathname.endsWith('.gif') ||
     url.pathname.endsWith('.ico') ||
     url.pathname.endsWith('.woff') ||
     url.pathname.endsWith('.woff2') ||
     url.pathname.endsWith('.ttf') ||
     url.pathname.endsWith('.json'))
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            if (networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => null);

          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // SPA navigation fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/');
      })
    );
  }
});
