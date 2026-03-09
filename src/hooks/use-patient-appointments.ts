"use client"

import useSWR from "swr"
import { createBrowserClient } from "@/lib/supabase/client"

export function usePatientAppointments(phone: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR(
    phone ? `patient-appointments-${phone}` : null,
    async () => {
      const supabase = createBrowserClient()

      const { data: appointments, error: apptError } = await supabase
        .from("appointments")
        .select("*")
        .eq("patient_phone", phone!)
        .order("date", { ascending: false })
        .order("time", { ascending: false })
        .limit(100)

      if (apptError) throw apptError

      // Fetch hospital names
      const tenantIds = [...new Set((appointments || []).map((a) => a.tenant_id).filter(Boolean))]
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

      return { appointments: appointments || [], hospitalNames }
    },
    { revalidateOnFocus: true, refreshInterval: 30000 }
  )

  return {
    appointments: data?.appointments || [],
    hospitalNames: data?.hospitalNames || {},
    error,
    isLoading,
    mutate,
  }
}
