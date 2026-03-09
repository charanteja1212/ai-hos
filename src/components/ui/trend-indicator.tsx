"use client"

import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

interface TrendIndicatorProps {
  value: number
  className?: string
}

export function TrendIndicator({ value, className }: TrendIndicatorProps) {
  if (value === 0) {
    return (
      <span className={cn("inline-flex items-center gap-0.5 text-xs text-muted-foreground", className)}>
        <Minus className="w-3 h-3" /> 0%
      </span>
    )
  }

  const isUp = value > 0
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium",
        isUp ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400",
        className
      )}
    >
      {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {isUp ? "+" : ""}
      {value.toFixed(1)}%
    </span>
  )
}
