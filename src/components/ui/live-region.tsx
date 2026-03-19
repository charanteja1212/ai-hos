"use client"

import { type ReactNode } from "react"
import { cn } from "@/lib/utils"

interface LiveRegionProps {
  children: ReactNode
  /**
   * How assertively the screen reader should announce changes.
   * - "polite" (default): waits until the user is idle
   * - "assertive": interrupts whatever the screen reader is currently saying
   */
  politeness?: "polite" | "assertive"
  /**
   * Whether to visually hide the region (screen-reader only).
   * Defaults to false so the content is visible.
   */
  visuallyHidden?: boolean
  /** Additional class names */
  className?: string
}

/**
 * Announces dynamic content changes to screen readers.
 *
 * Usage:
 *   <LiveRegion>3 results found</LiveRegion>
 *   <LiveRegion politeness="assertive">Error: form invalid</LiveRegion>
 *   <LiveRegion visuallyHidden>Toast notification text</LiveRegion>
 */
export function LiveRegion({
  children,
  politeness = "polite",
  visuallyHidden = false,
  className,
}: LiveRegionProps) {
  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic="true"
      className={cn(visuallyHidden && "sr-only", className)}
    >
      {children}
    </div>
  )
}
