/* Free Relief service worker: offline-capable static app shell. */
const VERSION = 'freerelief-v3';
const SHELL = `${VERSION}-shell`;
const VENDOR = `${VERSION}-vendor`;
const KEEP = [SHELL, VENDOR];
const PRECACHE = [
  './',
  'index.html',
  'privacy.html',
  'terms.html',
  'css/styles.css',
  'css/screen.css',
  'css/programs.css',
  'css/growth.css',
  'js/data.js',
  'js/figures.js',
  'js/anatomy.js',
  'js/lab3d.js',
  'js/app.js',
  'js/screen.js',
  'js/programs.js',
  'js/growth.js',
  /* three.js r147, vendored: without these the swing lab is a blank canvas offline. They are the
     bulk of the install (~660 KB) but they are the whole point of precaching - the lab is the app. */
  'js/vendor/three/build/three.min.js',
  'js/vendor/three/examples/js/controls/OrbitControls.js',
  'js/vendor/three/examples/js/shaders/CopyShader.js',
  'js/vendor/three/examples/js/shaders/LuminosityHighPassShader.js',
  'js/vendor/three/examples/js/shaders/GammaCorrectionShader.js',
  'js/vendor/three/examples/js/postprocessing/EffectComposer.js',
  'js/vendor/three/examples/js/postprocessing/RenderPass.js',
  'js/vendor/three/examples/js/postprocessing/ShaderPass.js',
  'js/vendor/three/examples/js/postprocessing/UnrealBloomPass.js',
  'js/vendor/three/examples/js/environments/RoomEnvironment.js',
  /* The font stylesheet, but not the .woff2 files it points at: their names carry Google's content
     hashes, so listing them here would silently rot the day the fonts are regenerated. The
     same-origin handler below caches each subset the first time it is used, and until then the CSS
     font stacks fall back to the system faces - a first visit made entirely offline looks slightly
     plainer, and nothing breaks. */
  'js/vendor/fonts/fonts.css',
  'manifest.webmanifest',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/icon-maskable-512.png',
  'assets/apple-touch-icon-180.png',
];
/* assets/anatomy/spine.bin is deliberately NOT precached: it is ~172 KB and the lab renders a
   full procedural skeleton without it. The same-origin stale-while-revalidate handler below
   caches it opportunistically the first time it is actually fetched, so it is offline from the
   second visit on without ever holding up an install. */
/* Fonts are the only third party left: three.js now ships in js/vendor and is precached above.
   cdn.jsdelivr.net stays in the list only so a browser still holding a pre-vendoring index.html
   keeps working offline until the new shell takes over. */
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
