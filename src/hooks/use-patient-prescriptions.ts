"use client"

import useSWR from "swr"
import { createBrowserClient } from "@/lib/supabase/client"

export function usePatientPrescriptions(phone: string | undefined) {
  const { data, error, isLoading } = useSWR(
    phone ? `patient-prescriptions-${phone}` : null,
    async () => {
      const supabase = createBrowserClient()

      const { data: prescriptions, error: rxError } = await supabase
        .from("prescriptions")
        .select("*")
        .eq("patient_phone", phone!)
        .order("created_at", { ascending: false })
        .limit(100)

      if (rxError) throw rxError

      // Fetch hospital names
      const tenantIds = [...new Set((prescriptions || []).map((p) => p.tenant_id).filter(Boolean))]
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

      return { prescriptions: prescriptions || [], hospitalNames }
    },
    { revalidateOnFocus: true, refreshInterval: 30000 }
  )

  return {
    prescriptions: data?.prescriptions || [],
    hospitalNames: data?.hospitalNames || {},
    error,
    isLoading,
  }
}
