"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface SectionHeaderProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
  icon?: React.ReactNode
  gradient?: string
  badge?: React.ReactNode
  variant?: "default" | "glass"
}

export function SectionHeader({ title, subtitle, action, icon, gradient, badge, variant = "default" }: SectionHeaderProps) {
  if (variant === "glass") {
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-5 flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          {icon && (
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-white",
              gradient || "gradient-blue"
            )}>
              {icon}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">{title}</h1>
              {badge}
            </div>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
        {action && <div>{action}</div>}
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start justify-between"
    >
      <div className="flex items-center gap-3">
        {icon && (
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
            gradient ? `${gradient} text-white` : "bg-primary/10 text-primary"
          )}>
            {icon}
          </div>
        )}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">{title}</h1>
            {badge}
          </div>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div>{action}</div>}
    </motion.div>
  )
}
