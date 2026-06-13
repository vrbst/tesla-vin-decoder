/* Tesla VIN Decoder – service worker
 * App-shell precache (offline) + runtime cache a Tesseract OCR CDN-hez.
 * A verzió emelésével (CACHE) frissül a gyorsítótár.
 */
const CACHE = 'tvd-v15';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Tesseract.js + nyelvi adat / wasm: cache-first runtime (első használat után offline OCR).
  const isOcrAsset =
    url.hostname.includes('cdn.jsdelivr.net') ||
    url.hostname.includes('unpkg.com') ||
    url.hostname.includes('tessdata') ||
    /tesseract|\.wasm(\.js)?$|\.traineddata(\.gz)?$/.test(url.pathname);
  if (isOcrAsset) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // Google Fonts: cache-first.
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  if (url.origin === self.location.origin) {
    // Lapbetöltés / HTML: network-first — online mindig a legfrissebb verzió jön,
    // offline a gyorsítótárból. Így a frissítések azonnal látszanak, ha van net.
    const isNav = req.mode === 'navigate' ||
                  (req.headers.get('accept') || '').includes('text/html');
    if (isNav) {
      event.respondWith(
        fetch(req)
          .then((res) => { cachePut(req, res); return res; })
          .catch(() => caches.match(req).then((c) => c || caches.match('./index.html')))
      );
      return;
    }
    // Egyéb azonos eredetű erőforrás (ikon, manifest): cache-first.
    event.respondWith(caches.match(req).then((cached) => cached || fetchAndCache(req)));
    return;
  }
});

function cachePut(req, res) {
  if (res && res.ok) {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
  }
}

function fetchAndCache(req) {
  return fetch(req).then((res) => {
    if (res && res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
    }
    return res;
  });
}

function staleWhileRevalidate(req) {
  return caches.open(CACHE).then((cache) =>
    cache.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()).catch(() => {});
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
}
