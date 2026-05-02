const CACHE_NAME = 'atlas-v95-aviso-atualizacao';
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

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Busca de arquivos: tenta pegar a versao nova primeiro e usa cache se estiver offline.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  const sempreAtualizar = e.request.mode === 'navigate' || /\.(html|js|css)$/i.test(url.pathname);
  const requestAtualizado = sempreAtualizar ? new Request(e.request, { cache: 'reload' }) : e.request;

  e.respondWith(
    fetch(requestAtualizado)
      .then(response => {
        const copia = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, copia));
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});
