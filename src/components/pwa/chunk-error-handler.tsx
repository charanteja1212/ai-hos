"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/**
 * Catches ChunkLoadError (stale JS after deploy) and auto-reloads once.
 * Uses sessionStorage to prevent infinite reload loops.
 */
export function ChunkErrorHandler() {
  const router = useRouter()

  useEffect(() => {
    function handleError(event: ErrorEvent) {
      const msg = event.message || ""
      const isChunkError =
        msg.includes("Loading chunk") ||
        msg.includes("ChunkLoadError") ||
        msg.includes("Loading CSS chunk") ||
        msg.includes("Failed to fetch dynamically imported module")

      if (!isChunkError) return

      // Prevent infinite reload: only retry once per page per session
      const key = "chunk-error-reload"
      const lastReload = sessionStorage.getItem(key)
      const now = Date.now()

      // If we already reloaded in the last 30 seconds, don't reload again
      if (lastReload && now - parseInt(lastReload) < 30000) return

      sessionStorage.setItem(key, String(now))

      // Clear SW caches to ensure fresh assets
      if ("caches" in window) {
        caches.keys().then((names) => {
          for (const name of names) caches.delete(name)
        })
      }

      // Hard reload to get fresh HTML + chunks
      window.location.reload()
    }

    // Catch unhandled promise rejections (dynamic imports throw these)
    function handleRejection(event: PromiseRejectionEvent) {
      const reason = event.reason
      const msg =
        reason?.message ||
        reason?.toString?.() ||
        ""

      if (
        msg.includes("Loading chunk") ||
        msg.includes("ChunkLoadError") ||
        msg.includes("Failed to fetch dynamically imported module")
      ) {
        const key = "chunk-error-reload"
        const lastReload = sessionStorage.getItem(key)
        const now = Date.now()

        if (lastReload && now - parseInt(lastReload) < 30000) return

        sessionStorage.setItem(key, String(now))

        if ("caches" in window) {
          caches.keys().then((names) => {
            for (const name of names) caches.delete(name)
          })
        }

        window.location.reload()
      }
    }

    window.addEventListener("error", handleError)
    window.addEventListener("unhandledrejection", handleRejection)

    return () => {
      window.removeEventListener("error", handleError)
      window.removeEventListener("unhandledrejection", handleRejection)
    }
  }, [router])

  return null
}
