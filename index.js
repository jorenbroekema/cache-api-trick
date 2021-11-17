import * as rollup from 'rollup';

const worker = new Worker('worker.js');

const modulePath = 'fake-path';
const foo = `export default {
  foo: 'bar',
  simpleFunc: () => {
    return 'qux';
  }
}`;

async function createBundle(from) {
  const rollupCfg = await rollup.rollup({
    input: modulePath,
    plugins: [
      {
        name: 'resolve-fake-path',
        resolveId(source, importer) {
          if (source === modulePath) {
            return modulePath;
          }
        },
        load(id) {
          if (id === modulePath) {
            return from;
          }
        },
      },
    ],
  });
  const { output } = await rollupCfg.generate({ name: '_UMD_EXPORT_', format: 'umd' });
  const { code } = output[0];
  return code;
}

async function addBundleToCache() {
  const code = await createBundle(foo); // UMD bundle of JS code
  const cache = await caches.open('v1');

  // Put in cache manually, so that a request to /foo/bar.js will give response with UMD code
  await cache.put(
    new Request('/foo/bar.js'),
    new Response(code, {
      status: 200,
      headers: {
        'content-type': 'text/javascript',
      },
    }),
  );
}

async function registerAndLoadSw() {
  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.register('./sw.js');
    if (reg.active) {
      return;
    }

    // If we are not active, we should wait until activation and then tell the SW
    // to claim clients, so no reload is needed for the SW to serve from Cache
    let promResolve;
    const prom = new Promise((resolve) => {
      promResolve = resolve;
    });
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'activated') {
          newWorker.postMessage('clients-claim');
          navigator.serviceWorker.addEventListener('message', (ev) => {
            if (ev.data.msg === 'clients-claimed') {
              promResolve();
            }
          });
        }
      });
    });
    await prom;
  }
}

await Promise.all([registerAndLoadSw(), addBundleToCache()]);
// Clients should be claimed, so we should be able to tell the worker to importScripts
// which will be served by SW from the Cache. Works in Firefox, not in Chrome.
worker.postMessage('woof');
