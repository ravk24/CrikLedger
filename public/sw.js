// CrikLedger service worker — the entire caching policy.
// This is a LIVE MONEY LEDGER: a cached balance is a wrong balance.
// Network-first for every page and API; cache ONLY truly static assets.
// Bump STATIC_CACHE when icons change.
// v3: the CricLedger -> CrikLedger rename replaced every icon and the
// app title, so installed clients must drop the old shell.
// v4: the splash screen is gone, so /splash.png left this list. The bump
// is what evicts it — an installed client keeps its old addAll otherwise.
const STATIC_CACHE = "crikledger-static-v4";
const STATIC_ASSETS = [
  "/icon-192.png",
  "/icon-512.png",
  "/offline.html",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Static assets: cache-first
  if (STATIC_ASSETS.includes(url.pathname)) {
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
    return;
  }
  // EVERYTHING else (pages, data): network only, offline fallback for navigations
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.match("/offline.html")));
  }
  // Non-navigation requests fall through to the network untouched.
});
