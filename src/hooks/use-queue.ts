"use client"

import useSWR from "swr"
import { useCallback, useMemo } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { useRealtime } from "./use-realtime"
import type { QueueEntry } from "@/types/database"

async function fetchQueue([, tenantId, date]: [string, string, string]): Promise<QueueEntry[]> {
  const supabase = createBrowserClient()
  const { data, error } = await supabase
    .from("queue_entries")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("date", date)
    .order("priority", { ascending: false })
    .order("queue_number", { ascending: true })

  if (error) throw error
  return (data || []) as QueueEntry[]
}

export function useQueue(tenantId: string, date: string) {
  const { data, error, isLoading, mutate } = useSWR(
    tenantId ? ["queue", tenantId, date] : null,
    fetchQueue,
    {
      refreshInterval: 10000,
      revalidateOnFocus: true,
    }
  )

  useRealtime({
    table: "queue_entries",
    filter: `tenant_id=eq.${tenantId}`,
    onChange: useCallback(() => {
      mutate()
    }, [mutate]),
    enabled: !!tenantId,
  })

  const entries = useMemo(() => data || [], [data])

  const stats = useMemo(() => {
    const waiting = entries.filter((e) => e.status === "waiting")
    const inConsultation = entries.filter((e) => e.status === "in_consultation")
    const completed = entries.filter((e) => e.status === "completed")
    const noShow = entries.filter((e) => e.status === "no_show")

    // Average wait time (check-in to consultation start)
    const waitTimes = completed
      .filter((e) => e.check_in_time && e.consultation_start)
      .map((e) => {
        const checkIn = new Date(e.check_in_time!).getTime()
        const start = new Date(e.consultation_start!).getTime()
        return (start - checkIn) / 60000
      })

    const avgWait = waitTimes.length > 0
      ? Math.round(waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length)
      : 0

    // Average consultation duration per doctor (for estimated wait calculation)
    const consultTimes = completed
      .filter((e) => e.consultation_start && e.consultation_end)
      .map((e) => ({
        doctorId: e.doctor_id,
        duration: (new Date(e.consultation_end!).getTime() - new Date(e.consultation_start!).getTime()) / 60000,
      }))

    const avgConsultByDoctor: Record<string, number> = {}
    const doctorTimes: Record<string, number[]> = {}
    for (const ct of consultTimes) {
      if (!ct.doctorId || ct.duration <= 0 || ct.duration > 120) continue
      if (!doctorTimes[ct.doctorId]) doctorTimes[ct.doctorId] = []
      doctorTimes[ct.doctorId].push(ct.duration)
    }
    for (const [docId, times] of Object.entries(doctorTimes)) {
      avgConsultByDoctor[docId] = Math.round(times.reduce((a, b) => a + b, 0) / times.length)
    }

    // Overall average consult time (fallback)
    const allConsultDurations = consultTimes.filter((ct) => ct.duration > 0 && ct.duration <= 120).map((ct) => ct.duration)
    const avgConsultOverall = allConsultDurations.length > 0
      ? Math.round(allConsultDurations.reduce((a, b) => a + b, 0) / allConsultDurations.length)
      : 15 // default 15 min

    return {
      total: entries.length,
      waiting: waiting.length,
      inConsultation: inConsultation.length,
      completed: completed.length,
      noShow: noShow.length,
      avgWaitMinutes: avgWait,
      avgConsultByDoctor,
      avgConsultOverall,
    }
  }, [entries])

  /** Estimate wait time for a patient given their position in a doctor's queue */
  const getEstimatedWait = useCallback((doctorId: string, positionInQueue: number) => {
    const avgConsult = stats.avgConsultByDoctor[doctorId] || stats.avgConsultOverall
    return positionInQueue * avgConsult
  }, [stats.avgConsultByDoctor, stats.avgConsultOverall])

  return {
    entries,
    stats,
    error,
    isLoading,
    mutate,
    getEstimatedWait,
  }
}
