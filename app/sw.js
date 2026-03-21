/* global self, caches, fetch, URL */
// NovaReader Service Worker — cache-first strategy for offline access
const APP_CACHE = 'novareader-app-v1';
const DOC_CACHE = 'novareader-docs-v1';

// App shell resources to pre-cache on install
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
];

// ── Install: pre-cache app shell ────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// ── Activate: clean up old caches on version bump ───────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== APP_CACHE && key !== DOC_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: cache-first for app shell, cache opened docs ─────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // For document files (PDF, DJVU, EPUB), cache on access for offline re-reading
  const url = new URL(request.url);
  const isDocument = /\.(pdf|djvu|djv|epub|xps)$/i.test(url.pathname);

  if (isDocument) {
    event.respondWith(
      caches.open(DOC_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            if (response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          });
        })
      )
    );
    return;
  }

  // App shell and other assets: cache-first with network fallback
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Cache successful same-origin responses for future offline use
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(APP_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
