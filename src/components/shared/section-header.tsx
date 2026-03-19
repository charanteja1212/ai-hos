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
      <div className="rounded-xl border border-border/60 bg-card p-5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          {icon && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {icon}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground tracking-tight">{title}</h1>
              {badge}
            </div>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    )
  }

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <div className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            "bg-primary/10 text-primary"
          )}>
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-foreground tracking-tight truncate">{title}</h1>
            {badge}
          </div>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
