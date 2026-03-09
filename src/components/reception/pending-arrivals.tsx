"use client"

import { useState, useEffect, useCallback } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"
import { createBrowserClient } from "@/lib/supabase/client"
import { getTodayIST } from "@/lib/utils/date"
import { formatTime } from "@/lib/utils/date"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import {
  Smartphone,
  UserCheck,
  Loader2,
  ChevronRight,
} from "lucide-react"
import { createNotification } from "@/lib/notifications"
import { calculateEstimatedWait } from "@/lib/utils/estimated-wait"
import type { Appointment } from "@/types/database"

interface PendingArrivalsProps {
  tenantId: string
  onCheckInComplete: () => void
}

export function PendingArrivals({ tenantId, onCheckInComplete }: PendingArrivalsProps) {
  const [pending, setPending] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [checkingIn, setCheckingIn] = useState<string | null>(null)

  const fetchPending = useCallback(async () => {
    const supabase = createBrowserClient()
    const today = getTodayIST()

    const { data } = await supabase
      .from("appointments")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("date", today)
      .eq("status", "confirmed")
      .or("check_in_status.is.null,check_in_status.eq.pending")
      .order("time")

    setPending((data || []) as Appointment[])
    setLoading(false)
  }, [tenantId])

  useEffect(() => {
    fetchPending()

    // Realtime subscription for appointment changes
    const supabase = createBrowserClient()
    const channel = supabase
      .channel(`pending-arrivals-${tenantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          fetchPending()
        }
      )
      .subscribe()

    // Fallback polling every 30s in case realtime misses
    const interval = setInterval(fetchPending, 30000)
    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [fetchPending, tenantId])

  const handleQuickCheckIn = useCallback(async (appt: Appointment) => {
    setCheckingIn(appt.booking_id)
    const supabase = createBrowserClient()
    const today = getTodayIST()
    const now = new Date().toISOString()

    try {
      // Guard: check if already in queue
      const { data: existingQueue } = await supabase
        .from("queue_entries")
        .select("queue_id")
        .eq("booking_id", appt.booking_id)
        .eq("tenant_id", tenantId)
        .limit(1)
        .maybeSingle()

      if (existingQueue) {
        toast.error("Already checked in")
        setPending((prev) => prev.filter((p) => p.booking_id !== appt.booking_id))
        setCheckingIn(null)
        return
      }

      // Get queue count
      const { count: totalCount } = await supabase
        .from("queue_entries")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("date", today)

      const queueNumber = (totalCount || 0) + 1
      const { waitingAhead, estimatedWait } = await calculateEstimatedWait(tenantId, appt.doctor_id)

      // Create queue entry
      const { error: queueError } = await supabase.from("queue_entries").insert({
        queue_id: `Q-${Date.now()}`,
        tenant_id: tenantId,
        booking_id: appt.booking_id,
        patient_phone: appt.patient_phone,
        patient_name: appt.patient_name,
        doctor_id: appt.doctor_id,
        doctor_name: appt.doctor_name,
        queue_number: queueNumber,
        status: "waiting",
        check_in_time: now,
        walk_in: false,
        priority: 0,
        estimated_wait_minutes: estimatedWait,
        date: today,
      })

      if (queueError) throw queueError

      // Update appointment
      await supabase
        .from("appointments")
        .update({
          check_in_status: "checked_in",
          arrival_time: now,
          queue_number: queueNumber,
        })
        .eq("booking_id", appt.booking_id)
        .eq("tenant_id", tenantId)

      createNotification({
        tenantId,
        type: "queue_checkin",
        title: "Patient checked in",
        message: `${appt.patient_name} is waiting (Queue #${queueNumber})`,
        targetRole: "DOCTOR",
        targetUserId: appt.doctor_id,
        referenceId: appt.booking_id,
        referenceType: "queue_entry",
      })

      toast.success(`${appt.patient_name} checked in — Queue #${queueNumber}`)
      setPending((prev) => prev.filter((p) => p.booking_id !== appt.booking_id))
      onCheckInComplete()
    } catch {
      toast.error("Failed to check in")
    } finally {
      setCheckingIn(null)
    }
  }, [tenantId, onCheckInComplete])

  if (loading || pending.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-amber-200 dark:border-amber-800/40 bg-amber-50/80 dark:bg-amber-950/20 p-3"
    >
      <div className="flex items-center gap-2 mb-2">
        <Smartphone className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">
          Pending Arrivals
        </span>
        <Badge className="bg-amber-200 text-amber-800 dark:bg-amber-800/40 dark:text-amber-200 text-xs">
          {pending.length}
        </Badge>
        <span className="text-xs text-amber-600/70 dark:text-amber-400/60 ml-auto">
          Booked via WhatsApp / online — click to check in
        </span>
      </div>

      <ScrollArea className="w-full">
        <div className="flex gap-2 pb-1">
          <AnimatePresence mode="popLayout">
            {pending.map((appt) => (
              <motion.div
                key={appt.booking_id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, x: -20 }}
                className="flex items-center gap-3 rounded-xl bg-white dark:bg-card border border-border px-3 py-2 min-w-[280px] shrink-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{appt.patient_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {appt.doctor_name} • {formatTime(appt.time)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="default"
                  className="shrink-0 h-8 gap-1"
                  disabled={checkingIn === appt.booking_id}
                  onClick={() => handleQuickCheckIn(appt)}
                >
                  {checkingIn === appt.booking_id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <UserCheck className="w-3.5 h-3.5" />
                  )}
                  Check In
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </motion.div>
  )
}
