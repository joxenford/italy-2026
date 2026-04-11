const CORE_CACHE = 'italy-2026-core-v2';
const IMG_CACHE  = 'italy-2026-img-v2';

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/marillion.jpg',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CORE_CACHE)
      .then(c => c.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  const keep = new Set([CORE_CACHE, IMG_CACHE]);
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !keep.has(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Stale-while-revalidate for Unsplash images (and any cross-origin images):
// serve the cached copy instantly, update in the background. This means the
// destination / food photos keep working offline on patchy Italian data.
function staleWhileRevalidate(request) {
  return caches.open(IMG_CACHE).then(cache =>
    cache.match(request).then(cached => {
      const network = fetch(request)
        .then(resp => {
          if (resp && resp.status === 200) cache.put(request, resp.clone());
          return resp;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isImage =
    req.destination === 'image' ||
    url.hostname === 'images.unsplash.com';

  if (isImage) {
    e.respondWith(staleWhileRevalidate(req));
    return;
  }

  // Core: cache-first with network fallback, and fall back to index.html for navigations offline
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).catch(() => {
        if (req.mode === 'navigate') return caches.match('/index.html');
      });
    })
  );
});
