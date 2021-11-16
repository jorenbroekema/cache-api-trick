import * as rollup from 'rollup';

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

const code = await createBundle(foo); // UMD bundle of JS code
const cache = await caches.open('foo-v1');

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

// Check if it's in cache
const match = await cache.match('/foo/bar.js');
const data = await match.text();
// This all seems okay to me
console.log(match, match.headers.get('content-type'), data);

// 404 not found for worker trying to importScripts('foo/bar.js')
const myWorker = new Worker('worker.js');
