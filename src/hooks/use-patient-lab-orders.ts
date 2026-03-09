"use client"

import useSWR from "swr"
import { createBrowserClient } from "@/lib/supabase/client"

export function usePatientLabOrders(phone: string | undefined) {
  const { data, error, isLoading } = useSWR(
    phone ? `patient-lab-orders-${phone}` : null,
    async () => {
      const supabase = createBrowserClient()

      const { data: orders, error: ordersError } = await supabase
        .from("lab_orders")
        .select("*")
        .eq("patient_phone", phone!)
        .order("created_at", { ascending: false })
        .limit(100)

      if (ordersError) throw ordersError

      const tenantIds = [...new Set((orders || []).map((o) => o.tenant_id).filter(Boolean))]
      let hospitalNames: Record<string, string> = {}
      if (tenantIds.length > 0) {
        const { data: tenants, error: tenantError } = await supabase
          .from("tenants")
          .select("tenant_id, hospital_name")
          .in("tenant_id", tenantIds)
        if (tenantError) throw tenantError
        hospitalNames = Object.fromEntries(
          (tenants || []).map((t) => [t.tenant_id, t.hospital_name])
        )
      }

      return { orders: orders || [], hospitalNames }
    },
    { revalidateOnFocus: true, refreshInterval: 30000 }
  )

  return {
    orders: data?.orders || [],
    hospitalNames: data?.hospitalNames || {},
    error,
    isLoading,
  }
}
