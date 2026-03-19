"use client"

import { cn } from "@/lib/utils"
import { AlertTriangle, AlertCircle, Info, ShieldAlert, X } from "lucide-react"
import { useState } from "react"

type AlertSeverity = "info" | "warning" | "critical" | "contraindicated"

interface ClinicalAlertProps {
  /** Severity determines color and icon */
  severity: AlertSeverity
  /** Alert title (bold, prominent) */
  title: string
  /** Alert description */
  description?: string
  /** Optional action button */
  action?: React.ReactNode
  /** Allow user to dismiss the alert */
  dismissible?: boolean
  /** Callback when dismissed */
  onDismiss?: () => void
  /** Additional className */
  className?: string
}

const SEVERITY_STYLES: Record<
  AlertSeverity,
  { bg: string; border: string; icon: string; title: string }
> = {
  info: {
    bg: "bg-blue-50 dark:bg-blue-950/20",
    border: "border-blue-200 dark:border-blue-800",
    icon: "text-blue-600 dark:text-blue-400",
    title: "text-blue-900 dark:text-blue-100",
  },
  warning: {
    bg: "bg-amber-50 dark:bg-amber-950/20",
    border: "border-amber-200 dark:border-amber-800",
    icon: "text-amber-600 dark:text-amber-400",
    title: "text-amber-900 dark:text-amber-100",
  },
  critical: {
    bg: "bg-red-50 dark:bg-red-950/20",
    border: "border-red-200 dark:border-red-800",
    icon: "text-red-600 dark:text-red-400",
    title: "text-red-900 dark:text-red-100",
  },
  contraindicated: {
    bg: "bg-red-100 dark:bg-red-950/40",
    border: "border-red-300 dark:border-red-700",
    icon: "text-red-700 dark:text-red-300",
    title: "text-red-950 dark:text-red-50",
  },
}

const SEVERITY_ICONS: Record<AlertSeverity, React.ElementType> = {
  info: Info,
  warning: AlertTriangle,
  critical: AlertCircle,
  contraindicated: ShieldAlert,
}

/**
 * Clinical alert banner for drug interactions, allergy warnings,
 * critical lab values, and other clinical decision support alerts.
 *
 * Usage:
 *   <ClinicalAlert severity="critical" title="Drug Interaction" description="..." />
 *   <ClinicalAlert severity="warning" title="Allergy" description="..." dismissible />
 */
export function ClinicalAlert({
  severity,
  title,
  description,
  action,
  dismissible = false,
  onDismiss,
  className,
}: ClinicalAlertProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const styles = SEVERITY_STYLES[severity]
  const Icon = SEVERITY_ICONS[severity]

  const handleDismiss = () => {
    setDismissed(true)
    onDismiss?.()
  }

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3",
        styles.bg,
        styles.border,
        severity === "contraindicated" && "ring-1 ring-red-400/50 dark:ring-red-600/50",
        className
      )}
    >
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", styles.icon)} />
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-semibold", styles.title)}>{title}</p>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
        {action && <div className="mt-2">{action}</div>}
      </div>
      {dismissible && (
        <button
          onClick={handleDismiss}
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5"
          aria-label="Dismiss alert"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

/**
 * Stack multiple clinical alerts with consistent spacing.
 */
export function ClinicalAlertStack({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)} role="log" aria-label="Clinical alerts">
      {children}
    </div>
  )
}
