"use client"

import { Badge } from "@/components/ui/badge"
import { statusColors, humanizeStatus, checkInColors } from "@/lib/utils/format"
import { cn } from "@/lib/utils"

interface StatusBadgeProps {
  /** The raw status string (e.g., "confirmed", "pending_payment") */
  status: string | null | undefined
  /** Use check-in specific color map instead of default */
  variant?: "default" | "checkin"
  /** Override the display label */
  label?: string
  /** Additional className */
  className?: string
  /** Size variant */
  size?: "sm" | "md"
  /** Show a colored dot indicator */
  dot?: boolean
}

const SIZE_MAP = {
  sm: "text-[10px] px-1.5 py-0",
  md: "text-xs px-2 py-0.5",
}

/**
 * Consistent status badge that auto-resolves color and label from status string.
 *
 * Usage:
 *   <StatusBadge status="confirmed" />
 *   <StatusBadge status={appt.status} variant="checkin" />
 *   <StatusBadge status="active" dot />
 */
export function StatusBadge({
  status,
  variant = "default",
  label,
  className,
  size = "md",
  dot = false,
}: StatusBadgeProps) {
  if (!status) return null

  const colorMap = variant === "checkin" ? checkInColors : statusColors
  const colorClass = colorMap[status] || "bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-300"
  const displayLabel = label || humanizeStatus(status)

  return (
    <Badge
      variant="secondary"
      className={cn(
        "border-0 font-medium",
        colorClass,
        SIZE_MAP[size],
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            "mr-1.5 inline-block h-1.5 w-1.5 rounded-full",
            status === "confirmed" || status === "done" || status === "dispensed" || status === "completed"
              ? "bg-green-500"
              : status === "cancelled" || status === "no_show"
                ? "bg-red-500"
                : status === "pending" || status === "waiting" || status === "preparing"
                  ? "bg-amber-500"
                  : "bg-current"
          )}
        />
      )}
      {displayLabel}
    </Badge>
  )
}
