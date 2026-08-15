const CACHE_NAME = 'magamerz-v1'; // Kalau ada update besar-besaran, ubah v1 jadi v2, v3, dst.
const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './magamerz.js',
    './logo.png',
    './manifest.json'
];

// Proses Install: Simpan file penting ke Cache
self.addEventListener('install', event => {
    self.skipWaiting(); // Memaksa service worker baru langsung aktif tanpa menunggu
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(urlsToCache);
        })
    );
});

// Proses Activate: Bersihkan sampah cache versi lama
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Menghapus cache lama:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim()) // Memaksa SW baru mengambil alih semua halaman
    );
});

// Proses Fetch (Network First, fallback to Cache)
self.addEventListener('fetch', event => {
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Jika sukses fetch dari internet, update cache dengan file terbaru
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }
                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseToCache);
                });
                return response;
            })
            .catch(() => {
                // Jika gagal (Offline), ambil dari Cache
                return caches.match(event.request);
            })
    );
});