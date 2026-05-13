'use strict';

const CACHE_NAME = 'look-v3';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './css/styles.css',
  './js/app.js',
  './js/state.js',
  './js/nav.js',
  './js/home.js',
  './js/setup.js',
  './js/event.js',
  './js/ocr.js',
  './js/importers.js',
  './js/export.js',
  './js/names.js',
  './js/utils.js'
];

const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
];

const PRECACHE = APP_SHELL.concat(CDN_ASSETS);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // addAll is all-or-nothing — fall back to individual puts so a single
    // bad URL doesn't fail the install.
    await Promise.all(PRECACHE.map(async url => {
      try {
        const response = await fetch(url, { cache: 'no-cache' });
        if (response && response.ok) await cache.put(url, response);
      } catch (e) {
        // best-effort precache
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isCdn = url.hostname === 'cdn.jsdelivr.net';

  if (request.mode === 'navigate' && isSameOrigin) {
    event.respondWith(navigationHandler(request));
    return;
  }

  if (isSameOrigin) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (isCdn) {
    event.respondWith(cdnStaleWhileRevalidate(request, event));
    return;
  }

  event.respondWith(networkFirst(request));
});

async function navigationHandler(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response && response.ok) await cache.put('./index.html', response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match('./index.html');
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) await cache.put(request, response.clone());
  return response;
}

async function cdnStaleWhileRevalidate(request, event) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const update = (async () => {
    const response = await fetch(request);
    if (response && response.ok) await cache.put(request, response.clone());
    return response;
  })();
  if (cached) {
    event.waitUntil(update.catch(() => {}));
    return cached;
  }
  return update;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response && response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}
