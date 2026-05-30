// AXIOM DIGIT AI — Service Worker v2.0
const CACHE_NAME = 'axiom-digit-ai-v2';
const SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=JetBrains+Mono:wght@300;400;700&family=Rajdhani:wght@300;400;600;700&display=swap',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // WebSocket — never intercept
  if (e.request.url.startsWith('ws')) return;
  // Deriv API — network only
  if (e.request.url.includes('binaryws.com') || e.request.url.includes('derivws.com')) return;
  // Tailwind CDN — network first
  if (e.request.url.includes('cdn.tailwindcss.com')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }
  // App shell — cache first
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(resp => {
      if (resp && resp.status === 200) {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
      }
      return resp;
    })).catch(() => caches.match('/index.html'))
  );
});

// Background sync stub
self.addEventListener('sync', e => {
  if (e.tag === 'sync-logs') {
    e.waitUntil(Promise.resolve());
  }
});

// Push notifications stub
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : { title: 'AXIOM', body: 'Trading alert' };
  e.waitUntil(
    self.registration.showNotification(data.title || 'AXIOM DIGIT AI', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      tag: 'axiom-alert',
      renotify: true,
      data: data
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow('/'));
});
