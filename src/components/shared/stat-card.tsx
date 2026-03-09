"use client"

import { memo } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { AnimatedCounter } from "@/components/ui/animated-counter"
import { Sparkline } from "@/components/ui/sparkline"
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

export const StatCard = memo(function StatCard({ label, value, gradient, icon, subtitle, index = 0, sparklineData, trend, onClick }: StatCardProps) {
  const isNumeric = typeof value === "number"

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={cn(
        "rounded-2xl p-5 text-white relative overflow-hidden noise-overlay cursor-default",
        "transition-all duration-300 hover:shadow-xl hover:scale-[1.02]",
        gradient,
        onClick && "cursor-pointer"
      )}
      onClick={onClick}
    >
      {/* Top highlight line */}
      <div className="absolute top-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent" />

      {/* Shimmer overlay */}
      <div className="absolute inset-0 animate-shimmer rounded-2xl pointer-events-none opacity-60" />

      {/* Floating icon */}
      {icon && (
        <motion.div
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-4 right-4 opacity-30"
        >
          {icon}
        </motion.div>
      )}

      <p className="text-xs font-semibold uppercase tracking-wider opacity-70 relative z-10">{label}</p>

      <div className="flex items-end justify-between mt-1 relative z-10">
        <div>
          {isNumeric ? (
            <AnimatedCounter
              value={value}
              className="text-3xl font-bold"
            />
          ) : (
            <motion.p
              key={String(value)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="text-3xl font-bold"
            >
              {value}
            </motion.p>
          )}

          {trend !== undefined && (
            <TrendIndicator
              value={trend}
              className="text-white/80 mt-0.5 [&_svg]:text-white/80"
            />
          )}

          {subtitle && (
            <p className="text-xs opacity-60 mt-0.5">{subtitle}</p>
          )}
        </div>

        {/* Sparkline */}
        {sparklineData && sparklineData.length >= 2 && (
          <Sparkline
            data={sparklineData}
            color="rgba(255,255,255,0.4)"
            width={64}
            height={28}
            className="mb-1"
          />
        )}
      </div>
    </motion.div>
  )
})
