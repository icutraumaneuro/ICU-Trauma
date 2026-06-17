// ICU Trauma Dashboard — Service Worker
// version เปลี่ยนทุกครั้งที่ update เพื่อ refresh cache
const CACHE_NAME = 'icu-trauma-v1';

// ไฟล์ที่ cache ไว้สำหรับ offline
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800&display=swap'
];

// ===== INSTALL — cache ไฟล์ static =====
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching static assets');
      // cache ทีละไฟล์ ถ้าไฟล์ไหน fail ไม่หยุดทั้งหมด
      return Promise.allSettled(
        STATIC_ASSETS.map(url => cache.add(url).catch(e => console.warn('[SW] Failed to cache:', url, e)))
      );
    }).then(() => self.skipWaiting())
  );
});

// ===== ACTIVATE — ลบ cache เก่า =====
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => {
          console.log('[SW] Deleting old cache:', key);
          return caches.delete(key);
        })
      )
    ).then(() => self.clients.claim())
  );
});

// ===== FETCH — strategy ตาม type ของ request =====
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Apps Script API calls — Network first, fallback offline message
  if (url.hostname === 'script.google.com') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // cache response ล่าสุดไว้
          const cloned = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
          return response;
        })
        .catch(() => {
          // offline — return cached data ถ้ามี
          return caches.match(event.request).then(cached => {
            if (cached) return cached;
            // ไม่มี cache — return offline JSON
            return new Response(JSON.stringify({
              offline: true,
              queues: [],
              beds: 8,
              admitted: [],
              updated: 'ออฟไลน์ — ข้อมูลล่าสุดที่มี',
              quotaSx: 6,
              quotaNeuro: 2
            }), {
              headers: { 'Content-Type': 'application/json' }
            });
          });
        })
    );
    return;
  }

  // Google Fonts — Cache first
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
        return response;
      }))
    );
    return;
  }

  // Static files — Cache first, network fallback
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.status === 200) {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
        }
        return response;
      }).catch(() => {
        // fallback สำหรับ navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// ===== BACKGROUND SYNC — sync เมื่อกลับมา online =====
self.addEventListener('sync', event => {
  if (event.tag === 'sync-data') {
    console.log('[SW] Background sync triggered');
    // notify clients ให้ reload data
    self.clients.matchAll().then(clients => {
      clients.forEach(client => client.postMessage({ type: 'SYNC_DATA' }));
    });
  }
});

// ===== MESSAGE — รับคำสั่งจาก app =====
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
