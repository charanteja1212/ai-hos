"use client"

import useSWR from "swr"
import { useCallback } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { useRealtime } from "./use-realtime"
import type { LabOrder } from "@/types/database"

export function useLabOrders(tenantId: string, status?: string) {
  const { data, error, isLoading, mutate } = useSWR(
    tenantId ? `lab-orders-${tenantId}-${status || "all"}` : null,
    async () => {
      const supabase = createBrowserClient()
      let query = supabase
        .from("lab_orders")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })

      if (status && status !== "all") {
        query = query.eq("status", status)
      }

      const { data, error: queryError } = await query.limit(200)
      if (queryError) throw queryError
      return (data || []) as LabOrder[]
    },
    { refreshInterval: 10000 }
  )

  const handleChange = useCallback(() => { mutate() }, [mutate])

  useRealtime({
    table: "lab_orders",
    filter: `tenant_id=eq.${tenantId}`,
    onChange: handleChange,
    enabled: !!tenantId,
  })

  return {
    orders: data || [],
    isLoading,
    error,
    mutate,
  }
}
