/*
 * Handlers Web Push, importés par le service worker Workbox généré
 * (cf. vite.config.ts → workbox.importScripts). Inerte tant qu'aucun push
 * n'est reçu : n'altère pas la mise en cache / l'auto-update de l'app.
 *
 * Payload attendu (JSON) : { title, body, url, tag }.
 */
/* global self, clients */

self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: event.data ? event.data.text() : 'mister-doc' };
  }
  const title = data.title || 'mister-doc';
  const options = {
    body: data.body || '',
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    data: { url: data.url || './' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target =
    (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    (async () => {
      const url = new URL(target, self.registration.scope).href;
      const wins = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const client of wins) {
        if ('focus' in client) {
          if ('navigate' in client) {
            try {
              await client.navigate(url);
            } catch {
              /* même document : le focus suffit */
            }
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })()
  );
});
