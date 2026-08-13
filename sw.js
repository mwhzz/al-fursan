/* Al Fursan — service worker (app shell cache) */
const CACHE = 'al-fursan-v1';
const SHELL = [
  './',
  'index.html',
  'css/styles.css',
  'js/config.js',
  'js/i18n.js',
  'js/demo.js',
  'js/api.js',
  'js/ui.js',
  'js/student.js',
  'js/admin.js',
  'js/app.js',
  'manifest.webmanifest',
  'assets/icon.svg',
  'assets/icon-maskable.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // never cache RPC calls
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // Supabase & fonts: straight to network

  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => hit || caches.match('index.html'));
      return hit || net;                                  // cache-first, refresh in background
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window' }).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    if (clients.openWindow) return clients.openWindow('./');
  }));
});
