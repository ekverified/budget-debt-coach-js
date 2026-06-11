// public/service-worker.js
// ─────────────────────────────────────────────────────────────────
// Budget & Debt Coach — Service Worker
// Improvements over original:
//   • Versioned cache names — bump CACHE_VERSION to force refresh
//   • Separate static vs dynamic caches (don't evict app shell)
//   • Offline fallback page served when network fails
//   • External API calls (ipapi, allorigins) are network-only —
//     caching third-party JSON causes stale financial data bugs
//   • Background sync reminder via postMessage
//   • Handles SKIP_WAITING message from the app
//   • Logs errors cleanly without crashing
// ─────────────────────────────────────────────────────────────────

const CACHE_VERSION  = 'v4';                       // ← bump this on every deploy
const STATIC_CACHE   = `budget-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE  = `budget-dynamic-${CACHE_VERSION}`;
const ALL_CACHES     = [STATIC_CACHE, DYNAMIC_CACHE];

// App shell: always cached on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',          // create a simple offline.html in /public
  '/manifest.json',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png',
];

// Domains whose responses should NEVER be cached
// (financial data, currency detection, analytics)
const NETWORK_ONLY_ORIGINS = [
  'ipapi.co',
  'allorigins.win',
  'money254.co.ke',
  'centralbank.go.ke',
  'vasiliafrica.com',
  'googletagmanager.com',
  'google-analytics.com',
];

// ── Install: pre-cache app shell ─────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => {
        // Don't wait for old tabs to close before activating
        // (handled by SKIP_WAITING message from app)
        console.log('[SW] Installed', CACHE_VERSION);
      })
      .catch((err) => console.error('[SW] Install failed:', err))
  );
});

// ── Activate: delete old caches ───────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => !ALL_CACHES.includes(name))
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        )
      )
      .then(() => {
        console.log('[SW] Activated', CACHE_VERSION);
        // Take control of all open tabs immediately
        return self.clients.claim();
      })
  );
});

// ── Fetch: stale-while-revalidate for static, network-first for API ──
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // 1) Network-only: third-party financial/analytics URLs
  if (NETWORK_ONLY_ORIGINS.some((origin) => url.hostname.includes(origin))) {
    event.respondWith(fetch(request).catch(() => new Response('{}', {
      headers: { 'Content-Type': 'application/json' },
    })));
    return;
  }

  // 2) Network-only: backend API calls (always need fresh data)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: 'offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    return;
  }

  // 3) Static assets (app shell): cache-first, fallback to network
  if (STATIC_ASSETS.includes(url.pathname) || url.pathname.startsWith('/static/')) {
    event.respondWith(
      caches.match(request)
        .then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            const toCache = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, toCache));
            return response;
          });
        })
        .catch(() => {
          // Offline fallback for navigation requests
          if (request.mode === 'navigate') {
            return caches.match('/offline.html');
          }
        })
    );
    return;
  }

  // 4) Everything else: network-first, cache as dynamic fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const toCache = response.clone();
        caches.open(DYNAMIC_CACHE).then((cache) => {
          cache.put(request, toCache);
          // Keep dynamic cache lean — evict entries over 50
          cache.keys().then((keys) => {
            if (keys.length > 50) cache.delete(keys[0]);
          });
        });
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          if (cached) return cached;
          if (request.mode === 'navigate') {
            return caches.match('/offline.html');
          }
          return new Response('Offline', { status: 503 });
        })
      )
  );
});

// ── Message handler ───────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (!event.data) return;

  switch (event.data.type) {
    // App sends this when a new SW is waiting — trigger immediate update
    case 'SKIP_WAITING':
      console.log('[SW] Skipping waiting, activating new version');
      self.skipWaiting();
      break;

    // App can request a background sync reminder (e.g. on open)
    case 'SYNC_REMINDER':
      event.source?.postMessage({
        type: 'SYNC_REMINDER_RESPONSE',
        message: 'Service worker is active and caching app shell.',
        version: CACHE_VERSION,
      });
      break;

    default:
      break;
  }
});
