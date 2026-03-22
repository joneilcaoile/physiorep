/**
 * PhysioRep Service Worker
 * Cache-first strategy for app shell, network-first for MediaPipe models.
 */

const CACHE_NAME = 'physiorep-v8';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/src/app.js',
  '/src/exercise-engine.js',
  '/src/exercise-library.js',
  '/src/audio.js',
  '/src/db.js',
  '/src/achievements.js',
  '/src/pt-mode.js',
  '/src/vitals.js',
  '/src/challenges.js',
  '/src/programs.js',
  '/src/voice-coach.js',
  '/src/analytics.js',
  '/src/recovery.js',
  '/src/hiit.js',
  '/src/video-analyzer.js',
  '/src/tempo.js',
  '/src/xp-system.js',
  '/src/share-cards.js',
  '/src/rest-timer.js',
  '/src/adaptive.js',
  '/src/health-sync.js',
  '/src/form-hud.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

const MEDIAPIPE_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/';

// Install: cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW: Caching app shell');
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Helper: enforce cache size limit
async function enforceCacheSizeLimit(cacheName, maxEntries = 100) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    const toDelete = keys.slice(0, keys.length - maxEntries);
    await Promise.all(toDelete.map(key => cache.delete(key)));
  }
}

// Fetch: cache-first for app shell, stale-while-revalidate for CDN
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // MediaPipe CDN: cache then update
  if (event.request.url.startsWith(MEDIAPIPE_CDN)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cached) => {
          const fetchPromise = fetch(event.request).then((response) => {
            if (response.ok) {
              cache.put(event.request, response.clone());
              enforceCacheSizeLimit(CACHE_NAME, 100);
            }
            return response;
          }).catch(() => cached);

          return cached || fetchPromise;
        });
      })
    );
    return;
  }

  // App shell: cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request);
      })
    );
    return;
  }

  // Everything else: network-first
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
