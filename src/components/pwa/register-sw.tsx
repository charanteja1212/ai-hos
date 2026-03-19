"use client"

import { useEffect } from "react"
import { toast } from "sonner"

export function RegisterSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // Check for updates immediately
        reg.update().catch(() => {})

        // When a new SW is found, notify the user
        reg.addEventListener("updatefound", () => {
          const newSW = reg.installing
          if (!newSW) return

          newSW.addEventListener("statechange", () => {
            // New SW installed and waiting to activate
            if (newSW.state === "installed" && navigator.serviceWorker.controller) {
              // There is a current controller, meaning this is an update (not first install)
              toast.info("Update available", {
                description: "A new version of AI-HOS is ready.",
                duration: Infinity,
                action: {
                  label: "Refresh",
                  onClick: () => {
                    // Tell the waiting SW to activate immediately
                    newSW.postMessage({ type: "SKIP_WAITING" })
                    window.location.reload()
                  },
                },
              })
            }
          })
        })
      })
      .catch(() => {
        // Service worker registration failed -- non-critical
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
