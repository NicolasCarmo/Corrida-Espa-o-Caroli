// service-worker.js

const CACHE_NAME = 'runtracker-v1';
const urlsToCache = [
  '/',
  '/tela_apresentacao.html',
  '/tela_corrida.html',
  '/tela_historico.html',
  '/admin.html',
  '/style.css',
  '/app.js',
  '/config.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
