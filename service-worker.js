const deriveVersion = () => {
  try {
    const url = new URL(self.location.href);
    const versionParam = url.searchParams.get('v');
    if (versionParam) return versionParam;
    return url.pathname;
  } catch (_) {
    return 'static';
  }
};

const sanitizeVersion = (value) => {
  return (value || 'static').replace(/[^a-zA-Z0-9._-]/g, '');
};

const CACHE_VERSION = sanitizeVersion(deriveVersion());
const CACHE_NAME = `pwa-cache-${CACHE_VERSION}`;
const APP_SHELL = Array.from(
  new Set([
  '/',
    '/index.html',
  '/book',
  '/trips',
  '/help'
  ])
);

async function notifyClients(message) {
  if (!message) return;
  try {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach((client) => {
      try {
        client.postMessage(message);
      } catch (_) {}
    });
  } catch (_) {}
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((name) => {
          if (name === CACHE_NAME) return Promise.resolve();
          if (name.startsWith('pwa-cache-')) {
            return caches.delete(name);
          }
          return Promise.resolve();
        })
      );
      await self.clients.claim();
      await notifyClients({ type: 'SW_ACTIVATED', version: CACHE_VERSION });
    })()
  );
});

// Token storage endpoint for iOS cross-context sharing
const TOKEN_CACHE_NAME = 'auth-token-cache';
const TOKEN_ENDPOINT = '/__auth-token-cache__';

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Handle token storage endpoint (Cache API for iOS cross-context sharing)
  if (event.request.url.endsWith(TOKEN_ENDPOINT)) {
    if (event.request.method === 'POST') {
      event.respondWith(
        event.request.json().then(data => {
          // Validate payload structure
          if (!data || typeof data.token !== 'string') {
            return new Response(JSON.stringify({ error: 'Invalid token format' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          return caches.open(TOKEN_CACHE_NAME).then(cache => {
            // Only store the token field
            const sanitizedData = { token: data.token };
            cache.put(TOKEN_ENDPOINT, new Response(JSON.stringify(sanitizedData)));
            return new Response(JSON.stringify({ success: true }), {
              headers: { 'Content-Type': 'application/json' }
            });
          });
        }).catch(() => {
          return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        })
      );
      return;
    } else if (event.request.method === 'GET') {
      event.respondWith(
        caches.open(TOKEN_CACHE_NAME).then(cache => {
          return cache.match(TOKEN_ENDPOINT)
            .then(response => response || new Response(JSON.stringify({ token: null }), {
              headers: { 'Content-Type': 'application/json' }
            }));
        })
      );
      return;
    } else if (event.request.method === 'DELETE') {
      event.respondWith(
        caches.open(TOKEN_CACHE_NAME).then(cache => {
          return cache.delete(TOKEN_ENDPOINT).then(() => {
            return new Response(JSON.stringify({ success: true }), {
              headers: { 'Content-Type': 'application/json' }
            });
          });
        })
      );
      return;
    }
  }

  // Skip non-GET requests - POST, PATCH, DELETE need credentials
  if (event.request.method !== 'GET') {
    return;
  }

  if (event.request.url.includes('/api/') || event.request.url.includes('/limogrid')) {
    return;
  }

  const isAsset = /\.(?:js|css|png|jpg|jpeg|gif|svg|webp|ico)$/i.test(url.pathname) || url.pathname.startsWith('/assets/');
  if (url.pathname === '/' || url.pathname.endsWith('/index.html')) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }
  if (url.pathname === '/service-worker.js' || url.pathname.endsWith('/service-worker.js')) {
    event.respondWith(fetch(new Request(event.request, { cache: 'no-store' })));
    return;
  }
  if (isAsset) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((response) => {
        if (response.status === 200 && response.type !== 'opaque') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => cached || new Response('Offline', { status: 503 }));
      return cached || fetchPromise;
    })
  );
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data) return;
  if (data === 'SKIP_WAITING' || (typeof data === 'object' && data.type === 'SKIP_WAITING')) {
    self.skipWaiting();
  }
});
