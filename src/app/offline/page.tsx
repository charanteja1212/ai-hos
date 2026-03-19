"use client"

import { useEffect, useState } from "react"

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false)

  useEffect(() => {
    setIsOnline(navigator.onLine)

    function handleOnline() {
      setIsOnline(true)
      // Auto-navigate back when connection is restored
      window.location.reload()
    }

    function handleOffline() {
      setIsOnline(false)
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 px-4 text-center">
      <div className="mx-auto max-w-md">
        {/* Offline icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-cyan-600/10">
          <svg
            className="h-10 w-10 text-cyan-600"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0"
            />
            {/* Diagonal strike-through line */}
            <line
              x1="3"
              y1="3"
              x2="21"
              y2="21"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1 className="mb-3 text-2xl font-semibold text-white">
          You&apos;re offline
        </h1>
        <p className="mb-8 text-slate-400">
          Please check your internet connection. This page will automatically
          reload when connectivity is restored.
        </p>

        {isOnline ? (
          <p className="text-sm font-medium text-cyan-500">
            Connection restored — reloading...
          </p>
        ) : (
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-900"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"
              />
            </svg>
            Try again
          </button>
        )}
      </div>
    </div>
  )
}
