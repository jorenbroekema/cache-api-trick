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
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'activated') {
          // force reload now that SW is activated and ready to intercept
          // network requests and load from our (manually filled) cache
          location.reload();
        }
      });
    });
  }
}

await Promise.all([addBundleToCache(), registerAndLoadSw()]);

// Now the worker can do importScripts to our cached JS string
worker.postMessage('woof!');
