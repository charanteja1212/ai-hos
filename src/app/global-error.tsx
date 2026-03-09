"use client"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", textAlign: "center" }}>
        <h2 style={{ marginBottom: "1rem" }}>Something went wrong</h2>
        <p style={{ color: "#666", marginBottom: "0.5rem" }}>{error.message}</p>
        {error.digest && (
          <p style={{ color: "#999", fontSize: "0.75rem", fontFamily: "monospace" }}>
            Error ID: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          style={{
            marginTop: "1rem",
            padding: "0.5rem 1rem",
            borderRadius: "0.5rem",
            border: "1px solid #ccc",
            cursor: "pointer",
            background: "#007AFF",
            color: "white",
          }}
        >
          Try Again
        </button>
      </body>
    </html>
  )
}
