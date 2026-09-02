js
// Offline support for Backyard Species Log.
// Network first, cache as the fallback: a new deploy is always picked up, and a
// bad cache can never permanently pin you to an old version of the app.

const CACHE = "bfl-v1";

// Pinned library files — these must match the versions in index.html.
const LIBS = [
  "https://unpkg.com/react@18.3.1/umd/react.production.min.js",
  "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/@babel/standalone@7.24.7/babel.min.js",
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js",
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js",
];

// Live data and map tiles are never cached — a stale answer is worse than none.
const LIVE = /googleapis\.com|nominatim|inaturalist|wikipedia|wikimedia|tile\.openstreetmap/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.all(
        ["./", "./index.html"].concat(LIBS).map((url) =>
          // Each file is fetched on its own and failures are ignored, so one
          // slow CDN can't stop offline support from installing.
          fetch(url).then((res) => (res.ok ? cache.put(url, res) : null)).catch(() => {})
        )
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (LIVE.test(new URL(req.url).hostname)) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => {
        if (hit) return hit;
        if (req.mode === "navigate") return caches.match("./index.html");
        throw new Error("offline");
      }))
  );
});
