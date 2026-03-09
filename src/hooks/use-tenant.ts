"use client"

import useSWR from "swr"
import { createBrowserClient } from "@/lib/supabase/client"
import type { Tenant } from "@/types/database"

export function useTenant(tenantId: string | undefined) {
  const { data, isLoading } = useSWR(
    tenantId ? `tenant-${tenantId}` : null,
    async () => {
      const supabase = createBrowserClient()
      const { data, error: queryError } = await supabase
        .from("tenants")
        .select("*")
        .eq("tenant_id", tenantId!)
        .single()
      if (queryError) throw queryError
      return data as Tenant | null
    },
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  )
  return { tenant: data ?? null, isLoading }
}
