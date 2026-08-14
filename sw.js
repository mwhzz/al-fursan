/* Al Fursan — service worker */
const VERSION = 'al-fursan-v2';
const SHELL = [
  './', 'index.html', 'css/styles.css',
  'js/config.js', 'js/i18n.js', 'js/store.js', 'js/demo.js', 'js/api.js', 'js/ui.js', 'js/guide.js',
  'js/student.js', 'js/admin.js', 'js/app.js',
  'manifest.webmanifest',
  'assets/logo.png', 'assets/logo.svg', 'assets/hero.jpg',
  'assets/icon-192.png', 'assets/icon-512.png', 'assets/icon-maskable.png',
  'assets/apple-touch-icon.png', 'assets/favicon-32.png', 'assets/favicon-16.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.allSettled(SHELL.map(u => c.add(u)))));
  // no skipWaiting here: the page asks the user first, then posts SKIP_WAITING
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                      // never cache RPC calls
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;       // Supabase & fonts go to network

  // HTML: network first so a deploy is picked up on the next visit
  const isDoc = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');
  if (isDoc) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(hit => hit || caches.match('index.html')))
    );
    return;
  }

  // assets: cache first, refreshed in the background
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});

/* A booking arrived while the app was closed. This runs without any page open,
   which is the whole point of push. */
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (err) { data = { body: e.data && e.data.text() }; }
  const title = data.title || 'Al Fursan';
  e.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: 'assets/icon-192.png',
    badge: 'assets/favicon-48.png',
    tag: data.tag || 'af-alert',
    renotify: true,
    data: { url: data.url || '/#/admin/requests' }
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window' }).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    if (clients.openWindow) return clients.openWindow('./#/admin/requests');
  }));
});
