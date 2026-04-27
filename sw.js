const CACHE_NAME = 'atlas-v21-registros-dia';
const assets = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/historicos-admin.js',
  '/atlas-ajustes-fachadas.js',
  '/firebase-atlas.js',
  '/logo.png'
];

// Instalação
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(assets);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

// Busca de arquivos: tenta pegar a versao nova primeiro e usa cache se estiver offline.
self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request)
      .then(response => {
        const copia = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, copia));
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});
