const CACHE_NAME = 'tahmin-biz-v1';
const ASSETS = [
    './',
    'index.html',
    'style.css',
    'app.js',
    'logo.png',
    'icon-192.png',
    'icon-180.png',
    'manifest.json'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (e) => {
    // Only cache GET requests that are NOT API calls
    if (e.request.method === 'GET' && !e.request.url.includes('/api/')) {
        e.respondWith(
            caches.match(e.request).then((response) => {
                return response || fetch(e.request);
            })
        );
    }
});
