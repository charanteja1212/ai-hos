"use client"

import { useCallback, useState, useMemo } from "react"
import { useBranch } from "@/components/providers/branch-context"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"
import { createBrowserClient } from "@/lib/supabase/client"
import { useQueue } from "@/hooks/use-queue"
import { getTodayIST, formatTime } from "@/lib/utils/date"
import { ElapsedTimer } from "@/components/ui/elapsed-timer"
import { PendingArrivals } from "./pending-arrivals"
import { EmptyState } from "@/components/shared/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import {
  Users,
  Clock,
  Stethoscope,
  CheckCircle2,
  UserPlus,
  CalendarSearch,
  Search,
  Play,
  XCircle,
  Phone,
  Zap,
  AlertTriangle,
  Timer,
} from "lucide-react"
import type { QueueEntry } from "@/types/database"

type TabKey = "all" | "waiting" | "in_consultation" | "completed"

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "waiting", label: "Waiting" },
  { key: "in_consultation", label: "In Consult" },
  { key: "completed", label: "Done" },
]

export function QueueBoard() {
  const router = useRouter()
  const { activeTenantId: tenantId } = useBranch()
  const today = getTodayIST()
  const [activeTab, setActiveTab] = useState<TabKey>("all")
  const [searchQuery, setSearchQuery] = useState("")

  const { entries, stats, isLoading, mutate, getEstimatedWait } = useQueue(tenantId, today)

  /* ── Status Change Handler ── */
  const handleStatusChange = useCallback(
    async (queueId: string, newStatus: string) => {
      const supabase = createBrowserClient()
      const now = new Date().toISOString()
      const updates: Record<string, unknown> = { status: newStatus }
      if (newStatus === "in_consultation") updates.consultation_start = now
      if (newStatus === "completed") updates.consultation_end = now

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
          await supabase
            .from("appointments")
            .update(apptUpdate)
            .eq("booking_id", queueEntry.booking_id)
            .eq("tenant_id", tenantId)
        }
      }

      toast.success(`Status updated to ${newStatus.replace("_", " ")}`)
    },
    [tenantId],
  )

  /* ── Priority Change Handler ── */
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
      toast.success(
        `Priority: ${newPriority === 2 ? "Emergency" : newPriority === 1 ? "Urgent" : "Normal"}`,
      )
    },
    [tenantId],
  )

  /* ── Derived Data ── */
  const filteredEntries = useMemo(() => {
    return entries
      .filter((e) => {
        if (activeTab === "waiting") return e.status === "waiting"
        if (activeTab === "in_consultation") return e.status === "in_consultation"
        if (activeTab === "completed")
          return e.status === "completed" || e.status === "no_show"
        return true
      })
      .filter((e) => {
        if (!searchQuery) return true
        const q = searchQuery.toLowerCase()
        return (
          e.patient_name?.toLowerCase().includes(q) ||
          e.patient_phone?.includes(q) ||
          e.doctor_name?.toLowerCase().includes(q)
        )
      })
  }, [entries, activeTab, searchQuery])

  const waitingEntries = entries.filter((e) => e.status === "waiting")
  const nextUp = waitingEntries[0]

  const getTabCount = (key: TabKey) => {
    if (key === "all") return stats.total
    if (key === "waiting") return stats.waiting
    if (key === "in_consultation") return stats.inConsultation
    return stats.completed + stats.noShow
  }

  /* ── Loading ── */
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 rounded-xl" />
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-[480px] rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Compact Stats Bar ── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1">
        <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded-full uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </div>
        <span className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
          <Users className="w-3.5 h-3.5" />
          <span className="font-semibold text-gray-900 dark:text-white">{stats.total}</span>
          today
        </span>
        <span className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
          <Clock className="w-3.5 h-3.5" />
          <span className="font-semibold">{stats.waiting}</span> waiting
        </span>
        <span className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400">
          <Stethoscope className="w-3.5 h-3.5" />
          <span className="font-semibold">{stats.inConsultation}</span> active
        </span>
        <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span className="font-semibold">{stats.completed}</span> done
        </span>
        {stats.avgWaitMinutes > 0 && (
          <span className="flex items-center gap-1.5 text-sm text-gray-400">
            <Timer className="w-3.5 h-3.5" />
            ~{stats.avgWaitMinutes}m avg
          </span>
        )}
      </div>

      {/* ── Pending Arrivals ── */}
      <PendingArrivals tenantId={tenantId} onCheckInComplete={() => mutate()} />

      {/* ── Main Card ── */}
      <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        {/* Search + Quick Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="relative flex-1 w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              className="pl-9 h-9 rounded-lg bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-sm"
              placeholder="Search patient, phone, doctor…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              className="h-9 gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
              onClick={() => router.push("/reception/book")}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Walk-in
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 rounded-lg text-xs font-medium"
              onClick={() => router.push("/reception/appointments")}
            >
              <CalendarSearch className="w-3.5 h-3.5" />
              Appointments
            </Button>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex items-center gap-1 px-4 pt-3 border-b border-gray-100 dark:border-gray-800">
          {TABS.map((tab) => {
            const count = getTabCount(tab.key)
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "relative px-3.5 py-2.5 text-sm font-medium transition-colors rounded-t-lg",
                  isActive
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300",
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    "ml-1.5 text-[11px] font-bold tabular-nums px-1.5 py-0.5 rounded-full",
                    isActive
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                      : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
                  )}
                >
                  {count}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="queue-tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full"
                  />
                )}
              </button>
            )
          })}
        </div>

        {/* Next Up Banner */}
        {nextUp && (activeTab === "all" || activeTab === "waiting") && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-4 mt-4 flex items-center gap-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200/60 dark:border-blue-800/30 rounded-xl px-4 py-3"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white font-bold text-sm flex items-center justify-center shrink-0">
              {nextUp.queue_number}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                Next Up — {nextUp.patient_name}
                {nextUp.priority === 2 && (
                  <span className="ml-2 text-[10px] font-bold text-red-600 bg-red-100 dark:bg-red-900/40 px-1.5 py-0.5 rounded">
                    EMERGENCY
                  </span>
                )}
                {nextUp.priority === 1 && (
                  <span className="ml-2 text-[10px] font-bold text-amber-600 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded">
                    URGENT
                  </span>
                )}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {nextUp.doctor_name || "No doctor assigned"}
                {nextUp.patient_phone && ` · ${nextUp.patient_phone}`}
              </p>
            </div>
            <Button
              size="sm"
              className="h-8 gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shrink-0"
              onClick={() => handleStatusChange(nextUp.queue_id, "in_consultation")}
            >
              <Play className="w-3.5 h-3.5" />
              Call Next
            </Button>
          </motion.div>
        )}

        {/* Content */}
        <div className="p-4">
          {filteredEntries.length === 0 ? (
            <EmptyState
              icon={<Users className="w-8 h-8" />}
              title={searchQuery ? "No matching patients" : "No patients in queue"}
              description={
                searchQuery
                  ? "Try a different search term"
                  : "Patients will appear here when they check in"
              }
            />
          ) : (
            <>
              {/* ── Desktop Table ── */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      <th className="text-left pb-3 pl-1 w-12">#</th>
                      <th className="text-left pb-3">Patient</th>
                      <th className="text-left pb-3">Doctor</th>
                      <th className="text-left pb-3 w-20">Check-in</th>
                      <th className="text-left pb-3 w-24">Time</th>
                      <th className="text-left pb-3 w-28">Status</th>
                      <th className="text-right pb-3 pr-1 w-40">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence mode="popLayout">
                      {filteredEntries.map((entry, idx) => (
                        <DesktopRow
                          key={entry.queue_id}
                          entry={entry}
                          onStatusChange={handleStatusChange}
                          onPriorityChange={handlePriorityChange}
                          estimatedWaitMin={
                            entry.status === "waiting" && entry.doctor_id
                              ? getEstimatedWait(
                                  entry.doctor_id,
                                  waitingEntries.findIndex(
                                    (w) => w.queue_id === entry.queue_id,
                                  ) + 1,
                                )
                              : undefined
                          }
                        />
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>

              {/* ── Mobile Cards ── */}
              <div className="md:hidden space-y-3">
                <AnimatePresence mode="popLayout">
                  {filteredEntries.map((entry) => (
                    <MobileCard
                      key={entry.queue_id}
                      entry={entry}
                      onStatusChange={handleStatusChange}
                      onPriorityChange={handlePriorityChange}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════
   Desktop Table Row
   ══════════════════════════════════════════════════════ */
function DesktopRow({
  entry,
  onStatusChange,
  onPriorityChange,
  estimatedWaitMin,
}: {
  entry: QueueEntry
  onStatusChange: (id: string, status: string) => void
  onPriorityChange: (id: string, priority: number) => void
  estimatedWaitMin?: number
}) {
  const isActive = entry.status === "in_consultation"
  const isDone =
    entry.status === "completed" ||
    entry.status === "no_show" ||
    entry.status === "cancelled"

  return (
    <motion.tr
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className={cn(
        "group border-b border-gray-50 dark:border-gray-800/60 last:border-0 transition-colors",
        !isDone && "hover:bg-gray-50/80 dark:hover:bg-gray-800/40",
        isActive && "bg-blue-50/50 dark:bg-blue-950/10",
        entry.priority === 2 &&
          !isActive &&
          !isDone &&
          "bg-red-50/40 dark:bg-red-950/10",
      )}
    >
      {/* Queue # */}
      <td className="py-3 pl-1">
        <div
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold",
            isActive
              ? "bg-blue-600 text-white"
              : entry.priority === 2
                ? "bg-red-500 text-white"
                : entry.priority === 1
                  ? "bg-amber-500 text-white"
                  : isDone
                    ? "bg-gray-100 dark:bg-gray-800 text-gray-400"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300",
          )}
        >
          {entry.queue_number}
        </div>
      </td>

      {/* Patient */}
      <td className="py-3">
        <p
          className={cn(
            "text-sm font-medium flex items-center gap-1.5",
            isDone
              ? "text-gray-400 dark:text-gray-500"
              : "text-gray-900 dark:text-white",
          )}
        >
          {entry.patient_name || "Unknown"}
          {entry.walk_in && (
            <span className="text-[10px] font-semibold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30 px-1.5 py-0.5 rounded">
              Walk-in
            </span>
          )}
          {entry.priority === 2 && entry.status === "waiting" && (
            <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded flex items-center gap-0.5">
              <Zap className="w-2.5 h-2.5" /> Emergency
            </span>
          )}
          {entry.priority === 1 && entry.status === "waiting" && (
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded flex items-center gap-0.5">
              <AlertTriangle className="w-2.5 h-2.5" /> Urgent
            </span>
          )}
        </p>
        {entry.patient_phone && (
          <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
            <Phone className="w-3 h-3" />
            {entry.patient_phone}
          </p>
        )}
      </td>

      {/* Doctor */}
      <td className="py-3">
        <p
          className={cn(
            "text-sm",
            isDone
              ? "text-gray-400 dark:text-gray-500"
              : "text-gray-600 dark:text-gray-400",
          )}
        >
          {entry.doctor_name || "—"}
        </p>
      </td>

      {/* Check-in time */}
      <td className="py-3">
        <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
          {entry.check_in_time
            ? formatTime(
                new Date(entry.check_in_time).toTimeString().slice(0, 5),
              )
            : "—"}
        </p>
      </td>

      {/* Wait / Duration */}
      <td className="py-3">
        {entry.status === "waiting" && entry.check_in_time ? (
          <div className="space-y-0.5">
            <ElapsedTimer
              startTime={entry.check_in_time}
              warningMinutes={20}
              dangerMinutes={40}
            />
            {estimatedWaitMin !== undefined && estimatedWaitMin > 0 && (
              <p className="text-[10px] text-blue-500/70 font-medium">
                ~{Math.round(estimatedWaitMin)}m est
              </p>
            )}
          </div>
        ) : isActive && entry.consultation_start ? (
          <div className="flex items-center gap-1">
            <Stethoscope className="w-3 h-3 text-blue-500" />
            <ElapsedTimer
              startTime={entry.consultation_start}
              warningMinutes={15}
              dangerMinutes={30}
            />
          </div>
        ) : (
          <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
        )}
      </td>

      {/* Status */}
      <td className="py-3">
        <StatusBadge status={entry.status} />
      </td>

      {/* Actions */}
      <td className="py-3 pr-1">
        <div className="flex items-center justify-end gap-1.5">
          {entry.status === "waiting" && (
            <>
              <Button
                size="sm"
                className="h-7 px-2.5 gap-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-medium"
                onClick={() =>
                  onStatusChange(entry.queue_id, "in_consultation")
                }
              >
                <Play className="w-3 h-3" />
                Start
              </Button>
              <button
                onClick={() => {
                  const next =
                    entry.priority === 0
                      ? 1
                      : entry.priority === 1
                        ? 2
                        : 0
                  onPriorityChange(entry.queue_id, next)
                }}
                className={cn(
                  "h-7 w-7 rounded-md flex items-center justify-center transition-colors",
                  entry.priority === 2
                    ? "text-red-500 bg-red-50 dark:bg-red-950/30 hover:bg-red-100"
                    : entry.priority === 1
                      ? "text-amber-500 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100"
                      : "text-gray-300 dark:text-gray-600 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800",
                )}
                title="Cycle priority: Normal → Urgent → Emergency"
              >
                {entry.priority === 2 ? (
                  <Zap className="w-3.5 h-3.5" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                onClick={() =>
                  onStatusChange(entry.queue_id, "no_show")
                }
                className="h-7 w-7 rounded-md flex items-center justify-center text-gray-300 dark:text-gray-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                title="Mark as no-show"
              >
                <XCircle className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          {isActive && (
            <>
              <Button
                size="sm"
                className="h-7 px-2.5 gap-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-medium"
                onClick={() =>
                  onStatusChange(entry.queue_id, "completed")
                }
              >
                <CheckCircle2 className="w-3 h-3" />
                Done
              </Button>
              <button
                onClick={() =>
                  onStatusChange(entry.queue_id, "cancelled")
                }
                className="h-7 w-7 rounded-md flex items-center justify-center text-gray-300 dark:text-gray-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                title="Cancel"
              >
                <XCircle className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </td>
    </motion.tr>
  )
}

/* ══════════════════════════════════════════════════════
   Status Badge
   ══════════════════════════════════════════════════════ */
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    waiting: {
      label: "Waiting",
      cls: "text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400",
      icon: <Clock className="w-3 h-3" />,
    },
    in_consultation: {
      label: "In Consult",
      cls: "text-blue-700 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400",
      icon: <Stethoscope className="w-3 h-3" />,
    },
    completed: {
      label: "Completed",
      cls: "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400",
      icon: <CheckCircle2 className="w-3 h-3" />,
    },
    no_show: {
      label: "No Show",
      cls: "text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-400",
      icon: <XCircle className="w-3 h-3" />,
    },
    cancelled: {
      label: "Cancelled",
      cls: "text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-400",
      icon: <XCircle className="w-3 h-3" />,
    },
  }
  const c = config[status] || config.waiting
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full whitespace-nowrap",
        c.cls,
      )}
    >
      {c.icon}
      {c.label}
    </span>
  )
}

/* ══════════════════════════════════════════════════════
   Mobile Card
   ══════════════════════════════════════════════════════ */
function MobileCard({
  entry,
  onStatusChange,
  onPriorityChange,
}: {
  entry: QueueEntry
  onStatusChange: (id: string, status: string) => void
  onPriorityChange: (id: string, priority: number) => void
}) {
  const isActive = entry.status === "in_consultation"
  const isDone =
    entry.status === "completed" ||
    entry.status === "no_show" ||
    entry.status === "cancelled"

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className={cn(
        "rounded-xl border p-3 space-y-2.5",
        "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800",
        isActive && "border-blue-200 dark:border-blue-800/40 bg-blue-50/30 dark:bg-blue-950/10",
        entry.priority === 2 &&
          !isDone &&
          "border-red-200 dark:border-red-800/40 bg-red-50/20 dark:bg-red-950/10",
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div
          className={cn(
            "w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm shrink-0",
            isActive
              ? "bg-blue-600 text-white"
              : entry.priority === 2
                ? "bg-red-500 text-white"
                : entry.priority === 1
                  ? "bg-amber-500 text-white"
                  : isDone
                    ? "bg-gray-100 dark:bg-gray-800 text-gray-400"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300",
          )}
        >
          {entry.queue_number}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {entry.patient_name || "Unknown"}
          </p>
          {entry.doctor_name && (
            <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate flex items-center gap-1">
              <Stethoscope className="w-3 h-3 text-blue-400 shrink-0" />
              {entry.doctor_name}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <StatusBadge status={entry.status} />
          {entry.walk_in && (
            <span className="text-[10px] font-semibold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30 px-1.5 py-0.5 rounded">
              Walk-in
            </span>
          )}
        </div>
      </div>

      {/* Info row */}
      <div className="flex items-center gap-3 text-[11px] text-gray-500">
        {entry.patient_phone && (
          <span className="flex items-center gap-1">
            <Phone className="w-3 h-3" />
            {entry.patient_phone}
          </span>
        )}
        {entry.check_in_time && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatTime(
              new Date(entry.check_in_time).toTimeString().slice(0, 5),
            )}
          </span>
        )}
        {entry.status === "waiting" && entry.check_in_time && (
          <span className="ml-auto">
            <ElapsedTimer
              startTime={entry.check_in_time}
              warningMinutes={20}
              dangerMinutes={40}
            />
          </span>
        )}
        {isActive && entry.consultation_start && (
          <span className="flex items-center gap-1 ml-auto">
            <Stethoscope className="w-3 h-3 text-blue-500" />
            <ElapsedTimer
              startTime={entry.consultation_start}
              warningMinutes={15}
              dangerMinutes={30}
            />
          </span>
        )}
      </div>

      {/* Actions */}
      {!isDone && (
        <div className="flex items-center gap-2 pt-1">
          {entry.status === "waiting" && (
            <>
              <Button
                size="sm"
                className="flex-1 h-8 gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                onClick={() =>
                  onStatusChange(entry.queue_id, "in_consultation")
                }
              >
                <Play className="w-3.5 h-3.5" />
                Start Consult
              </Button>
              <button
                onClick={() => {
                  const next =
                    entry.priority === 0
                      ? 1
                      : entry.priority === 1
                        ? 2
                        : 0
                  onPriorityChange(entry.queue_id, next)
                }}
                className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center transition-colors",
                  entry.priority === 2
                    ? "text-red-500 bg-red-50 dark:bg-red-950/30"
                    : entry.priority === 1
                      ? "text-amber-500 bg-amber-50 dark:bg-amber-950/30"
                      : "text-gray-400 bg-gray-50 dark:bg-gray-800",
                )}
              >
                {entry.priority === 2 ? (
                  <Zap className="w-3.5 h-3.5" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                onClick={() =>
                  onStatusChange(entry.queue_id, "no_show")
                }
                className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          {isActive && (
            <>
              <Button
                size="sm"
                className="flex-1 h-8 gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                onClick={() =>
                  onStatusChange(entry.queue_id, "completed")
                }
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Mark Done
              </Button>
              <button
                onClick={() =>
                  onStatusChange(entry.queue_id, "cancelled")
                }
                className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      )}
    </motion.div>
  )
}
