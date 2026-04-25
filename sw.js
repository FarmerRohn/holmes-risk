// Holmes Risk — Service Worker
// PWA asset caching (no push notifications).
// Cache strategies: cache-first for static assets, stale-while-revalidate for CDN,
// network-first for navigation, network-only for API calls.

var CACHE_NAME = 'hf-risk-v__SW_CACHE_VERSION__';
var PRECACHE = ['/'];

// ==================== INSTALL ====================
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(PRECACHE);
    }).then(function() { return self.skipWaiting(); })
  );
});

// ==================== ACTIVATE ====================
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n !== CACHE_NAME; })
          .map(function(n) { return caches.delete(n); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

// ==================== FETCH ====================
self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  // Skip non-GET requests (POST mutations, etc.)
  if (event.request.method !== 'GET') return;

  // Skip non-http(s) schemes — Cache API rejects chrome-extension://,
  // moz-extension://, data:, blob:, file:, etc. with TypeError.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Skip API calls — never cache dynamic data
  if (url.pathname.startsWith('/api/')) return;

  // Static assets (JS, CSS, images, fonts): cache-first
  // Content-hashed filenames (app.min.{hash}.js) make this safe — new deploy = new URL
  if (url.pathname.match(/\.(js|css|png|jpg|svg|woff2?)$/) && url.pathname !== '/sw.js') {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        return cached || fetch(event.request).then(function(resp) {
          if (resp.ok) {
            var clone = resp.clone();
            caches.open(CACHE_NAME).then(function(c) { c.put(event.request, clone); });
          }
          return resp;
        });
      })
    );
    return;
  }

  // CDN resources (Google Fonts): stale-while-revalidate
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('gstatic.com') ||
      url.hostname.includes('jsdelivr.net') || url.hostname.includes('unpkg.com')) {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        var fetchPromise = fetch(event.request).then(function(resp) {
          if (resp.ok) {
            var clone = resp.clone();
            caches.open(CACHE_NAME).then(function(c) { c.put(event.request, clone); });
          }
          return resp;
        }).catch(function() { return cached; });
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Navigation (index.html): network-first with cached fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(function() {
        return caches.match('/');
      })
    );
  }
});
