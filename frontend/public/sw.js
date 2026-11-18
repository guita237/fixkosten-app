// Service Worker: App-Shell offline verfügbar; API-Daten immer frisch vom Server.
const CACHE = 'fixkosten-v1';
const SHELL = ['/', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) {
    return; // API und fremde Quellen nie aus dem Cache
  }
  // Gehashte Build-Dateien: Cache zuerst
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(event.request).then((hit) => {
        if (hit) {
          return hit;
        }
        return fetch(event.request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          return res;
        });
      }),
    );
    return;
  }
  // Seiten: Netz zuerst, offline die gespeicherte App-Shell
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/')),
    );
  }
});
