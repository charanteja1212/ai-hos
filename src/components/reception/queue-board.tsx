"use client"

import { useCallback, useState, useMemo } from "react"
import { useBranch } from "@/components/providers/branch-context"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"
import { createBrowserClient } from "@/lib/supabase/client"
import { useQueue } from "@/hooks/use-queue"
import { getTodayIST, formatTime } from "@/lib/utils/date"
import { ElapsedTimer } from "@/components/ui/elapsed-timer"
import { AnimatedCounter } from "@/components/ui/animated-counter"
import { PendingArrivals } from "./pending-arrivals"
import { EmptyState } from "@/components/shared/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
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
  Sparkles,
  TrendingUp,
  Activity,
} from "lucide-react"
import type { QueueEntry } from "@/types/database"

type TabKey = "all" | "waiting" | "in_consultation" | "completed"

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return "Good Morning"
  if (h < 17) return "Good Afternoon"
  return "Good Evening"
}

export function QueueBoard() {
  const router = useRouter()
  const { activeTenantId: tenantId } = useBranch()
  const today = getTodayIST()
  const [activeTab, setActiveTab] = useState<TabKey>("all")
  const [searchQuery, setSearchQuery] = useState("")

  const { entries, stats, isLoading, mutate, getEstimatedWait } = useQueue(tenantId, today)

  /* ── Status Change ── */
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

  /* ── Priority Change ── */
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

  /* ── Derived ── */
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

  const tabConfig: { key: TabKey; label: string; icon: React.ReactNode; color: string }[] = [
    { key: "all", label: "All Patients", icon: <Users className="w-3.5 h-3.5" />, color: "blue" },
    { key: "waiting", label: "Waiting", icon: <Clock className="w-3.5 h-3.5" />, color: "amber" },
    { key: "in_consultation", label: "In Consult", icon: <Stethoscope className="w-3.5 h-3.5" />, color: "violet" },
    { key: "completed", label: "Done", icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: "emerald" },
  ]

  const getTabCount = (key: TabKey) => {
    if (key === "all") return stats.total
    if (key === "waiting") return stats.waiting
    if (key === "in_consultation") return stats.inConsultation
    return stats.completed + stats.noShow
  }

  /* ── Loading ── */
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 rounded-2xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-[400px] rounded-2xl" />
      </div>
    )
  }

  const throughput =
    stats.completed > 0 && stats.total > 0
      ? Math.round((stats.completed / stats.total) * 100)
      : 0

  return (
    <div className="space-y-6">
      {/* ═══════════════════════════════════════════
          WELCOME HEADER
          ═══════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            {getGreeting()}! <span className="text-2xl">👋</span>
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            Live reception dashboard
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="h-10 gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-all"
            onClick={() => router.push("/reception/book")}
          >
            <UserPlus className="w-4 h-4" />
            New Walk-in
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-10 gap-2 rounded-xl border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium"
            onClick={() => router.push("/reception/appointments")}
          >
            <CalendarSearch className="w-4 h-4" />
            Appointments
          </Button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          STAT CARDS
          ═══════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Patients */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
          className="relative bg-white dark:bg-gray-900 rounded-2xl p-5 border border-blue-100 dark:border-blue-900/40 shadow-sm hover:shadow-md transition-shadow group overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-blue-600 rounded-t-2xl" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                Total Today
              </p>
              <AnimatedCounter
                value={stats.total}
                className="text-3xl font-bold text-gray-900 dark:text-white mt-1.5 block"
              />
              <p className="text-[11px] text-gray-400 mt-1">patients registered</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </motion.div>

        {/* Waiting */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="relative bg-white dark:bg-gray-900 rounded-2xl p-5 border border-amber-100 dark:border-amber-900/40 shadow-sm hover:shadow-md transition-shadow group overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-500 rounded-t-2xl" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                Waiting
              </p>
              <AnimatedCounter
                value={stats.waiting}
                className="text-3xl font-bold text-gray-900 dark:text-white mt-1.5 block"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                {stats.waiting > 0 ? "in queue now" : "no one waiting"}
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </motion.div>

        {/* In Consultation */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative bg-white dark:bg-gray-900 rounded-2xl p-5 border border-violet-100 dark:border-violet-900/40 shadow-sm hover:shadow-md transition-shadow group overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 to-purple-600 rounded-t-2xl" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider">
                In Consultation
              </p>
              <AnimatedCounter
                value={stats.inConsultation}
                className="text-3xl font-bold text-gray-900 dark:text-white mt-1.5 block"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                {stats.inConsultation > 0 ? "seeing doctor" : "none active"}
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-violet-50 dark:bg-violet-950/30 flex items-center justify-center text-violet-500 group-hover:scale-110 transition-transform">
              <Stethoscope className="w-5 h-5" />
            </div>
          </div>
        </motion.div>

        {/* Avg Wait / Completion */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="relative bg-white dark:bg-gray-900 rounded-2xl p-5 border border-emerald-100 dark:border-emerald-900/40 shadow-sm hover:shadow-md transition-shadow group overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-t-2xl" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Avg Wait
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1.5">
                {stats.avgWaitMinutes > 0 ? `${stats.avgWaitMinutes}m` : "\u2014"}
              </p>
              <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
                {stats.completed > 0 && (
                  <>
                    <TrendingUp className="w-3 h-3 text-emerald-500" />
                    {stats.completed} completed ({throughput}%)
                  </>
                )}
                {stats.completed === 0 && "no data yet"}
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
              <Timer className="w-5 h-5" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* ═══════════════════════════════════════════
          PENDING ARRIVALS
          ═══════════════════════════════════════════ */}
      <PendingArrivals tenantId={tenantId} onCheckInComplete={() => mutate()} />

      {/* ═══════════════════════════════════════════
          NEXT UP BANNER
          ═══════════════════════════════════════════ */}
      {nextUp && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 p-5 text-white shadow-lg shadow-blue-500/20"
        >
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvc3ZnPg==')] opacity-60" />
          <div className="relative flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center font-bold text-lg shrink-0">
                {nextUp.queue_number}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span className="text-xs font-bold uppercase tracking-wider text-white/70">
                    Next Up
                  </span>
                </div>
                <p className="text-lg font-bold truncate">{nextUp.patient_name}</p>
                <p className="text-sm text-white/60 truncate">
                  {nextUp.doctor_name || "No doctor assigned"}
                  {nextUp.patient_phone && ` \u00B7 ${nextUp.patient_phone}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {nextUp.priority === 2 && (
                <span className="px-2.5 py-1 rounded-full bg-red-500/30 text-red-200 text-xs font-bold flex items-center gap-1">
                  <Zap className="w-3 h-3" /> Emergency
                </span>
              )}
              {nextUp.priority === 1 && (
                <span className="px-2.5 py-1 rounded-full bg-amber-500/30 text-amber-200 text-xs font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Urgent
                </span>
              )}
              <Button
                size="sm"
                className="h-10 gap-2 rounded-xl bg-white text-blue-700 hover:bg-white/90 font-bold shadow-md px-5"
                onClick={() => handleStatusChange(nextUp.queue_id, "in_consultation")}
              >
                <Play className="w-4 h-4" />
                Call Next
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════
          QUEUE SECTION
          ═══════════════════════════════════════════ */}
      <div className="space-y-4">
        {/* Search + Pill Tabs */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              className="pl-9 h-10 rounded-xl bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-sm shadow-sm"
              placeholder="Search patient, phone, doctor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
            {tabConfig.map((tab) => {
              const count = getTabCount(tab.key)
              const isActive = activeTab === tab.key
              const colorMap: Record<string, string> = {
                blue: "bg-blue-600 text-white shadow-md shadow-blue-500/25",
                amber: "bg-amber-500 text-white shadow-md shadow-amber-500/25",
                violet: "bg-violet-600 text-white shadow-md shadow-violet-500/25",
                emerald: "bg-emerald-600 text-white shadow-md shadow-emerald-500/25",
              }
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200",
                    isActive
                      ? colorMap[tab.color]
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300",
                  )}
                >
                  {tab.icon}
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span
                    className={cn(
                      "text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums",
                      isActive
                        ? "bg-white/25 text-white"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400",
                    )}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Patient Cards Grid */}
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredEntries.map((entry, idx) => (
                <PatientCard
                  key={entry.queue_id}
                  entry={entry}
                  index={idx}
                  onStatusChange={handleStatusChange}
                  onPriorityChange={handlePriorityChange}
                  estimatedWaitMin={
                    entry.status === "waiting" && entry.doctor_id
                      ? getEstimatedWait(
                          entry.doctor_id,
                          waitingEntries.findIndex((w) => w.queue_id === entry.queue_id) + 1,
                        )
                      : undefined
                  }
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════
   PATIENT CARD — Premium Card Design
   ══════════════════════════════════════════════════════ */
function PatientCard({
  entry,
  index,
  onStatusChange,
  onPriorityChange,
  estimatedWaitMin,
}: {
  entry: QueueEntry
  index: number
  onStatusChange: (id: string, status: string) => void
  onPriorityChange: (id: string, priority: number) => void
  estimatedWaitMin?: number
}) {
  const isActive = entry.status === "in_consultation"
  const isDone =
    entry.status === "completed" || entry.status === "no_show" || entry.status === "cancelled"

  const borderColor = isActive
    ? "border-l-violet-500"
    : entry.priority === 2
      ? "border-l-red-500"
      : entry.priority === 1
        ? "border-l-amber-500"
        : entry.status === "waiting"
          ? "border-l-amber-400"
          : entry.status === "completed"
            ? "border-l-emerald-500"
            : "border-l-gray-300"

  const queueBg = isActive
    ? "bg-violet-600 text-white"
    : entry.priority === 2
      ? "bg-red-500 text-white"
      : entry.priority === 1
        ? "bg-amber-500 text-white"
        : isDone
          ? "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
          : "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400"

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2, delay: index * 0.03 }}
      className={cn(
        "bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden border-l-4",
        borderColor,
        isActive && "ring-1 ring-violet-200 dark:ring-violet-800/40",
      )}
    >
      <div className="p-4 space-y-3">
        {/* Top: Queue # + Name + Badges */}
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0",
              queueBg,
            )}
          >
            {entry.queue_number}
            {isActive && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-violet-400 animate-ping" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p
              className={cn(
                "text-sm font-bold truncate",
                isDone ? "text-gray-400 dark:text-gray-500" : "text-gray-900 dark:text-white",
              )}
            >
              {entry.patient_name || "Unknown"}
            </p>
            {entry.doctor_name && (
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate flex items-center gap-1 mt-0.5">
                <Stethoscope className="w-3 h-3 text-violet-400 shrink-0" />
                {entry.doctor_name}
              </p>
            )}
          </div>

          {/* Badges */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            <StatusBadge status={entry.status} />
            {entry.walk_in && (
              <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30 px-2 py-0.5 rounded-full">
                Walk-in
              </span>
            )}
          </div>
        </div>

        {/* Info Row */}
        <div className="flex items-center gap-3 text-[11px] text-gray-400">
          {entry.patient_phone && (
            <span className="flex items-center gap-1">
              <Phone className="w-3 h-3" />
              {entry.patient_phone}
            </span>
          )}
          {entry.check_in_time && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTime(new Date(entry.check_in_time).toTimeString().slice(0, 5))}
            </span>
          )}
          {entry.status === "waiting" && entry.check_in_time && (
            <span className="flex items-center gap-1 ml-auto font-medium">
              <ElapsedTimer
                startTime={entry.check_in_time}
                warningMinutes={20}
                dangerMinutes={40}
              />
            </span>
          )}
          {isActive && entry.consultation_start && (
            <span className="flex items-center gap-1 ml-auto">
              <Activity className="w-3 h-3 text-violet-500" />
              <ElapsedTimer
                startTime={entry.consultation_start}
                warningMinutes={15}
                dangerMinutes={30}
              />
            </span>
          )}
        </div>

        {/* Estimated wait */}
        {entry.status === "waiting" &&
          estimatedWaitMin !== undefined &&
          estimatedWaitMin > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 px-2.5 py-1.5 rounded-lg w-fit">
              <Timer className="w-3 h-3" />
              ~{Math.round(estimatedWaitMin)}m estimated wait
            </div>
          )}

        {/* Priority badge (clickable for waiting) */}
        {entry.status === "waiting" && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const next = entry.priority === 0 ? 1 : entry.priority === 1 ? 2 : 0
                onPriorityChange(entry.queue_id, next)
              }}
              className={cn(
                "text-[11px] font-bold px-2.5 py-1 rounded-full transition-colors flex items-center gap-1",
                entry.priority === 2
                  ? "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400 hover:bg-red-100"
                  : entry.priority === 1
                    ? "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400 hover:bg-amber-100"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200",
              )}
              title="Click to cycle: Normal → Urgent → Emergency"
            >
              {entry.priority === 2 && <Zap className="w-3 h-3" />}
              {entry.priority === 1 && <AlertTriangle className="w-3 h-3" />}
              {entry.priority === 2
                ? "Emergency"
                : entry.priority === 1
                  ? "Urgent"
                  : "Normal Priority"}
            </button>
          </div>
        )}

        {/* Action Buttons */}
        {!isDone && (
          <div className="flex items-center gap-2 pt-1 border-t border-gray-50 dark:border-gray-800">
            {entry.status === "waiting" && (
              <>
                <Button
                  size="sm"
                  className="flex-1 h-9 gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-sm shadow-blue-500/20"
                  onClick={() => onStatusChange(entry.queue_id, "in_consultation")}
                >
                  <Play className="w-3.5 h-3.5" />
                  Start Consultation
                </Button>
                <button
                  onClick={() => onStatusChange(entry.queue_id, "no_show")}
                  className="h-9 w-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                  title="Mark as no-show"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </>
            )}
            {isActive && (
              <>
                <Button
                  size="sm"
                  className="flex-1 h-9 gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white text-xs font-bold shadow-sm shadow-emerald-500/20"
                  onClick={() => onStatusChange(entry.queue_id, "completed")}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Mark Complete
                </Button>
                <button
                  onClick={() => onStatusChange(entry.queue_id, "cancelled")}
                  className="h-9 w-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                  title="Cancel"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}

/* ══════════════════════════════════════════════════════
   STATUS BADGE
   ══════════════════════════════════════════════════════ */
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    waiting: {
      label: "Waiting",
      cls: "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400 ring-1 ring-amber-200/60 dark:ring-amber-800/30",
    },
    in_consultation: {
      label: "In Consult",
      cls: "bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-400 ring-1 ring-violet-200/60 dark:ring-violet-800/30",
    },
    completed: {
      label: "Done",
      cls: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 ring-1 ring-emerald-200/60 dark:ring-emerald-800/30",
    },
    no_show: {
      label: "No Show",
      cls: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 ring-1 ring-gray-200/60 dark:ring-gray-700/30",
    },
    cancelled: {
      label: "Cancelled",
      cls: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 ring-1 ring-gray-200/60 dark:ring-gray-700/30",
    },
  }
  const c = map[status] || map.waiting
  return (
    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", c.cls)}>
      {c.label}
    </span>
  )
}
