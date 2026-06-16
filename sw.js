// Recruit Ledger — service worker
// Strategy: cache the app shell (HTML + icons + manifest) so the app loads
// instantly and works offline. API requests are NEVER cached — they always
// hit the network so data stays fresh.

// Bump this version string to force a refresh of cached assets after a deploy.
const VERSION = 'v1';
const SHELL_CACHE = `ledger-shell-${VERSION}`;

// Files that make up the static "app shell". The HTML is self-contained
// (CSS + JS embedded) so this is a short list.
const SHELL_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-192-maskable.png',
  '/icon-512-maskable.png',
];

// On install: pre-cache the shell.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_FILES))
  );
  // Activate immediately on first install instead of waiting for the next page load.
  self.skipWaiting();
});

// On activate: clean up any old shell caches from previous versions.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('ledger-shell-') && k !== SHELL_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// On fetch: route requests.
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only GETs are cacheable. PUT/POST/DELETE always go straight to the network.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // API: always network. Never serve a stale entries list.
  if (url.pathname.startsWith('/api/')) return;

  // Cross-origin (Google Fonts, etc.): use a stale-while-revalidate-ish flow,
  // but for simplicity just let the browser handle it normally.
  if (url.origin !== location.origin) return;

  // App shell: try cache first, fall back to network.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        // Refresh in the background so the next load picks up updates.
        fetch(req)
          .then((res) => {
            if (res && res.ok) {
              caches.open(SHELL_CACHE).then((c) => c.put(req, res.clone()));
            }
          })
          .catch(() => { /* offline; ignore */ });
        return cached;
      }
      return fetch(req).then((res) => {
        // If it looks like a useful response, stash it.
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => {
        // Offline and no cache hit. For navigation requests, return the cached index
        // as a fallback so the app shell still loads.
        if (req.mode === 'navigate') return caches.match('/index.html');
        throw new Error('Offline and not in cache');
      });
    })
  );
});
