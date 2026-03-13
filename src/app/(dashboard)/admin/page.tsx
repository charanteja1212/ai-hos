"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useBranch } from "@/components/providers/branch-context"
import { motion } from "framer-motion"
import { createBrowserClient } from "@/lib/supabase/client"
import { getTodayIST, formatDate } from "@/lib/utils/date"
import { humanizeStatus, statusColors, getInitials, formatCurrency } from "@/lib/utils/format"
import { StatCard } from "@/components/reception/stat-card"
import { AnimatedCounter } from "@/components/ui/animated-counter"
import { SectionHeader } from "@/components/shared/section-header"
import { DoctorPerformanceCard } from "@/components/admin/doctor-performance-card"
import { BranchStatCard } from "@/components/admin/branch-stat-card"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  LazyLineChart as LineChart,
  LazyBarChart as BarChart,
  LazyPieChart as PieChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Pie,
  Cell,
} from "@/components/ui/lazy-recharts"
import {
  Users,
  Stethoscope,
  IndianRupee,
  CalendarDays,
  Clock,
  XCircle,
  BedDouble,
  Pill,
  TestTube,
  CheckCircle2,
  BarChart3,
  Building2,
  Download,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { DateRangeFilter } from "@/components/admin/date-range-filter"
import type { DatePreset } from "@/components/admin/date-range-filter"
import { downloadCSV } from "@/lib/utils/csv-export"
import { Button } from "@/components/ui/button"

import type { DoctorPerf } from "@/components/admin/doctor-performance-card"

interface AnalyticsData {
  totalPatients: number
  totalDoctors: number
  todayAppointments: number
  todayRevenue: number
  todayCompleted: number
  todayCancelled: number
  todayPending: number
  yesterdayAppointments: number
  yesterdayRevenue: number
  activeAdmissions: number
  pendingPharmacy: number
  pendingLab: number
  recentAppointments: { booking_id: string; patient_name: string; doctor_name: string; time: string; status: string }[]
  dailyTrend: { day: string; appointments: number; completed: number }[]
  statusBreakdown: { name: string; value: number; color: string }[]
  sparklinePatients: number[]
  sparklineRevenue: number[]
  revenueDaily: { day: string; revenue: number }[]
  doctorPerformance: DoctorPerf[]
  // Raw data for CSV export
  rawAppointments: { booking_id: string; patient_name: string; doctor_name: string; date: string; time: string; status: string; specialty?: string }[]
}

const DONUT_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"]
const STATUS_BADGE = statusColors

function getLast7Days(): string[] {
  const days: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().split("T")[0])
  }
  return days
}

import type { SessionUser } from "@/types/auth"

interface BranchInfo {
  tenant_id: string
  hospital_name: string
  city: string | null
}

interface CrossBranchStats {
  branches: BranchInfo[]
  branchStats: Record<string, { appointments: number; completed: number; patients: number; doctors: number }>
  totals: { patients: number; doctors: number; appointments: number; revenue: number }
}

