"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useBranch } from "@/components/providers/branch-context"
import { useSession } from "next-auth/react"
import { createBrowserClient } from "@/lib/supabase/client"
import { formatCurrency } from "@/lib/utils/format"
import { SectionHeader } from "@/components/shared/section-header"
import { StatCard } from "@/components/reception/stat-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  LazyBarChart as BarChart,
  LazyLineChart as LineChart,
  LazyPieChart as PieChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Pie,
  Cell,
} from "@/components/ui/lazy-recharts"
import {
  BarChart3,
  Users,
  IndianRupee,
  Clock,
  Star,
  TrendingUp,
  UserPlus,
  UserCheck,
  Activity,
  MessageSquare,
} from "lucide-react"
import { cn } from "@/lib/utils"

const COLORS = ["#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed", "#06b6d4", "#ec4899", "#84cc16"]
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const GENDER_COLORS: Record<string, string> = { Male: "#3b82f6", Female: "#ec4899", Other: "#8b5cf6", Unknown: "#94a3b8" }

function getDateRange(preset: string) {
  const now = new Date()
  const today = now.toISOString().split("T")[0]
  switch (preset) {
    case "7d": {
      const d = new Date(now)
      d.setDate(d.getDate() - 7)
      return { from: d.toISOString().split("T")[0], to: today }
    }
    case "30d": {
      const d = new Date(now)
      d.setDate(d.getDate() - 30)
      return { from: d.toISOString().split("T")[0], to: today }
    }
    case "90d": {
      const d = new Date(now)
      d.setDate(d.getDate() - 90)
      return { from: d.toISOString().split("T")[0], to: today }
    }
    case "all":
      return { from: "2020-01-01", to: today }
    default:
      return { from: "2020-01-01", to: today }
  }
}

interface DoctorSession {
  doctorId?: string
  doctorName?: string
}

