// Генерирует dist/sw.js с уникальным BUILD-id (кэш инвалидируется на каждый релиз)
// и dist/version.json. Запускается после vite build.
import { writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

let build = process.env.APP_VERSION;
if (!build) {
  try {
    build = 'git-' + execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    build = String(Date.now());
  }
}

const distDir = fileURLToPath(new URL('../dist/', import.meta.url));

const sw = `const BUILD = ${JSON.stringify(build)};
const CACHE = 'life-os-' + BUILD;
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/version.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api')) return;
  // version.json — всегда из сети (чтобы ловить новые релизы), с фолбэком в кэш.
  if (url.pathname === '/version.json') {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/index.html')));
    return;
  }
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
        return response;
      });
    }),
  );
});
`;

writeFileSync(distDir + 'sw.js', sw);
writeFileSync(distDir + 'version.json', JSON.stringify({ version: build }) + '\n');
console.log('Сгенерированы dist/sw.js и dist/version.json — build:', build);
