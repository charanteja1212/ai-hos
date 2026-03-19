"use client"

import { cn } from "@/lib/utils"

interface InfoCardProps {
  /** Icon displayed to the left */
  icon?: React.ReactNode
  /** Label text (muted, small) */
  label: string
  /** Value text (bold, prominent) */
  value: string | React.ReactNode
  /** Optional secondary value or badge */
  suffix?: React.ReactNode
  /** Additional className */
  className?: string
}

/**
 * Key-value display card for detail views.
 * Used in patient profiles, admission details, etc.
 *
 * Usage:
 *   <InfoCard icon={<User />} label="Patient" value="John Doe" />
 */
export function InfoCard({ icon, label, value, suffix, className }: InfoCardProps) {
  return (
    <div className={cn("flex items-center gap-3 p-3 rounded-lg bg-muted/30", className)}>
      {icon && (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary [&>svg]:h-4 [&>svg]:w-4">
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-foreground truncate">
          {value || "—"}
        </p>
      </div>
      {suffix && <div className="shrink-0">{suffix}</div>}
    </div>
  )
}
