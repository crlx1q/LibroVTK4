const CACHE_NAME = "vtk-cache-v2";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/manifest.json",
  "/libro.png"
];

const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(self.navigator?.userAgent || "");
};

const isApiRequest = (url) => url.pathname.startsWith("/api/");
const isAuthRequest = (url) => url.pathname.includes("/auth/");

self.addEventListener("install", (event) => {
  self.skipWaiting();
  if (isMobile()) {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => 
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  
  if (event.request.method !== "GET") return;
  
  if (isAuthRequest(url)) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  if (!isMobile()) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  if (isApiRequest(url)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok && (url.pathname.includes("/books") || url.pathname.includes("/me"))) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }
  
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/index.html")))
  );
});
