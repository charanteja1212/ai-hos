"use client"

import { useCallback } from "react"
import { useBranch } from "@/components/providers/branch-context"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"
import { createBrowserClient } from "@/lib/supabase/client"
import { useQueue } from "@/hooks/use-queue"
import { getTodayIST } from "@/lib/utils/date"
import { StatCard } from "./stat-card"
import { QueueCard } from "./queue-card"
import { RealtimeStatsBanner } from "./realtime-stats-banner"
import { QuickActionsPanel } from "./quick-actions-panel"
import { PendingArrivals } from "./pending-arrivals"
import { EmptyState } from "@/components/shared/empty-state"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import {
  Users,
  Clock,
  Stethoscope,
  CheckCircle2,
  UserPlus,
  CalendarSearch,
} from "lucide-react"
export function QueueBoard() {
  const router = useRouter()
  const { activeTenantId: tenantId } = useBranch()
  const today = getTodayIST()

  const { entries, stats, isLoading, mutate, getEstimatedWait } = useQueue(tenantId, today)

  const handleStatusChange = useCallback(
    async (queueId: string, newStatus: string) => {
      const supabase = createBrowserClient()
      const now = new Date().toISOString()
      const updates: Record<string, unknown> = { status: newStatus }

      if (newStatus === "in_consultation") {
        updates.consultation_start = now
      }
      if (newStatus === "completed") {
        updates.consultation_end = now
      }

      const { error } = await supabase
        .from("queue_entries")
        .update(updates)
        .eq("queue_id", queueId)
        .eq("tenant_id", tenantId)

      if (error) {
        toast.error("Failed to update status")
        return
      }

      const { data: queueEntry } = await supabase
        .from("queue_entries")
        .select("booking_id")
        .eq("queue_id", queueId)
        .eq("tenant_id", tenantId)
        .single()

      if (queueEntry?.booking_id) {
        const apptUpdate: Record<string, string> = {}
        if (newStatus === "in_consultation") {
          apptUpdate.check_in_status = "in_consultation"
        } else if (newStatus === "completed") {
          apptUpdate.status = "completed"
          apptUpdate.check_in_status = "completed"
        } else if (newStatus === "no_show") {
          apptUpdate.status = "no_show"
          apptUpdate.check_in_status = "no_show"
        } else if (newStatus === "cancelled") {
          apptUpdate.status = "cancelled"
          apptUpdate.check_in_status = "cancelled"
        }
        if (Object.keys(apptUpdate).length > 0) {
          const { error: apptError } = await supabase
            .from("appointments")
            .update(apptUpdate)
            .eq("booking_id", queueEntry.booking_id)
            .eq("tenant_id", tenantId)
          if (apptError) console.error("Appointment sync failed:", apptError)
        }
      }

      toast.success(`Status updated to ${newStatus.replace("_", " ")}`)
    },
    [tenantId]
  )

  const handlePriorityChange = useCallback(
    async (queueId: string, newPriority: number) => {
      const supabase = createBrowserClient()
      const { error } = await supabase
        .from("queue_entries")
        .update({ priority: newPriority })
        .eq("queue_id", queueId)
        .eq("tenant_id", tenantId)

      if (error) {
        toast.error("Failed to update priority")
        return
      }
      toast.success(`Priority changed to ${newPriority === 2 ? "Emergency" : newPriority === 1 ? "Urgent" : "Normal"}`)
    },
    [tenantId]
  )

  const waitingEntries = entries.filter((e) => e.status === "waiting")
  const inConsultation = entries.filter((e) => e.status === "in_consultation")
  const completedEntries = entries.filter(
    (e) => e.status === "completed" || e.status === "no_show"
  )

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-12 rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Real-time Stats Banner */}
      <RealtimeStatsBanner
        total={stats.total}
        waiting={stats.waiting}
        inConsultation={stats.inConsultation}
        completed={stats.completed}
        avgWaitMinutes={stats.avgWaitMinutes}
      />

      {/* Pending Arrivals — WhatsApp/online bookings not yet checked in */}
      <PendingArrivals tenantId={tenantId} onCheckInComplete={() => mutate()} />

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Today's Total"
          value={stats.total}
          gradient="gradient-blue"
          icon={<Users className="w-6 h-6" />}
          index={0}
        />
        <StatCard
          label="Waiting"
          value={stats.waiting}
          gradient="gradient-orange"
          icon={<Clock className="w-6 h-6" />}
          subtitle={stats.waiting > 0 ? "in queue" : "no one waiting"}
          index={1}
        />
        <StatCard
          label="In Consultation"
          value={stats.inConsultation}
          gradient="gradient-green"
          icon={<Stethoscope className="w-6 h-6" />}
          index={2}
        />
        <StatCard
          label="Avg Wait"
          value={stats.avgWaitMinutes > 0 ? `${stats.avgWaitMinutes}m` : "\u2014"}
          gradient="gradient-purple"
          icon={<CheckCircle2 className="w-6 h-6" />}
          subtitle={stats.completed > 0 ? `${stats.completed} completed` : "no data yet"}
          index={3}
        />
      </div>

      {/* Mobile Quick Actions (hidden on lg where sidebar shows) */}
      <div className="flex gap-3 lg:hidden">
        <Button
          variant="default"
          size="sm"
          className="flex-1 gap-2 h-10 rounded-xl bg-blue-600 hover:bg-blue-700"
          onClick={() => router.push("/reception/book")}
        >
          <UserPlus className="w-4 h-4" />
          Walk-in Booking
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 gap-2 h-10 rounded-xl"
          onClick={() => router.push("/reception/appointments")}
        >
          <CalendarSearch className="w-4 h-4" />
          Appointments
        </Button>
      </div>

      {/* Main content: Kanban + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
        {/* Flow hint */}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/60 md:hidden mb-2">
          <span className="font-medium">Flow:</span>
          <span className="text-amber-600">Waiting</span>
          <span>→</span>
          <span className="text-blue-600">In Consult</span>
          <span>→</span>
          <span className="text-green-600">Done</span>
        </div>

        {/* Kanban Columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Waiting */}
          <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-gray-100 dark:border-gray-700">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <div className="flex-1">
                <h3 className="font-semibold text-foreground text-sm">Waiting</h3>
                <p className="text-[10px] text-muted-foreground leading-tight">Click &quot;Start Consult&quot; when ready</p>
              </div>
              <motion.span
                key={waitingEntries.length}
                initial={{ scale: 1.3 }}
                animate={{ scale: 1 }}
                className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center"
              >
                {waitingEntries.length}
              </motion.span>
            </div>
            <ScrollArea className="max-h-[50vh] lg:max-h-[calc(100vh-480px)]">
              <div className="space-y-3 pr-1">
                <AnimatePresence mode="popLayout">
                  {waitingEntries.length === 0 ? (
                    <EmptyState
                      icon={<Clock className="w-8 h-8" />}
                      title="No patients waiting"
                      description="New patients will appear here"
                    />
                  ) : (
                    waitingEntries.map((entry, idx) => (
                      <QueueCard
                        key={entry.queue_id}
                        entry={entry}
                        onStatusChange={handleStatusChange}
                        onPriorityChange={handlePriorityChange}
                        estimatedWaitMin={entry.doctor_id ? getEstimatedWait(entry.doctor_id, idx + 1) : undefined}
                      />
                    ))
                  )}
                </AnimatePresence>
              </div>
            </ScrollArea>
          </div>

          {/* In Consultation */}
          <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-gray-100 dark:border-gray-700">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <div className="flex-1">
                <h3 className="font-semibold text-foreground text-sm">In Consultation</h3>
                <p className="text-[10px] text-muted-foreground leading-tight">Click &quot;Mark Done&quot; when finished</p>
              </div>
              <motion.span
                key={inConsultation.length}
                initial={{ scale: 1.3 }}
                animate={{ scale: 1 }}
                className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center"
              >
                {inConsultation.length}
              </motion.span>
            </div>
            <ScrollArea className="max-h-[50vh] lg:max-h-[calc(100vh-480px)]">
              <div className="space-y-3 pr-1">
                <AnimatePresence mode="popLayout">
                  {inConsultation.length === 0 ? (
                    <EmptyState
                      icon={<Stethoscope className="w-8 h-8" />}
                      title="No active consultations"
                      description="Start a consultation from waiting"
                    />
                  ) : (
                    inConsultation.map((entry) => (
                      <QueueCard
                        key={entry.queue_id}
                        entry={entry}
                        onStatusChange={handleStatusChange}
                      />
                    ))
                  )}
                </AnimatePresence>
              </div>
            </ScrollArea>
          </div>

          {/* Completed */}
          <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-gray-100 dark:border-gray-700">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <div className="flex-1">
                <h3 className="font-semibold text-foreground text-sm">Completed</h3>
                <p className="text-[10px] text-muted-foreground leading-tight">Today&apos;s finished patients</p>
              </div>
              <motion.span
                key={completedEntries.length}
                initial={{ scale: 1.3 }}
                animate={{ scale: 1 }}
                className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center"
              >
                {completedEntries.length}
              </motion.span>
            </div>
            <ScrollArea className="max-h-[50vh] lg:max-h-[calc(100vh-480px)]">
              <div className="space-y-3 pr-1">
                <AnimatePresence mode="popLayout">
                  {completedEntries.length === 0 ? (
                    <EmptyState
                      icon={<CheckCircle2 className="w-8 h-8" />}
                      title="No completed consultations"
                      description="Completed patients appear here"
                    />
                  ) : (
                    completedEntries.map((entry) => (
                      <QueueCard
                        key={entry.queue_id}
                        entry={entry}
                        onStatusChange={handleStatusChange}
                      />
                    ))
                  )}
                </AnimatePresence>
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Quick Actions Panel */}
        <div className="hidden lg:block">
          <QuickActionsPanel
            tenantId={tenantId}
            nextPatient={waitingEntries[0] || null}
            onStatusChange={handleStatusChange}
          />
        </div>
      </div>
    </div>
  )
}
