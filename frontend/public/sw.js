// ATENX — Service Worker
// Habilita PWA install e push notifications

const CACHE_NAME = 'atenx-v3';

// Instala o SW e faz cache dos assets estáticos essenciais
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([
        '/',
        '/manifest.json',
        '/icons/icon-192.png',
        '/icons/icon-512.png',
      ]).catch(() => {}) // silencia erros de cache offline
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Remove caches antigos
      caches.keys().then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      ),
    ])
  );
});

// Fetch: serve da rede, fallback para cache (apenas GET)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Não intercepta chamadas de API — sempre vai para rede
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Push: recebe notificação do backend e exibe ao usuário
self.addEventListener('push', (event) => {
  let data = { title: 'ENVOX Intelligence', body: 'Novo alerta detectado', url: '/' };

  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch (_) {}

  const options = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag || 'envox-alert',
    data: { url: data.url || '/' },
    requireInteraction: data.critical === true,
    vibrate: data.critical ? [200, 100, 200, 100, 200] : [200],
    actions: [
      { action: 'open', title: 'Ver alerta' },
      { action: 'dismiss', title: 'Ignorar' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Click na notificação: abre o app na página de alertas
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const url = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Foca aba já aberta
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NAVIGATE', url });
          return;
        }
      }
      // Abre nova aba
      return self.clients.openWindow(url);
    })
  );
});
