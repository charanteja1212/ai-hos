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

const gradientStyles: Record<string, string> = {
  "gradient-blue": "from-cyan-600 to-cyan-800",
  "gradient-green": "from-emerald-500 to-emerald-700",
  "gradient-orange": "from-amber-500 to-orange-600",
  "gradient-purple": "from-violet-500 to-purple-700",
  "gradient-red": "from-red-500 to-red-700",
  "gradient-teal": "from-cyan-500 to-teal-700",
  "gradient-blue-premium": "from-cyan-600 to-cyan-800",
  "gradient-green-premium": "from-emerald-500 to-emerald-700",
  "gradient-orange-premium": "from-amber-500 to-orange-600",
  "gradient-purple-premium": "from-violet-500 to-purple-700",
}

export const StatCard = memo(function StatCard({ label, value, gradient, icon, subtitle, index = 0, trend, onClick }: StatCardProps) {
  const isNumeric = typeof value === "number"
  const gradientClass = gradientStyles[gradient] || gradientStyles["gradient-blue"]

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl p-5 cursor-default animate-fade-in bg-gradient-to-br text-white shadow-lg",
        gradientClass,
        onClick && "cursor-pointer hover:shadow-xl transition-shadow"
      )}
      style={{ animationDelay: `${index * 40}ms` }}
      onClick={onClick}
    >
      <div className="flex items-start justify-between relative z-10">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">{label}</p>

          <div className="mt-2">
            {isNumeric ? (
              <AnimatedCounter
                value={value}
                className="text-3xl font-bold text-white"
              />
            ) : (
              <p className="text-3xl font-bold text-white">{value}</p>
            )}
          </div>

          {trend !== undefined && (
            <TrendIndicator value={trend} className="mt-1.5" />
          )}

          {subtitle && (
            <p className="text-xs text-white/60 mt-1.5">{subtitle}</p>
          )}
        </div>

        {icon && (
          <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0 text-white/80">
            {icon}
          </div>
        )}
      </div>

      {/* Decorative circle */}
      <div className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full bg-white/10" />
    </div>
  )
})
