const CACHE_NAME = "ai-hos-v3"
const STATIC_ASSETS = [
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/manifest.json",
]

// Install: cache only small static assets, activate immediately
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// Activate: clean ALL old caches immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch strategy
self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET and cross-origin
  if (request.method !== "GET" || url.origin !== self.location.origin) return

  // API routes + auth: always network (never cache)
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/login")) return

  // ─── CRITICAL: Never cache _next/static/chunks (JS bundles) ───
  // These have hashed filenames and are cached by the browser via immutable headers.
  // SW caching them causes stale chunk errors after deploys.
  if (url.pathname.startsWith("/_next/static/chunks/")) return
  if (url.pathname.startsWith("/_next/static/css/")) return

  // Only cache truly static assets: icons, images, fonts (NOT JS chunks)
  if (
    url.pathname.startsWith("/icons/") ||
    url.pathname.match(/\.(svg|png|jpg|jpeg|webp|woff2?)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
      })
    )
    return
  }

  // Pages: network-first (always try fresh, fall back to cache for offline)
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
      .catch(() => caches.match(request).then((cached) => cached || new Response("Offline", { status: 503 })))
  )
})

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
