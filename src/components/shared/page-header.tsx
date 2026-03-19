"use client"

import { cn } from "@/lib/utils"
import { ChevronRight } from "lucide-react"

interface Breadcrumb {
  label: string
  href?: string
}

interface PageHeaderProps {
  /** Page title — rendered as h1 */
  title: string
  /** Optional description below title */
  description?: string
  /** Breadcrumb trail, e.g. [{ label: "Admin" }, { label: "Billing" }] */
  breadcrumbs?: Breadcrumb[]
  /** Badge or count next to the title */
  badge?: React.ReactNode
  /** Icon displayed to the left of the title */
  icon?: React.ReactNode
  /** Action buttons on the right side */
  actions?: React.ReactNode
  /** Additional className */
  className?: string
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  badge,
  icon,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("space-y-1", className)}>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3" />}
              {crumb.href ? (
                <a
                  href={crumb.href}
                  className="hover:text-foreground transition-colors"
                >
                  {crumb.label}
                </a>
              ) : (
                <span className={i === breadcrumbs.length - 1 ? "text-foreground font-medium" : ""}>
                  {crumb.label}
                </span>
              )}
            </span>
          ))}
        </nav>
      )}

      {/* Title row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-foreground tracking-tight truncate">
                {title}
              </h1>
              {badge}
            </div>
            {description && (
              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                {description}
              </p>
            )}
          </div>
        </div>

        {actions && (
          <div className="flex items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}
