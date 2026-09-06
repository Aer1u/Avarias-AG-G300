const CACHE_NAME = "avarias-app-shell-v1";
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/file.svg",
  "/globe.svg",
  "/next.svg",
  "/window.svg"
];

// Install: Cache core App Shell static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Strategy:
// 1. Bypass Supabase & Backend API calls (Handled by IndexedDB in Phase 2)
// 2. Network-First for HTML/document navigation (ensures fresh Next.js deployments)
// 3. Stale-While-Revalidate for static assets
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Bypass non-GET requests or Supabase/API requests
  if (
    event.request.method !== "GET" ||
    url.hostname.includes("supabase") ||
    url.pathname.startsWith("/api")
  ) {
    return;
  }

  // Navigation / HTML requests: Network-First (fallback to Cache)
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => cached || caches.match("/"));
        })
    );
    return;
  }

  // Static Assets (CSS, JS, Images, Fonts): Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
