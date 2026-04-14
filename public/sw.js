// Auto-generated no-op service worker.
// Serwist rebuilds this file on production builds (next build).
// In development, this placeholder prevents stale precache errors.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(names.map((name) => caches.delete(name))))
  );
  self.clients.claim();
});
