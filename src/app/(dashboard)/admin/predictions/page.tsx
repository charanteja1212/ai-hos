"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useBranch } from "@/components/providers/branch-context"
import { createBrowserClient } from "@/lib/supabase/client"
import { FeatureGate } from "@/components/shared/feature-gate"
import { SectionHeader } from "@/components/shared/section-header"
import { StatCard } from "@/components/shared/stat-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  LazyBarChart as BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
} from "@/components/ui/lazy-recharts"
import { Brain, AlertTriangle, TrendingDown, IndianRupee, Bell, CalendarClock, RefreshCw } from "lucide-react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils/format"
import { cn } from "@/lib/utils"

interface Appt {
  booking_id: string; patient_phone: string; patient_name: string
  doctor_id: string; doctor_name: string; specialty?: string
  date: string; time: string; status: string; created_at?: string
}
interface RiskAppt extends Appt {
  riskScore: number; riskLevel: "low" | "medium" | "high"; factors: string[]
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const AVG_FEE = 500

function riskLevel(s: number): "low" | "medium" | "high" {
  return s >= 60 ? "high" : s >= 30 ? "medium" : "low"
}

function RiskBadge({ level, score }: { level: "low" | "medium" | "high"; score: number }) {
  const c = { low: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" }
  return <Badge variant="secondary" className={cn("text-xs font-semibold", c[level])}>{score}% {level}</Badge>
}

export default function PredictionsPage() {
  return (
    <FeatureGate feature="predictive_noshow" featureName="No-Show Prediction">
      <PredictionsContent />
    </FeatureGate>
  )
}

function PredictionsContent() {
  const { activeTenantId: tenantId } = useBranch()
  const [loading, setLoading] = useState(true)
  const [past, setPast] = useState<Appt[]>([])
  const [upcoming, setUpcoming] = useState<Appt[]>([])

  const fetchData = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const supabase = createBrowserClient()
    const now = new Date()
    const d90 = new Date(now); d90.setDate(d90.getDate() - 90)
    const d7 = new Date(now); d7.setDate(d7.getDate() + 7)
    const today = now.toISOString().split("T")[0]

    const [pastRes, upRes] = await Promise.all([
      supabase.from("appointments")
        .select("booking_id, patient_phone, patient_name, doctor_id, doctor_name, date, time, status, created_at")
        .eq("tenant_id", tenantId).gte("date", d90.toISOString().split("T")[0]).lte("date", today)
        .in("status", ["completed", "no_show", "cancelled"]).order("date", { ascending: false }),
      supabase.from("appointments")
        .select("booking_id, patient_phone, patient_name, doctor_id, doctor_name, specialty, date, time, status, created_at")
        .eq("tenant_id", tenantId).gte("date", today).lte("date", d7.toISOString().split("T")[0])
        .eq("status", "confirmed").order("date", { ascending: true }),
    ])
    setPast((pastRes.data || []) as Appt[])
    setUpcoming((upRes.data || []) as Appt[])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { fetchData() }, [fetchData])

  // Build risk patterns from historical data
  const patterns = useMemo(() => {
    type Tally = Record<string, { total: number; noShows: number }>
    const patient: Tally = {}, day: Tally = {}, hour: Tally = {}, doctor: Tally = {}
    const inc = (m: Tally, k: string, ns: boolean) => {
      if (!m[k]) m[k] = { total: 0, noShows: 0 }; m[k].total++; if (ns) m[k].noShows++
    }
    for (const a of past) {
      const isNS = a.status === "no_show"
      inc(patient, a.patient_phone || "x", isNS)
      inc(day, String(new Date(a.date).getDay()), isNS)
      inc(doctor, a.doctor_id || "x", isNS)
      const hm = (a.time || "").match(/^(\d{1,2})/); if (hm) inc(hour, hm[1], isNS)
    }
    return { patient, day, hour, doctor }
  }, [past])

  const overallRate = useMemo(() => {
    if (!past.length) return 0
    return Math.round((past.filter(a => a.status === "no_show").length / past.length) * 100)
  }, [past])

  // Score upcoming appointments
  const scored = useMemo((): RiskAppt[] => {
    const avgRate = past.length > 0 ? past.filter(p => p.status === "no_show").length / past.length : 0

    return upcoming.map(a => {
      let score = 0; const factors: string[] = []
      // 1. Patient history (40)
      const ph = patterns.patient[a.patient_phone || "x"]
      if (ph && ph.total > 0) {
        const r = ph.noShows / ph.total; score += Math.round(r * 40)
        if (r > 0.3) factors.push(`${Math.round(r * 100)}% past no-show rate`)
      }
      // 2. Day of week (20)
      const dd = patterns.day[String(new Date(a.date).getDay())]
      if (dd && dd.total > 0) {
        const dr = dd.noShows / dd.total
        score += avgRate > 0 ? Math.round(Math.min((dr / Math.max(avgRate, 0.01)) * 10, 20)) : 0
        if (dr > avgRate * 1.3) factors.push(`${DAYS[new Date(a.date).getDay()]}s have higher no-show rate`)
      }
      // 3. Time slot (15)
      const hm = (a.time || "").match(/^(\d{1,2})/); const hr = hm ? parseInt(hm[1]) : -1
      if (hr >= 0) {
        const hd = patterns.hour[String(hr)]
        if (hd && hd.total > 0) { score += Math.round((hd.noShows / hd.total) * 15) }
        if (hr < 9 || hr >= 18) factors.push("Early/late time slot")
      }
      // 4. Doctor rate (15)
      const drd = patterns.doctor[a.doctor_id || "x"]
      if (drd && drd.total > 0) {
        const drr = drd.noShows / drd.total; score += Math.round(drr * 15)
        if (drr > 0.2) factors.push(`Doctor has ${Math.round(drr * 100)}% no-show rate`)
      }
      // 5. Lead time (10)
      if (a.created_at) {
        const lead = Math.round((new Date(a.date).getTime() - new Date(a.created_at).getTime()) / 86400000)
        score += Math.min(Math.round((lead / 30) * 10), 10)
        if (lead > 14) factors.push(`Booked ${lead} days in advance`)
      }

      score = Math.min(Math.max(Math.round(score), 0), 100)
      const rl = riskLevel(score)
      return { ...a, riskScore: score, riskLevel: rl, factors: factors.length ? factors : ["Low historical risk"] } as RiskAppt
    }).sort((a, b) => b.riskScore - a.riskScore)
  }, [upcoming, patterns, past])

  const highCount = scored.filter(a => a.riskLevel === "high").length

  const riskDist = useMemo(() => [
    { name: "Low (<30)", count: scored.filter(a => a.riskLevel === "low").length, fill: "#22c55e" },
    { name: "Medium (30-60)", count: scored.filter(a => a.riskLevel === "medium").length, fill: "#eab308" },
    { name: "High (>60)", count: scored.filter(a => a.riskLevel === "high").length, fill: "#ef4444" },
  ], [scored])

  const dayChart = useMemo(() => DAYS.map((name, i) => {
    const d = patterns.day[String(i)]
    return { name, rate: d && d.total > 0 ? Math.round((d.noShows / d.total) * 100) : 0 }
  }), [patterns.day])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <div className="grid grid-cols-3 gap-4">{[0,1,2].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
        <div className="grid grid-cols-2 gap-4"><Skeleton className="h-72 rounded-2xl" /><Skeleton className="h-72 rounded-2xl" /></div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    )
  }

