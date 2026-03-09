"use client"

import useSWR from "swr"
import { useCallback } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { useRealtime } from "./use-realtime"
import type { Admission, WardConfig } from "@/types/database"

export interface BedStatus {
  bed: string
  status: "available" | "occupied" | "maintenance"
  admission?: Admission
}

const DEFAULT_WARDS: Record<string, WardConfig> = {
  "General Ward": { beds: Array.from({ length: 10 }, (_, i) => `GW-${i + 1}`), daily_rate: 500, type: "general" },
  "Semi-Private": { beds: Array.from({ length: 6 }, (_, i) => `SP-${i + 1}`), daily_rate: 1000, type: "semi_private" },
  "Private": { beds: Array.from({ length: 4 }, (_, i) => `PV-${i + 1}`), daily_rate: 2000, type: "private" },
  "ICU": { beds: Array.from({ length: 6 }, (_, i) => `ICU-${i + 1}`), daily_rate: 5000, type: "icu" },
  "NICU": { beds: Array.from({ length: 4 }, (_, i) => `NICU-${i + 1}`), daily_rate: 4000, type: "nicu" },
  "Maternity": { beds: Array.from({ length: 6 }, (_, i) => `MAT-${i + 1}`), daily_rate: 1500, type: "maternity" },
  "Pediatric": { beds: Array.from({ length: 6 }, (_, i) => `PED-${i + 1}`), daily_rate: 1000, type: "pediatric" },
  "Surgical": { beds: Array.from({ length: 4 }, (_, i) => `SUR-${i + 1}`), daily_rate: 3000, type: "surgical" },
}

export function useWardBeds(tenantId: string) {
  const { data, isLoading, mutate } = useSWR(
    tenantId ? `ward-beds-${tenantId}` : null,
    async () => {
      const supabase = createBrowserClient()

      const [tenantRes, admissionsRes] = await Promise.all([
        supabase.from("tenants").select("ward_beds").eq("tenant_id", tenantId).single(),
        supabase.from("admissions").select("*").eq("tenant_id", tenantId).eq("status", "admitted"),
      ])

      if (tenantRes.error && tenantRes.error.code !== "PGRST116") throw tenantRes.error
      if (admissionsRes.error) throw admissionsRes.error

      const wardConfig: Record<string, WardConfig> = tenantRes.data?.ward_beds || DEFAULT_WARDS
      const admissions = (admissionsRes.data || []) as Admission[]

      const bedMap: Record<string, BedStatus[]> = {}
      let totalBeds = 0
      let occupiedCount = 0

      for (const [wardName, config] of Object.entries(wardConfig)) {
        bedMap[wardName] = config.beds.map((bed) => {
          totalBeds++
          const admission = admissions.find(
            (a) => a.ward === wardName && a.bed_number === bed
          )
          if (admission) {
            occupiedCount++
            return { bed, status: "occupied" as const, admission }
          }
          return { bed, status: "available" as const }
        })
      }

      return { wards: wardConfig, bedMap, totalBeds, occupiedBeds: occupiedCount, admissions }
    },
    { refreshInterval: 15000 }
  )

  const handleChange = useCallback(() => { mutate() }, [mutate])

  useRealtime({
    table: "admissions",
    filter: `tenant_id=eq.${tenantId}`,
    onChange: handleChange,
    enabled: !!tenantId,
  })

  return {
    wards: data?.wards || DEFAULT_WARDS,
    bedMap: data?.bedMap || {},
    totalBeds: data?.totalBeds || 0,
    occupiedBeds: data?.occupiedBeds || 0,
    availableBeds: (data?.totalBeds || 0) - (data?.occupiedBeds || 0),
    admissions: data?.admissions || [],
    isLoading,
    mutate,
  }
}
