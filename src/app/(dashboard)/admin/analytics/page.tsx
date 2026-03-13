"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useBranch } from "@/components/providers/branch-context"
import { motion } from "framer-motion"
import { createBrowserClient } from "@/lib/supabase/client"
import { getTodayIST } from "@/lib/utils/date"
import { formatCurrency } from "@/lib/utils/format"
import { SectionHeader } from "@/components/shared/section-header"
import { StatCard } from "@/components/reception/stat-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  LazyLineChart as LineChart,
  LazyBarChart as BarChart,
  LazyPieChart as PieChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Pie,
  Cell,
} from "@/components/ui/lazy-recharts"
import dynamic from "next/dynamic"
const Legend = dynamic(() => import("recharts").then((mod) => mod.Legend), { ssr: false })
import {
  BarChart3,
  Stethoscope,
  Users,
  IndianRupee,
  TrendingUp,
  Clock,
  Activity,
  TestTube,
  Pill,
  Loader2,
  UserCheck,
  UserPlus,
  Calendar,
  Target,
} from "lucide-react"
import { cn } from "@/lib/utils"

const COLORS = ["#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed", "#06b6d4", "#ec4899", "#84cc16"]
const GENDER_COLORS: Record<string, string> = { Male: "#3b82f6", Female: "#ec4899", Other: "#8b5cf6", Unknown: "#94a3b8" }

function getDateRange(preset: string) {
  const today = getTodayIST()
  const d = new Date(today)
  let from = today
  if (preset === "7d") { d.setDate(d.getDate() - 6); from = d.toISOString().split("T")[0] }
  else if (preset === "30d") { d.setDate(d.getDate() - 29); from = d.toISOString().split("T")[0] }
  else if (preset === "90d") { d.setDate(d.getDate() - 89); from = d.toISOString().split("T")[0] }
  return { from, to: today }
}

