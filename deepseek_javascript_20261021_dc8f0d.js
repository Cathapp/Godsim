var CACHE_NAME = 'gorodok-v1';
var urlsToCache = [
  './',
  './index.html',
  './game.js',
  './world.js',
  './console.js',
  './three.min.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return cache.addAll(urlsToCache).catch(function(e){
        console.log('SW cache error:', e);
      });
    })
  );
});

self.addEventListener('fetch', function(event){
  event.respondWith(
    caches.match(event.request).then(function(response){
      return response || fetch(event.request);
    })
  );
});