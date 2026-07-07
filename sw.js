// Service worker : cache local pour fonctionner hors ligne (dictionnaire inclus)
const CACHE = "noxchiyn-mott-v18";
const FILES = ["./","./index.html","./style.css","./app.js",
  "./data/dict.js","./data/phrases.js","./manifest.webmanifest","./icons/icon.svg"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks =>
    Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const u = e.request.url;
  if (u.includes("translate.googleapis.com")) return; // MT : toujours réseau
  if (u.includes("googlesyndication") || u.includes("doubleclick") ||
      u.includes("adtrafficquality") || u.includes("googleadservices")) return; // publicité : jamais interceptée
  if (u.includes("fonts.googleapis.com") || u.includes("fonts.gstatic.com")
      || u.includes("cdnjs.cloudflare.com") || u.includes("cdn.jsdelivr.net")) {
    // polices et bibliothèques (PDF, Word, OCR) : cache après premier chargement
    e.respondWith(caches.open(CACHE).then(async c => {
      const m = await c.match(e.request);
      const f = fetch(e.request).then(r => { c.put(e.request, r.clone()); return r; }).catch(() => m);
      return m || f;
    }));
    return;
  }
  // fichiers de l'application : RÉSEAU D'ABORD (les mises à jour arrivent toujours),
  // cache en secours pour le hors ligne
  e.respondWith(
    fetch(e.request).then(r => {
      if (e.request.method === "GET" && r.ok) {
        const cp = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, cp));
      }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
