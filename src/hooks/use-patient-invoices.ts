"use client"

import useSWR from "swr"
import { createBrowserClient } from "@/lib/supabase/client"

export function usePatientInvoices(phone: string | undefined) {
  const { data, error, isLoading } = useSWR(
    phone ? `patient-invoices-${phone}` : null,
    async () => {
      const supabase = createBrowserClient()

      const { data: invoices, error: invError } = await supabase
        .from("invoices")
        .select("*")
        .eq("patient_phone", phone!)
        .order("created_at", { ascending: false })
        .limit(100)

      if (invError) throw invError

      const tenantIds = [...new Set((invoices || []).map((inv) => inv.tenant_id).filter(Boolean))]
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

      return { invoices: invoices || [], hospitalNames }
    },
    { revalidateOnFocus: true, refreshInterval: 30000 }
  )

  return {
    invoices: data?.invoices || [],
    hospitalNames: data?.hospitalNames || {},
    error,
    isLoading,
  }
}
