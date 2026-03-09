"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Auth error:", error)
  }, [error])

  return (
    <div className="flex items-center justify-center min-h-screen p-6">
      <div className="text-center space-y-4 max-w-md">
        <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
        <h2 className="text-xl font-bold">Authentication Error</h2>
        <p className="text-sm text-muted-foreground">
          {error.message || "Something went wrong during authentication"}
        </p>
        <div className="flex gap-2 justify-center">
          <Button onClick={reset}>Try Again</Button>
          <Button variant="outline" onClick={() => window.location.href = "/login"}>
            Back to Login
          </Button>
        </div>
      </div>
    </div>
  )
}
