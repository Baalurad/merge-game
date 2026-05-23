const CACHE_NAME = 'merge-game-v1';
const ASSETS = [
    '/merge-game/',
    '/merge-game/index.html',
    '/merge-game/manifest.json',
    '/merge-game/src/main.js',
    '/merge-game/src/GameScene.js',
    'https://cdn.jsdelivr.net/npm/phaser@3.70.0/dist/phaser.min.js',
];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', e => {
    e.respondWith(
        caches.match(e.request).then(cached => cached || fetch(e.request))
    );
});
