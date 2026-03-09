"use client"

import useSWR from "swr"
import { useCallback } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { useRealtime } from "./use-realtime"
import type { Appointment } from "@/types/database"

interface UseAppointmentsOptions {
  tenantId: string
  date?: string
  doctorId?: string
  status?: string
}

async function fetchAppointments(opts: UseAppointmentsOptions): Promise<Appointment[]> {
  const supabase = createBrowserClient()
  let query = supabase
    .from("appointments")
    .select("*")
    .eq("tenant_id", opts.tenantId)
    .order("date", { ascending: true })
    .order("time", { ascending: true })

  if (opts.date) query = query.eq("date", opts.date)
  if (opts.doctorId) query = query.eq("doctor_id", opts.doctorId)
  if (opts.status) query = query.eq("status", opts.status)

  const { data, error } = await query
  if (error) throw error
  return (data || []) as Appointment[]
}

export function useAppointments(opts: UseAppointmentsOptions) {
  const key = opts.tenantId ? `appointments-${opts.tenantId}-${opts.date || "all"}-${opts.doctorId || "all"}-${opts.status || "all"}` : null

  const { data, error, isLoading, mutate } = useSWR(
    key,
    () => fetchAppointments(opts),
    {
      refreshInterval: 10000,
      revalidateOnFocus: true,
    }
  )

  useRealtime({
    table: "appointments",
    filter: `tenant_id=eq.${opts.tenantId}`,
    onChange: useCallback(() => {
      mutate()
    }, [mutate]),
    enabled: !!opts.tenantId,
  })

  return {
    appointments: data || [],
    error,
    isLoading,
    mutate,
  }
}
