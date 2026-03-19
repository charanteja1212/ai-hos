"use client"

import { useEffect } from "react"

export function RegisterSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // Check for updates immediately
        reg.update().catch(() => {})

        // When a new SW is found, activate it immediately
        reg.addEventListener("updatefound", () => {
          const newSW = reg.installing
          if (!newSW) return

          newSW.addEventListener("statechange", () => {
            if (newSW.state === "activated" && navigator.serviceWorker.controller) {
              // New SW activated — if user has stale page, prompt or auto-reload
              // The ChunkErrorHandler handles the actual reload if chunks fail
            }
          })
        })
      })
      .catch(() => {
        // Service worker registration failed — non-critical
      })

    // Periodically check for SW updates (every 5 minutes)
    const interval = setInterval(() => {
      navigator.serviceWorker.getRegistration().then((reg) => {
        reg?.update().catch(() => {})
      })
    }, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  return null
}
