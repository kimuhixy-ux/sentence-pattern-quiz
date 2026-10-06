// データやコードを更新したら必ず番号を上げる（上げ忘れると端末に古い版が残る）
const CACHE_NAME = 'sentence-pattern-quiz-v2';

const PRECACHE_URLS = [
  './',
  'index.html',
  'css/style.css',
  'js/app.js',
  'js/user-store.js',
  'data/questions.json',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

// HTML と JSON は内容の更新を早く届けたいので通信を優先し、圏外のときだけキャッシュを使う
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  const isDocument = request.mode === 'navigate' || request.destination === 'document';
  const isJson = new URL(request.url).pathname.endsWith('.json');
  event.respondWith(isDocument || isJson ? networkFirst(request) : cacheFirst(request));
});
