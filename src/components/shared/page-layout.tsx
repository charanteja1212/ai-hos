"use client"

import { cn } from "@/lib/utils"

interface PageLayoutProps {
  children: React.ReactNode
  /** Max width constraint. Default: "7xl" (1280px) */
  maxWidth?: "5xl" | "6xl" | "7xl" | "full"
  /** Additional className on the outer wrapper */
  className?: string
}

const MAX_WIDTH_MAP = {
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
  full: "max-w-full",
}

/**
 * Consistent page wrapper for all dashboard pages.
 * Provides vertical spacing between sections and optional max-width.
 */
export function PageLayout({ children, maxWidth = "7xl", className }: PageLayoutProps) {
  return (
    <div
      className={cn(
        "space-y-6",
        MAX_WIDTH_MAP[maxWidth],
        className
      )}
    >
      {children}
    </div>
  )
}
