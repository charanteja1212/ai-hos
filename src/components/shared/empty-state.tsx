"use client"

import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  /** Optional SVG illustration component (renders above icon) */
  illustration?: React.ReactNode
  /** Size variant */
  size?: "sm" | "md" | "lg"
  className?: string
}

const SIZE_MAP = {
  sm: { wrapper: "py-6 px-4", iconSize: "text-3xl", title: "text-sm", desc: "text-xs" },
  md: { wrapper: "py-10 px-6", iconSize: "text-4xl", title: "text-base", desc: "text-sm" },
  lg: { wrapper: "py-16 px-8", iconSize: "text-5xl", title: "text-lg", desc: "text-sm" },
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  illustration,
  size = "md",
  className,
}: EmptyStateProps) {
  const s = SIZE_MAP[size]

  return (
    <div
      className={cn(
        "rounded-xl bg-card border border-dashed border-border/80 text-center animate-fade-in",
        s.wrapper,
        className
      )}
    >
      {/* Illustration */}
      {illustration && (
        <div className="flex justify-center mb-4 text-muted-foreground/20">
          {illustration}
        </div>
      )}

      {/* Icon */}
      <div className={cn("flex justify-center mb-3", s.iconSize)}>
        <div className="text-muted-foreground/30">{icon}</div>
      </div>

      {/* Text */}
      <p className={cn("font-medium text-muted-foreground", s.title)}>{title}</p>
      {description && (
        <p className={cn("text-muted-foreground/60 mt-1 max-w-sm mx-auto", s.desc)}>{description}</p>
      )}

      {/* Action */}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
