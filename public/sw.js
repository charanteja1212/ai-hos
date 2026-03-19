// ─── AI-HOS Service Worker ─────────────────────────────────────────────────
// Cache version: bump this to invalidate all caches on deploy
const CACHE_VERSION = "v4"
const STATIC_CACHE = `ai-hos-static-${CACHE_VERSION}`
const RUNTIME_CACHE = `ai-hos-runtime-${CACHE_VERSION}`
const OFFLINE_URL = "/offline"

// Static assets to pre-cache on install
const PRECACHE_ASSETS = [
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/manifest.json",
  OFFLINE_URL,
]

// ─── Message handler: allow client to trigger skipWaiting ───────────────────
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting()
  }
})

// ─── Install: pre-cache static assets + offline page ────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_ASSETS))
  )
  self.skipWaiting()
})

// ─── Activate: purge ALL old versioned caches ───────────────────────────────
self.addEventListener("activate", (event) => {
  const currentCaches = [STATIC_CACHE, RUNTIME_CACHE]
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !currentCaches.includes(key))
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

// ─── Fetch strategies ───────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET and cross-origin requests
  if (request.method !== "GET" || url.origin !== self.location.origin) return

  // API routes + auth: always network, never cache
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/login")) return

  // ─── CRITICAL: Never cache JS/CSS chunks ───────────────────────────────
  // These have hashed filenames and are cached by the browser via immutable
  // Cache-Control headers. SW caching them causes stale chunk errors after deploys.
  if (url.pathname.startsWith("/_next/static/chunks/")) return
  if (url.pathname.startsWith("/_next/static/css/")) return

  // ─── Strategy 1: Cache-first for static assets (icons, images, fonts) ──
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // ─── Strategy 2: Network-first for navigation (HTML pages) ─────────────
  if (request.mode === "navigate") {
    event.respondWith(networkFirstWithOfflineFallback(request))
    return
  }

  // ─── Strategy 3: Network-first for everything else ─────────────────────
  event.respondWith(networkFirst(request, RUNTIME_CACHE))
})

// ─── Helper: identify static assets ─────────────────────────────────────────
function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/fonts/") ||
    /\.(svg|png|jpg|jpeg|webp|gif|ico|woff2?|ttf|otf)$/.test(url.pathname)
  )
}

// ─── Strategy: Cache-first ──────────────────────────────────────────────────
// Try cache, fall back to network (and cache the response for next time)
function cacheFirst(request, cacheName) {
  return caches.match(request).then((cached) => {
    if (cached) return cached
    return fetch(request).then((response) => {
      if (response.ok) {
        const clone = response.clone()
        caches.open(cacheName).then((cache) => cache.put(request, clone))
      }
      return response
    })
  })
}

// ─── Strategy: Network-first ────────────────────────────────────────────────
// Try network, fall back to cache
function networkFirst(request, cacheName) {
  return fetch(request)
    .then((response) => {
      if (response.ok) {
        const clone = response.clone()
        caches.open(cacheName).then((cache) => cache.put(request, clone))
      }
      return response
    })
    .catch(() =>
      caches.match(request).then(
        (cached) => cached || new Response("Offline", { status: 503 })
      )
    )
}

// ─── Strategy: Network-first with offline fallback page ─────────────────────
// For navigation requests: try network, fall back to cached page, then offline page
function networkFirstWithOfflineFallback(request) {
  return fetch(request)
    .then((response) => {
      if (response.ok) {
        const clone = response.clone()
        caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone))
      }
      return response
    })
    .catch(() =>
      caches.match(request).then((cached) => {
        if (cached) return cached
        // Serve the offline fallback page
        return caches.match(OFFLINE_URL).then(
          (offlinePage) =>
            offlinePage || new Response("Offline", { status: 503 })
        )
      })
    )
}

// ─── Push Notifications ─────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  if (!event.data) return

  const data = event.data.json()
  const { title, body, url, tag } = data

  event.waitUntil(
    self.registration.showNotification(title || "AI-HOS", {
      body: body || "",
      icon: "/icons/icon.svg",
      badge: "/icons/icon.svg",
      tag: tag || "default",
      data: { url: url || "/" },
      vibrate: [200, 100, 200],
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = event.notification.data?.url || "/"

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