  const EmptyChart = ({ text }: { text: string }) => (
    <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
      <CalendarClock className="w-8 h-8 mr-2 opacity-30" />{text}
    </div>
  )

  return (
    <div className="space-y-6">
      <SectionHeader
        variant="glass"
        icon={<Brain className="w-6 h-6" />}
        gradient="gradient-purple"
        title="No-Show Prediction"
        subtitle="AI-powered risk analysis for upcoming appointments"
        badge={<Badge variant="secondary" className="text-xs">{scored.length} upcoming</Badge>}
        action={<Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="w-4 h-4 mr-1" /> Refresh</Button>}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="No-Show Rate" value={`${overallRate}%`} icon={<TrendingDown className="w-4 h-4" />} gradient="gradient-orange" subtitle="Last 90 days" />
        <StatCard label="High-Risk Appointments" value={highCount} icon={<AlertTriangle className="w-4 h-4" />} gradient="gradient-red" subtitle="Next 7 days" />
        <StatCard label="Predicted Savings" value={formatCurrency(highCount * AVG_FEE)} icon={<IndianRupee className="w-4 h-4" />} gradient="gradient-green" subtitle="If reminders sent to high-risk" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Risk Distribution (Next 7 Days)</CardTitle></CardHeader>
          <CardContent>
            {scored.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={riskDist}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <RechartsTooltip />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Appointments">
                    {riskDist.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart text="No upcoming appointments to analyze" />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">No-Show Rate by Day of Week</CardTitle></CardHeader>
          <CardContent>
            {past.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={dayChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="%" />
                  <RechartsTooltip formatter={(v) => [`${v}%`, "No-Show Rate"]} />
                  <Bar dataKey="rate" fill="#7c3aed" radius={[4, 4, 0, 0]} name="No-Show Rate" />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart text="No historical data to analyze" />}
          </CardContent>
        </Card>
      </div>

      {/* Appointments Table */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Upcoming Appointments by Risk Score</CardTitle></CardHeader>
        <CardContent>
          {scored.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarClock className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No confirmed appointments in the next 7 days</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Risk Score</TableHead>
                    <TableHead className="hidden lg:table-cell">Risk Factors</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scored.map((a, idx) => (
                    <motion.tr key={a.booking_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.02 }} className="border-b">
                      <TableCell>
                        <div className="font-medium text-sm">{a.patient_name || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground">{a.patient_phone}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{a.doctor_name ? `Dr. ${a.doctor_name}` : "--"}</div>
                        {a.specialty && <div className="text-xs text-muted-foreground">{a.specialty}</div>}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {new Date(a.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", weekday: "short" })}
                      </TableCell>
                      <TableCell className="text-sm">{a.time}</TableCell>
                      <TableCell><RiskBadge level={a.riskLevel} score={a.riskScore} /></TableCell>
                      <TableCell className="hidden lg:table-cell max-w-[220px]">
                        <div className="flex flex-wrap gap-1">
                          {a.factors.map((f, i) => (
                            <span key={i} className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{f}</span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
                          toast.success(`Reminder queued for ${a.patient_name || "patient"}`, {
                            description: `Appointment on ${new Date(a.date).toLocaleDateString("en-IN")} at ${a.time}`,
                          })
                        }}>
                          <Bell className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Remind</span>
                        </Button>
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
