// Bump this on every deploy that ships new JS/CSS so Chrome (which pins SW
// installs aggressively) is forced to drop the previous cache. Old SW
// installs were serving stale hashed bundles after deploys, producing a
// blank /organizer screen in Chrome only.
const CACHE_NAME = "hasadx-v4-2026-05-18";

// JS/CSS are Vite-hashed and change on every deploy. We *must* go to the
// network first for them — a cached miss for a no-longer-existing hash
// would white-screen the SPA. We still cache after a successful fetch so
// repeat visits stay fast; we just don't trust the cache as the source of
// truth.
const STATIC_PATTERNS = [
  /\/images\//,
  /\/icons\//,
  /\/fonts\//,
  /\.(?:woff2?|ttf|otf|eot)$/,
];

const NETWORK_FIRST_ASSET_PATTERNS = [
  /\.(?:js|css)$/,
];

const NETWORK_FIRST_PATTERNS = [
  /\/api\//,
  /\/auth\//,
];

function isStaticAsset(url) {
  return STATIC_PATTERNS.some((p) => p.test(url));
}

function isNetworkFirstAsset(url) {
  return NETWORK_FIRST_ASSET_PATTERNS.some((p) => p.test(url));
}

function isNetworkFirst(url) {
  return NETWORK_FIRST_PATTERNS.some((p) => p.test(url));
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  // Do NOT pre-cache "/" here. The index.html references hashed JS/CSS
  // bundles whose filenames change every deploy. Pre-caching "/" pinned a
  // stale shell that, when served as a navigation fallback after a deploy,
  // pointed Chrome at JS hashes the server no longer had → white page.
  // We only pre-cache assets whose URLs do not change between deploys.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(["/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png"])
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
        // Offline fallback: try the cached copy of this exact URL only.
        // Do NOT fall back to a cached "/" — its embedded hashed bundle
        // refs may point to JS files the server no longer has, which
        // white-screens the page once the user is back online.
        .catch(() => caches.match(request))
    );
    return;
  }

  if (isNetworkFirst(url)) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Vite-hashed JS/CSS: always try network first. If the network returns
  // a non-OK status (e.g. 404 because this hash no longer exists after a
  // deploy), do NOT serve a stale cached copy of a *different* file —
  // surface the failure so the page can recover via a reload. Only fall
  // back to cache when the network is unreachable.
  if (isNetworkFirstAsset(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || Response.error()))
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
