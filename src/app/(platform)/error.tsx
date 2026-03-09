"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

export default function PlatformError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Platform error:", error)
  }, [error])

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <div className="text-center space-y-4 max-w-md">
        <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
        <h2 className="text-xl font-bold">Something went wrong</h2>
        <p className="text-sm text-muted-foreground">
          {error.message || "An unexpected error occurred"}
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground font-mono">
            Error ID: {error.digest}
          </p>
        )}
        <div className="flex gap-2 justify-center">
          <Button onClick={reset}>Try Again</Button>
          <Button variant="outline" onClick={() => window.location.href = "/platform"}>
            Back to Platform
          </Button>
        </div>
      </div>
    </div>
  )
}
