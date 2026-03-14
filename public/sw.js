const CACHE_NAME = "ai-hos-v1"
const STATIC_ASSETS = [
  "/login",
  "/icons/icon.svg",
  "/manifest.json",
]

// Install: cache shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch: network-first for API/pages, cache-first for static assets
self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET and cross-origin
  if (request.method !== "GET" || url.origin !== self.location.origin) return

  // API routes: always network
  if (url.pathname.startsWith("/api/")) return

  // Static assets (_next/static, icons, fonts): cache-first
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.match(/\.(svg|png|jpg|jpeg|webp|woff2?|css|js)$/)
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

  // Pages: network-first with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
      .catch(() => caches.match(request))
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
      // Focus existing window if open
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      // Open new window
      return self.clients.openWindow(url)
    })
  )
})
