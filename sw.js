// Dial it — offline cache. Bump VERSION when you change any file.
const VERSION = "dialit-v10";
const FILES = [
  "./",
  "./index.html",
  "./css/app.css",
  "./fonts/archivo.woff2",
  "./js/ballistics.js",
  "./js/util.js",
  "./js/store.js",
  "./js/nav.js",
  "./js/dial.js",
  "./js/air.js",
  "./js/results.js",
  "./js/photo.js",
  "./js/dope.js",
  "./js/rifles.js",
  "./js/ammo.js",
  "./js/chrono.js",
  "./js/log.js",
  "./js/backup.js",
  "./js/sync.js",
  "./js/main.js",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  // Dropbox and anything else off-site goes straight to the network.
  if (new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(e.request).then((res) => {
        if (res && res.ok && new URL(e.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(e.request, copy));
        }
        return res;
      }).catch(() => caches.match("./index.html"));
    })
  );
});
