"use client"

import { memo } from "react"
import { cn } from "@/lib/utils"
import { AnimatedCounter } from "@/components/ui/animated-counter"
import { TrendIndicator } from "@/components/ui/trend-indicator"

// ─── Color system: 5 semantic colors ───
// Maps old gradient names → new accent color keys
type AccentColor = "blue" | "green" | "orange" | "purple" | "red" | "teal"

const GRADIENT_TO_ACCENT: Record<string, AccentColor> = {
  "gradient-blue": "blue",
  "gradient-green": "green",
  "gradient-orange": "orange",
  "gradient-purple": "purple",
  "gradient-red": "red",
  "gradient-teal": "teal",
  "gradient-blue-premium": "blue",
  "gradient-green-premium": "green",
  "gradient-orange-premium": "orange",
  "gradient-purple-premium": "purple",
}

const ACCENT_STYLES: Record<AccentColor, { border: string; iconBg: string; iconColor: string; iconBgDark: string; iconColorDark: string }> = {
  blue:   { border: "border-l-cyan-600",    iconBg: "bg-cyan-50",    iconColor: "text-cyan-600",    iconBgDark: "dark:bg-cyan-950/40",    iconColorDark: "dark:text-cyan-400" },
  green:  { border: "border-l-emerald-600", iconBg: "bg-emerald-50", iconColor: "text-emerald-600", iconBgDark: "dark:bg-emerald-950/40", iconColorDark: "dark:text-emerald-400" },
  orange: { border: "border-l-amber-500",   iconBg: "bg-amber-50",   iconColor: "text-amber-600",   iconBgDark: "dark:bg-amber-950/40",   iconColorDark: "dark:text-amber-400" },
  purple: { border: "border-l-violet-600",  iconBg: "bg-violet-50",  iconColor: "text-violet-600",  iconBgDark: "dark:bg-violet-950/40",  iconColorDark: "dark:text-violet-400" },
  red:    { border: "border-l-rose-600",    iconBg: "bg-rose-50",    iconColor: "text-rose-600",    iconBgDark: "dark:bg-rose-950/40",    iconColorDark: "dark:text-rose-400" },
  teal:   { border: "border-l-teal-600",    iconBg: "bg-teal-50",    iconColor: "text-teal-600",    iconBgDark: "dark:bg-teal-950/40",    iconColorDark: "dark:text-teal-400" },
}

interface StatCardProps {
  label: string
  value: string | number
  /** Accepts old gradient names (backward compat) or direct color: "blue" | "green" | "orange" | "purple" | "red" | "teal" */
  gradient?: string
  /** Direct color prop (preferred over gradient) */
  color?: AccentColor
  icon?: React.ReactNode
  subtitle?: string
  index?: number
  sparklineData?: number[]
  trend?: number
  onClick?: () => void
}

export const StatCard = memo(function StatCard({
  label,
  value,
  gradient,
  color,
  icon,
  subtitle,
  index = 0,
  trend,
  onClick,
}: StatCardProps) {
  const isNumeric = typeof value === "number"

  // Resolve color: prefer `color` prop, then map from `gradient`, fallback to blue
  const accent: AccentColor = color || (gradient ? GRADIENT_TO_ACCENT[gradient] || "blue" : "blue")
  const styles = ACCENT_STYLES[accent]

  return (
    <div
      className={cn(
        // Base: white card, rounded, subtle shadow, colored left border
        "relative overflow-hidden rounded-xl border border-border/60 bg-card p-5",
        "border-l-[3px] shadow-sm",
        styles.border,
        // Stagger animation
        "animate-fade-in",
        // Hover
        onClick
          ? "cursor-pointer transition-all duration-200 hover:shadow-md hover:border-border active:scale-[0.99]"
          : "cursor-default",
        // Dark mode
        "dark:bg-card dark:border-border/40"
      )}
      style={{ animationDelay: `${index * 50}ms` }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick() } } : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Text content */}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>

          <div className="mt-2">
            {isNumeric ? (
              <AnimatedCounter
                value={value}
                className="text-2xl font-bold text-foreground tabular-nums"
              />
            ) : (
              <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
            )}
          </div>

          {trend !== undefined && (
            <TrendIndicator value={trend} className="mt-1.5" />
          )}

          {subtitle && (
            <p className="text-xs text-muted-foreground/70 mt-1.5 truncate">{subtitle}</p>
          )}
        </div>

        {/* Icon — soft colored background */}
        {icon && (
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
              "[&>svg]:h-5 [&>svg]:w-5",
              styles.iconBg,
              styles.iconColor,
              styles.iconBgDark,
              styles.iconColorDark
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  )
})
