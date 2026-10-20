const CACHE_VERSION = 'crucidrive-pwa-v2';
const STATIC_CACHE = `crucidrive-static-${CACHE_VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(['/'])).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key.startsWith('crucidrive-static-') && key !== STATIC_CACHE) {
            return caches.delete(key);
          }
          return undefined;
        }),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  // Nunca interceptar ni guardar API, autenticación, fotos privadas o URLs firmadas.
  if (request.headers.has('authorization') || url.search ||
      /^\/(api|auth|storage)\//.test(url.pathname)) return;

  const cacheable = (response) => response.ok &&
    !/no-store|private/i.test(response.headers.get('cache-control') || '');

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          if (cacheable(response)) {
            event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.put('/', copy)));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match('/');
        }),
    );
    return;
  }

  // Lista explícita de recursos públicos del build. Otros GET pasan a la red.
  if (!/^\/(assets\/|_expo\/static\/|(?:pwa-[\w-]+|apple-touch-icon|favicon)\.(?:png|ico)$)/.test(url.pathname)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(request).then((response) => {
        if (response && cacheable(response)) {
          const copy = response.clone();
          event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy)));
        }
        return response;
      });
    }),
  );
});
