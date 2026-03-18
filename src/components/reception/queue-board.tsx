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
  Activity,
  ArrowLeft,
  Calendar,
  Hash,
  ArrowRight,
  HeartPulse,
  Dot,
} from "lucide-react"
import type { QueueEntry } from "@/types/database"

type FilterKey = "all" | "waiting" | "in_consultation" | "completed"

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
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { entries, stats, isLoading, mutate, getEstimatedWait } = useQueue(tenantId, today)

  /* ── Handlers ── */
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
        if (newStatus === "in_consultation") apptUpdate.check_in_status = "in_consultation"
        else if (newStatus === "completed") { apptUpdate.status = "completed"; apptUpdate.check_in_status = "completed" }
        else if (newStatus === "no_show") { apptUpdate.status = "no_show"; apptUpdate.check_in_status = "no_show" }
        else if (newStatus === "cancelled") { apptUpdate.status = "cancelled"; apptUpdate.check_in_status = "cancelled" }
        if (Object.keys(apptUpdate).length > 0) {
          await supabase.from("appointments").update(apptUpdate)
            .eq("booking_id", queueEntry.booking_id).eq("tenant_id", tenantId)
        }
      }

      toast.success(`Status updated to ${newStatus.replace("_", " ")}`)
    },
    [tenantId],
  )

  const handlePriorityChange = useCallback(
    async (queueId: string, newPriority: number) => {
      const supabase = createBrowserClient()
      const { error } = await supabase
        .from("queue_entries")
        .update({ priority: newPriority })
        .eq("queue_id", queueId)
        .eq("tenant_id", tenantId)
      if (error) { toast.error("Failed to update priority"); return }
      toast.success(`Priority: ${newPriority === 2 ? "Emergency" : newPriority === 1 ? "Urgent" : "Normal"}`)
    },
    [tenantId],
  )

  /* ── Derived ── */
  const filteredEntries = useMemo(() => {
    return entries
      .filter((e) => {
        if (activeFilter === "waiting") return e.status === "waiting"
        if (activeFilter === "in_consultation") return e.status === "in_consultation"
        if (activeFilter === "completed") return e.status === "completed" || e.status === "no_show"
        return true
      })
      .filter((e) => {
        if (!searchQuery) return true
        const q = searchQuery.toLowerCase()
        return e.patient_name?.toLowerCase().includes(q) || e.patient_phone?.includes(q) || e.doctor_name?.toLowerCase().includes(q)
      })
  }, [entries, activeFilter, searchQuery])

  const waitingEntries = entries.filter((e) => e.status === "waiting")
  const selectedEntry = entries.find((e) => e.queue_id === selectedId) || null
  const nextUp = waitingEntries[0]

  const throughput = stats.completed > 0 && stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0

  const getFilterCount = (key: FilterKey) => {
    if (key === "all") return stats.total
    if (key === "waiting") return stats.waiting
    if (key === "in_consultation") return stats.inConsultation
    return stats.completed + stats.noShow
  }

  /* ── Loading ── */
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-14 w-56" />
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-[520px] rounded-3xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ══════ HEADER ══════ */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white"
          >
            {getGreeting()} <span className="inline-block origin-[70%_70%] animate-[wave_2s_ease-in-out_infinite]">👋</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-sm text-gray-400 mt-1 flex items-center gap-2"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
            </span>
            Live Queue &middot; {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
          </motion.p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            className="h-10 gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg shadow-blue-600/20 transition-all hover:shadow-blue-600/30 hover:-translate-y-0.5"
            onClick={() => router.push("/reception/book")}
          >
            <UserPlus className="w-4 h-4" /> Walk-in
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-10 gap-2 rounded-xl border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium transition-all hover:-translate-y-0.5"
            onClick={() => router.push("/reception/appointments")}
          >
            <CalendarSearch className="w-4 h-4" /> Appointments
          </Button>
        </div>
      </div>

      {/* ══════ METRICS BAR ══════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total", val: stats.total, icon: Users, color: "blue" as const },
          { label: "Waiting", val: stats.waiting, icon: Clock, color: "sky" as const },
          { label: "In Consult", val: stats.inConsultation, icon: Stethoscope, color: "indigo" as const },
          { label: "Completed", val: stats.completed, icon: CheckCircle2, color: "blue" as const },
        ].map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="group relative bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-800/40 transition-all hover:shadow-lg hover:shadow-blue-600/5 hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{m.label}</span>
              <div className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110",
                m.color === "blue" && "bg-blue-50 text-blue-600 dark:bg-blue-950/30",
                m.color === "sky" && "bg-sky-50 text-sky-500 dark:bg-sky-950/30",
                m.color === "indigo" && "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30",
              )}>
                <m.icon className="w-4 h-4" />
              </div>
            </div>
            <AnimatedCounter value={m.val} className="text-3xl font-extrabold text-gray-900 dark:text-white block tracking-tight" />
          </motion.div>
        ))}
      </div>

      {/* ══════ PENDING ARRIVALS ══════ */}
      <PendingArrivals tenantId={tenantId} onCheckInComplete={() => mutate()} />

      {/* ══════ NEXT UP BANNER ══════ */}
      <AnimatePresence>
        {nextUp && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 p-5 text-white shadow-xl shadow-blue-600/15">
              {/* Decorative elements */}
              <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/[0.04]" />
              <div className="absolute right-20 -bottom-8 w-24 h-24 rounded-full bg-white/[0.04]" />
              <div className="absolute left-1/2 top-0 w-px h-full bg-gradient-to-b from-transparent via-white/10 to-transparent" />

              <div className="relative flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center font-extrabold text-xl shrink-0 ring-1 ring-white/20">
                    {nextUp.queue_number}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-200" />
                      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/50">Next Patient</span>
                    </div>
                    <p className="text-lg font-bold truncate leading-tight">{nextUp.patient_name}</p>
                    <p className="text-xs text-white/40 truncate mt-0.5">{nextUp.doctor_name || "No doctor"}{nextUp.patient_phone && ` \u00B7 ${nextUp.patient_phone}`}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="h-11 gap-2 rounded-xl bg-white text-blue-700 hover:bg-blue-50 font-bold shadow-lg px-5 transition-all hover:scale-105"
                  onClick={() => handleStatusChange(nextUp.queue_id, "in_consultation")}
                >
                  <Play className="w-4 h-4" /> Call In
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════
          MAIN PANEL — List + Detail
          ══════════════════════════════════════════ */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] min-h-[520px]">

          {/* ── LEFT: Patient List ── */}
          <div className={cn(
            "border-r border-gray-100 dark:border-gray-800 flex flex-col",
            selectedEntry && "hidden lg:flex"
          )}>
            {/* Search + Filter */}
            <div className="p-3 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                <Input
                  className="pl-9 h-10 rounded-xl bg-gray-50 dark:bg-gray-800 border-0 text-sm placeholder:text-gray-300 focus-visible:ring-1 focus-visible:ring-blue-500/30"
                  placeholder="Search patients..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                {(["all", "waiting", "in_consultation", "completed"] as FilterKey[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setActiveFilter(key)}
                    className={cn(
                      "shrink-0 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all",
                      activeFilter === key
                        ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20"
                        : "text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                    )}
                  >
                    {key === "all" ? "All" : key === "waiting" ? "Waiting" : key === "in_consultation" ? "Consult" : "Done"}
                    <span className={cn("ml-1.5 tabular-nums", activeFilter === key ? "text-white/60" : "text-gray-300")}>{getFilterCount(key)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Patient rows */}
            <ScrollArea className="flex-1">
              <div>
                {filteredEntries.length === 0 ? (
                  <div className="p-10 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
                      <Users className="w-5 h-5 text-gray-300" />
                    </div>
                    <p className="text-sm font-medium text-gray-400">{searchQuery ? "No matches" : "No patients yet"}</p>
                  </div>
                ) : (
                  filteredEntries.map((entry, i) => (
                    <motion.button
                      key={entry.queue_id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      onClick={() => setSelectedId(entry.queue_id)}
                      className={cn(
                        "w-full text-left px-4 py-3.5 flex items-center gap-3 transition-all border-l-[3px]",
                        selectedId === entry.queue_id
                          ? "bg-blue-50/70 dark:bg-blue-950/15 border-l-blue-600"
                          : "hover:bg-gray-50/80 dark:hover:bg-gray-800/40 border-l-transparent",
                        entry.priority === 2 && selectedId !== entry.queue_id && "bg-red-50/20 dark:bg-red-950/5",
                      )}
                    >
                      <div className="relative shrink-0">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm transition-transform",
                          selectedId === entry.queue_id && "scale-105",
                          entry.status === "in_consultation" ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/20" :
                          entry.priority === 2 ? "bg-red-500 text-white shadow-sm shadow-red-500/20" :
                          entry.priority === 1 ? "bg-blue-700 text-white shadow-sm shadow-blue-700/20" :
                          entry.status === "completed" || entry.status === "no_show" ? "bg-gray-100 dark:bg-gray-800 text-gray-400" :
                          "bg-blue-50 dark:bg-blue-950/30 text-blue-600"
                        )}>
                          {entry.queue_number}
                        </div>
                        {entry.status === "in_consultation" && (
                          <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500 ring-2 ring-white dark:ring-gray-900" />
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-[13px] font-semibold truncate leading-tight",
                          (entry.status === "completed" || entry.status === "no_show") ? "text-gray-400" : "text-gray-900 dark:text-white"
                        )}>
                          {entry.patient_name || "Unknown"}
                        </p>
                        <p className="text-[11px] text-gray-400 truncate mt-0.5">
                          {entry.doctor_name || "No doctor"}
                          {entry.walk_in && <span className="text-blue-400"> &middot; Walk-in</span>}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <StatusPill status={entry.status} />
                        {entry.status === "waiting" && entry.check_in_time && (
                          <ElapsedTimer startTime={entry.check_in_time} warningMinutes={20} dangerMinutes={40} className="text-[10px] font-medium tabular-nums" />
                        )}
                        {entry.status === "in_consultation" && entry.consultation_start && (
                          <ElapsedTimer startTime={entry.consultation_start} warningMinutes={15} dangerMinutes={30} className="text-[10px] font-medium tabular-nums" />
                        )}
                      </div>
                    </motion.button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* ── RIGHT: Detail / Overview ── */}
          <div className={cn(
            "flex flex-col bg-[#FAFBFC] dark:bg-gray-950/50",
            !selectedEntry && "hidden lg:flex"
          )}>
            <AnimatePresence mode="wait">
              {selectedEntry ? (
                <PatientDetail
                  key={selectedEntry.queue_id}
                  entry={selectedEntry}
                  onStatusChange={handleStatusChange}
                  onPriorityChange={handlePriorityChange}
                  onBack={() => setSelectedId(null)}
                  estimatedWaitMin={
                    selectedEntry.status === "waiting" && selectedEntry.doctor_id
                      ? getEstimatedWait(selectedEntry.doctor_id, waitingEntries.findIndex((w) => w.queue_id === selectedEntry.queue_id) + 1)
                      : undefined
                  }
                />
              ) : (
                <OverviewPanel
                  key="overview"
                  stats={stats}
                  throughput={throughput}
                  waitingEntries={waitingEntries}
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   OVERVIEW PANEL — Replaces boring empty state
   ══════════════════════════════════════════════════════════════ */
function OverviewPanel({ stats, throughput, waitingEntries }: {
  stats: { total: number; waiting: number; inConsultation: number; completed: number; noShow: number; avgWaitMinutes: number }
  throughput: number
  waitingEntries: QueueEntry[]
}) {
  const r = 52
  const circumference = 2 * Math.PI * r
  const progress = stats.total > 0 ? throughput : 0
  const offset = circumference - (progress / 100) * circumference

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col p-6 overflow-y-auto"
    >
      {/* Title */}
      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-sm shadow-blue-600/20">
            <HeartPulse className="w-3.5 h-3.5 text-white" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Today&apos;s Overview</h2>
        </div>
        <p className="text-xs text-gray-400 ml-[38px]">Real-time performance at a glance</p>
      </div>

      {/* ── Progress Ring + Throughput ── */}
      <div className="flex items-center gap-10 mb-8">
        <div className="relative w-32 h-32 shrink-0">
          <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
            <defs>
              <linearGradient id="ring-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#2563eb" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
            </defs>
            <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="10" className="text-gray-100 dark:text-gray-800" />
            <motion.circle
              cx="60" cy="60" r={r} fill="none" strokeWidth="10" strokeLinecap="round"
              stroke="url(#ring-gradient)"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, type: "spring" }}
              className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight"
            >{progress}<span className="text-lg text-gray-400">%</span></motion.span>
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em]">Complete</span>
          </div>
        </div>

        <div className="flex-1 space-y-4">
          {[
            { label: "Completed", val: stats.completed, total: stats.total, color: "bg-blue-600" },
            { label: "In Consult", val: stats.inConsultation, total: stats.total, color: "bg-indigo-500" },
            { label: "Waiting", val: stats.waiting, total: stats.total, color: "bg-sky-400" },
          ].map((s) => (
            <div key={s.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-gray-500">{s.label}</span>
                <span className="text-[11px] font-bold text-gray-900 dark:text-white tabular-nums">{s.val}</span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: s.total > 0 ? `${(s.val / s.total) * 100}%` : "0%" }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                  className={cn("h-full rounded-full", s.color)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Metric Cards ── */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 text-center">
          <p className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">{stats.total}</p>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-1">Registered</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 text-center">
          <p className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">{stats.avgWaitMinutes > 0 ? `${stats.avgWaitMinutes}m` : "\u2014"}</p>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-1">Avg Wait</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 text-center">
          <p className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">{stats.noShow}</p>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-1">No Show</p>
        </div>
      </div>

      {/* ── Waiting Queue Preview ── */}
      {waitingEntries.length > 0 ? (
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em] mb-3">Queue Order</p>
          <div className="space-y-2">
            {waitingEntries.slice(0, 4).map((e, i) => (
              <motion.div
                key={e.queue_id}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.08 }}
                className="flex items-center gap-3 bg-white dark:bg-gray-900 rounded-xl px-3.5 py-2.5 border border-gray-100 dark:border-gray-800"
              >
                <span className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-600 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 dark:text-white truncate">{e.patient_name}</p>
                  <p className="text-[10px] text-gray-400 truncate">{e.doctor_name || "Unassigned"}</p>
                </div>
                {e.check_in_time && (
                  <ElapsedTimer startTime={e.check_in_time} warningMinutes={20} dangerMinutes={40} className="text-[10px] font-medium tabular-nums" />
                )}
              </motion.div>
            ))}
            {waitingEntries.length > 4 && (
              <p className="text-[10px] text-gray-400 text-center font-medium">+{waitingEntries.length - 4} more</p>
            )}
          </div>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex-1 flex flex-col items-center justify-center text-center"
        >
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-7 h-7 text-blue-500" />
          </div>
          <p className="text-sm font-bold text-gray-900 dark:text-white">All Clear</p>
          <p className="text-xs text-gray-400 mt-1 max-w-[200px]">No patients waiting. Queue is empty.</p>
        </motion.div>
      )}

      {/* Bottom hint */}
      <div className="mt-auto pt-6 flex items-center justify-center gap-1.5 text-gray-300 dark:text-gray-600">
        <ArrowLeft className="w-3 h-3" />
        <p className="text-[10px] font-medium">Click a patient for details</p>
      </div>
    </motion.div>
  )
}

/* ══════════════════════════════════════════════════════════════
   PATIENT DETAIL — World-Class Card
   ══════════════════════════════════════════════════════════════ */
function PatientDetail({
  entry,
  onStatusChange,
  onPriorityChange,
  onBack,
  estimatedWaitMin,
}: {
  entry: QueueEntry
  onStatusChange: (id: string, status: string) => void
  onPriorityChange: (id: string, priority: number) => void
  onBack: () => void
  estimatedWaitMin?: number
}) {
  const isActive = entry.status === "in_consultation"
  const isDone = entry.status === "completed" || entry.status === "no_show" || entry.status === "cancelled"

  const steps = [
    { label: "Check-in", icon: UserPlus, done: true },
    { label: "Waiting", icon: Clock, done: entry.status !== "cancelled" },
    { label: "Consult", icon: Stethoscope, done: isActive || isDone },
    { label: "Done", icon: CheckCircle2, done: entry.status === "completed" },
  ]
  const activeStep = entry.status === "completed" ? 3 : entry.status === "in_consultation" ? 2 : entry.status === "waiting" ? 1 : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col h-full"
    >
      {/* ── Hero Header ── */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-600" />
        <div className="absolute -right-16 -top-16 w-48 h-48 rounded-full bg-white/[0.04]" />
        <div className="absolute right-8 bottom-0 w-20 h-20 rounded-full bg-white/[0.04]" />
        <div className="absolute left-0 bottom-0 w-full h-px bg-gradient-to-r from-white/0 via-white/10 to-white/0" />

        <div className="relative px-5 pt-5 pb-6">
          <div className="flex items-start gap-4">
            <button onClick={onBack} className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors mt-0.5">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center font-extrabold text-2xl text-white shrink-0 ring-1 ring-white/20 shadow-lg shadow-black/10">
              {entry.queue_number}
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <p className="text-xl font-extrabold text-white truncate tracking-tight">{entry.patient_name || "Unknown"}</p>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span className="text-[10px] font-bold bg-white/15 text-white/90 px-2.5 py-0.5 rounded-full backdrop-blur-sm">
                  {entry.status.replace(/_/g, " ").toUpperCase()}
                </span>
                {entry.walk_in && <span className="text-[10px] font-bold bg-white/10 text-white/70 px-2 py-0.5 rounded-full">Walk-in</span>}
                {entry.priority === 2 && (
                  <span className="text-[10px] font-bold bg-red-400/25 text-white px-2 py-0.5 rounded-full flex items-center gap-0.5"><Zap className="w-3 h-3" />Emergency</span>
                )}
                {entry.priority === 1 && (
                  <span className="text-[10px] font-bold bg-amber-400/20 text-white px-2 py-0.5 rounded-full flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" />Urgent</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Journey Progress ── */}
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="flex items-center">
          {steps.map((step, i) => {
            const isCompleted = i <= activeStep
            const isCurrent = i === activeStep
            const StepIcon = step.icon
            return (
              <div key={step.label} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center relative">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center transition-all relative",
                    isCurrent ? "bg-blue-600 text-white shadow-md shadow-blue-500/25" :
                    isCompleted ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600" :
                    "bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600"
                  )}>
                    <StepIcon className="w-3.5 h-3.5" />
                    {isCurrent && !isDone && (
                      <span className="absolute -inset-1 rounded-full border-2 border-blue-400/30 animate-[ping_2s_ease-in-out_infinite]" />
                    )}
                  </div>
                  <span className={cn(
                    "text-[8px] font-bold mt-1.5 uppercase tracking-wider",
                    isCurrent ? "text-blue-600" : isCompleted ? "text-gray-500" : "text-gray-300 dark:text-gray-600"
                  )}>{step.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className={cn(
                    "flex-1 h-[2px] mx-2 rounded-full -mt-4 transition-all",
                    i < activeStep ? "bg-blue-400" : "bg-gray-200 dark:bg-gray-700"
                  )} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Info Bento */}
        <div className="grid grid-cols-2 gap-3">
          <InfoCard icon={<Stethoscope className="w-4 h-4" />} label="Doctor" value={entry.doctor_name || "Not assigned"} />
          <InfoCard icon={<Phone className="w-4 h-4" />} label="Phone" value={entry.patient_phone || "N/A"} />
          <InfoCard icon={<Calendar className="w-4 h-4" />} label="Check-in" value={entry.check_in_time ? formatTime(new Date(entry.check_in_time).toTimeString().slice(0, 5)) : "N/A"} />
          <InfoCard icon={<Hash className="w-4 h-4" />} label="Queue" value={`#${entry.queue_number}`} />
        </div>

        {/* ── Live Timer ── */}
        {entry.status === "waiting" && entry.check_in_time && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-sky-50 dark:from-blue-950/20 dark:via-gray-900 dark:to-sky-950/20 rounded-2xl p-5 border border-blue-100/60 dark:border-blue-800/20"
          >
            <div className="absolute top-3 right-3">
              <span className="flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-50" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
            </div>
            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-[0.15em] mb-2">Waiting Time</p>
            <div className="flex items-end justify-between">
              <ElapsedTimer startTime={entry.check_in_time} warningMinutes={20} dangerMinutes={40} className="text-4xl font-extrabold tracking-tight" />
              {estimatedWaitMin !== undefined && estimatedWaitMin > 0 && (
                <div className="text-right">
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Est.</p>
                  <p className="text-xl font-extrabold text-blue-600 tracking-tight">~{Math.round(estimatedWaitMin)}m</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {isActive && entry.consultation_start && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-blue-50 dark:from-indigo-950/20 dark:via-gray-900 dark:to-blue-950/20 rounded-2xl p-5 border border-indigo-100/60 dark:border-indigo-800/20"
          >
            <div className="absolute top-3 right-3">
              <span className="flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-50" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
              </span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-indigo-500" />
              <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-[0.15em]">Consultation</p>
            </div>
            <ElapsedTimer startTime={entry.consultation_start} warningMinutes={15} dangerMinutes={30} className="text-4xl font-extrabold tracking-tight" />
          </motion.div>
        )}

        {/* Priority */}
        {entry.status === "waiting" && (
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em] mb-2.5">Priority</p>
            <div className="flex gap-2">
              {[
                { val: 0, label: "Normal", icon: null, active: "bg-blue-50 text-blue-600 border-blue-200 ring-blue-400/40 dark:bg-blue-950/20 dark:border-blue-800/30" },
                { val: 1, label: "Urgent", icon: AlertTriangle, active: "bg-amber-50 text-amber-600 border-amber-200 ring-amber-400/40 dark:bg-amber-950/20 dark:border-amber-800/30" },
                { val: 2, label: "Emergency", icon: Zap, active: "bg-red-50 text-red-600 border-red-200 ring-red-400/40 dark:bg-red-950/20 dark:border-red-800/30" },
              ].map((p) => {
                const Icon = p.icon
                return (
                  <button
                    key={p.val}
                    onClick={() => onPriorityChange(entry.queue_id, p.val)}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all text-center",
                      entry.priority === p.val
                        ? `${p.active} ring-2 ring-offset-1`
                        : "bg-white dark:bg-gray-900 text-gray-400 border-gray-200 dark:border-gray-700 hover:border-blue-300"
                    )}
                  >
                    {Icon && <Icon className="w-3 h-3 inline mr-1" />}
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Action Bar ── */}
      {!isDone && (
        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
          {entry.status === "waiting" && (
            <div className="flex gap-3">
              <Button
                className="flex-1 h-12 gap-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-600/20 text-sm transition-all hover:shadow-blue-600/30 hover:-translate-y-0.5"
                onClick={() => onStatusChange(entry.queue_id, "in_consultation")}
              >
                <Play className="w-4 h-4" /> Start Consultation
              </Button>
              <Button
                variant="outline"
                className="h-12 w-12 rounded-2xl border-gray-200 dark:border-gray-700 text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50/50 dark:hover:bg-red-950/10 transition-all"
                onClick={() => onStatusChange(entry.queue_id, "no_show")}
              >
                <XCircle className="w-4 h-4" />
              </Button>
            </div>
          )}
          {isActive && (
            <div className="flex gap-3">
              <Button
                className="flex-1 h-12 gap-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-600/20 text-sm transition-all hover:shadow-blue-600/30 hover:-translate-y-0.5"
                onClick={() => onStatusChange(entry.queue_id, "completed")}
              >
                <CheckCircle2 className="w-4 h-4" /> Complete
              </Button>
              <Button
                variant="outline"
                className="h-12 w-12 rounded-2xl border-gray-200 dark:border-gray-700 text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50/50 dark:hover:bg-red-950/10 transition-all"
                onClick={() => onStatusChange(entry.queue_id, "cancelled")}
              >
                <XCircle className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}

/* ══════════════════════════════════════════════════════════════
   COMPONENTS
   ══════════════════════════════════════════════════════════════ */
function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl p-3.5 border border-gray-100 dark:border-gray-800 group hover:border-blue-100 dark:hover:border-blue-900/30 transition-colors">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-blue-500 group-hover:text-blue-600 transition-colors">{icon}</span>
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{value}</p>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    waiting: "bg-sky-50 text-sky-600 dark:bg-sky-950/30 dark:text-sky-400",
    in_consultation: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400",
    completed: "bg-blue-50 text-blue-500 dark:bg-blue-950/30 dark:text-blue-400",
    no_show: "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500",
    cancelled: "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500",
  }
  const labels: Record<string, string> = {
    waiting: "Waiting",
    in_consultation: "Consult",
    completed: "Done",
    no_show: "No Show",
    cancelled: "Cancelled",
  }
  return (
    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-md", styles[status] || styles.waiting)}>
      {labels[status] || status}
    </span>
  )
}
