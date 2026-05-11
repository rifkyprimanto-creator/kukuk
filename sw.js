/* ═══════════════════════════════════════════
   Asset Tracker — Service Worker
   Handles caching & offline support
   ═══════════════════════════════════════════ */

const CACHE_NAME = 'asset-tracker-v1';

// File-file yang di-cache untuk offline
const CACHE_URLS = [
  './',
  './index.html',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// Install: cache semua file penting
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        CACHE_URLS.map(url => cache.add(url).catch(() => {}))
      );
    })
  );
  self.skipWaiting();
});

// Activate: hapus cache lama
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first untuk assets statis, network-first untuk Supabase
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Supabase requests — selalu network, jangan cache
  if(url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request).catch(() => new Response(JSON.stringify([]), {
        headers: { 'Content-Type': 'application/json' }
      }))
    );
    return;
  }

  // Tile map OpenStreetMap — cache dengan stale-while-revalidate
  if(url.hostname.includes('tile.openstreetmap.org')) {
    event.respondWith(
      caches.open('map-tiles-v1').then(async cache => {
        const cached = await cache.match(event.request);
        const fetchPromise = fetch(event.request).then(resp => {
          if(resp.ok) cache.put(event.request, resp.clone());
          return resp;
        }).catch(() => null);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // CDN assets (Leaflet, Tabler icons) — cache-first
  if(url.hostname.includes('cdn.jsdelivr.net') || url.hostname.includes('unpkg.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request).then(resp => {
        if(resp.ok){
          caches.open(CACHE_NAME).then(c => c.put(event.request, resp.clone()));
        }
        return resp;
      }))
    );
    return;
  }

  // Default: network-first, fallback ke cache
  event.respondWith(
    fetch(event.request)
      .then(resp => {
        if(resp.ok){
          caches.open(CACHE_NAME).then(c => c.put(event.request, resp.clone()));
        }
        return resp;
      })
      .catch(() => caches.match(event.request))
  );
});

// Background sync — kirim data pending saat online kembali
self.addEventListener('sync', event => {
  if(event.tag === 'sync-assets'){
    event.waitUntil(syncPendingData());
  }
});

async function syncPendingData(){
  // Placeholder — bisa dikembangkan untuk queue offline mutations
  console.log('[SW] Background sync triggered');
}
