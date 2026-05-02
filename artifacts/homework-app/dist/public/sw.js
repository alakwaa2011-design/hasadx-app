const CACHE_NAME = "hasadx-v3-2026-04-18";

const STATIC_PATTERNS = [
  /\.(?:js|css|woff2?|ttf|otf|eot)$/,
  /\/images\//,
  /\/icons\//,
  /\/fonts\//,
];

const NETWORK_FIRST_PATTERNS = [
  /\/api\//,
  /\/auth\//,
];

function isStaticAsset(url) {
  return STATIC_PATTERNS.some((p) => p.test(url));
}

function isNetworkFirst(url) {
  return NETWORK_FIRST_PATTERNS.some((p) => p.test(url));
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(["/", "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png"])
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = request.url;

  if (request.method !== "GET") return;

  // Always go to the network for HTML documents and navigations so the user
  // sees the latest deployed version. Fall back to the cached shell only when
  // the network is unavailable (offline support).
  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/")))
    );
    return;
  }

  if (isNetworkFirst(url)) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
      )
    );
    return;
  }

  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
