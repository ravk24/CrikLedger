// CrikLedger service worker — the entire caching policy.
// This is a LIVE MONEY LEDGER: a cached balance is a wrong balance.
// Network-first for every page and API; cache ONLY truly static assets.
// Bump STATIC_CACHE when the precache list or the runtime rule changes.
// v3: the CricLedger -> CrikLedger rename replaced every icon and the
// app title, so installed clients must drop the old shell.
// v5: only offline.html is precached (the icons are fetched by the
// browser on install, never by pages), and navigations use navigation
// preload so the network request starts before this worker has booted.
// v7: /_next/static/* is cached on first use. Those URLs are
// content-hashed and served immutable, so a cached one can never be a
// stale VALUE — a new build is a new URL. Without it a PWA cold start
// re-downloaded ~190 KB of JS and fonts whenever the browser's disk
// cache had evicted them. Nothing else is cached: not /_next/image
// (query-keyed), not RSC payloads (?_rsc=), not /api, not HTML.
const STATIC_CACHE = "crikledger-static-v7";
const RUNTIME_CACHE = "crikledger-runtime-v7";
const STATIC_ASSETS = ["/offline.html"];
const IMMUTABLE_PREFIX = "/_next/static/";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
              .map((k) => caches.delete(k)),
          ),
        ),
      self.registration.navigationPreload
        ? self.registration.navigationPreload.enable()
        : Promise.resolve(),
    ]),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (STATIC_ASSETS.includes(url.pathname)) {
    // cache-first
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
    return;
  }
  if (e.request.mode === "navigate") {
    // network-only, via the preloaded response when the browser started
    // one; the offline page only when the network is unreachable.
    e.respondWith(
      (async () => {
        try {
          const preloaded = await e.preloadResponse;
          return preloaded || (await fetch(e.request));
        } catch {
          return (await caches.match("/offline.html")) || Response.error();
        }
      })(),
    );
    return;
  }
  if (
    e.request.method === "GET" &&
    url.origin === self.location.origin &&
    url.pathname.startsWith(IMMUTABLE_PREFIX) &&
    !url.search
  ) {
    // cache-first for content-hashed build assets only (see v7 note).
    e.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_CACHE);
        const hit = await cache.match(e.request);
        if (hit) return hit;
        const res = await fetch(e.request);
        if (res.ok) cache.put(e.request, res.clone());
        return res;
      })(),
    );
    return;
  }
  // Everything else falls through to the network untouched.
});
