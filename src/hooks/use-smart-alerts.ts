"use client"

import useSWR from "swr"
import type { SmartAlert, AlertPriority } from "@/lib/notifications/smart-alerts"

interface SmartAlertsResponse {
  alerts: SmartAlert[]
  summary: {
    total: number
    critical: number
    high: number
    medium: number
    low: number
  }
}

async function fetchAlerts([, tenantId]: [string, string]): Promise<SmartAlertsResponse> {
  const res = await fetch(`/api/notifications/smart-alerts?tenantId=${tenantId}`)
  if (!res.ok) throw new Error("Failed to fetch alerts")
  const json = await res.json()
  return json.data
}

/**
 * Hook to fetch smart alerts for the current tenant.
 * Polls every 5 minutes to catch new alerts.
 */
export function useSmartAlerts(tenantId: string, enabled = true) {
  const { data, error, isLoading, mutate } = useSWR(
    tenantId && enabled ? ["smart-alerts", tenantId] : null,
    fetchAlerts,
    {
      refreshInterval: 5 * 60 * 1000, // 5 minutes
      revalidateOnFocus: true,
      dedupingInterval: 60 * 1000, // 1 minute dedup
    }
  )

  return {
    alerts: data?.alerts || [],
    summary: data?.summary || { total: 0, critical: 0, high: 0, medium: 0, low: 0 },
    error,
    isLoading,
    refresh: mutate,
  }
}

/** Priority badge color mapping */
export const ALERT_PRIORITY_COLORS: Record<AlertPriority, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  low: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
}
