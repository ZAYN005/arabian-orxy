// Offline support. Paths are relative so it works under /arabian-orxy/ on GitHub Pages.
const CACHE = 'ao-docs-v2';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/brand.js',
  './js/vendor/html2canvas.min.js',
  './js/vendor/jspdf.umd.min.js',
  './manifest.json',
  './assets/mark.svg',
  './assets/fonts/archivo.woff2',
  './assets/fonts/noto-kufi-arabic.woff2',
  './assets/fonts/plex-arabic-400.woff2',
  './assets/fonts/plex-arabic-500.woff2',
  './assets/fonts/plex-arabic-600.woff2',
  './assets/fonts/plex-arabic-700.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first, so updates reach the office straight away; cache when offline.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(hit => hit || caches.match('./index.html')))
  );
});
