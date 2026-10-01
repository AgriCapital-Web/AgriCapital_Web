const CACHE_NAME = 'agricapital-client-shell-v4';
const APP_ORIGIN = self.location.origin;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.allSettled(
      cacheNames.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    );
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach((client) => client.postMessage({ type: 'SW_ACTIVATED' }));
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let payload = {};
    try {
      payload = event.data ? event.data.json() : {};
    } catch {
      payload = { body: event.data?.text?.() || '' };
    }

    const title = payload.title || 'AgriCapital';
    const body = payload.body || 'Une nouvelle information est disponible.';
    const tag = payload.tag || payload.dedupe_key || 'agricapital-notification';
    const url = payload.url || '/';
    const data = {
      ...(payload.data || {}),
      url,
      dedupe_key: payload.dedupe_key || null,
    };

    // When the PWA is visibly open, let the in-app notification center/realtime
    // handle the event. This prevents a duplicate OS notification.
    const windows = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });
    const visible = windows.some((client) => client.visibilityState === 'visible');

    if (visible) {
      windows.forEach((client) => {
        client.postMessage({
          type: 'PUSH_NOTIFICATION_RECEIVED',
          payload: { title, body, tag, data },
        });
      });
      return;
    }

    await self.registration.showNotification(title, {
      body,
      icon: payload.icon || '/icons/icon-192x192.png',
      badge: payload.badge || '/icons/icon-192x192.png',
      tag,
      renotify: false,
      data,
      vibrate: [200, 100, 200],
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/';

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });

    for (const client of windows) {
      if ('focus' in client) {
        client.focus();
        client.postMessage({
          type: 'OPEN_NOTIFICATION_TARGET',
          url: target,
        });
        return;
      }
    }

    if (self.clients.openWindow) {
      await self.clients.openWindow(new URL(target, APP_ORIGIN).href);
    }
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== APP_ORIGIN) return;

  if (event.request.mode === 'navigate' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() => caches.match('/index.html'))
    );
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response.ok) await cache.put(event.request, response.clone());
      return response;
    }));
  }
});