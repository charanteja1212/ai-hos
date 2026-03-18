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
const accentMap: Record<string, { border: string; iconBg: string }> = {
  "gradient-blue": { border: "border-l-blue-600", iconBg: "icon-blue" },
  "gradient-green": { border: "border-l-emerald-600", iconBg: "icon-green" },
  "gradient-orange": { border: "border-l-amber-500", iconBg: "icon-orange" },
  "gradient-purple": { border: "border-l-violet-600", iconBg: "icon-purple" },
  "gradient-red": { border: "border-l-red-600", iconBg: "icon-red" },
  "gradient-teal": { border: "border-l-cyan-600", iconBg: "icon-teal" },
  "gradient-blue-premium": { border: "border-l-blue-600", iconBg: "icon-blue" },
  "gradient-green-premium": { border: "border-l-emerald-600", iconBg: "icon-green" },
  "gradient-orange-premium": { border: "border-l-amber-500", iconBg: "icon-orange" },
  "gradient-purple-premium": { border: "border-l-violet-600", iconBg: "icon-purple" },
}

export const StatCard = memo(function StatCard({ label, value, gradient, icon, subtitle, index = 0, trend, onClick }: StatCardProps) {
  const isNumeric = typeof value === "number"
  const accent = accentMap[gradient] || accentMap["gradient-blue"]

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-5 border-l-[3px] card-hover cursor-default animate-fade-in",
        accent.border,
        onClick && "cursor-pointer"
      )}
      style={{ animationDelay: `${index * 40}ms` }}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>

          <div className="mt-2">
            {isNumeric ? (
              <AnimatedCounter
                value={value}
                className="text-2xl font-bold text-foreground"
              />
            ) : (
              <p className="text-2xl font-bold text-foreground">{value}</p>
            )}
          </div>

          {trend !== undefined && (
            <TrendIndicator value={trend} className="mt-1" />
          )}

          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>

        {icon && (
          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", accent.iconBg)}>
            {icon}
          </div>
        )}
      </div>
    </div>
  )
})