export default function DoctorAnalyticsPage() {
  const { activeTenantId: tenantId } = useBranch()
  const { data: session } = useSession()
  const user = session?.user as DoctorSession | undefined
  const doctorId = user?.doctorId || ""
  const doctorName = user?.doctorName || "Doctor"

  const [range, setRange] = useState("30d")
  const [loading, setLoading] = useState(true)

  // Data states
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [appointments, setAppointments] = useState<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [queueEntries, setQueueEntries] = useState<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [prescriptions, setPrescriptions] = useState<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [feedback, setFeedback] = useState<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [invoices, setInvoices] = useState<any[]>([])

  const fetchData = useCallback(async () => {
    if (!tenantId || !doctorId) return
    setLoading(true)
    const supabase = createBrowserClient()
    const { from, to } = getDateRange(range)

    const [apptRes, queueRes, rxRes, fbRes, invRes] = await Promise.all([
      supabase
        .from("appointments")
        .select("booking_id,date,time,status,patient_name,patient_phone,specialty,consultation_fee")
        .eq("tenant_id", tenantId)
        .eq("doctor_id", doctorId)
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: false }),
      supabase
        .from("queue_entries")
        .select("id,patient_name,status,consultation_start,consultation_end,checked_in_at,created_at")
        .eq("tenant_id", tenantId)
        .eq("doctor_id", doctorId)
        .gte("created_at", from + "T00:00:00")
        .lte("created_at", to + "T23:59:59"),
      supabase
        .from("prescriptions")
        .select("prescription_id,diagnosis,items,created_at,follow_up_date")
        .eq("tenant_id", tenantId)
        .eq("doctor_id", doctorId)
        .gte("created_at", from + "T00:00:00")
        .lte("created_at", to + "T23:59:59"),
      supabase
        .from("feedback")
        .select("id,rating,comment,patient_name,created_at")
        .eq("tenant_id", tenantId)
        .eq("doctor_id", doctorId)
        .gte("created_at", from + "T00:00:00")
        .lte("created_at", to + "T23:59:59")
        .order("created_at", { ascending: false }),
      supabase
        .from("invoices")
        .select("invoice_id,total,status,type,created_at")
        .eq("tenant_id", tenantId)
        .eq("doctor_id", doctorId)
        .eq("status", "paid")
        .gte("created_at", from + "T00:00:00")
        .lte("created_at", to + "T23:59:59"),
    ])

    setAppointments(apptRes.data || [])
    setQueueEntries(queueRes.data || [])
    setPrescriptions(rxRes.data || [])
    setFeedback(fbRes.data || [])
    setInvoices(invRes.data || [])
    setLoading(false)
  }, [tenantId, doctorId, range])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ---- Computed Metrics ----
  const metrics = useMemo(() => {
    const total = appointments.length
    const completed = appointments.filter((a) => a.status === "completed").length
    const cancelled = appointments.filter((a) => a.status === "cancelled").length
    const noShow = appointments.filter((a) => a.status === "no_show").length
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0

    // Average consultation time
    const durations = queueEntries
      .filter((q) => q.consultation_start && q.consultation_end)
      .map((q) => (new Date(q.consultation_end).getTime() - new Date(q.consultation_start).getTime()) / 60000)
      .filter((d) => d > 0 && d < 180)
    const avgConsultTime = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0

    // Revenue
    const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0)

    // Feedback
    const ratings = feedback.map((f) => f.rating).filter((r) => r > 0)
    const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "N/A"
    const fiveStars = ratings.filter((r) => r === 5).length

    // Prescriptions count
    const rxCount = prescriptions.length

    // New patients (unique phones)
    const uniquePatients = new Set(appointments.map((a) => a.patient_phone)).size

    return {
      total, completed, cancelled, noShow, completionRate,
      avgConsultTime, totalRevenue, avgRating, fiveStars,
      rxCount, uniquePatients, feedbackCount: ratings.length,
    }
  }, [appointments, queueEntries, invoices, feedback, prescriptions])

  // ---- Chart Data ----
  const dailyTrend = useMemo(() => {
    const map: Record<string, { date: string; appointments: number; completed: number; revenue: number }> = {}
    appointments.forEach((a) => {
      const d = a.date
      if (!map[d]) map[d] = { date: d, appointments: 0, completed: 0, revenue: 0 }
      map[d].appointments++
      if (a.status === "completed") map[d].completed++
    })
    invoices.forEach((inv) => {
      const d = (inv.created_at || "").slice(0, 10)
      if (!map[d]) map[d] = { date: d, appointments: 0, completed: 0, revenue: 0 }
      map[d].revenue += inv.total || 0
    })
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date)).slice(-30)
  }, [appointments, invoices])

  const topDiagnoses = useMemo(() => {
    const map: Record<string, number> = {}
    prescriptions.forEach((rx) => {
      const diag = (rx.diagnosis || "").trim()
      if (diag) map[diag] = (map[diag] || 0) + 1
    })
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name: name.length > 25 ? name.slice(0, 22) + "..." : name, count }))
  }, [prescriptions])

  const topMedicines = useMemo(() => {
    const map: Record<string, number> = {}
    prescriptions.forEach((rx) => {
      const items = rx.items || []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items.forEach((item: any) => {
        const name = item.name || item.medicine_name || ""
        if (name) map[name] = (map[name] || 0) + 1
      })
    })
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name: name.length > 20 ? name.slice(0, 17) + "..." : name, count }))
  }, [prescriptions])

  const ratingDistribution = useMemo(() => {
    const dist = [0, 0, 0, 0, 0]
    feedback.forEach((f) => {
      const r = Math.round(f.rating)
      if (r >= 1 && r <= 5) dist[r - 1]++
    })
    return [
      { stars: "1 star", count: dist[0] },
      { stars: "2 stars", count: dist[1] },
      { stars: "3 stars", count: dist[2] },
      { stars: "4 stars", count: dist[3] },
      { stars: "5 stars", count: dist[4] },
    ]
  }, [feedback])

  const appointmentStatusPie = useMemo(() => {
    const completed = appointments.filter((a) => a.status === "completed").length
    const cancelled = appointments.filter((a) => a.status === "cancelled").length
    const noShow = appointments.filter((a) => a.status === "no_show").length
    const pending = appointments.filter((a) => a.status === "pending" || a.status === "confirmed").length
    return [
      { name: "Completed", value: completed },
      { name: "Cancelled", value: cancelled },
      { name: "No-show", value: noShow },
      { name: "Upcoming", value: pending },
    ].filter((d) => d.value > 0)
  }, [appointments])

  const hourlyDistribution = useMemo(() => {
    const hours: Record<number, number> = {}
    queueEntries.forEach((q) => {
      if (q.consultation_start) {
        const h = new Date(q.consultation_start).getHours()
        hours[h] = (hours[h] || 0) + 1
      }
    })
    return Array.from({ length: 12 }, (_, i) => ({
      hour: `${(i + 8) % 12 || 12}${i + 8 < 12 ? "AM" : "PM"}`,
      patients: hours[i + 8] || 0,
    }))
  }, [queueEntries])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        variant="glass"
        icon={<BarChart3 className="w-6 h-6" />}
        gradient="gradient-purple"
        title="My Analytics"
        subtitle={`Performance insights for Dr. ${doctorName}`}
        action={
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Patients" value={metrics.uniquePatients} icon={<Users className="w-4 h-4" />} gradient="gradient-blue" />
        <StatCard label="Consultations" value={metrics.completed} icon={<UserCheck className="w-4 h-4" />} gradient="gradient-green" subtitle={`${metrics.completionRate}% completion`} />
        <StatCard label="Avg Rating" value={metrics.avgRating} icon={<Star className="w-4 h-4" />} gradient="gradient-orange" subtitle={`${metrics.feedbackCount} reviews`} />
        <StatCard label="Revenue" value={formatCurrency(metrics.totalRevenue)} icon={<IndianRupee className="w-4 h-4" />} gradient="gradient-green" />
        <StatCard label="Avg Consult Time" value={`${metrics.avgConsultTime} min`} icon={<Clock className="w-4 h-4" />} gradient="gradient-purple" />
        <StatCard label="Prescriptions" value={metrics.rxCount} icon={<Activity className="w-4 h-4" />} gradient="gradient-blue" />
        <StatCard label="5-Star Reviews" value={metrics.fiveStars} icon={<Star className="w-4 h-4" />} gradient="gradient-orange" />
        <StatCard label="No-Shows" value={metrics.noShow} icon={<UserPlus className="w-4 h-4" />} gradient="gradient-red" />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 max-w-lg">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="clinical">Clinical</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
        </TabsList>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Daily Trend */}
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  Daily Consultation Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dailyTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="appointments" stroke="#3b82f6" strokeWidth={2} name="Total" dot={false} />
                      <Line type="monotone" dataKey="completed" stroke="#059669" strokeWidth={2} name="Completed" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No data for this period</p>
                )}
              </CardContent>
            </Card>

            {/* Appointment Status Pie */}
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Appointment Outcomes</CardTitle>
              </CardHeader>
              <CardContent>
                {appointmentStatusPie.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={appointmentStatusPie} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}>
                        {appointmentStatusPie.map((_, i) => (
                          <Cell key={i} fill={COLORS[i]} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No data</p>
                )}
              </CardContent>
            </Card>

            {/* Peak Hours */}
            <Card className="glass-card md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-500" />
                  Peak Consultation Hours
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={hourlyDistribution}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                    <Bar dataKey="patients" fill="#7c3aed" radius={[4, 4, 0, 0]} name="Patients" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Clinical Tab */}
        <TabsContent value="clinical" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Top Diagnoses */}
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Top Diagnoses</CardTitle>
              </CardHeader>
              <CardContent>
                {topDiagnoses.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={topDiagnoses} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={120} />
                      <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                      <Bar dataKey="count" fill="#06b6d4" radius={[0, 4, 4, 0]} name="Cases" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No prescriptions in this period</p>
                )}
              </CardContent>
            </Card>

            {/* Top Medicines */}
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Most Prescribed Medicines</CardTitle>
              </CardHeader>
              <CardContent>
                {topMedicines.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={topMedicines} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={120} />
                      <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                      <Bar dataKey="count" fill="#059669" radius={[0, 4, 4, 0]} name="Times Prescribed" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No prescriptions in this period</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Feedback Tab */}
        <TabsContent value="feedback" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Rating Distribution */}
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500" />
                  Rating Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={ratingDistribution}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis dataKey="stars" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Reviews">
                      {ratingDistribution.map((_, i) => (
                        <Cell key={i} fill={["#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e"][i]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Recent Reviews */}
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-blue-500" />
                  Recent Reviews
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[280px]">
                  {feedback.length > 0 ? (
                    <div className="divide-y">
                      {feedback.slice(0, 15).map((fb) => (
                        <div key={fb.id} className="px-4 py-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{fb.patient_name || "Patient"}</span>
                            <div className="flex items-center gap-1">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className={cn("w-3 h-3", i < fb.rating ? "text-amber-500 fill-amber-500" : "text-muted-foreground/30")}
                                />
                              ))}
                            </div>
                          </div>
                          {fb.comment && (
                            <p className="text-xs text-muted-foreground line-clamp-2">{fb.comment}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground/60 mt-1">
                            {new Date(fb.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                      No feedback in this period
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Financial Tab */}
        <TabsContent value="financial" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard label="Total Revenue" value={formatCurrency(metrics.totalRevenue)} icon={<IndianRupee className="w-4 h-4" />} gradient="gradient-green" />
            <StatCard label="Avg per Consultation" value={metrics.completed > 0 ? formatCurrency(Math.round(metrics.totalRevenue / metrics.completed)) : "N/A"} icon={<TrendingUp className="w-4 h-4" />} gradient="gradient-blue" />
            <StatCard label="Paid Invoices" value={invoices.length} icon={<Activity className="w-4 h-4" />} gradient="gradient-purple" />
          </div>

          {/* Revenue Trend */}
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
                Revenue Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dailyTrend.filter((d) => d.revenue > 0).length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${v}`} />
                    <RechartsTooltip contentStyle={{ fontSize: 12 }} formatter={(v: number | undefined) => [`₹${v || 0}`, "Revenue"]} />
                    <Line type="monotone" dataKey="revenue" stroke="#059669" strokeWidth={2} dot={false} fill="#059669" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No revenue data for this period</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
