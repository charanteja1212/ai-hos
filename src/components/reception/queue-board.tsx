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
  TrendingUp,
  Activity,
  ArrowLeft,
  User,
  Calendar,
  Hash,
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
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton className="h-[500px] rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            {getGreeting()}! <span className="text-2xl">👋</span>
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
            </span>
            Live reception dashboard
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" className="h-10 gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md shadow-blue-500/20" onClick={() => router.push("/reception/book")}>
            <UserPlus className="w-4 h-4" /> New Walk-in
          </Button>
          <Button variant="outline" size="sm" className="h-10 gap-2 rounded-xl border-blue-200 dark:border-blue-800/40 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20 font-medium" onClick={() => router.push("/reception/appointments")}>
            <CalendarSearch className="w-4 h-4" /> Appointments
          </Button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatMini label="Total Today" value={stats.total} icon={<Users className="w-5 h-5" />} accent="blue-600" delay={0} />
        <StatMini label="Waiting" value={stats.waiting} icon={<Clock className="w-5 h-5" />} accent="sky-500" sub={stats.waiting > 0 ? "in queue" : "clear"} delay={0.05} />
        <StatMini label="In Consultation" value={stats.inConsultation} icon={<Stethoscope className="w-5 h-5" />} accent="indigo-600" sub={stats.inConsultation > 0 ? "active" : "none"} delay={0.1} />
        <StatMini label="Avg Wait" textValue={stats.avgWaitMinutes > 0 ? `${stats.avgWaitMinutes}m` : "\u2014"} icon={<Timer className="w-5 h-5" />} accent="blue-800" sub={stats.completed > 0 ? `${stats.completed} done (${throughput}%)` : "no data"} delay={0.15} />
      </div>

      {/* ── Pending Arrivals ── */}
      <PendingArrivals tenantId={tenantId} onCheckInComplete={() => mutate()} />

      {/* ── Next Up ── */}
      {nextUp && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 p-4 text-white shadow-lg shadow-blue-600/20">
          <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/5" />
          <div className="relative flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center font-bold text-base shrink-0">{nextUp.queue_number}</div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-blue-200" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">Next Up</span>
                </div>
                <p className="text-base font-bold truncate">{nextUp.patient_name}</p>
                <p className="text-xs text-white/50 truncate">{nextUp.doctor_name || "No doctor"}{nextUp.patient_phone && ` \u00B7 ${nextUp.patient_phone}`}</p>
              </div>
            </div>
            <Button size="sm" className="h-9 gap-2 rounded-xl bg-white text-blue-700 hover:bg-blue-50 font-bold shadow-md px-4" onClick={() => handleStatusChange(nextUp.queue_id, "in_consultation")}>
              <Play className="w-4 h-4" /> Call Next
            </Button>
          </div>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════
          SPLIT PANEL — Patient List + Detail
          ═══════════════════════════════════════════ */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] min-h-[480px]">

          {/* ── LEFT: Patient List ── */}
          <div className={cn(
            "border-r border-gray-100 dark:border-gray-800 flex flex-col",
            selectedEntry && "hidden lg:flex"
          )}>
            {/* Search */}
            <div className="p-3 border-b border-gray-100 dark:border-gray-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
                <Input
                  className="pl-9 h-9 rounded-lg bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-sm focus:border-blue-400"
                  placeholder="Search patient..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-100 dark:border-gray-800 overflow-x-auto">
              {(["all", "waiting", "in_consultation", "completed"] as FilterKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setActiveFilter(key)}
                  className={cn(
                    "shrink-0 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-all",
                    activeFilter === key
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20"
                  )}
                >
                  {key === "all" ? "All" : key === "waiting" ? "Waiting" : key === "in_consultation" ? "Consult" : "Done"}
                  <span className={cn("ml-1 tabular-nums", activeFilter === key ? "text-white/70" : "text-gray-400")}>{getFilterCount(key)}</span>
                </button>
              ))}
            </div>

            {/* List */}
            <ScrollArea className="flex-1">
              <div className="divide-y divide-gray-50 dark:divide-gray-800/60">
                {filteredEntries.length === 0 ? (
                  <div className="p-8 text-center">
                    <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">{searchQuery ? "No matches" : "No patients"}</p>
                  </div>
                ) : (
                  filteredEntries.map((entry) => (
                    <button
                      key={entry.queue_id}
                      onClick={() => setSelectedId(entry.queue_id)}
                      className={cn(
                        "w-full text-left px-3 py-3 flex items-center gap-3 transition-colors",
                        selectedId === entry.queue_id
                          ? "bg-blue-50 dark:bg-blue-950/20 border-l-2 border-l-blue-600"
                          : "hover:bg-gray-50 dark:hover:bg-gray-800/50 border-l-2 border-l-transparent",
                        entry.priority === 2 && selectedId !== entry.queue_id && "bg-red-50/30 dark:bg-red-950/5",
                      )}
                    >
                      {/* Status dot + Queue # */}
                      <div className="relative shrink-0">
                        <div className={cn(
                          "w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs",
                          entry.status === "in_consultation" ? "bg-indigo-600 text-white" :
                          entry.priority === 2 ? "bg-red-500 text-white" :
                          entry.priority === 1 ? "bg-blue-700 text-white" :
                          entry.status === "completed" || entry.status === "no_show" ? "bg-gray-100 dark:bg-gray-800 text-gray-400" :
                          "bg-blue-50 dark:bg-blue-950/30 text-blue-600"
                        )}>
                          {entry.queue_number}
                        </div>
                        {entry.status === "in_consultation" && (
                          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm font-semibold truncate",
                          (entry.status === "completed" || entry.status === "no_show") ? "text-gray-400" : "text-gray-900 dark:text-white"
                        )}>
                          {entry.patient_name || "Unknown"}
                        </p>
                        <p className="text-[11px] text-gray-400 truncate">
                          {entry.doctor_name || "No doctor"}
                          {entry.walk_in && " \u00B7 Walk-in"}
                        </p>
                      </div>

                      {/* Right side: status + time */}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <ListStatusBadge status={entry.status} />
                        {entry.status === "waiting" && entry.check_in_time && (
                          <ElapsedTimer startTime={entry.check_in_time} warningMinutes={20} dangerMinutes={40} className="text-[10px]" />
                        )}
                        {entry.status === "in_consultation" && entry.consultation_start && (
                          <ElapsedTimer startTime={entry.consultation_start} warningMinutes={15} dangerMinutes={30} className="text-[10px]" />
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* ── RIGHT: Detail Panel ── */}
          <div className={cn(
            "flex flex-col",
            !selectedEntry && "hidden lg:flex"
          )}>
            {selectedEntry ? (
              <PatientDetail
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
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/20 flex items-center justify-center mb-4">
                  <User className="w-7 h-7 text-blue-400" />
                </div>
                <p className="text-base font-semibold text-gray-900 dark:text-white">Select a patient</p>
                <p className="text-sm text-gray-400 mt-1 max-w-[240px]">
                  Choose a patient from the list to view details and take action
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════
   PATIENT DETAIL PANEL
   ══════════════════════════════════════════════════════ */
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

  return (
    <motion.div
      key={entry.queue_id}
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col h-full"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <button onClick={onBack} className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shrink-0",
          isActive ? "bg-indigo-600 text-white" :
          entry.priority === 2 ? "bg-red-500 text-white" :
          entry.priority === 1 ? "bg-blue-700 text-white" :
          isDone ? "bg-gray-100 dark:bg-gray-800 text-gray-400" :
          "bg-blue-50 dark:bg-blue-950/30 text-blue-600"
        )}>
          {entry.queue_number}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-bold text-gray-900 dark:text-white truncate">{entry.patient_name || "Unknown"}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <DetailStatusBadge status={entry.status} />
            {entry.walk_in && (
              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded-full">Walk-in</span>
            )}
            {entry.priority === 2 && (
              <span className="text-[10px] font-bold text-red-600 bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded-full flex items-center gap-0.5"><Zap className="w-3 h-3" /> Emergency</span>
            )}
            {entry.priority === 1 && (
              <span className="text-[10px] font-bold text-blue-700 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-full flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" /> Urgent</span>
            )}
          </div>
        </div>
      </div>

      {/* Info Grid */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <InfoField icon={<Stethoscope className="w-4 h-4 text-blue-500" />} label="Doctor" value={entry.doctor_name || "Not assigned"} />
          <InfoField icon={<Phone className="w-4 h-4 text-blue-500" />} label="Phone" value={entry.patient_phone || "N/A"} />
          <InfoField icon={<Calendar className="w-4 h-4 text-blue-500" />} label="Check-in" value={entry.check_in_time ? formatTime(new Date(entry.check_in_time).toTimeString().slice(0, 5)) : "N/A"} />
          <InfoField icon={<Hash className="w-4 h-4 text-blue-500" />} label="Queue #" value={String(entry.queue_number)} />
        </div>

        {/* Live timer */}
        {entry.status === "waiting" && entry.check_in_time && (
          <div className="bg-blue-50 dark:bg-blue-950/20 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Waiting Time</p>
              <div className="mt-1">
                <ElapsedTimer startTime={entry.check_in_time} warningMinutes={20} dangerMinutes={40} className="text-2xl font-bold" />
              </div>
            </div>
            {estimatedWaitMin !== undefined && estimatedWaitMin > 0 && (
              <div className="text-right">
                <p className="text-[11px] font-semibold text-blue-500 uppercase tracking-wider">Estimated</p>
                <p className="text-lg font-bold text-blue-600 mt-1">~{Math.round(estimatedWaitMin)}m</p>
              </div>
            )}
          </div>
        )}

        {isActive && entry.consultation_start && (
          <div className="bg-indigo-50 dark:bg-indigo-950/20 rounded-xl p-4 flex items-center gap-3">
            <Activity className="w-5 h-5 text-indigo-500" />
            <div>
              <p className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider">Consultation Time</p>
              <div className="mt-1">
                <ElapsedTimer startTime={entry.consultation_start} warningMinutes={15} dangerMinutes={30} className="text-2xl font-bold" />
              </div>
            </div>
          </div>
        )}

        {/* Priority control (waiting only) */}
        {entry.status === "waiting" && (
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Priority</p>
            <div className="flex items-center gap-2">
              {[
                { val: 0, label: "Normal", cls: "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800/30" },
                { val: 1, label: "Urgent", cls: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:border-blue-700/30" },
                { val: 2, label: "Emergency", cls: "bg-red-50 text-red-600 border-red-200 dark:bg-red-950/20 dark:border-red-800/30" },
              ].map((p) => (
                <button
                  key={p.val}
                  onClick={() => onPriorityChange(entry.queue_id, p.val)}
                  className={cn(
                    "px-3 py-2 rounded-xl text-xs font-bold border transition-all",
                    entry.priority === p.val
                      ? `${p.cls} ring-2 ring-offset-1 ${p.val === 2 ? "ring-red-400" : "ring-blue-400"}`
                      : "bg-gray-50 dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700 hover:border-blue-300"
                  )}
                >
                  {p.val === 2 && <Zap className="w-3 h-3 inline mr-1" />}
                  {p.val === 1 && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action Footer */}
      {!isDone && (
        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
          {entry.status === "waiting" && (
            <div className="flex items-center gap-3">
              <Button className="flex-1 h-11 gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-500/20 text-sm" onClick={() => onStatusChange(entry.queue_id, "in_consultation")}>
                <Play className="w-4 h-4" /> Start Consultation
              </Button>
              <Button variant="outline" className="h-11 px-4 rounded-xl border-gray-200 dark:border-gray-700 text-gray-500 hover:text-red-500 hover:border-red-200 hover:bg-red-50 dark:hover:bg-red-950/20" onClick={() => onStatusChange(entry.queue_id, "no_show")}>
                <XCircle className="w-4 h-4" />
              </Button>
            </div>
          )}
          {isActive && (
            <div className="flex items-center gap-3">
              <Button className="flex-1 h-11 gap-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold shadow-md shadow-blue-600/20 text-sm" onClick={() => onStatusChange(entry.queue_id, "completed")}>
                <CheckCircle2 className="w-4 h-4" /> Mark Complete
              </Button>
              <Button variant="outline" className="h-11 px-4 rounded-xl border-gray-200 dark:border-gray-700 text-gray-500 hover:text-red-500 hover:border-red-200 hover:bg-red-50 dark:hover:bg-red-950/20" onClick={() => onStatusChange(entry.queue_id, "cancelled")}>
                <XCircle className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}

/* ══════════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════════ */
function InfoField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{value}</p>
    </div>
  )
}

function ListStatusBadge({ status }: { status: string }) {
  const m: Record<string, { label: string; cls: string }> = {
    waiting: { label: "Waiting", cls: "bg-sky-50 text-sky-600 dark:bg-sky-950/30 dark:text-sky-400" },
    in_consultation: { label: "Consult", cls: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400" },
    completed: { label: "Done", cls: "bg-blue-50 text-blue-500 dark:bg-blue-950/30 dark:text-blue-400" },
    no_show: { label: "No Show", cls: "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500" },
    cancelled: { label: "Cancelled", cls: "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500" },
  }
  const c = m[status] || m.waiting
  return <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", c.cls)}>{c.label}</span>
}

function DetailStatusBadge({ status }: { status: string }) {
  const m: Record<string, { label: string; cls: string }> = {
    waiting: { label: "Waiting", cls: "bg-sky-50 text-sky-600 dark:bg-sky-950/30 dark:text-sky-400 ring-1 ring-sky-200/60 dark:ring-sky-800/30" },
    in_consultation: { label: "In Consultation", cls: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400 ring-1 ring-indigo-200/60 dark:ring-indigo-800/30" },
    completed: { label: "Completed", cls: "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400 ring-1 ring-blue-200/60 dark:ring-blue-800/30" },
    no_show: { label: "No Show", cls: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 ring-1 ring-gray-200/60 dark:ring-gray-700/30" },
    cancelled: { label: "Cancelled", cls: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 ring-1 ring-gray-200/60 dark:ring-gray-700/30" },
  }
  const c = m[status] || m.waiting
  return <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", c.cls)}>{c.label}</span>
}

const STAT_ACCENT: Record<string, { bar: string; iconBg: string; iconText: string }> = {
  "blue-600":  { bar: "bg-blue-600",  iconBg: "bg-blue-50 dark:bg-blue-600/10",    iconText: "text-blue-600" },
  "sky-500":   { bar: "bg-sky-500",   iconBg: "bg-sky-50 dark:bg-sky-500/10",      iconText: "text-sky-500" },
  "indigo-600":{ bar: "bg-indigo-600",iconBg: "bg-indigo-50 dark:bg-indigo-600/10", iconText: "text-indigo-600" },
  "blue-800":  { bar: "bg-blue-800",  iconBg: "bg-blue-50 dark:bg-blue-800/10",    iconText: "text-blue-800" },
}

function StatMini({ label, value, textValue, icon, accent, sub, delay = 0 }: {
  label: string; value?: number; textValue?: string; icon: React.ReactNode; accent: string; sub?: string; delay?: number
}) {
  const a = STAT_ACCENT[accent] || STAT_ACCENT["blue-600"]
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} className="relative bg-white dark:bg-gray-900 rounded-2xl p-4 border border-blue-100 dark:border-blue-900/30 shadow-sm hover:shadow-md transition-shadow group overflow-hidden">
      <div className={cn("absolute top-0 left-0 w-full h-1 rounded-t-2xl", a.bar)} />
      <div className="flex items-center gap-3">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform", a.iconBg, a.iconText)}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
          {value !== undefined ? (
            <AnimatedCounter value={value} className="text-xl font-bold text-gray-900 dark:text-white block" />
          ) : (
            <p className="text-xl font-bold text-gray-900 dark:text-white">{textValue}</p>
          )}
          {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
        </div>
      </div>
    </motion.div>
  )
}
