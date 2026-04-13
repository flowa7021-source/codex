/* global self, caches, fetch, URL, Response */
// NovaReader Service Worker — handles offline access and cache management
// Also handles Background Sync for offline cloud operations.
//
// Strategy:
//   Navigation (HTML)  → network-first (always get fresh HTML after rebuild)
//   Hashed assets (JS/CSS) → cache-first (hash in filename = immutable)
//   Documents (PDF, DJVU) → cache on access for offline re-reading

const APP_CACHE = 'novareader-app-v2';
const DOC_CACHE = 'novareader-docs-v1';

// ── Install: skip waiting to activate immediately ────────────
self.addEventListener('install', () => {
  self.skipWaiting();
});

// ── Activate: clean up ALL old caches except current versions ─
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

// ── Fetch handler ─────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) return;

  // Document files (PDF, DJVU, EPUB): cache on access
  const isDocument = /\.(pdf|djvu|djv|epub|xps)$/i.test(url.pathname);
  if (isDocument) {
    event.respondWith(
      caches.open(DOC_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          }).catch(() => cached || new Response('Offline', { status: 503 }));
        })
      )
    );
    return;
  }

  // Navigation requests (HTML pages): NETWORK-FIRST
  // This ensures the latest index.html (with correct JS hashes) is always served
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(APP_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) =>
            cached || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/html' } })
          )
        )
    );
    return;
  }

  // Static assets (JS, CSS, images): CACHE-FIRST
  // Vite adds content hashes to filenames, so cached versions are immutable
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(APP_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});

// ── Background Sync: cloud-sync ───────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'cloud-sync') {
    // Notify all clients to process the sync queue
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(client => client.postMessage({ type: 'PROCESS_SYNC_QUEUE' }));
      })
    );
  }
});

// ── Periodic Background Sync ──────────────────────────────────────────────────
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'cloud-periodic-sync') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(client => client.postMessage({ type: 'PROCESS_SYNC_QUEUE' }));
      })
    );
  }
});
