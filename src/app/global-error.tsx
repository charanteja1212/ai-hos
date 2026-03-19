"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect, useState } from "react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [isChunkError, setIsChunkError] = useState(false)

  useEffect(() => {
    // Report to Sentry
    Sentry.captureException(error)

    const msg = error.message || ""
    const chunk =
      msg.includes("Loading chunk") ||
      msg.includes("ChunkLoadError") ||
      msg.includes("Loading CSS chunk") ||
      msg.includes("Failed to fetch dynamically imported module")

    setIsChunkError(chunk)

    if (chunk) {
      // Clear SW caches so reload gets fresh assets
      if ("caches" in window) {
        caches.keys().then((names) => {
          for (const name of names) caches.delete(name)
        })
      }
    }
  }, [error])

  const handleHardReload = () => {
    window.location.reload()
  }

  return (
    <html>
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", textAlign: "center" }}>
        <div style={{ maxWidth: "400px", margin: "80px auto" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>
            {isChunkError ? "\u26A0\uFE0F" : "\u274C"}
          </div>
          <h2 style={{ marginBottom: "0.5rem", fontSize: "1.25rem" }}>
            Something went wrong
          </h2>
          <p style={{ color: "#666", marginBottom: "0.5rem", fontSize: "0.875rem" }}>
            {isChunkError
              ? "A new version is available. Please reload to continue."
              : error.message}
          </p>
          {error.digest && !isChunkError && (
            <p style={{ color: "#999", fontSize: "0.75rem", fontFamily: "monospace" }}>
              Error ID: {error.digest}
            </p>
          )}
          <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.75rem", justifyContent: "center" }}>
            <button
              onClick={isChunkError ? handleHardReload : reset}
              style={{
                padding: "0.5rem 1.25rem",
                borderRadius: "0.5rem",
                border: "none",
                cursor: "pointer",
                background: "#0891B2",
                color: "white",
                fontSize: "0.875rem",
                fontWeight: "500",
              }}
            >
              {isChunkError ? "Reload Page" : "Try Again"}
            </button>
            <button
              onClick={() => { window.location.href = "/login" }}
              style={{
                padding: "0.5rem 1.25rem",
                borderRadius: "0.5rem",
                border: "1px solid #D1D5DB",
                cursor: "pointer",
                background: "white",
                color: "#374151",
                fontSize: "0.875rem",
                fontWeight: "500",
              }}
            >
              Back to Login
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
