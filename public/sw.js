// CrikLedger service worker — the entire caching policy.
// This is a LIVE MONEY LEDGER: a cached balance is a wrong balance.
// Network-first for every page and API; cache ONLY truly static assets.
// Bump STATIC_CACHE when the precache list changes.
// v3: the CricLedger -> CrikLedger rename replaced every icon and the
// app title, so installed clients must drop the old shell.
// v4: the splash screen is gone, so /splash.png left this list.
// v5: only offline.html is precached (the icons are fetched by the
// browser on install, never by pages), and navigations use navigation
// preload so the network request starts before this worker has booted.
const STATIC_CACHE = "crikledger-static-v6";
const STATIC_ASSETS = ["/offline.html"];

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
            keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k)),
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
  }
  // Non-navigation requests fall through to the network untouched.
});