export default function AnalyticsPage() {
  const { activeTenantId: tenantId } = useBranch()
  const [datePreset, setDatePreset] = useState("30d")
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("doctors")

  // Raw data
  const [appointments, setAppointments] = useState<Record<string, unknown>[]>([])
  const [patients, setPatients] = useState<Record<string, unknown>[]>([])
  const [invoices, setInvoices] = useState<Record<string, unknown>[]>([])
  const [queueEntries, setQueueEntries] = useState<Record<string, unknown>[]>([])
  const [labOrders, setLabOrders] = useState<Record<string, unknown>[]>([])
  const [pharmOrders, setPharmOrders] = useState<Record<string, unknown>[]>([])

  const { from, to } = useMemo(() => getDateRange(datePreset), [datePreset])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createBrowserClient()

    const [apptRes, patRes, invRes, queueRes, labRes, pharmRes] = await Promise.all([
      supabase.from("appointments").select("*").eq("tenant_id", tenantId)
        .gte("date", from).lte("date", to).order("date"),
      supabase.from("patients").select("name, phone, age, gender, created_at").eq("tenant_id", tenantId),
      supabase.from("invoices").select("*").eq("tenant_id", tenantId)
        .gte("created_at", from + "T00:00:00").lte("created_at", to + "T23:59:59"),
      supabase.from("queue_entries").select("*").eq("tenant_id", tenantId)
        .gte("date", from).lte("date", to),
      supabase.from("lab_orders").select("order_id, status, tests, created_at, results_uploaded_at, total_amount")
        .eq("tenant_id", tenantId).gte("created_at", from + "T00:00:00").lte("created_at", to + "T23:59:59"),
      supabase.from("pharmacy_orders").select("order_id, status, items, total_amount, created_at, dispensed_at")
        .eq("tenant_id", tenantId).gte("created_at", from + "T00:00:00").lte("created_at", to + "T23:59:59"),
    ])

    setAppointments((apptRes.data || []) as Record<string, unknown>[])
    setPatients((patRes.data || []) as Record<string, unknown>[])
    setInvoices((invRes.data || []) as Record<string, unknown>[])
    setQueueEntries((queueRes.data || []) as Record<string, unknown>[])
    setLabOrders((labRes.data || []) as Record<string, unknown>[])
    setPharmOrders((pharmRes.data || []) as Record<string, unknown>[])
    setLoading(false)
  }, [tenantId, from, to])

  useEffect(() => { if (tenantId) fetchData() }, [fetchData, tenantId])

  // ─── Top-level KPIs ──────────────────────────────────────────────────────────
  const totalAppointments = appointments.length
  const completedAppts = appointments.filter(a => a.status === "completed").length
  const cancelledAppts = appointments.filter(a => a.status === "cancelled").length
  const noShowAppts = appointments.filter(a => a.status === "no_show").length
  const completionRate = totalAppointments > 0 ? Math.round((completedAppts / totalAppointments) * 100) : 0
  const noShowRate = totalAppointments > 0 ? Math.round((noShowAppts / totalAppointments) * 100) : 0
  const totalRevenue = invoices.filter(i => i.payment_status === "paid").reduce((s, i) => s + (Number(i.total) || 0), 0)
  const avgRevenuePerAppt = completedAppts > 0 ? Math.round(totalRevenue / completedAppts) : 0

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        variant="glass"
        icon={<BarChart3 className="w-6 h-6" />}
        gradient="gradient-purple"
        title="Advanced Analytics"
        subtitle={`${from} to ${to} — ${totalAppointments} appointments`}
        action={
          <Select value={datePreset} onValueChange={setDatePreset}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {/* Top KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Completion Rate" value={`${completionRate}%`} icon={<Target className="w-4 h-4" />} gradient="gradient-blue" subtitle={`${completedAppts}/${totalAppointments} appointments`} />
        <StatCard label="No-Show Rate" value={`${noShowRate}%`} icon={<UserCheck className="w-4 h-4" />} gradient="gradient-orange" subtitle={`${noShowAppts} no-shows`} />
        <StatCard label="Total Revenue" value={formatCurrency(totalRevenue)} icon={<IndianRupee className="w-4 h-4" />} gradient="gradient-green" subtitle="Paid invoices" />
        <StatCard label="Revenue/Appointment" value={formatCurrency(avgRevenuePerAppt)} icon={<TrendingUp className="w-4 h-4" />} gradient="gradient-purple" subtitle="Avg per completed visit" />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="doctors" className="gap-1.5"><Stethoscope className="w-3.5 h-3.5 hidden sm:block" /> Doctors</TabsTrigger>
          <TabsTrigger value="patients" className="gap-1.5"><Users className="w-3.5 h-3.5 hidden sm:block" /> Patients</TabsTrigger>
          <TabsTrigger value="operations" className="gap-1.5"><Activity className="w-3.5 h-3.5 hidden sm:block" /> Operations</TabsTrigger>
          <TabsTrigger value="financial" className="gap-1.5"><IndianRupee className="w-3.5 h-3.5 hidden sm:block" /> Financial</TabsTrigger>
          <TabsTrigger value="clinical" className="gap-1.5"><TestTube className="w-3.5 h-3.5 hidden sm:block" /> Clinical</TabsTrigger>
        </TabsList>

        {/* Doctor Performance */}
        <TabsContent value="doctors" className="space-y-4 mt-4">
          <DoctorPerformanceTab appointments={appointments} invoices={invoices} queueEntries={queueEntries} />
        </TabsContent>

        {/* Patient Demographics */}
        <TabsContent value="patients" className="space-y-4 mt-4">
          <PatientDemographicsTab patients={patients} appointments={appointments} from={from} />
        </TabsContent>

        {/* Operational Metrics */}
        <TabsContent value="operations" className="space-y-4 mt-4">
          <OperationsTab appointments={appointments} queueEntries={queueEntries} />
        </TabsContent>

        {/* Financial Deep Dive */}
        <TabsContent value="financial" className="space-y-4 mt-4">
          <FinancialTab invoices={invoices} appointments={appointments} />
        </TabsContent>

        {/* Lab & Pharmacy */}
        <TabsContent value="clinical" className="space-y-4 mt-4">
          <ClinicalTab labOrders={labOrders} pharmOrders={pharmOrders} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─── DOCTOR PERFORMANCE TAB ─────────────────────────────────────────────────────

function DoctorPerformanceTab({ appointments, invoices, queueEntries }: {
  appointments: Record<string, unknown>[]
  invoices: Record<string, unknown>[]
  queueEntries: Record<string, unknown>[]
}) {
  // Group by doctor
  const doctorMap = useMemo(() => {
    const map: Record<string, {
      name: string; specialty: string; total: number; completed: number; cancelled: number; noShow: number; revenue: number
      avgConsultMin: number; consultCount: number
    }> = {}

    for (const a of appointments) {
      const id = String(a.doctor_id || "unknown")
      if (!map[id]) map[id] = { name: String(a.doctor_name || "Unknown"), specialty: String(a.specialty || ""), total: 0, completed: 0, cancelled: 0, noShow: 0, revenue: 0, avgConsultMin: 0, consultCount: 0 }
      map[id].total++
      if (a.status === "completed") map[id].completed++
      if (a.status === "cancelled") map[id].cancelled++
      if (a.status === "no_show") map[id].noShow++
    }

    // Revenue per doctor (from consultation invoices)
    for (const inv of invoices) {
      if (inv.type !== "consultation" || inv.payment_status !== "paid") continue
      const items = Array.isArray(inv.items) ? inv.items : []
      for (const item of items) {
        const desc = String((item as Record<string, unknown>).description || "")
        const drMatch = desc.match(/Dr\.\s*(.+)/)
        if (drMatch) {
          const drEntry = Object.values(map).find(d => d.name.includes(drMatch[1].trim()))
          if (drEntry) drEntry.revenue += Number(inv.total) || 0
        }
      }
    }

    // Avg consultation time from queue
    for (const q of queueEntries) {
      if (!q.consultation_start || !q.consultation_end) continue
      const start = new Date(String(q.consultation_start)).getTime()
      const end = new Date(String(q.consultation_end)).getTime()
      const minutes = (end - start) / 60000
      if (minutes > 0 && minutes < 180) {
        const drId = String(q.doctor_id || "unknown")
        if (map[drId]) {
          map[drId].avgConsultMin = ((map[drId].avgConsultMin * map[drId].consultCount) + minutes) / (map[drId].consultCount + 1)
          map[drId].consultCount++
        }
      }
    }

    return map
  }, [appointments, invoices, queueEntries])

  const doctors = Object.entries(doctorMap).sort((a, b) => b[1].total - a[1].total)

  // Bar chart data
  const chartData = doctors.slice(0, 10).map(([, d]) => ({
    name: d.name.replace("Dr. ", ""),
    Completed: d.completed,
    Cancelled: d.cancelled,
    "No Show": d.noShow,
  }))

  return (
    <>
      {/* Doctor comparison chart */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Appointment Outcomes by Doctor</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <RechartsTooltip />
              <Legend />
              <Bar dataKey="Completed" fill="#059669" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Cancelled" fill="#dc2626" radius={[4, 4, 0, 0]} />
              <Bar dataKey="No Show" fill="#d97706" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Doctor detail cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {doctors.map(([id, d]) => {
          const rate = d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0
          return (
            <motion.div key={id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="card-hover">
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">{d.name}</p>
                      <p className="text-xs text-muted-foreground">{d.specialty}</p>
                    </div>
                    <Badge variant="secondary" className={cn("text-xs", rate >= 80 ? "bg-green-100 text-green-700" : rate >= 50 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700")}>
                      {rate}% completion
                    </Badge>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div><p className="text-lg font-bold">{d.total}</p><p className="text-[10px] text-muted-foreground">Total</p></div>
                    <div><p className="text-lg font-bold text-green-600">{d.completed}</p><p className="text-[10px] text-muted-foreground">Done</p></div>
                    <div><p className="text-lg font-bold text-red-600">{d.cancelled}</p><p className="text-[10px] text-muted-foreground">Cancel</p></div>
                    <div><p className="text-lg font-bold text-amber-600">{d.noShow}</p><p className="text-[10px] text-muted-foreground">No-show</p></div>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground border-t pt-2">
                    <span>Revenue: {formatCurrency(d.revenue)}</span>
                    <span>Avg: {d.avgConsultMin > 0 ? `${Math.round(d.avgConsultMin)} min` : "—"}</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>
    </>
  )
}

// ─── PATIENT DEMOGRAPHICS TAB ──────────────────────────────────────────────────

function PatientDemographicsTab({ patients, appointments, from }: {
  patients: Record<string, unknown>[]
  appointments: Record<string, unknown>[]
  from: string
}) {
  // Gender distribution
  const genderData = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of patients) {
      const g = String(p.gender || "Unknown")
      counts[g] = (counts[g] || 0) + 1
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [patients])

  // Age distribution
  const ageData = useMemo(() => {
    const bins: Record<string, number> = { "0-18": 0, "19-30": 0, "31-45": 0, "46-60": 0, "60+": 0, "Unknown": 0 }
    for (const p of patients) {
      const age = Number(p.age) || 0
      if (!p.age) bins["Unknown"]++
      else if (age <= 18) bins["0-18"]++
      else if (age <= 30) bins["19-30"]++
      else if (age <= 45) bins["31-45"]++
      else if (age <= 60) bins["46-60"]++
      else bins["60+"]++
    }
    return Object.entries(bins).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }))
  }, [patients])

  // New vs returning patients
  const { newPatients, returningPatients } = useMemo(() => {
    const newP = patients.filter(p => {
      const created = String(p.created_at || "")
      return created >= from
    }).length
    return { newPatients: newP, returningPatients: patients.length - newP }
  }, [patients, from])

  // Top specialties
  const specialtyData = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const a of appointments) {
      const s = String(a.specialty || "Unknown")
      counts[s] = (counts[s] || 0) + 1
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }))
  }, [appointments])

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Patients" value={patients.length} icon={<Users className="w-4 h-4" />} gradient="gradient-blue" />
        <StatCard label="New Patients" value={newPatients} icon={<UserPlus className="w-4 h-4" />} gradient="gradient-green" subtitle={`In selected period`} />
        <StatCard label="Returning" value={returningPatients} icon={<UserCheck className="w-4 h-4" />} gradient="gradient-orange" />
        <StatCard label="New %"  value={`${patients.length > 0 ? Math.round((newPatients / patients.length) * 100) : 0}%`} icon={<TrendingUp className="w-4 h-4" />} gradient="gradient-purple" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Gender */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Gender Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={genderData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label={(props) => `${props.name || ""} ${((Number(props.percent) || 0) * 100).toFixed(0)}%`}>
                  {genderData.map((entry, i) => <Cell key={i} fill={GENDER_COLORS[entry.name] || COLORS[i % COLORS.length]} />)}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Age groups */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Age Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={ageData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <RechartsTooltip />
                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Patients" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top specialties */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Most Visited Specialties</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={specialtyData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
              <RechartsTooltip />
              <Bar dataKey="value" fill="#7c3aed" radius={[0, 4, 4, 0]} name="Appointments" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </>
  )
}

// ─── OPERATIONS TAB ─────────────────────────────────────────────────────────────

function OperationsTab({ appointments, queueEntries }: {
  appointments: Record<string, unknown>[]
  queueEntries: Record<string, unknown>[]
}) {
  // Peak hours analysis
  const peakHoursData = useMemo(() => {
    const hours: Record<number, number> = {}
    for (const a of appointments) {
      const time = String(a.time || "")
      const match = time.match(/^(\d{1,2})/)
      if (match) {
        const h = parseInt(match[1])
        hours[h] = (hours[h] || 0) + 1
      }
    }
    return Array.from({ length: 14 }, (_, i) => i + 8).map(h => ({
      hour: `${h}:00`,
      appointments: hours[h] || 0,
    }))
  }, [appointments])

  // Daily appointment volume
  const dailyVolume = useMemo(() => {
    const dayMap: Record<string, { total: number; completed: number; noShow: number }> = {}
    for (const a of appointments) {
      const d = String(a.date || "")
      if (!dayMap[d]) dayMap[d] = { total: 0, completed: 0, noShow: 0 }
      dayMap[d].total++
      if (a.status === "completed") dayMap[d].completed++
      if (a.status === "no_show") dayMap[d].noShow++
    }
    return Object.entries(dayMap).sort((a, b) => a[0].localeCompare(b[0])).map(([date, v]) => ({
      date: new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      Total: v.total,
      Completed: v.completed,
      "No Show": v.noShow,
    }))
  }, [appointments])

  // Average wait time from queue
  const avgWaitMinutes = useMemo(() => {
    let total = 0, count = 0
    for (const q of queueEntries) {
      if (!q.check_in_time || !q.consultation_start) continue
      const wait = (new Date(String(q.consultation_start)).getTime() - new Date(String(q.check_in_time)).getTime()) / 60000
      if (wait > 0 && wait < 300) { total += wait; count++ }
    }
    return count > 0 ? Math.round(total / count) : 0
  }, [queueEntries])

  const avgConsultMinutes = useMemo(() => {
    let total = 0, count = 0
    for (const q of queueEntries) {
      if (!q.consultation_start || !q.consultation_end) continue
      const dur = (new Date(String(q.consultation_end)).getTime() - new Date(String(q.consultation_start)).getTime()) / 60000
      if (dur > 0 && dur < 180) { total += dur; count++ }
    }
    return count > 0 ? Math.round(total / count) : 0
  }, [queueEntries])

  // Day of week distribution
  const dayOfWeekData = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    const counts = Array(7).fill(0)
    for (const a of appointments) {
      const d = new Date(String(a.date || ""))
      if (!isNaN(d.getTime())) counts[d.getDay()]++
    }
    return days.map((name, i) => ({ name, appointments: counts[i] }))
  }, [appointments])

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Avg Wait Time" value={`${avgWaitMinutes} min`} icon={<Clock className="w-4 h-4" />} gradient="gradient-orange" subtitle="Check-in to consultation" />
        <StatCard label="Avg Consultation" value={`${avgConsultMinutes} min`} icon={<Stethoscope className="w-4 h-4" />} gradient="gradient-blue" subtitle="Consultation duration" />
        <StatCard label="Daily Avg" value={Math.round(appointments.length / Math.max(1, dailyVolume.length))} icon={<Calendar className="w-4 h-4" />} gradient="gradient-green" subtitle="Appointments/day" />
        <StatCard label="Peak Queue" value={queueEntries.length} icon={<Activity className="w-4 h-4" />} gradient="gradient-purple" subtitle="Total queue entries" />
      </div>

      {/* Daily volume trend */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Daily Appointment Volume</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={dailyVolume}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <RechartsTooltip />
              <Legend />
              <Line type="monotone" dataKey="Total" stroke="#2563eb" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Completed" stroke="#059669" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="No Show" stroke="#d97706" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Peak hours */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Peak Hours (Appointments by Hour)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={peakHoursData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <RechartsTooltip />
                <Bar dataKey="appointments" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Day of week */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Busiest Days of Week</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dayOfWeekData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <RechartsTooltip />
                <Bar dataKey="appointments" fill="#7c3aed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

// ─── FINANCIAL TAB ──────────────────────────────────────────────────────────────

function FinancialTab({ invoices, appointments }: {
  invoices: Record<string, unknown>[]
  appointments: Record<string, unknown>[]
}) {
  const paidInvoices = invoices.filter(i => i.payment_status === "paid")
  const unpaidInvoices = invoices.filter(i => i.payment_status === "unpaid")
  const totalBilled = invoices.reduce((s, i) => s + (Number(i.total) || 0), 0)
  const totalCollected = paidInvoices.reduce((s, i) => s + (Number(i.total) || 0), 0)
  const totalOutstanding = unpaidInvoices.reduce((s, i) => s + (Number(i.total) || 0), 0)
  const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0

  // Revenue by type
  const revenueByType = useMemo(() => {
    const map: Record<string, { billed: number; collected: number; count: number }> = {}
    for (const inv of invoices) {
      const t = String(inv.type || "other")
      if (!map[t]) map[t] = { billed: 0, collected: 0, count: 0 }
      map[t].billed += Number(inv.total) || 0
      map[t].count++
      if (inv.payment_status === "paid") map[t].collected += Number(inv.total) || 0
    }
    return Object.entries(map).map(([name, v]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      Billed: v.billed,
      Collected: v.collected,
      invoices: v.count,
    }))
  }, [invoices])

  // Daily revenue trend
  const dailyRevenue = useMemo(() => {
    const dayMap: Record<string, number> = {}
    for (const inv of paidInvoices) {
      const d = String(inv.created_at || "").split("T")[0]
      dayMap[d] = (dayMap[d] || 0) + (Number(inv.total) || 0)
    }
    return Object.entries(dayMap).sort((a, b) => a[0].localeCompare(b[0])).map(([date, revenue]) => ({
      date: new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      revenue,
    }))
  }, [paidInvoices])

  // Revenue per doctor
  const revenuePerDoctor = useMemo(() => {
    const drRevenue: Record<string, number> = {}
    for (const inv of paidInvoices) {
      if (inv.type !== "consultation") continue
      const items = Array.isArray(inv.items) ? inv.items : []
      for (const item of items) {
        const desc = String((item as Record<string, unknown>).description || "")
        const match = desc.match(/Dr\.\s*(.+)/)
        if (match) {
          const name = `Dr. ${match[1].trim()}`
          drRevenue[name] = (drRevenue[name] || 0) + (Number(inv.total) || 0)
        }
      }
    }
    return Object.entries(drRevenue).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name: name.replace("Dr. ", ""), value }))
  }, [paidInvoices])

  // GST collected
  const totalGST = invoices.reduce((s, i) => s + (Number(i.tax) || 0), 0)

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Billed" value={formatCurrency(totalBilled)} icon={<IndianRupee className="w-4 h-4" />} gradient="gradient-blue" subtitle={`${invoices.length} invoices`} />
        <StatCard label="Collected" value={formatCurrency(totalCollected)} icon={<IndianRupee className="w-4 h-4" />} gradient="gradient-green" subtitle={`${paidInvoices.length} paid`} />
        <StatCard label="Outstanding" value={formatCurrency(totalOutstanding)} icon={<IndianRupee className="w-4 h-4" />} gradient="gradient-orange" subtitle={`${unpaidInvoices.length} unpaid`} />
        <StatCard label="Collection Rate" value={`${collectionRate}%`} icon={<Target className="w-4 h-4" />} gradient="gradient-purple" subtitle={totalGST > 0 ? `GST: ${formatCurrency(totalGST)}` : undefined} />
      </div>

      {/* Daily revenue trend */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Daily Revenue (Collected)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={dailyRevenue}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <RechartsTooltip formatter={(v) => [formatCurrency(Number(v) || 0), "Revenue"]} />
              <Line type="monotone" dataKey="revenue" stroke="#059669" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Revenue by type */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Revenue by Department</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={revenueByType}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <RechartsTooltip formatter={(v) => formatCurrency(Number(v) || 0)} />
                <Legend />
                <Bar dataKey="Billed" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Collected" fill="#059669" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Revenue per doctor */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Revenue by Doctor (Consultation)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={revenuePerDoctor} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                <RechartsTooltip formatter={(v) => formatCurrency(Number(v) || 0)} />
                <Bar dataKey="value" fill="#7c3aed" radius={[0, 4, 4, 0]} name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

// ─── CLINICAL TAB (Lab & Pharmacy) ─────────────────────────────────────────────

function ClinicalTab({ labOrders, pharmOrders }: {
  labOrders: Record<string, unknown>[]
  pharmOrders: Record<string, unknown>[]
}) {
  // Top lab tests
  const topTests = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const order of labOrders) {
      const tests = Array.isArray(order.tests) ? order.tests : []
      for (const t of tests) {
        const name = String((t as Record<string, unknown>).test_name || "")
        if (name) counts[name] = (counts[name] || 0) + 1
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, value]) => ({ name, value }))
  }, [labOrders])

  // Top medicines
  const topMedicines = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const order of pharmOrders) {
      const items = Array.isArray(order.items) ? order.items : []
      for (const item of items) {
        const name = String((item as Record<string, unknown>).medicine_name || "")
        if (name) counts[name] = (counts[name] || 0) + 1
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, value]) => ({ name, value }))
  }, [pharmOrders])

  // Lab turnaround time
  const avgLabTurnaround = useMemo(() => {
    let total = 0, count = 0
    for (const order of labOrders) {
      if (!order.created_at || !order.results_uploaded_at) continue
      const hours = (new Date(String(order.results_uploaded_at)).getTime() - new Date(String(order.created_at)).getTime()) / 3600000
      if (hours > 0 && hours < 720) { total += hours; count++ }
    }
    return count > 0 ? Math.round(total / count) : 0
  }, [labOrders])

  // Pharmacy dispense time
  const avgDispenseTime = useMemo(() => {
    let total = 0, count = 0
    for (const order of pharmOrders) {
      if (!order.created_at || !order.dispensed_at) continue
      const minutes = (new Date(String(order.dispensed_at)).getTime() - new Date(String(order.created_at)).getTime()) / 60000
      if (minutes > 0 && minutes < 1440) { total += minutes; count++ }
    }
    return count > 0 ? Math.round(total / count) : 0
  }, [pharmOrders])

  const labRevenue = labOrders.reduce((s, o) => s + (Number(o.total_amount) || 0), 0)
  const pharmRevenue = pharmOrders.reduce((s, o) => s + (Number(o.total_amount) || 0), 0)
  const labCompleted = labOrders.filter(o => o.status === "completed").length
  const pharmDispensed = pharmOrders.filter(o => o.status === "dispensed").length

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Lab Orders" value={labOrders.length} icon={<TestTube className="w-4 h-4" />} gradient="gradient-orange" subtitle={`${labCompleted} completed`} />
        <StatCard label="Lab TAT" value={avgLabTurnaround > 0 ? `${avgLabTurnaround}h` : "—"} icon={<Clock className="w-4 h-4" />} gradient="gradient-blue" subtitle="Avg turnaround" />
        <StatCard label="Pharmacy Orders" value={pharmOrders.length} icon={<Pill className="w-4 h-4" />} gradient="gradient-green" subtitle={`${pharmDispensed} dispensed`} />
        <StatCard label="Dispense Time" value={avgDispenseTime > 0 ? `${avgDispenseTime} min` : "—"} icon={<Clock className="w-4 h-4" />} gradient="gradient-purple" subtitle="Avg order to dispense" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top lab tests */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Most Ordered Lab Tests</CardTitle></CardHeader>
          <CardContent>
            {topTests.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topTests} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
                  <RechartsTooltip />
                  <Bar dataKey="value" fill="#d97706" radius={[0, 4, 4, 0]} name="Orders" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">No lab orders in this period</p>
            )}
          </CardContent>
        </Card>

        {/* Top medicines */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Most Prescribed Medicines</CardTitle></CardHeader>
          <CardContent>
            {topMedicines.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topMedicines} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
                  <RechartsTooltip />
                  <Bar dataKey="value" fill="#059669" radius={[0, 4, 4, 0]} name="Prescriptions" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">No pharmacy orders in this period</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="card-hover">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Lab Revenue</p>
                <p className="text-2xl font-bold">{formatCurrency(labRevenue)}</p>
              </div>
              <div className="w-10 h-10 rounded-xl gradient-orange flex items-center justify-center text-white">
                <TestTube className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pharmacy Revenue</p>
                <p className="text-2xl font-bold">{formatCurrency(pharmRevenue)}</p>
              </div>
              <div className="w-10 h-10 rounded-xl gradient-green flex items-center justify-center text-white">
                <Pill className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
