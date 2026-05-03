/**
 * Minimal offline-friendly cache for static assets (Breathed with Daniel).
 */
'use strict';

const CACHE_VERSION = 'breath4me-static-v31';
/** Paths relative to this service worker URL. */
const PRECACHE_REL = [
  './index.html',
  './styles.css',
  './app.js',
  './patterns.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './og-image.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) =>
        cache.addAll(
          PRECACHE_REL.map((rel) => new URL(rel, self.location).href),
        ),
      )
      .then(() => self.skipWaiting())
      .catch(() => {}),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_VERSION)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const req = event.request;
  if (new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((hit) =>
      hit
        ? hit
        : fetch(req).catch(() =>
            caches.match(new URL('./index.html', self.location)),
          ),
    ),
  );
});
