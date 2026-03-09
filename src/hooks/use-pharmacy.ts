"use client"

import useSWR from "swr"
import { useCallback } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { useRealtime } from "./use-realtime"
import type { PharmacyOrder, Medicine } from "@/types/database"

export function usePharmacyOrders(tenantId: string, status?: string) {
  const { data, error, isLoading, mutate } = useSWR(
    tenantId ? `pharmacy-orders-${tenantId}-${status || "all"}` : null,
    async () => {
      const supabase = createBrowserClient()
      let query = supabase
        .from("pharmacy_orders")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })

      if (status && status !== "all") {
        query = query.eq("status", status)
      }

      const { data, error: queryError } = await query.limit(200)
      if (queryError) throw queryError
      return (data || []) as PharmacyOrder[]
    },
    { refreshInterval: 10000 }
  )

  const handleChange = useCallback(() => { mutate() }, [mutate])

  useRealtime({
    table: "pharmacy_orders",
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

export function useMedicines(tenantId: string) {
  const { data, error, isLoading, mutate } = useSWR(
    tenantId ? `medicines-${tenantId}` : null,
    async () => {
      const supabase = createBrowserClient()
      const { data, error: queryError } = await supabase
        .from("medicines")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("medicine_name")

      if (queryError) throw queryError
      return (data || []) as Medicine[]
    },
    { refreshInterval: 30000 }
  )

  return {
    medicines: data || [],
    isLoading,
    error,
    mutate,
  }
}
