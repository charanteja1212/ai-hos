"use client"

import { memo } from "react"
import { cn } from "@/lib/utils"
import { AnimatedCounter } from "@/components/ui/animated-counter"
import { TrendIndicator } from "@/components/ui/trend-indicator"

interface StatCardProps {
  label: string
  value: string | number
  gradient: string
  icon?: React.ReactNode
  subtitle?: string
  index?: number
  sparklineData?: number[]
  trend?: number
  onClick?: () => void
}

/** Map gradient class names to clean accent styles */
const accentMap: Record<string, { iconBg: string; iconText: string }> = {
  "gradient-blue": { iconBg: "bg-blue-50 dark:bg-blue-900/20", iconText: "text-blue-600 dark:text-blue-400" },
  "gradient-green": { iconBg: "bg-emerald-50 dark:bg-emerald-900/20", iconText: "text-emerald-600 dark:text-emerald-400" },
  "gradient-orange": { iconBg: "bg-amber-50 dark:bg-amber-900/20", iconText: "text-amber-600 dark:text-amber-400" },
  "gradient-purple": { iconBg: "bg-violet-50 dark:bg-violet-900/20", iconText: "text-violet-600 dark:text-violet-400" },
  "gradient-red": { iconBg: "bg-red-50 dark:bg-red-900/20", iconText: "text-red-600 dark:text-red-400" },
  "gradient-teal": { iconBg: "bg-cyan-50 dark:bg-cyan-900/20", iconText: "text-cyan-600 dark:text-cyan-400" },
  "gradient-blue-premium": { iconBg: "bg-blue-50 dark:bg-blue-900/20", iconText: "text-blue-600 dark:text-blue-400" },
  "gradient-green-premium": { iconBg: "bg-emerald-50 dark:bg-emerald-900/20", iconText: "text-emerald-600 dark:text-emerald-400" },
  "gradient-orange-premium": { iconBg: "bg-amber-50 dark:bg-amber-900/20", iconText: "text-amber-600 dark:text-amber-400" },
  "gradient-purple-premium": { iconBg: "bg-violet-50 dark:bg-violet-900/20", iconText: "text-violet-600 dark:text-violet-400" },
}

export const StatCard = memo(function StatCard({ label, value, gradient, icon, subtitle, index = 0, trend, onClick }: StatCardProps) {
  const isNumeric = typeof value === "number"
  const accent = accentMap[gradient] || accentMap["gradient-blue"]

  return (
    <div
      className={cn(
        "rounded-2xl bg-white dark:bg-card border border-gray-200 dark:border-gray-700 p-5 cursor-default animate-fade-in transition-shadow duration-200 hover:shadow-md",
        onClick && "cursor-pointer"
      )}
      style={{ animationDelay: `${index * 40}ms` }}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">{label}</p>

          <div className="mt-2">
            {isNumeric ? (
              <AnimatedCounter
                value={value}
                className="text-3xl font-bold text-foreground"
              />
            ) : (
              <p className="text-3xl font-bold text-foreground">{value}</p>
            )}
          </div>

          {trend !== undefined && (
            <TrendIndicator value={trend} className="mt-1.5" />
          )}

          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1.5">{subtitle}</p>
          )}
        </div>

        {icon && (
          <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", accent.iconBg, accent.iconText)}>
            {icon}
          </div>
        )}
      </div>
    </div>
  )
})
