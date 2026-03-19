"use client"

import React from "react"
import { AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ErrorBoundaryProps {
  children: React.ReactNode
  /** Section name shown in the error message */
  section?: string
  /** Custom fallback UI */
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * React Error Boundary — catches render errors in a section
 * without crashing the entire page.
 *
 * Usage:
 *   <ErrorBoundary section="Appointments">
 *     <AppointmentsTable />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to Sentry if available
    if (typeof window !== "undefined" && "Sentry" in window) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).Sentry?.captureException(error, {
        contexts: { react: { componentStack: errorInfo.componentStack } },
      })
    }
    console.error(`[ErrorBoundary:${this.props.section || "unknown"}]`, error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex flex-col items-center justify-center p-8 rounded-xl border border-destructive/20 bg-destructive/5">
          <AlertCircle className="w-10 h-10 text-destructive mb-3" />
          <h3 className="text-sm font-semibold text-foreground mb-1">
            {this.props.section ? `${this.props.section} failed to load` : "Something went wrong"}
          </h3>
          <p className="text-xs text-muted-foreground mb-4 text-center max-w-sm">
            {this.state.error?.message || "An unexpected error occurred"}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={this.handleReset}
            className="gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Try again
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Functional wrapper for pages — wraps entire page content.
 */
export function PageErrorBoundary({ children, page }: { children: React.ReactNode; page: string }) {
  return (
    <ErrorBoundary section={page}>
      {children}
    </ErrorBoundary>
  )
}
