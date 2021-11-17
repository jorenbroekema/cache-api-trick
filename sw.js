self.addEventListener('message', async (ev) => {
  if (ev.data === 'clients-claim') {
    await clients.claim();
    // Tell clients we claimed clients so they can proceed to load
    clients.matchAll().then((cls) =>
      cls.forEach((client) => {
        client.postMessage({ msg: 'clients-claimed' });
      }),
    );
  }
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then(function (response) {
      if (response) {
        return response;
      }

      // We call .clone() on the request since we might use it in a call to cache.put() later on.
      // Both fetch() and cache.put() "consume" the request, so we need to make a copy.
      // (see https://developer.mozilla.org/en-US/docs/Web/API/Request/clone)
      return fetch(event.request.clone()).then(function (response) {
        return response;
      });
    }),
  );
});
