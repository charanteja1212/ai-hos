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
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import {
  Users,
  Clock,
  Stethoscope,
  CheckCircle2,
  UserPlus,
  CalendarSearch,
  Play,
  XCircle,
  Phone,
  Zap,
  AlertTriangle,
  Activity,
  Calendar,
  Hash,
  Sparkles,
  Timer,
  ChevronRight,
} from "lucide-react"
import type { QueueEntry } from "@/types/database"

type MobileTab = "waiting" | "consult" | "done"

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
  const [mobileTab, setMobileTab] = useState<MobileTab>("waiting")
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
      setSelectedId(null)
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

  /* ── Kanban columns ── */
  const columns = useMemo(() => ({
    waiting: entries.filter((e) => e.status === "waiting"),
    consult: entries.filter((e) => e.status === "in_consultation"),
    done: entries.filter((e) => e.status === "completed" || e.status === "no_show" || e.status === "cancelled"),
  }), [entries])

  const selectedEntry = entries.find((e) => e.queue_id === selectedId) || null
  const waitingEntries = columns.waiting

  /* ── Loading ── */
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <div className="grid grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[400px] rounded-2xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* ══════ HEADER ══════ */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            {getGreeting()} <span className="inline-block origin-[70%_70%] animate-[wave_2s_ease-in-out_infinite]">👋</span>
          </h1>
          <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
            </span>
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })} &middot; Live
          </p>
        </motion.div>
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
            className="h-10 gap-2 rounded-xl border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium"
            onClick={() => router.push("/reception/appointments")}
          >
            <CalendarSearch className="w-4 h-4" /> Appointments
          </Button>
        </div>
      </div>

      {/* ══════ INLINE STATS BAR ══════ */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex items-center gap-3 flex-wrap"
      >
        {[
          { label: "Patients", val: stats.total, icon: Users, accent: "bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400" },
          { label: "Waiting", val: stats.waiting, icon: Clock, accent: "bg-sky-100 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400" },
          { label: "Consult", val: stats.inConsultation, icon: Stethoscope, accent: "bg-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400" },
          { label: "Avg Wait", val: stats.avgWaitMinutes, icon: Timer, accent: "bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400", suffix: "m" },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-2 bg-white dark:bg-gray-900 rounded-full pl-1.5 pr-3.5 py-1.5 border border-gray-100 dark:border-gray-800 shadow-sm">
            <div className={cn("w-7 h-7 rounded-full flex items-center justify-center", s.accent)}>
              <s.icon className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-extrabold text-gray-900 dark:text-white tabular-nums">
                {s.val > 0 ? s.val : "\u2014"}{s.suffix && s.val > 0 ? s.suffix : ""}
              </span>
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{s.label}</span>
            </div>
          </div>
        ))}
      </motion.div>

      {/* ══════ PENDING ARRIVALS ══════ */}
      <PendingArrivals tenantId={tenantId} onCheckInComplete={() => mutate()} />

      {/* ══════ MOBILE TABS ══════ */}
      <div className="flex lg:hidden items-center bg-gray-100 dark:bg-gray-800 rounded-xl p-1 gap-1">
        {([
          { key: "waiting" as MobileTab, label: "Waiting", count: columns.waiting.length },
          { key: "consult" as MobileTab, label: "In Consult", count: columns.consult.length },
          { key: "done" as MobileTab, label: "Done", count: columns.done.length },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setMobileTab(tab.key)}
            className={cn(
              "flex-1 text-xs font-bold py-2 rounded-lg transition-all text-center",
              mobileTab === tab.key
                ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            {tab.label} <span className="ml-1 tabular-nums text-gray-400">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* ══════ KANBAN BOARD ══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5 min-h-[420px]">
        {/* ── WAITING COLUMN ── */}
        <div className={cn("lg:block", mobileTab !== "waiting" && "hidden")}>
          <KanbanColumn
            title="Waiting"
            count={columns.waiting.length}
            accentDot="bg-sky-400"
            accentBg="bg-sky-50 dark:bg-sky-950/20"
            emptyIcon={Clock}
            emptyText="No patients waiting"
          >
            {columns.waiting.map((entry, i) => (
              <WaitingCard
                key={entry.queue_id}
                entry={entry}
                index={i}
                isFirst={i === 0}
                onSelect={() => setSelectedId(entry.queue_id)}
                onCallIn={() => handleStatusChange(entry.queue_id, "in_consultation")}
              />
            ))}
          </KanbanColumn>
        </div>

        {/* ── IN CONSULT COLUMN ── */}
        <div className={cn("lg:block", mobileTab !== "consult" && "hidden")}>
          <KanbanColumn
            title="In Consultation"
            count={columns.consult.length}
            accentDot="bg-indigo-500"
            accentBg="bg-indigo-50 dark:bg-indigo-950/20"
            emptyIcon={Stethoscope}
            emptyText="No active consultations"
          >
            {columns.consult.map((entry, i) => (
              <ConsultCard
                key={entry.queue_id}
                entry={entry}
                index={i}
                onSelect={() => setSelectedId(entry.queue_id)}
                onComplete={() => handleStatusChange(entry.queue_id, "completed")}
              />
            ))}
          </KanbanColumn>
        </div>

        {/* ── DONE COLUMN ── */}
        <div className={cn("lg:block", mobileTab !== "done" && "hidden")}>
          <KanbanColumn
            title="Completed"
            count={columns.done.length}
            accentDot="bg-gray-400"
            accentBg="bg-gray-50 dark:bg-gray-800/50"
            emptyIcon={CheckCircle2}
            emptyText="No completed visits yet"
          >
            {columns.done.map((entry, i) => (
              <DoneCard key={entry.queue_id} entry={entry} index={i} onSelect={() => setSelectedId(entry.queue_id)} />
            ))}
          </KanbanColumn>
        </div>
      </div>

      {/* ══════ PATIENT DETAIL SHEET ══════ */}
      <Sheet open={!!selectedEntry} onOpenChange={(open) => { if (!open) setSelectedId(null) }}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 overflow-hidden">
          {selectedEntry && (
            <PatientSheet
              entry={selectedEntry}
              onStatusChange={handleStatusChange}
              onPriorityChange={handlePriorityChange}
              estimatedWaitMin={
                selectedEntry.status === "waiting" && selectedEntry.doctor_id
                  ? getEstimatedWait(selectedEntry.doctor_id, waitingEntries.findIndex((w) => w.queue_id === selectedEntry.queue_id) + 1)
                  : undefined
              }
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   KANBAN COLUMN
   ══════════════════════════════════════════════════════════ */
function KanbanColumn({ title, count, accentDot, accentBg, emptyIcon: EmptyIcon, emptyText, children }: {
  title: string
  count: number
  accentDot: string
  accentBg: string
  emptyIcon: React.ElementType
  emptyText: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col bg-[#F7F8FA] dark:bg-gray-900/60 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800/60">
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className={cn("w-2.5 h-2.5 rounded-full", accentDot)} />
          <span className="text-[13px] font-bold text-gray-700 dark:text-gray-200">{title}</span>
        </div>
        <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums", accentBg, "text-gray-600 dark:text-gray-300")}>
          {count}
        </span>
      </div>

      {/* Cards area */}
      <ScrollArea className="flex-1 max-h-[520px]">
        <div className="px-2.5 pt-2.5 pb-2.5 space-y-2.5">
          {count === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-12 text-center"
            >
              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-3", accentBg)}>
                <EmptyIcon className="w-5 h-5 text-gray-400" />
              </div>
              <p className="text-xs font-medium text-gray-400">{emptyText}</p>
            </motion.div>
          ) : children}
        </div>
      </ScrollArea>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   PATIENT CARDS
   ══════════════════════════════════════════════════════════ */

function WaitingCard({ entry, index, isFirst, onSelect, onCallIn }: {
  entry: QueueEntry; index: number; isFirst: boolean
  onSelect: () => void; onCallIn: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={cn(
        "group relative bg-white dark:bg-gray-900 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer",
        "border border-transparent hover:border-blue-200 dark:hover:border-blue-800/40",
        isFirst && "ring-2 ring-blue-500/20 border-blue-100 dark:border-blue-800/30",
        entry.priority === 2 && "ring-2 ring-red-500/20 border-red-100 dark:border-red-800/30",
        entry.priority === 1 && "ring-2 ring-amber-500/20 border-amber-100 dark:border-amber-800/30",
      )}
      onClick={onSelect}
    >
      {/* First in line highlight */}
      {isFirst && (
        <div className="absolute -top-px left-4 right-4 h-[2px] bg-gradient-to-r from-blue-500 to-indigo-500 rounded-b-full" />
      )}

      <div className="p-3.5">
        <div className="flex items-start gap-3">
          {/* Queue number */}
          <div className={cn(
            "w-11 h-11 rounded-xl flex items-center justify-center font-extrabold text-sm shrink-0 transition-transform group-hover:scale-105",
            entry.priority === 2 ? "bg-red-500 text-white shadow-sm shadow-red-500/20" :
            entry.priority === 1 ? "bg-amber-500 text-white shadow-sm shadow-amber-500/20" :
            isFirst ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20" :
            "bg-blue-50 dark:bg-blue-950/30 text-blue-600"
          )}>
            {entry.queue_number}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{entry.patient_name || "Unknown"}</p>
              {entry.priority === 2 && <Zap className="w-3 h-3 text-red-500 shrink-0" />}
              {entry.priority === 1 && <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />}
            </div>
            <p className="text-[11px] text-gray-400 truncate mt-0.5">{entry.doctor_name || "No doctor"}{entry.walk_in && " · Walk-in"}</p>
          </div>
        </div>

        {/* Timer + Action */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50 dark:border-gray-800">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-gray-300" />
            {entry.check_in_time ? (
              <ElapsedTimer startTime={entry.check_in_time} warningMinutes={20} dangerMinutes={40} className="text-[11px] font-semibold tabular-nums" />
            ) : (
              <span className="text-[11px] text-gray-400">Just now</span>
            )}
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); onCallIn() }}
            className={cn(
              "h-7 px-3 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all",
              isFirst
                ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700"
                : "bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950/30 dark:hover:bg-blue-950/50"
            )}
          >
            <Play className="w-3 h-3" />
            {isFirst ? "Call In" : "Start"}
          </button>
        </div>
      </div>

      {/* First patient badge */}
      {isFirst && (
        <div className="absolute -top-2 right-3">
          <span className="text-[9px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full shadow-sm flex items-center gap-0.5">
            <Sparkles className="w-2.5 h-2.5" /> NEXT
          </span>
        </div>
      )}
    </motion.div>
  )
}

function ConsultCard({ entry, index, onSelect, onComplete }: {
  entry: QueueEntry; index: number
  onSelect: () => void; onComplete: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="group relative bg-white dark:bg-gray-900 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer border border-transparent hover:border-indigo-200 dark:hover:border-indigo-800/40"
      onClick={onSelect}
    >
      {/* Active pulse indicator */}
      <div className="absolute top-3.5 right-3.5">
        <span className="flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-60" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
        </span>
      </div>

      <div className="p-3.5">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-extrabold text-sm shrink-0 shadow-sm shadow-indigo-500/20 transition-transform group-hover:scale-105">
            {entry.queue_number}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{entry.patient_name || "Unknown"}</p>
            <p className="text-[11px] text-gray-400 truncate mt-0.5">{entry.doctor_name || "No doctor"}</p>
          </div>
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50 dark:border-gray-800">
          <div className="flex items-center gap-1.5">
            <Activity className="w-3 h-3 text-indigo-400" />
            {entry.consultation_start ? (
              <ElapsedTimer startTime={entry.consultation_start} warningMinutes={15} dangerMinutes={30} className="text-[11px] font-semibold tabular-nums" />
            ) : (
              <span className="text-[11px] text-gray-400">Starting...</span>
            )}
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); onComplete() }}
            className="h-7 px-3 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50 flex items-center gap-1 transition-all"
          >
            <CheckCircle2 className="w-3 h-3" /> Done
          </button>
        </div>
      </div>
    </motion.div>
  )
}

function DoneCard({ entry, index, onSelect }: {
  entry: QueueEntry; index: number; onSelect: () => void
}) {
  const isNoShow = entry.status === "no_show" || entry.status === "cancelled"
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="bg-white dark:bg-gray-900 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-gray-700 opacity-70 hover:opacity-100"
      onClick={onSelect}
    >
      <div className="p-3.5">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0",
            isNoShow ? "bg-gray-100 dark:bg-gray-800 text-gray-400" : "bg-blue-50 dark:bg-blue-950/30 text-blue-500"
          )}>
            {isNoShow ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 truncate">{entry.patient_name || "Unknown"}</p>
            <p className="text-[11px] text-gray-400 truncate">{entry.doctor_name || "No doctor"}</p>
          </div>
          <span className={cn(
            "text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0",
            isNoShow ? "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" : "bg-blue-50 text-blue-500 dark:bg-blue-950/30 dark:text-blue-400"
          )}>
            {entry.status === "no_show" ? "No Show" : entry.status === "cancelled" ? "Cancelled" : "Done"}
          </span>
        </div>
      </div>
    </motion.div>
  )
}

/* ══════════════════════════════════════════════════════════
   PATIENT DETAIL SHEET (Slide-over)
   ══════════════════════════════════════════════════════════ */
function PatientSheet({ entry, onStatusChange, onPriorityChange, estimatedWaitMin }: {
  entry: QueueEntry
  onStatusChange: (id: string, status: string) => void
  onPriorityChange: (id: string, priority: number) => void
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
    <div className="flex flex-col h-full">
      {/* Hero */}
      <div className="relative overflow-hidden shrink-0">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-600" />
        <div className="absolute -right-12 -top-12 w-40 h-40 rounded-full bg-white/[0.04]" />
        <div className="absolute right-10 bottom-0 w-20 h-20 rounded-full bg-white/[0.04]" />

        <SheetHeader className="relative px-6 pt-6 pb-5">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center font-extrabold text-2xl text-white shrink-0 ring-1 ring-white/20">
              {entry.queue_number}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <SheetTitle className="text-xl font-extrabold text-white truncate tracking-tight">
                {entry.patient_name || "Unknown"}
              </SheetTitle>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span className="text-[10px] font-bold bg-white/15 text-white/90 px-2.5 py-0.5 rounded-full">
                  {entry.status.replace(/_/g, " ").toUpperCase()}
                </span>
                {entry.walk_in && <span className="text-[10px] font-bold bg-white/10 text-white/70 px-2 py-0.5 rounded-full">Walk-in</span>}
                {entry.priority === 2 && <span className="text-[10px] font-bold bg-red-400/25 text-white px-2 py-0.5 rounded-full flex items-center gap-0.5"><Zap className="w-3 h-3" />Emergency</span>}
                {entry.priority === 1 && <span className="text-[10px] font-bold bg-amber-400/20 text-white px-2 py-0.5 rounded-full flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" />Urgent</span>}
              </div>
            </div>
          </div>
        </SheetHeader>
      </div>

      {/* Journey */}
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
        <div className="flex items-center">
          {steps.map((step, i) => {
            const isCompleted = i <= activeStep
            const isCurrent = i === activeStep
            const StepIcon = step.icon
            return (
              <div key={step.label} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center relative",
                    isCurrent ? "bg-blue-600 text-white shadow-sm shadow-blue-500/25" :
                    isCompleted ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600" :
                    "bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600"
                  )}>
                    <StepIcon className="w-3.5 h-3.5" />
                    {isCurrent && !isDone && <span className="absolute -inset-1 rounded-full border-2 border-blue-400/30 animate-[ping_2s_ease-in-out_infinite]" />}
                  </div>
                  <span className={cn(
                    "text-[8px] font-bold mt-1.5 uppercase tracking-wider",
                    isCurrent ? "text-blue-600" : isCompleted ? "text-gray-500" : "text-gray-300 dark:text-gray-600"
                  )}>{step.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className={cn("flex-1 h-[2px] mx-2 rounded-full -mt-4", i < activeStep ? "bg-blue-400" : "bg-gray-200 dark:bg-gray-700")} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* Info */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Stethoscope, label: "Doctor", value: entry.doctor_name || "Not assigned" },
            { icon: Phone, label: "Phone", value: entry.patient_phone || "N/A" },
            { icon: Calendar, label: "Check-in", value: entry.check_in_time ? formatTime(new Date(entry.check_in_time).toTimeString().slice(0, 5)) : "N/A" },
            { icon: Hash, label: "Queue", value: `#${entry.queue_number}` },
          ].map((info) => (
            <div key={info.label} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <info.icon className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{info.label}</span>
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{info.value}</p>
            </div>
          ))}
        </div>

        {/* Timer */}
        {entry.status === "waiting" && entry.check_in_time && (
          <div className="bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-950/20 dark:to-sky-950/20 rounded-2xl p-5 border border-blue-100/60 dark:border-blue-800/20 relative overflow-hidden">
            <div className="absolute top-3 right-3">
              <span className="flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-50" /><span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" /></span>
            </div>
            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-[0.15em] mb-2">Waiting Time</p>
            <div className="flex items-end justify-between">
              <ElapsedTimer startTime={entry.check_in_time} warningMinutes={20} dangerMinutes={40} className="text-4xl font-extrabold tracking-tight" />
              {estimatedWaitMin !== undefined && estimatedWaitMin > 0 && (
                <div className="text-right">
                  <p className="text-[9px] font-bold text-gray-400 uppercase">Est.</p>
                  <p className="text-xl font-extrabold text-blue-600">~{Math.round(estimatedWaitMin)}m</p>
                </div>
              )}
            </div>
          </div>
        )}

        {isActive && entry.consultation_start && (
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/20 dark:to-blue-950/20 rounded-2xl p-5 border border-indigo-100/60 dark:border-indigo-800/20 relative overflow-hidden">
            <div className="absolute top-3 right-3">
              <span className="flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-50" /><span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" /></span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-indigo-500" />
              <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-[0.15em]">Consultation</p>
            </div>
            <ElapsedTimer startTime={entry.consultation_start} warningMinutes={15} dangerMinutes={30} className="text-4xl font-extrabold tracking-tight" />
          </div>
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

      {/* Actions */}
      {!isDone && (
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 shrink-0">
          {entry.status === "waiting" && (
            <div className="flex gap-3">
              <Button
                className="flex-1 h-12 gap-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-600/20 text-sm transition-all hover:shadow-blue-600/30"
                onClick={() => onStatusChange(entry.queue_id, "in_consultation")}
              >
                <Play className="w-4 h-4" /> Start Consultation
              </Button>
              <Button
                variant="outline"
                className="h-12 w-12 rounded-2xl border-gray-200 dark:border-gray-700 text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50/50"
                onClick={() => onStatusChange(entry.queue_id, "no_show")}
              >
                <XCircle className="w-4 h-4" />
              </Button>
            </div>
          )}
          {isActive && (
            <div className="flex gap-3">
              <Button
                className="flex-1 h-12 gap-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-600/20 text-sm transition-all"
                onClick={() => onStatusChange(entry.queue_id, "completed")}
              >
                <CheckCircle2 className="w-4 h-4" /> Complete
              </Button>
              <Button
                variant="outline"
                className="h-12 w-12 rounded-2xl border-gray-200 dark:border-gray-700 text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50/50"
                onClick={() => onStatusChange(entry.queue_id, "cancelled")}
              >
                <XCircle className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
