"use client"

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

export function SectionHeader({ title, subtitle, action, icon, badge, variant = "default" }: SectionHeaderProps) {
  if (variant === "glass") {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-card p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {icon && (
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-400">
              {icon}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">{title}</h1>
              {badge}
            </div>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
        {action && <div>{action}</div>}
      </div>
    )
  }

  return (
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-3">
        {icon && (
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
            "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
          )}>
            {icon}
          </div>
        )}
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-foreground tracking-tight">{title}</h1>
            {badge}
          </div>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
