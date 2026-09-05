/* Free Relief service worker: offline-capable static app shell. */
const VERSION = 'freerelief-v1';
const SHELL = `${VERSION}-shell`;
const VENDOR = `${VERSION}-vendor`;
const KEEP = [SHELL, VENDOR];
const PRECACHE = [
  './',
  'index.html',
  'css/styles.css',
  'js/data.js',
  'js/figures.js',
  'js/lab3d.js',
  'js/app.js',
  'manifest.webmanifest',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/icon-maskable-512.png',
  'assets/apple-touch-icon-180.png',
];
const VENDOR_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      .then((cache) => Promise.all(PRECACHE.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Same-origin: stale-while-revalidate (serve cache immediately, refresh in background).
async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL);
  const cached = await cache.match(request, { ignoreSearch: true });
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok && response.type === 'basic') cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

// Vendor scripts/fonts: cache-first, opaque (no-cors) responses accepted.
async function cacheFirst(request) {
  const cache = await caches.open(VENDOR);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && (response.ok || response.type === 'opaque')) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  let url;
  try { url = new URL(request.url); } catch (e) { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (url.origin === self.location.origin) {
    event.respondWith(
      staleWhileRevalidate(request).then((r) => r || fetch(request)).catch(() => caches.match('index.html'))
    );
    return;
  }
  if (VENDOR_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(request).catch(() => caches.match(request, { cacheName: VENDOR })));
  }
});
