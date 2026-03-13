"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { SectionHeader } from "@/components/shared/section-header"
import { StatCard } from "@/components/shared/stat-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  LazyLineChart as LineChart,
  LazyBarChart as BarChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "@/components/ui/lazy-recharts"
import {
  BarChart3,
  Users,
  CalendarDays,
  IndianRupee,
  TrendingUp,
  XCircle,
  Building2,
} from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { formatCurrency } from "@/lib/utils/format"
import type { SessionUser } from "@/types/auth"

interface PlatformStats {
  totalPatients: number
  totalAppointments: number
  totalRevenue: number
  totalDoctors: number
  dailyTrend: { day: string; appointments: number; revenue: number }[]
  branchBreakdown: { name: string; appointments: number; revenue: number }[]
}

export default function AnalyticsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const user = session?.user as SessionUser | undefined
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Auth guard — SUPER_ADMIN only
  useEffect(() => {
    if (user && user.role !== "SUPER_ADMIN") {
      router.push("/unauthorized")
    }
  }, [user, router])

  useEffect(() => {
    const supabase = createBrowserClient()
    const now = new Date()
    const last30: string[] = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      last30.push(d.toISOString().split("T")[0])
    }
    const rangeFrom = last30[0]
    const rangeTo = last30[last30.length - 1]

    Promise.all([
      supabase.from("patients").select("*", { count: "exact", head: true }),
      supabase.from("doctors").select("*", { count: "exact", head: true }),
      supabase.from("appointments").select("date, status, tenant_id").gte("date", rangeFrom).lte("date", rangeTo),
      supabase.from("invoices").select("total, payment_status, created_at, tenant_id").gte("created_at", rangeFrom + "T00:00:00").lte("created_at", rangeTo + "T23:59:59"),
      supabase.from("tenants").select("tenant_id, hospital_name").eq("status", "active"),
    ]).then(([pRes, dRes, aRes, iRes, tRes]) => {
      const appts = (aRes.data || []) as { date: string; status: string; tenant_id: string }[]
      const invoices = (iRes.data || []) as { total: number; payment_status: string; created_at: string; tenant_id: string }[]
      const tenants = (tRes.data || []) as { tenant_id: string; hospital_name: string }[]

      const paidInvoices = invoices.filter(i => i.payment_status === "paid")
      const totalRevenue = paidInvoices.reduce((s, i) => s + (i.total || 0), 0)

      const dailyTrend = last30.filter((_, i) => i % 3 === 0 || i === last30.length - 1).map(date => {
        const dayAppts = appts.filter(a => a.date === date)
        const dayRev = paidInvoices.filter(i => i.created_at?.startsWith(date)).reduce((s, i) => s + (i.total || 0), 0)
        return {
          day: new Date(date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
          appointments: dayAppts.length,
          revenue: dayRev,
        }
      })

      const branchBreakdown = tenants.map(t => {
        const bAppts = appts.filter(a => a.tenant_id === t.tenant_id)
        const bRev = paidInvoices.filter(i => i.tenant_id === t.tenant_id).reduce((s, i) => s + (i.total || 0), 0)
        return { name: t.hospital_name, appointments: bAppts.length, revenue: bRev }
      }).sort((a, b) => b.appointments - a.appointments)

      setStats({
        totalPatients: pRes.count || 0,
        totalDoctors: dRes.count || 0,
        totalAppointments: appts.length,
        totalRevenue,
        dailyTrend,
        branchBreakdown,
      })
      setLoading(false)
    }).catch((err) => {
      console.error("[analytics] Failed to load platform analytics:", err)
      setError(true)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 rounded-2xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <XCircle className="w-12 h-12 text-destructive mb-4" />
        <h2 className="text-lg font-semibold">Failed to load analytics</h2>
        <p className="text-sm text-muted-foreground mt-1">Please check your connection and refresh.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        variant="glass"
        icon={<BarChart3 className="w-6 h-6" />}
        gradient="gradient-purple"
        title="Global Analytics"
        subtitle="Platform-wide insights — last 30 days"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Patients" value={stats.totalPatients} gradient="gradient-blue" icon={<Users className="w-10 h-10" />} index={0} />
        <StatCard label="Total Doctors" value={stats.totalDoctors} gradient="gradient-green" icon={<TrendingUp className="w-10 h-10" />} index={1} />
        <StatCard label="30-Day Appointments" value={stats.totalAppointments} gradient="gradient-purple" icon={<CalendarDays className="w-10 h-10" />} index={2} />
        <StatCard label="30-Day Revenue" value={formatCurrency(stats.totalRevenue)} gradient="gradient-orange" icon={<IndianRupee className="w-10 h-10" />} index={3} />
      </div>

      {/* Appointment Trend */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="card-hover">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              Appointment Trend (30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={stats.dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }} />
                <Line type="monotone" dataKey="appointments" stroke="hsl(var(--chart-1))" strokeWidth={2.5} dot={{ r: 3 }} name="Appointments" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      {/* Revenue by Branch */}
      {stats.branchBreakdown.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="card-hover">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                Revenue by Branch
                <Badge variant="secondary" className="text-xs ml-1">{stats.branchBreakdown.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={Math.max(200, stats.branchBreakdown.length * 40)}>
                <BarChart data={stats.branchBreakdown} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }} formatter={(value) => [`₹${Number(value).toLocaleString("en-IN")}`, "Revenue"]} />
                  <Bar dataKey="revenue" fill="#6366f1" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  )
}
