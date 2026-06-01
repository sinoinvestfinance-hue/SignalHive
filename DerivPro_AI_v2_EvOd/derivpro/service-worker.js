// service-worker.js — DerivPro AI | PWA Service Worker
const CACHE_NAME = 'derivpro-ai-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/core/websocket.js',
  '/core/db.js',
  '/core/state.js',
  '/strategies/evod-directional.js',
  '/strategies/martingale.js',
  '/strategies/risk-manager.js',
  '/ai/ai-engine.js',
  '/services/trade-engine.js',
  '/services/digit-analyzer.js',
  '/services/indicator-engine.js',
  '/services/tick-analyzer.js',
  '/utils/logger.js',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&family=JetBrains+Mono:wght@300;400;500;700&family=Rajdhani:wght@300;400;500;600;700&display=swap',
];

// Install: cache all assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(ASSETS.map(url => cache.add(url).catch(() => {})));
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first for API, cache-first for assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip WebSocket requests
  if (event.request.url.startsWith('wss://') || event.request.url.startsWith('ws://')) return;

  // Network-first for Deriv API calls
  if (url.hostname.includes('binaryws.com') || url.hostname.includes('derivws.com')) {
    event.respondWith(fetch(event.request).catch(() => new Response('Offline', { status: 503 })));
    return;
  }

  // Cache-first for app assets
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        if (event.request.destination === 'document') return caches.match('/index.html');
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

// Background sync for trade logging
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-trades') {
    event.waitUntil(syncTrades());
  }
});

async function syncTrades() {
  // Background trade log sync (cloud backup hook)
  const clients = await self.clients.matchAll();
  clients.forEach(client => client.postMessage({ type: 'SYNC_TRADES' }));
}

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'DerivPro AI', {
      body: data.body || 'Trading notification',
      icon: '/pwa/icon-192.png',
      badge: '/pwa/icon-192.png',
      tag: data.tag || 'trade',
      vibrate: [200, 100, 200],
      data: data,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});

// Message handler
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'GET_VERSION') {
    event.ports[0]?.postMessage({ version: CACHE_NAME });
  }
});