export default function AdminPage() {
  const { activeTenantId: tenantId, setActiveBranch } = useBranch()
  const { data: session } = useSession()
  const user = session?.user as SessionUser | undefined
  const isClientAdmin = user?.role === "CLIENT_ADMIN"
  const today = getTodayIST()

  // Date range filter state
  const [datePreset, setDatePreset] = useState<DatePreset>("today")
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState(today)

  const handleDateChange = (from: string, to: string, preset: DatePreset) => {
    setDateFrom(from)
    setDateTo(to)
    setDatePreset(preset)
  }

  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Cross-branch data for CLIENT_ADMIN
  const [crossData, setCrossData] = useState<CrossBranchStats | null>(null)

  useEffect(() => {
    if (!tenantId) return
    setLoading(true)
    const supabase = createBrowserClient()
    const last7 = getLast7Days()

    // Use dateFrom/dateTo for filtered queries, last7 for trend
    const rangeFrom = dateFrom
    const rangeTo = dateTo
    // For yesterday comparison, use the day before dateFrom
    const yDate = new Date(rangeFrom + "T00:00:00")
    yDate.setDate(yDate.getDate() - 1)
    const yesterday = yDate.toISOString().split("T")[0]

    // Build list of all days in range for daily charts
    const rangeDays: string[] = []
    const cur = new Date(rangeFrom + "T00:00:00")
    const end = new Date(rangeTo + "T00:00:00")
    while (cur <= end) {
      rangeDays.push(cur.toISOString().split("T")[0])
      cur.setDate(cur.getDate() + 1)
    }

    // Use the wider of range or last7 for trend queries
    const trendFrom = rangeFrom < last7[0] ? rangeFrom : last7[0]

    Promise.all([
      supabase.from("patients").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId),
      supabase.from("doctors").select("doctor_id, name, specialty").eq("tenant_id", tenantId),
      // Range appointments (for stats)
      supabase.from("appointments").select("*").eq("tenant_id", tenantId).gte("date", rangeFrom).lte("date", rangeTo).limit(1000),
      supabase.from("admissions").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "admitted"),
      supabase.from("pharmacy_orders").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "pending"),
      supabase.from("lab_orders").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).in("status", ["ordered", "sample_collected"]),
      // Trend data (wider range)
      supabase.from("appointments").select("date, status, doctor_id, doctor_name, specialty").eq("tenant_id", tenantId).gte("date", trendFrom).lte("date", rangeTo).limit(1000),
      // Yesterday for comparison
      supabase.from("appointments").select("status, payment_status").eq("tenant_id", tenantId).eq("date", yesterday).limit(500),
      // Invoice data for revenue
      supabase.from("invoices").select("type, total, payment_status, created_at").eq("tenant_id", tenantId).gte("created_at", trendFrom + "T00:00:00").lte("created_at", rangeTo + "T23:59:59").limit(1000),
      // Queue entries for consultation times (today only for perf)
      supabase.from("queue_entries").select("doctor_id, consultation_start, consultation_end").eq("tenant_id", tenantId).eq("date", today).eq("status", "completed").limit(500),
      // Tenant config for consultation fee fallback
      supabase.from("tenants").select("consultation_fee").eq("tenant_id", tenantId).single(),
    ]).then(([patientsRes, doctorsRes, appointmentsRes, admissionsRes, pharmacyRes, labRes, weekRes, yesterdayRes, invoicesRes, queueRes, tenantRes]) => {
      const appointments = (appointmentsRes.data || []) as { booking_id: string; patient_name: string; doctor_name: string; doctor_id?: string; date?: string; time: string; status: string; payment_status?: string; specialty?: string }[]
      const trendAppts = (weekRes.data || []) as { date: string; status: string; doctor_id?: string; doctor_name?: string; specialty?: string }[]
      const yesterdayAppts = (yesterdayRes.data || []) as { status: string; payment_status?: string }[]
      const doctors = (doctorsRes.data || []) as { doctor_id: string; name: string; specialty: string }[]
      const allInvoices = (invoicesRes.data || []) as { type: string; total: number; payment_status: string; created_at: string }[]
      const queueEntries = (queueRes.data || []) as { doctor_id: string; consultation_start: string | null; consultation_end: string | null }[]
      const consultFee = (tenantRes.data as { consultation_fee?: number } | null)?.consultation_fee || 200

      // Build Maps for O(1) lookups in doctor performance (avoid O(n^2))
      const trendApptsByDoctor = new Map<string, typeof trendAppts>()
      for (const a of trendAppts) {
        if (a.doctor_id) {
          const arr = trendApptsByDoctor.get(a.doctor_id)
          if (arr) arr.push(a)
          else trendApptsByDoctor.set(a.doctor_id, [a])
        }
      }
      const rangeApptsByDoctor = new Map<string, typeof appointments>()
      for (const a of appointments) {
        if (a.doctor_id) {
          const arr = rangeApptsByDoctor.get(a.doctor_id)
          if (arr) arr.push(a)
          else rangeApptsByDoctor.set(a.doctor_id, [a])
        }
      }
      const queueByDoctor = new Map<string, typeof queueEntries>()
      for (const q of queueEntries) {
        if (q.doctor_id) {
          const arr = queueByDoctor.get(q.doctor_id)
          if (arr) arr.push(q)
          else queueByDoctor.set(q.doctor_id, [q])
        }
      }

      // Revenue for the selected range
      const rangeInvoices = allInvoices.filter(inv => {
        const d = inv.created_at?.split("T")[0]
        return d && d >= rangeFrom && d <= rangeTo
      })
      const yesterdayInvoices = allInvoices.filter(inv => inv.created_at?.startsWith(yesterday))

      const rangeRevenue = rangeInvoices.length > 0
        ? rangeInvoices.filter(i => i.payment_status === "paid").reduce((s, i) => s + (i.total || 0), 0)
        : appointments.filter(a => a.payment_status === "paid" || a.status === "confirmed").length * consultFee

      const yesterdayRevenue = yesterdayInvoices.length > 0
        ? yesterdayInvoices.filter(i => i.payment_status === "paid").reduce((s, i) => s + (i.total || 0), 0)
        : yesterdayAppts.filter(a => a.payment_status === "paid" || a.status === "confirmed").length * consultFee

      // Build daily trend (use rangeDays for the chart)
      const chartDays = rangeDays.length > 1 ? rangeDays : last7
      const dailyTrend = chartDays.map((date) => {
        const dayAppts = trendAppts.filter((a) => a.date === date)
        const dayName = chartDays.length <= 7
          ? new Date(date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short" })
          : new Date(date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })
        return {
          day: dayName,
          appointments: dayAppts.length,
          completed: dayAppts.filter((a) => a.status === "completed").length,
        }
      })

      // Revenue daily chart
      const revenueDaily = chartDays.map((date) => {
        const dayInv = allInvoices.filter(i => i.created_at?.startsWith(date) && i.payment_status === "paid")
        const dayAppts = trendAppts.filter(a => a.date === date)
        const revenue = dayInv.length > 0
          ? dayInv.reduce((s, i) => s + (i.total || 0), 0)
          : dayAppts.filter(a => a.status === "completed").length * consultFee
        const dayName = chartDays.length <= 7
          ? new Date(date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short" })
          : new Date(date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })
        return { day: dayName, revenue }
      })

      // Status breakdown for donut (range)
      const rangeCompleted = appointments.filter((a) => a.status === "completed").length
      const rangeCancelled = appointments.filter((a) => a.status === "cancelled").length
      const rangePending = appointments.filter((a) => a.status === "confirmed").length
      const rangeOther = appointments.length - rangeCompleted - rangeCancelled - rangePending

      const statusBreakdown = [
        { name: "Completed", value: rangeCompleted, color: DONUT_COLORS[0] },
        { name: "Confirmed", value: rangePending, color: DONUT_COLORS[1] },
        { name: "Cancelled", value: rangeCancelled, color: DONUT_COLORS[2] },
        ...(rangeOther > 0 ? [{ name: "Other", value: rangeOther, color: DONUT_COLORS[3] }] : []),
      ].filter((s) => s.value > 0)

      // Sparkline data
      const sparklineAppts = dailyTrend.map((d) => d.appointments)
      const sparklineRevenue = revenueDaily.map((d) => d.revenue)

      // Doctor performance — real consultation times from queue_entries
      const doctorPerformance: DoctorPerf[] = doctors.map((doc) => {
        const docAppts = trendApptsByDoctor.get(doc.doctor_id) || []
        const rangeDocAppts = rangeApptsByDoctor.get(doc.doctor_id) || []
        const completedDoc = rangeDocAppts.filter((a) => a.status === "completed").length
        const dailyCounts = last7.map((date) => docAppts.filter((a) => a.date === date).length)

        const docQueue = (queueByDoctor.get(doc.doctor_id) || []).filter((q) => q.consultation_start && q.consultation_end)
        let avgMin = 0
        if (docQueue.length > 0) {
          const totalMin = docQueue.reduce((sum, q) => {
            const start = new Date(q.consultation_start!).getTime()
            const end = new Date(q.consultation_end!).getTime()
            return sum + Math.max(0, (end - start) / 60000)
          }, 0)
          avgMin = Math.round(totalMin / docQueue.length)
        }

        return {
          doctor_id: doc.doctor_id,
          doctor_name: doc.name,
          specialty: doc.specialty || "General",
          patients_seen: rangeDocAppts.length,
          avg_consultation_min: avgMin,
          completion_rate: rangeDocAppts.length > 0 ? Math.round((completedDoc / rangeDocAppts.length) * 100) : 0,
          daily_counts: dailyCounts,
        }
      }).sort((a, b) => b.patients_seen - a.patients_seen)

      setData({
        totalPatients: patientsRes.count || 0,
        totalDoctors: doctors.length,
        todayAppointments: appointments.length,
        todayRevenue: rangeRevenue,
        todayCompleted: rangeCompleted,
        todayCancelled: rangeCancelled,
        todayPending: rangePending,
        yesterdayAppointments: yesterdayAppts.length,
        yesterdayRevenue,
        activeAdmissions: admissionsRes.count || 0,
        pendingPharmacy: pharmacyRes.count || 0,
        pendingLab: labRes.count || 0,
        recentAppointments: appointments.slice(0, 10),
        dailyTrend,
        statusBreakdown,
        sparklinePatients: sparklineAppts,
        sparklineRevenue,
        revenueDaily,
        doctorPerformance,
        rawAppointments: appointments.map(a => ({
          booking_id: a.booking_id,
          patient_name: a.patient_name,
          doctor_name: a.doctor_name,
          date: a.date || "",
          time: a.time,
          status: a.status,
          specialty: a.specialty,
        })),
      })
      setLoading(false)
    }).catch((err) => {
      console.error("[admin] Failed to load analytics data:", err)
      setError(true)
      setLoading(false)
    })
  }, [tenantId, today, dateFrom, dateTo])

  // Cross-branch data for CLIENT_ADMIN
  useEffect(() => {
    if (!isClientAdmin || !user?.clientId) {
      // cross-branch loaded
      return
    }

    const supabase = createBrowserClient()

    const fetchCrossBranch = async () => {
      // Get all branches for this client (include consultation_fee)
      const { data: branches } = await supabase
        .from("tenants")
        .select("tenant_id, hospital_name, city, consultation_fee")
        .eq("client_id", user.clientId!)
        .eq("status", "active")
        .order("hospital_name")

      if (!branches || branches.length <= 1) {
        // cross-branch loaded
        return
      }

      const branchIds = branches.map((b) => b.tenant_id)

      // Fetch stats for all branches in parallel
      const [apptsRes, patientsRes, doctorsRes, crossInvoicesRes] = await Promise.all([
        supabase.from("appointments").select("tenant_id, status").in("tenant_id", branchIds).eq("date", today).limit(1000),
        supabase.from("patients").select("tenant_id").in("tenant_id", branchIds).limit(5000),
        supabase.from("doctors").select("tenant_id").in("tenant_id", branchIds).eq("status", "active").limit(500),
        supabase.from("invoices").select("tenant_id, total, payment_status").in("tenant_id", branchIds).gte("created_at", today + "T00:00:00").lte("created_at", today + "T23:59:59").limit(1000),
      ])

      const appts = apptsRes.data || []
      const patients = patientsRes.data || []
      const doctors = doctorsRes.data || []
      const crossInvoices = (crossInvoicesRes.data || []) as { tenant_id: string; total: number; payment_status: string }[]

      // Build Maps for O(1) cross-branch lookups (avoid O(n^2))
      const apptsByTenant = new Map<string, typeof appts>()
      for (const a of appts) { const arr = apptsByTenant.get(a.tenant_id); if (arr) arr.push(a); else apptsByTenant.set(a.tenant_id, [a]) }
      const patientCountByTenant = new Map<string, number>()
      for (const p of patients) { patientCountByTenant.set(p.tenant_id, (patientCountByTenant.get(p.tenant_id) || 0) + 1) }
      const doctorCountByTenant = new Map<string, number>()
      for (const d of doctors) { doctorCountByTenant.set(d.tenant_id, (doctorCountByTenant.get(d.tenant_id) || 0) + 1) }
      const paidInvoicesByTenant = new Map<string, typeof crossInvoices>()
      for (const i of crossInvoices) { if (i.payment_status === "paid") { const arr = paidInvoicesByTenant.get(i.tenant_id); if (arr) arr.push(i); else paidInvoicesByTenant.set(i.tenant_id, [i]) } }

      const branchStats: Record<string, { appointments: number; completed: number; patients: number; doctors: number }> = {}
      let totalPatients = 0, totalDoctors = 0, totalAppts = 0, totalRevenue = 0

      for (const branch of branches) {
        const id = branch.tenant_id
        const bAppts = apptsByTenant.get(id) || []
        const bCompleted = bAppts.filter((a) => a.status === "completed").length
        const bPatients = patientCountByTenant.get(id) || 0
        const bDoctors = doctorCountByTenant.get(id) || 0

        // Revenue from invoices (with fallback using branch consultation fee)
        const bInvoices = paidInvoicesByTenant.get(id) || []
        const branchFee = (branch as { consultation_fee?: number }).consultation_fee || 200
        const bRevenue = bInvoices.length > 0
          ? bInvoices.reduce((s, i) => s + (i.total || 0), 0)
          : bCompleted * branchFee

        branchStats[id] = { appointments: bAppts.length, completed: bCompleted, patients: bPatients, doctors: bDoctors }
        totalPatients += bPatients
        totalDoctors += bDoctors
        totalAppts += bAppts.length
        totalRevenue += bRevenue
      }

      setCrossData({
        branches,
        branchStats,
        totals: { patients: totalPatients, doctors: totalDoctors, appointments: totalAppts, revenue: totalRevenue },
      })
      // cross-branch loaded
    }

    fetchCrossBranch().catch((err) => {
      console.error("[admin] Failed to load cross-branch data:", err)
    })
  }, [isClientAdmin, user?.clientId, today])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Skeleton className="col-span-2 h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <XCircle className="w-12 h-12 text-destructive mb-4" />
        <h2 className="text-lg font-semibold">Failed to load analytics</h2>
        <p className="text-muted-foreground">Please check your connection and refresh the page.</p>
      </div>
    )
  }

  if (!data) return null

  const apptTrend = data.yesterdayAppointments > 0
    ? Math.round(((data.todayAppointments - data.yesterdayAppointments) / data.yesterdayAppointments) * 100)
    : 0
  const revTrend = data.yesterdayRevenue > 0
    ? Math.round(((data.todayRevenue - data.yesterdayRevenue) / data.yesterdayRevenue) * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* CLIENT_ADMIN Cross-Branch Overview */}
      {isClientAdmin && crossData && crossData.branches.length > 1 && (
        <div className="space-y-4">
          <SectionHeader
            title={`${user?.clientName || "All Branches"} — Overview`}
            subtitle="Cross-branch performance overview"
            icon={<Building2 className="w-6 h-6" />}
            gradient="gradient-purple"
            variant="glass"
            badge={
              <Badge variant="secondary" className="text-xs">
                {crossData.branches.length} branches
              </Badge>
            }
          />

          {/* Aggregate KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              label="Total Patients"
              value={crossData.totals.patients}
              gradient="gradient-blue"
              icon={<Users className="w-10 h-10" />}
              index={0}
            />
            <StatCard
              label="Total Doctors"
              value={crossData.totals.doctors}
              gradient="gradient-green"
              icon={<Stethoscope className="w-10 h-10" />}
              index={1}
            />
            <StatCard
              label="Today's Appointments"
              value={crossData.totals.appointments}
              gradient="gradient-purple"
              icon={<CalendarDays className="w-10 h-10" />}
              index={2}
            />
            <StatCard
              label="Today's Revenue"
              value={formatCurrency(crossData.totals.revenue)}
              gradient="gradient-orange"
              icon={<IndianRupee className="w-10 h-10" />}
              index={3}
            />
          </div>

          {/* Branch comparison cards — horizontal scroll */}
          <ScrollArea className="w-full">
            <div className="flex gap-4 pb-3">
              {crossData.branches.map((branch, idx) => (
                <BranchStatCard
                  key={branch.tenant_id}
                  branch={branch}
                  isActive={branch.tenant_id === tenantId}
                  onClick={() => setActiveBranch(branch.tenant_id, branch.hospital_name)}
                  stats={crossData.branchStats[branch.tenant_id] || { appointments: 0, completed: 0, patients: 0, doctors: 0 }}
                  index={idx}
                />
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          <Separator className="my-2" />
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <SectionHeader
          title="Hospital Analytics"
          subtitle={datePreset === "today" ? `Performance overview — ${formatDate(today)}` : `${formatDate(dateFrom)} — ${formatDate(dateTo)}`}
        />
        <div className="flex items-center gap-2">
          <DateRangeFilter from={dateFrom} to={dateTo} preset={datePreset} onChange={handleDateChange} />
          {data && data.rawAppointments.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs rounded-lg gap-1"
              onClick={() => downloadCSV(data.rawAppointments, `appointments-${dateFrom}-to-${dateTo}`)}
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </Button>
          )}
        </div>
      </div>

      {/* Main KPIs with sparklines and trends */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Patients"
          value={data.totalPatients}
          gradient="gradient-blue"
          icon={<Users className="w-10 h-10" />}
          sparklineData={data.sparklinePatients}
          index={0}
        />
        <StatCard
          label="Active Doctors"
          value={data.totalDoctors}
          gradient="gradient-green"
          icon={<Stethoscope className="w-10 h-10" />}
          index={1}
        />
        <StatCard
          label={datePreset === "today" ? "Today's Revenue" : "Revenue"}
          value={formatCurrency(data.todayRevenue)}
          gradient="gradient-orange"
          icon={<IndianRupee className="w-10 h-10" />}
          sparklineData={data.sparklineRevenue}
          subtitle={datePreset === "today" && revTrend !== 0 ? `${revTrend > 0 ? "+" : ""}${revTrend}% vs yesterday` : undefined}
          index={2}
        />
        <StatCard
          label={datePreset === "today" ? "Today's Appointments" : "Appointments"}
          value={data.todayAppointments}
          gradient="gradient-purple"
          icon={<CalendarDays className="w-10 h-10" />}
          sparklineData={data.sparklinePatients}
          subtitle={datePreset === "today" && apptTrend !== 0 ? `${apptTrend > 0 ? "+" : ""}${apptTrend}% vs yesterday` : undefined}
          index={3}
        />
      </div>

      {/* Charts Row: Line Chart (2/3) + Donut (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 7-Day Trend Line Chart */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="lg:col-span-2">
          <Card className="card-hover">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                7-Day Appointment Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data.dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="day" className="text-xs" tick={{ fontSize: 12 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "12px",
                      fontSize: "12px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="appointments"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "hsl(var(--chart-1))" }}
                    activeDot={{ r: 6, strokeWidth: 2, stroke: "hsl(var(--background))" }}
                    name="Total"
                  />
                  <Line
                    type="monotone"
                    dataKey="completed"
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "hsl(var(--chart-2))" }}
                    activeDot={{ r: 6, strokeWidth: 2, stroke: "hsl(var(--background))" }}
                    name="Completed"
                    strokeDasharray="5 5"
                  />
                </LineChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-center gap-6 mt-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: "hsl(var(--chart-1))" }} />
                  Total Appointments
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: "hsl(var(--chart-2))" }} />
                  Completed
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Status Donut Chart */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="card-hover h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-primary" />
                {datePreset === "today" ? "Today's" : "Period"} Status
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              {data.statusBreakdown.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <CalendarDays className="w-10 h-10 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">No appointments today</p>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={data.statusBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {data.statusBreakdown.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "12px",
                          fontSize: "12px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap justify-center gap-3 mt-2">
                    {data.statusBreakdown.map((item) => (
                      <div key={item.name} className="flex items-center gap-1.5 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-muted-foreground">{item.name}</span>
                        <span className="font-semibold">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Revenue Bar Chart — only shown for multi-day ranges */}
      {data.revenueDaily.length > 1 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="card-hover">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <IndianRupee className="w-4 h-4 text-primary" />
                  Daily Revenue
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => downloadCSV(
                    data.revenueDaily.map(d => ({ day: d.day, revenue: d.revenue })),
                    `revenue-${dateFrom}-to-${dateTo}`
                  )}
                >
                  <Download className="w-3 h-3" />
                  Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.revenueDaily}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="day" className="text-xs" tick={{ fontSize: 11 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "12px",
                      fontSize: "12px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                    formatter={(value) => [`₹${Number(value).toLocaleString("en-IN")}`, "Revenue"]}
                  />
                  <Bar dataKey="revenue" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Doctor Performance Row */}
      {data.doctorPerformance.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-primary" />
            Doctor Performance
            <Badge variant="secondary" className="ml-1 text-xs">{data.doctorPerformance.length}</Badge>
          </h2>
          <ScrollArea className="w-full">
            <div className="flex gap-4 pb-3">
              {data.doctorPerformance.map((doc, idx) => (
                <DoctorPerformanceCard key={doc.doctor_id} doctor={doc} index={idx} />
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      )}

      {/* Today's Breakdown + Operations — Merged */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { icon: CheckCircle2, label: "Completed", value: data.todayCompleted, bg: "bg-green-100 dark:bg-green-900/30", iconColor: "text-green-600 dark:text-green-400" },
          { icon: Clock, label: "Confirmed", value: data.todayPending, bg: "bg-amber-100 dark:bg-amber-900/30", iconColor: "text-amber-600 dark:text-amber-400" },
          { icon: XCircle, label: "Cancelled", value: data.todayCancelled, bg: "bg-red-100 dark:bg-red-900/30", iconColor: "text-red-600 dark:text-red-400" },
          { icon: BedDouble, label: "Admissions", value: data.activeAdmissions, bg: "bg-orange-100 dark:bg-orange-900/30", iconColor: "text-orange-600 dark:text-orange-400" },
          { icon: Pill, label: "Pharmacy", value: data.pendingPharmacy, bg: "bg-blue-100 dark:bg-blue-900/30", iconColor: "text-blue-600 dark:text-blue-400" },
          { icon: TestTube, label: "Lab Orders", value: data.pendingLab, bg: "bg-purple-100 dark:bg-purple-900/30", iconColor: "text-purple-600 dark:text-purple-400" },
        ].map((item, idx) => {
          const Icon = item.icon
          return (
            <motion.div key={item.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + idx * 0.03 }}>
              <Card className="card-hover">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", item.bg)}>
                    <Icon className={cn("w-5 h-5", item.iconColor)} />
                  </div>
                  <div className="min-w-0">
                    <AnimatedCounter value={item.value} className="text-xl font-bold" />
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">{item.label}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Recent Appointments Table */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="card-hover">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              {datePreset === "today" ? "Today's" : "Recent"} Appointments
              <Badge variant="secondary" className="ml-auto text-xs">{data.recentAppointments.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentAppointments.length === 0 ? (
              <div className="text-center py-8">
                <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                  <CalendarDays className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                </motion.div>
                <p className="text-sm font-medium text-muted-foreground">No appointments today</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Appointments will appear here</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {data.recentAppointments.map((appt, idx) => (
                  <motion.div
                    key={appt.booking_id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.02 }}
                    className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {getInitials(appt.patient_name)}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{appt.patient_name}</p>
                        <p className="text-xs text-muted-foreground">{appt.doctor_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground font-mono">{appt.time}</span>
                      <Badge
                        variant="secondary"
                        className={cn("text-[10px]", STATUS_BADGE[appt.status] || "")}
                      >
                        {humanizeStatus(appt.status)}
                      </Badge>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
