"use client"

import { useCallback, useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useBranch } from "@/components/providers/branch-context"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { createBrowserClient } from "@/lib/supabase/client"
import { useQueue } from "@/hooks/use-queue"
import { getTodayIST, formatTime, formatDate } from "@/lib/utils/date"
import { getInitials, formatPhone, humanizeStatus } from "@/lib/utils/format"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ElapsedTimer } from "@/components/ui/elapsed-timer"
import {
  Clock,
  CheckCircle2,
  Play,
  Phone,
  AlertTriangle,
  Stethoscope,
  ArrowRight,
  CalendarDays,
  Activity,
  Coffee,
  History,
  RefreshCw,
  Users,
  Timer,
  IndianRupee,
  Zap,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { logAuditClient } from "@/lib/audit-client"
import type { SessionUser } from "@/types/auth"
import type { Appointment } from "@/types/database"

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return "Good Morning"
  if (h < 17) return "Good Afternoon"
  return "Good Evening"
}

export default function DoctorPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const user = session?.user as SessionUser | undefined
  const { activeTenantId: tenantId } = useBranch()
  const doctorId = user?.doctorId
  const today = getTodayIST()

  const { entries, isLoading, stats, mutate: refreshQueue } = useQueue(tenantId, today)
  const [upcoming, setUpcoming] = useState<Appointment[]>([])
  const [doctorStatus, setDoctorStatus] = useState<"active" | "on_break">("active")
  const [togglingBreak, setTogglingBreak] = useState(false)
  interface PastVisit { prescription_id: string; date: string; symptoms?: string; diagnosis?: string; medicines?: { name: string; dosage?: string }[]; follow_up_date?: string }
  const [patientHistory, setPatientHistory] = useState<PastVisit[]>([])
  const [historyPhone, setHistoryPhone] = useState<string | null>(null)
  const [todayEarnings, setTodayEarnings] = useState<number>(0)

  // Fetch upcoming appointments + doctor status
  useEffect(() => {
    if (!doctorId || !tenantId) return
    const supabase = createBrowserClient()
    supabase
      .from("appointments")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("doctor_id", doctorId)
      .gte("date", today)
      .in("status", ["confirmed", "pending_payment"])
      .order("date", { ascending: true })
      .order("time", { ascending: true })
      .limit(20)
      .then(({ data }) => {
        if (data) setUpcoming(data as Appointment[])
      })
    supabase
      .from("doctors")
      .select("status, consultation_fee")
      .eq("doctor_id", doctorId)
      .single()
      .then(({ data }) => {
        if (data?.status === "on_break") setDoctorStatus("on_break")
        else setDoctorStatus("active")
        if (data?.consultation_fee) {
          supabase
            .from("queue_entries")
            .select("*", { count: "exact", head: true })
            .eq("tenant_id", tenantId)
            .eq("doctor_id", doctorId)
            .eq("date", today)
            .eq("status", "completed")
            .then(({ count }) => {
              setTodayEarnings((count || 0) * (data.consultation_fee || 0))
            })
        }
      })
  }, [doctorId, tenantId, today])

  const toggleBreak = useCallback(async () => {
    if (!doctorId) return
    setTogglingBreak(true)
    const supabase = createBrowserClient()
    const newStatus = doctorStatus === "active" ? "on_break" : "active"
    const { error } = await supabase.from("doctors").update({ status: newStatus }).eq("doctor_id", doctorId).eq("tenant_id", tenantId)
    if (error) {
      toast.error("Failed to update status")
      setTogglingBreak(false)
      return
    }
    setDoctorStatus(newStatus)
    logAuditClient({
      action: "status_change", entityType: "doctor", entityId: doctorId,
      actorEmail: user?.email || "doctor", actorRole: user?.role || "DOCTOR", tenantId,
      details: { status: newStatus },
    })
    toast.success(newStatus === "on_break" ? "You are now on break" : "You are back from break")
    setTogglingBreak(false)
  }, [doctorId, doctorStatus, tenantId, user])

  // Fetch patient history for next patient
  useEffect(() => {
    const nextPhone = entries.find((e) => e.doctor_id === doctorId && e.status === "waiting")?.patient_phone
    if (!nextPhone || nextPhone === historyPhone) return
    setHistoryPhone(nextPhone)
    const supabase = createBrowserClient()
    supabase
      .from("prescriptions")
      .select("prescription_id, date, symptoms, diagnosis, medicines, follow_up_date")
      .eq("patient_phone", nextPhone)
      .eq("tenant_id", tenantId)
      .order("date", { ascending: false })
      .limit(3)
      .then(({ data }) => {
        if (data) setPatientHistory(data as PastVisit[])
        else setPatientHistory([])
      })
  }, [entries, doctorId, historyPhone])

  const myEntries = entries.filter((e) => e.doctor_id === doctorId)
  const waiting = myEntries.filter((e) => e.status === "waiting")
  const inConsultation = myEntries.filter((e) => e.status === "in_consultation")
  const completed = myEntries.filter((e) => e.status === "completed")
  const nextPatient = waiting[0]

  const handleStartConsultation = useCallback(
    async (queueId: string, patientPhone: string) => {
      const supabase = createBrowserClient()
      await supabase
        .from("queue_entries")
        .update({ status: "in_consultation", consultation_start: new Date().toISOString() })
        .eq("queue_id", queueId)
        .eq("tenant_id", tenantId)
        .eq("doctor_id", doctorId)
      logAuditClient({
        action: "status_change", entityType: "queue_entry", entityId: queueId,
        actorEmail: user?.email || "doctor", actorRole: user?.role || "DOCTOR", tenantId,
        details: { status: "in_consultation", patient_phone: patientPhone },
      })
      toast.success("Consultation started")
      router.push(`/doctor/consult?patient=${patientPhone}&queue=${queueId}`)
    },
    [router, tenantId, doctorId, user]
  )

  const handleComplete = useCallback(async (queueId: string) => {
    const supabase = createBrowserClient()
    const now = new Date().toISOString()

    await supabase
      .from("queue_entries")
      .update({ status: "completed", consultation_end: now })
      .eq("queue_id", queueId)
      .eq("tenant_id", tenantId)
      .eq("doctor_id", doctorId)

    const { data: queueEntry } = await supabase
      .from("queue_entries")
      .select("booking_id")
      .eq("queue_id", queueId)
      .eq("tenant_id", tenantId)
      .single()

    if (queueEntry?.booking_id) {
      await supabase
        .from("appointments")
        .update({ status: "completed", check_in_status: "completed" })
        .eq("booking_id", queueEntry.booking_id)
        .eq("tenant_id", tenantId)
    }

    logAuditClient({
      action: "status_change", entityType: "queue_entry", entityId: queueId,
      actorEmail: user?.email || "doctor", actorRole: user?.role || "DOCTOR", tenantId,
      details: { status: "completed" },
    })
    toast.success("Consultation completed")
  }, [tenantId, doctorId, user])

  // Compute avg consult time
  const consultDurations = completed
    .filter((e) => e.consultation_start && e.consultation_end)
    .map((e) => (new Date(e.consultation_end!).getTime() - new Date(e.consultation_start!).getTime()) / 60000)
    .filter((d) => d > 0 && d <= 120)
  const avgConsult = consultDurations.length > 0
    ? Math.round(consultDurations.reduce((a, b) => a + b, 0) / consultDurations.length)
    : 0

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <div className="flex gap-3 flex-wrap">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-28 rounded-full" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
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
            {getGreeting()}, Dr. {user?.name?.replace("Dr. ", "")}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", doctorStatus === "on_break" ? "bg-amber-400" : "bg-cyan-400")} />
              <span className={cn("relative inline-flex rounded-full h-2 w-2", doctorStatus === "on_break" ? "bg-amber-500" : "bg-cyan-600")} />
            </span>
            {user?.specialty} &middot; {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
          </p>
        </motion.div>
        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            variant={doctorStatus === "on_break" ? "default" : "outline"}
            onClick={toggleBreak}
            disabled={togglingBreak}
            className={cn(
              "h-10 gap-2 rounded-xl font-semibold transition-all",
              doctorStatus === "on_break"
                ? "bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20"
                : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            )}
          >
            <Coffee className="w-4 h-4" />
            {doctorStatus === "on_break" ? "Resume Queue" : "Take Break"}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refreshQueue()}
            className="h-10 w-10 rounded-xl text-gray-400 hover:text-gray-600"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* ══════ BREAK BANNER ══════ */}
      {doctorStatus === "on_break" && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
              <Coffee className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-800 dark:text-amber-200">On Break</p>
              <p className="text-[11px] text-amber-600 dark:text-amber-400">Queue is paused. Patients see &quot;Doctor on break&quot;.</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* ══════ INLINE STATS BAR ══════ */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="flex items-center gap-3 flex-wrap">
        {[
          { label: "Patients", val: myEntries.length, icon: Users, accent: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-400" },
          { label: "Waiting", val: waiting.length, icon: Clock, accent: "bg-sky-100 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400" },
          { label: "Consult", val: inConsultation.length, icon: Stethoscope, accent: "bg-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400" },
          { label: "Done", val: completed.length, icon: CheckCircle2, accent: "bg-green-100 text-green-600 dark:bg-green-950/40 dark:text-green-400" },
          { label: "Avg Time", val: avgConsult, icon: Timer, accent: "bg-purple-100 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400", suffix: "m" },
          { label: "Earnings", val: todayEarnings, icon: IndianRupee, accent: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400", prefix: "\u20B9" },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-2 bg-white dark:bg-gray-900 rounded-full pl-1.5 pr-3.5 py-1.5 border border-gray-100 dark:border-gray-800 shadow-sm">
            <div className={cn("w-7 h-7 rounded-full flex items-center justify-center", s.accent)}>
              <s.icon className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-extrabold text-gray-900 dark:text-white tabular-nums">
                {s.val > 0 ? `${s.prefix || ""}${s.val}${s.suffix || ""}` : "\u2014"}
              </span>
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{s.label}</span>
            </div>
          </div>
        ))}
      </motion.div>

      {/* ══════ NEXT PATIENT HERO ══════ */}
      {nextPatient && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="relative bg-gradient-to-br from-cyan-700 via-cyan-700 to-indigo-600 rounded-2xl overflow-hidden shadow-lg shadow-cyan-700/20"
        >
          <div className="absolute -right-12 -top-12 w-40 h-40 rounded-full bg-white/[0.04]" />
          <div className="absolute right-10 bottom-0 w-20 h-20 rounded-full bg-white/[0.04]" />
          <div className="relative p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-white text-xl font-extrabold ring-1 ring-white/20">
                {nextPatient.queue_number}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-lg font-extrabold text-white">{nextPatient.patient_name}</p>
                  {nextPatient.priority === 2 && (
                    <span className="text-[10px] font-bold bg-red-400/25 text-white px-2 py-0.5 rounded-full flex items-center gap-0.5"><Zap className="w-3 h-3" />Emergency</span>
                  )}
                  {nextPatient.priority === 1 && (
                    <span className="text-[10px] font-bold bg-amber-400/20 text-white px-2 py-0.5 rounded-full flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" />Urgent</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-white/70 text-sm mt-1">
                  <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{formatPhone(nextPatient.patient_phone)}</span>
                  {nextPatient.check_in_time && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <ElapsedTimer startTime={nextPatient.check_in_time} className="text-white/70" />
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="text-[10px] font-bold bg-white/15 text-white/90 px-2.5 py-0.5 rounded-full">NEXT IN LINE</span>
                  {nextPatient.walk_in && <span className="text-[10px] font-bold bg-white/10 text-white/70 px-2 py-0.5 rounded-full">Walk-in</span>}
                </div>
              </div>
            </div>
            <Button
              size="lg"
              onClick={() => handleStartConsultation(nextPatient.queue_id, nextPatient.patient_phone || "")}
              className="gap-2 text-sm px-6 bg-white text-cyan-700 hover:bg-white/90 font-bold rounded-xl shadow-lg shrink-0"
            >
              <Play className="w-4 h-4" /> Start Consultation
            </Button>
          </div>
        </motion.div>
      )}

      {/* ══════ PATIENT HISTORY ══════ */}
      {nextPatient && patientHistory.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-950/30 flex items-center justify-center">
              <History className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-[13px] font-bold text-gray-700 dark:text-gray-200">Recent Visits &mdash; {nextPatient.patient_name}</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {patientHistory.map((visit) => (
              <div key={visit.prescription_id} className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3 space-y-1.5">
                <p className="text-[11px] font-bold text-cyan-700">{formatDate(visit.date)}</p>
                {visit.symptoms && (
                  <p className="text-[11px] text-gray-500"><span className="font-semibold text-gray-700 dark:text-gray-300">Symptoms:</span> {visit.symptoms.length > 60 ? visit.symptoms.slice(0, 60) + "..." : visit.symptoms}</p>
                )}
                {visit.diagnosis && (
                  <p className="text-[11px] text-gray-600 dark:text-gray-300"><span className="font-semibold">Dx:</span> {visit.diagnosis.length > 60 ? visit.diagnosis.slice(0, 60) + "..." : visit.diagnosis}</p>
                )}
                {visit.medicines && visit.medicines.length > 0 && (
                  <p className="text-[11px] text-gray-500">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">Rx:</span> {visit.medicines.slice(0, 3).map((m) => m.name).join(", ")}
                    {visit.medicines.length > 3 && ` +${visit.medicines.length - 3}`}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════ 3-COLUMN BOARD ══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5 min-h-[420px]">
        {/* ── ACTIVE CONSULTATIONS ── */}
        <div className="flex flex-col bg-[#F7F8FA] dark:bg-gray-900/60 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800/60">
          <div className="flex items-center justify-between px-4 py-3 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              <span className="text-[13px] font-bold text-gray-700 dark:text-gray-200">In Consultation</span>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums bg-indigo-50 dark:bg-indigo-950/20 text-gray-600 dark:text-gray-300">
              {inConsultation.length}
            </span>
          </div>
          <ScrollArea className="flex-1 max-h-[520px]">
            <div className="px-2.5 pt-2.5 pb-2.5 space-y-2.5">
              {inConsultation.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/20 flex items-center justify-center mb-3">
                    <Stethoscope className="w-5 h-5 text-gray-400" />
                  </div>
                  <p className="text-xs font-medium text-gray-400">No active consultations</p>
                </div>
              ) : inConsultation.map((entry, i) => (
                <motion.div
                  key={entry.queue_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="group relative bg-white dark:bg-gray-900 rounded-xl shadow-sm hover:shadow-md transition-all border border-transparent hover:border-indigo-200 dark:hover:border-indigo-800/40"
                >
                  <div className="absolute top-3.5 right-3.5">
                    <span className="flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-60" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
                    </span>
                  </div>
                  <div className="p-3.5">
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-extrabold text-sm shrink-0 shadow-sm shadow-indigo-500/20">
                        {getInitials(entry.patient_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{entry.patient_name}</p>
                        <p className="text-[11px] text-gray-400 truncate mt-0.5">{formatPhone(entry.patient_phone)}</p>
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
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => router.push(`/doctor/consult?patient=${entry.patient_phone}&queue=${entry.queue_id}`)}
                          className="h-7 px-3 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50 flex items-center gap-1 transition-all"
                        >
                          <ArrowRight className="w-3 h-3" /> Continue
                        </button>
                        <button
                          onClick={() => handleComplete(entry.queue_id)}
                          className="h-7 px-3 rounded-lg text-[11px] font-bold bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-950/30 dark:hover:bg-green-950/50 flex items-center gap-1 transition-all"
                        >
                          <CheckCircle2 className="w-3 h-3" /> Done
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* ── WAITING QUEUE ── */}
        <div className="flex flex-col bg-[#F7F8FA] dark:bg-gray-900/60 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800/60">
          <div className="flex items-center justify-between px-4 py-3 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-sky-400" />
              <span className="text-[13px] font-bold text-gray-700 dark:text-gray-200">Waiting</span>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums bg-sky-50 dark:bg-sky-950/20 text-gray-600 dark:text-gray-300">
              {waiting.length}
            </span>
          </div>
          <ScrollArea className="flex-1 max-h-[520px]">
            <div className="px-2.5 pt-2.5 pb-2.5 space-y-2.5">
              {waiting.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950/20 flex items-center justify-center mb-3">
                    <Clock className="w-5 h-5 text-gray-400" />
                  </div>
                  <p className="text-xs font-medium text-gray-400">
                    {doctorStatus === "on_break" ? "Queue paused" : "No patients waiting"}
                  </p>
                </div>
              ) : waiting.map((entry, i) => (
                <motion.div
                  key={entry.queue_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={cn(
                    "group relative bg-white dark:bg-gray-900 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer",
                    "border border-transparent hover:border-cyan-200 dark:hover:border-cyan-800/40",
                    i === 0 && "ring-2 ring-cyan-600/20 border-cyan-100 dark:border-cyan-800/30",
                    entry.priority === 2 && "ring-2 ring-red-500/20 border-red-100 dark:border-red-800/30",
                    entry.priority === 1 && "ring-2 ring-amber-500/20 border-amber-100 dark:border-amber-800/30",
                  )}
                >
                  {i === 0 && <div className="absolute -top-px left-4 right-4 h-[2px] bg-gradient-to-r from-cyan-600 to-indigo-500 rounded-b-full" />}
                  <div className="p-3.5">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "w-11 h-11 rounded-xl flex items-center justify-center font-extrabold text-sm shrink-0",
                        entry.priority === 2 ? "bg-red-500 text-white shadow-sm shadow-red-500/20" :
                        entry.priority === 1 ? "bg-amber-500 text-white shadow-sm shadow-amber-500/20" :
                        i === 0 ? "bg-cyan-700 text-white shadow-sm shadow-cyan-700/20" :
                        "bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700"
                      )}>
                        {entry.queue_number}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{entry.patient_name}</p>
                          {entry.priority === 2 && <Zap className="w-3 h-3 text-red-500 shrink-0" />}
                          {entry.priority === 1 && <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />}
                        </div>
                        <p className="text-[11px] text-gray-400 truncate mt-0.5">{formatPhone(entry.patient_phone)}{entry.walk_in ? " \u00b7 Walk-in" : ""}</p>
                      </div>
                    </div>
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
                        onClick={() => handleStartConsultation(entry.queue_id, entry.patient_phone || "")}
                        className={cn(
                          "h-7 px-3 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all",
                          i === 0
                            ? "bg-cyan-700 text-white shadow-sm shadow-cyan-700/20 hover:bg-cyan-800"
                            : "bg-cyan-50 text-cyan-700 hover:bg-cyan-100 dark:bg-cyan-950/30 dark:hover:bg-cyan-950/50"
                        )}
                      >
                        <Play className="w-3 h-3" />
                        {i === 0 ? "Call In" : "Start"}
                      </button>
                    </div>
                  </div>
                  {i === 0 && (
                    <div className="absolute -top-2 right-3">
                      <span className="text-[9px] font-bold bg-cyan-700 text-white px-2 py-0.5 rounded-full shadow-sm flex items-center gap-0.5">
                        <Sparkles className="w-2.5 h-2.5" /> NEXT
                      </span>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* ── UPCOMING APPOINTMENTS ── */}
        <div className="flex flex-col bg-[#F7F8FA] dark:bg-gray-900/60 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800/60">
          <div className="flex items-center justify-between px-4 py-3 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
              <span className="text-[13px] font-bold text-gray-700 dark:text-gray-200">Upcoming</span>
            </div>
            <button onClick={() => router.push("/doctor/patients")} className="text-[11px] font-bold text-cyan-700 hover:text-cyan-800 flex items-center gap-0.5">
              View All <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <ScrollArea className="flex-1 max-h-[520px]">
            <div className="px-2.5 pt-2.5 pb-2.5 space-y-2.5">
              {upcoming.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-50 dark:bg-cyan-950/20 flex items-center justify-center mb-3">
                    <CalendarDays className="w-5 h-5 text-gray-400" />
                  </div>
                  <p className="text-xs font-medium text-gray-400">No upcoming appointments</p>
                </div>
              ) : upcoming.slice(0, 10).map((apt, i) => (
                <motion.div
                  key={apt.booking_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="bg-white dark:bg-gray-900 rounded-xl shadow-sm hover:shadow-md transition-all border border-transparent hover:border-cyan-200 dark:hover:border-cyan-800/40"
                >
                  <div className="p-3.5 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/30 flex items-center justify-center text-cyan-700 font-bold text-sm shrink-0">
                      {getInitials(apt.patient_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{apt.patient_name}</p>
                      <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5">
                        <span>{apt.date === today ? "Today" : formatDate(apt.date)}</span>
                        <span>&middot;</span>
                        <span>{formatTime(apt.time)}</span>
                      </div>
                    </div>
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0",
                      apt.status === "confirmed"
                        ? "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-400"
                        : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                    )}>
                      {humanizeStatus(apt.status)}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* ══════ COMPLETED ══════ */}
      {completed.length > 0 && (
        <div className="bg-[#F7F8FA] dark:bg-gray-900/60 rounded-2xl border border-gray-100 dark:border-gray-800/60 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
            <span className="text-[13px] font-bold text-gray-700 dark:text-gray-200">Completed Today</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums bg-green-50 dark:bg-green-950/20 text-gray-600 dark:text-gray-300 ml-auto">
              {completed.length}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {completed.slice(0, 6).map((entry) => (
              <div key={entry.queue_id} className="bg-white dark:bg-gray-900 rounded-xl p-3 flex items-center gap-3 border border-transparent opacity-70 hover:opacity-100 transition-all">
                <div className="w-9 h-9 rounded-xl bg-green-50 dark:bg-green-950/30 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 truncate">{entry.patient_name}</p>
                  <p className="text-[11px] text-gray-400 truncate">{formatPhone(entry.patient_phone)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
