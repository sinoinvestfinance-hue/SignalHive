/* ============================================================
   DerivAI Pro — Service Worker v3.0
   Handles: Caching, Offline Shell, Background Sync, Push
============================================================ */
'use strict';

const CACHE_NAME     = 'derivaipro-v3';
const SHELL_CACHE    = 'derivaipro-shell-v3';
const DATA_CACHE     = 'derivaipro-data-v3';
const OFFLINE_URL    = '/index.html';

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&family=JetBrains+Mono:wght@300;400;600;700&display=swap',
  'https://cdn.tailwindcss.com'
];

/* ─── INSTALL ─── */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing DerivAI Pro Service Worker');
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => {
        return cache.addAll(SHELL_ASSETS.filter(url => !url.startsWith('https://fonts') && !url.startsWith('https://cdn')));
      })
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Cache install error:', err))
  );
});

/* ─── ACTIVATE ─── */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating DerivAI Pro Service Worker');
  event.waitUntil(
    caches.keys().then(keyList =>
      Promise.all(
        keyList
          .filter(key => key !== SHELL_CACHE && key !== DATA_CACHE)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

/* ─── FETCH ─── */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip WebSocket connections
  if (url.protocol === 'wss:' || url.protocol === 'ws:') return;

  // Skip Deriv API calls (always live)
  if (url.hostname.includes('binaryws.com') || url.hostname.includes('deriv.com')) return;

  // Skip browser-sync / dev tools
  if (url.pathname.includes('browser-sync')) return;

  event.respondWith(
    caches.match(request).then(cachedResponse => {
      if (cachedResponse) return cachedResponse;

      return fetch(request).then(response => {
        // Don't cache non-successful or non-basic responses
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }

        // Cache shell assets
        const responseClone = response.clone();
        caches.open(SHELL_CACHE).then(cache => cache.put(request, responseClone));

        return response;
      }).catch(() => {
        // Offline fallback for navigation requests
        if (request.mode === 'navigate') {
          return caches.match(OFFLINE_URL);
        }
      });
    })
  );
});

/* ─── PUSH NOTIFICATIONS ─── */
self.addEventListener('push', (event) => {
  let data = { title: 'DerivAI Pro', body: 'New trading signal available', icon: '/icon-192.png' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/icon-192.png',
      badge: '/icon-72.png',
      tag: 'derivai-signal',
      renotify: true,
      requireInteraction: false,
      data: data
    })
  );
});

/* ─── NOTIFICATION CLICK ─── */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});

/* ─── BACKGROUND SYNC ─── */
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  if (event.tag === 'sync-trades') {
    event.waitUntil(syncPendingTrades());
  }
});

async function syncPendingTrades() {
  // Placeholder: sync pending offline trades when connection restored
  console.log('[SW] Syncing pending trades...');
}

/* ─── MESSAGE HANDLER ─── */
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'CACHE_URLS') {
    caches.open(SHELL_CACHE).then(cache => cache.addAll(event.data.urls || []));
  }
});

/* ─── PERIODIC SYNC (if supported) ─── */
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'market-check') {
    console.log('[SW] Periodic market check');
  }
});
