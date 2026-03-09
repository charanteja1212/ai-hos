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
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ElapsedTimer } from "@/components/ui/elapsed-timer"
import { EmptyState } from "@/components/shared/empty-state"
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
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { SessionUser } from "@/types/auth"
import type { Appointment } from "@/types/database"

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
          // Count completed patients to estimate earnings
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
    toast.success(newStatus === "on_break" ? "You are now on break" : "You are back from break")
    setTogglingBreak(false)
  }, [doctorId, doctorStatus, tenantId])

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
      toast.success("Consultation started")
      router.push(`/doctor/consult?patient=${patientPhone}&queue=${queueId}`)
    },
    [router, tenantId, doctorId]
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

    toast.success("Consultation completed")
  }, [tenantId, doctorId])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-14 rounded-2xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="glass rounded-2xl p-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Welcome, Dr. {user?.name?.replace("Dr. ", "")}
          </h1>
          <p className="text-sm text-muted-foreground">{user?.specialty} &mdash; {today}</p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant={doctorStatus === "on_break" ? "default" : "outline"}
            size="sm"
            onClick={toggleBreak}
            disabled={togglingBreak}
            className={cn(
              "gap-2",
              doctorStatus === "on_break" && "bg-amber-500 hover:bg-amber-600 text-white"
            )}
          >
            <Coffee className="w-4 h-4" />
            {doctorStatus === "on_break" ? "Resume" : "Take Break"}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refreshQueue()}
            className="rounded-xl text-muted-foreground hover:text-foreground"
            title="Refresh queue"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <div className="text-right hidden sm:block">
            <p className="text-2xl font-bold text-foreground">{myEntries.length}</p>
            <p className="text-xs text-muted-foreground">patients today</p>
          </div>
          <div className="w-12 h-12 rounded-2xl gradient-blue-premium flex items-center justify-center">
            <Activity className="w-6 h-6 text-white" />
          </div>
        </div>
      </div>

      {/* Break Mode Banner */}
      {doctorStatus === "on_break" && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Coffee className="w-5 h-5 text-amber-600" />
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-200">On Break</p>
              <p className="text-xs text-amber-600 dark:text-amber-400">Queue is paused. Patients see &quot;Doctor on break&quot; on the display.</p>
            </div>
          </div>
          <Button size="sm" onClick={toggleBreak} disabled={togglingBreak}>
            Resume Queue
          </Button>
        </div>
      )}

      {/* Compact Stat Strip */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {(() => {
          const consultDurations = completed
            .filter((e) => e.consultation_start && e.consultation_end)
            .map((e) => (new Date(e.consultation_end!).getTime() - new Date(e.consultation_start!).getTime()) / 60000)
            .filter((d) => d > 0 && d <= 120)
          const avgConsult = consultDurations.length > 0
            ? Math.round(consultDurations.reduce((a, b) => a + b, 0) / consultDurations.length)
            : 0
          return [
            { label: "Total", value: myEntries.length, color: "text-primary", bg: "bg-primary/10" },
            { label: "Waiting", value: waiting.length, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
            { label: "Active", value: inConsultation.length, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10" },
            { label: "Done", value: completed.length, color: "text-green-600 dark:text-green-400", bg: "bg-green-500/10" },
            { label: "Avg Time", value: avgConsult > 0 ? `${avgConsult}m` : "\u2014", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/10" },
            { label: "Earnings", value: todayEarnings > 0 ? `\u20B9${todayEarnings}` : "\u2014", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
          ]
        })().map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={cn("rounded-xl p-3 flex items-center gap-3", stat.bg)}
          >
            <motion.span
              key={stat.value}
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
              className={cn("text-2xl font-bold", stat.color)}
            >
              {stat.value}
            </motion.span>
            <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
          </motion.div>
        ))}
      </div>

      {/* Next Patient Hero Card */}
      {nextPatient && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          <div className="gradient-border">
            <Card className="bg-card border-0">
              <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl gradient-blue-premium flex items-center justify-center text-white text-2xl font-bold shrink-0 glow-blue">
                    {getInitials(nextPatient.patient_name)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xl font-bold">{nextPatient.patient_name}</p>
                      {nextPatient.priority > 0 && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {nextPatient.priority === 2 ? "Emergency" : "Urgent"}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                      <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{formatPhone(nextPatient.patient_phone)}</span>
                      {nextPatient.check_in_time && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Waiting: <ElapsedTimer startTime={nextPatient.check_in_time} />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Queue #{nextPatient.queue_number} &mdash; Next in line</p>
                  </div>
                </div>
                <Button
                  size="lg"
                  onClick={() => handleStartConsultation(nextPatient.queue_id, nextPatient.patient_phone || "")}
                  className="gap-2 text-base px-8 gradient-blue hover:opacity-90 transition-opacity shrink-0"
                >
                  <Play className="w-5 h-5" /> Start Consultation
                </Button>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      )}

      {/* Patient History Preview */}
      {nextPatient && patientHistory.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <History className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold">Recent Visits — {nextPatient.patient_name}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {patientHistory.map((visit) => (
                <div key={visit.prescription_id} className="rounded-lg bg-muted/50 p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-primary">{formatDate(visit.date)}</p>
                  {visit.symptoms && (
                    <p className="text-xs text-muted-foreground"><span className="font-medium">Symptoms:</span> {visit.symptoms.length > 60 ? visit.symptoms.slice(0, 60) + "..." : visit.symptoms}</p>
                  )}
                  {visit.diagnosis && (
                    <p className="text-xs"><span className="font-medium">Diagnosis:</span> {visit.diagnosis.length > 60 ? visit.diagnosis.slice(0, 60) + "..." : visit.diagnosis}</p>
                  )}
                  {visit.medicines && visit.medicines.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">Medicines:</span> {visit.medicines.slice(0, 3).map((m) => m.name).join(", ")}
                      {visit.medicines.length > 3 && ` +${visit.medicines.length - 3} more`}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Two-column: Active + Queue | Upcoming */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6">
        {/* Left: Active + Waiting */}
        <div className="space-y-6">
          {/* Active Consultations */}
          {inConsultation.length > 0 && (
            <div>
              <h2 className="font-semibold mb-3 flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                Active Consultations
              </h2>
              <div className="space-y-2">
                {inConsultation.map((entry) => (
                  <motion.div key={entry.queue_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <Card className="card-hover animate-pulse-glow">
                      <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-10 h-10 rounded-xl gradient-blue flex items-center justify-center text-white font-bold shrink-0">
                            {getInitials(entry.patient_name)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{entry.patient_name}</p>
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-muted-foreground truncate">{formatPhone(entry.patient_phone)}</p>
                              {entry.consultation_start && (
                                <ElapsedTimer startTime={entry.consultation_start} />
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button variant="outline" size="sm" onClick={() => router.push(`/doctor/consult?patient=${entry.patient_phone}&queue=${entry.queue_id}`)}>
                            <ArrowRight className="w-4 h-4 mr-1" />Continue
                          </Button>
                          <Button size="sm" onClick={() => handleComplete(entry.queue_id)}>
                            <CheckCircle2 className="w-4 h-4 mr-1" />Complete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Waiting Queue */}
          <div>
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              Waiting Queue ({waiting.length})
            </h2>
            {waiting.length === 0 ? (
              <EmptyState
                icon={<Stethoscope className="w-10 h-10" />}
                title="No patients waiting"
                description={doctorStatus === "on_break" ? "Queue is paused while you are on break" : "Your queue is clear. Patients will appear here when checked in."}
              />
            ) : (
              <div className="space-y-2">
                {waiting.map((entry, idx) => (
                  <motion.div key={entry.queue_id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
                    {idx === 0 ? (
                      /* First patient — more prominent but smaller than hero */
                      <Card className={cn("card-hover ring-2 ring-primary/20", entry.priority > 0 && "border-l-4 border-l-destructive")}>
                        <CardContent className="p-4 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0">{entry.queue_number}</div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="font-medium text-sm truncate">{entry.patient_name}</p>
                                {entry.walk_in && <Badge variant="outline" className="text-[10px] shrink-0">Walk-in</Badge>}
                                {entry.priority > 0 && <Badge variant="destructive" className="text-[10px] shrink-0">{entry.priority === 2 ? "Emergency" : "Urgent"}</Badge>}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">{formatPhone(entry.patient_phone)}</p>
                            </div>
                          </div>
                          <Button size="sm" className="shrink-0" onClick={() => handleStartConsultation(entry.queue_id, entry.patient_phone || "")}>
                            <Play className="w-4 h-4 mr-1" />Start
                          </Button>
                        </CardContent>
                      </Card>
                    ) : (
                      /* Rest — compact rows */
                      <div className={cn(
                        "flex items-center gap-3 px-4 py-2.5 rounded-xl bg-card border border-border hover:bg-accent/30 transition-colors",
                        entry.priority > 0 && "border-l-4 border-l-destructive"
                      )}>
                        <span className="text-sm font-bold text-muted-foreground w-6 text-center">{entry.queue_number}</span>
                        <span className="text-sm font-medium flex-1 truncate">{entry.patient_name}</span>
                        <span className="text-xs text-muted-foreground">{formatPhone(entry.patient_phone)}</span>
                        {entry.walk_in && <Badge variant="outline" className="text-[10px]">Walk-in</Badge>}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Upcoming Appointments */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              Upcoming ({upcoming.length})
            </h2>
            <Button variant="ghost" size="sm" onClick={() => router.push("/doctor/patients")} className="text-xs text-primary">
              View All <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
          {upcoming.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="w-10 h-10" />}
              title="No upcoming appointments"
              description="Appointments will appear here"
            />
          ) : (
            <div className="space-y-2">
              {upcoming.slice(0, 8).map((apt, idx) => (
                <motion.div key={apt.booking_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
                  <Card className="card-hover">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                        {getInitials(apt.patient_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{apt.patient_name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{apt.date === today ? "Today" : formatDate(apt.date)}</span>
                          <span>&middot;</span>
                          <span>{formatTime(apt.time)}</span>
                        </div>
                      </div>
                      <Badge
                        variant={apt.status === "confirmed" ? "default" : "outline"}
                        className="text-[10px] shrink-0"
                      >
                        {humanizeStatus(apt.status)}
                      </Badge>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
