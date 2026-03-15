"use client"

import { useMemo } from "react"
import { useSession } from "next-auth/react"
import useSWR from "swr"
import { createBrowserClient } from "@/lib/supabase/client"
import { SectionHeader } from "@/components/shared/section-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import {
  LazyLineChart as LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "@/components/ui/lazy-recharts"
import {
  Activity,
  Heart,
  Stethoscope,
  Pill,
  TestTube,
  Calendar,
  FileText,
  Download,
  Thermometer,
  Droplets,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { SessionUser } from "@/types/auth"

interface Condition { condition_name: string; severity?: string }
interface Allergy { allergen: string; severity?: string; reaction?: string }
interface Vital { created_at: string; bp_systolic?: number; bp_diastolic?: number; pulse?: number; spo2?: number; temperature?: number; weight?: number }
interface PrescriptionItem { name?: string; medicine_name?: string; dosage?: string; frequency?: string; duration?: string }

export default function HealthPage() {
  const { data: session } = useSession()
  const user = session?.user as SessionUser | undefined
  const phone = user?.patientPhone
  const supabase = createBrowserClient()

  const { data, isLoading } = useSWR(
    phone ? `patient-health-${phone}` : null,
    async () => {
      const [appts, rxs, vitals, labs, conditions, allergies] = await Promise.all([
        supabase
          .from("appointments")
          .select("booking_id,doctor_name,specialty,date,time,status,tenant_id")
          .eq("patient_phone", phone!)
          .eq("status", "completed")
          .order("date", { ascending: false })
          .limit(50),
        supabase
          .from("prescriptions")
          .select("prescription_id,doctor_name,diagnosis,items,follow_up_date,created_at")
          .eq("patient_phone", phone!)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("vitals")
          .select("*")
          .eq("patient_phone", phone!)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("lab_orders")
          .select("id,test_name,status,results,created_at,doctor_name")
          .eq("patient_phone", phone!)
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("medical_conditions")
          .select("*")
          .eq("patient_phone", phone!),
        supabase
          .from("allergies")
          .select("*")
          .eq("patient_phone", phone!),
      ])

      return {
        appointments: appts.data || [],
        prescriptions: rxs.data || [],
        vitals: vitals.data || [],
        labOrders: labs.data || [],
        conditions: conditions.data || [],
        allergies: allergies.data || [],
      }
    }
  )

  // Vitals chart data
  const vitalsChart = useMemo(() => {
    if (!data?.vitals?.length) return []
    return [...data.vitals]
      .reverse()
      .map((v) => ({
        date: new Date(v.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        systolic: v.bp_systolic || null,
        diastolic: v.bp_diastolic || null,
        pulse: v.pulse || null,
        spo2: v.spo2 || null,
        temp: v.temperature || null,
        weight: v.weight || null,
      }))
  }, [data?.vitals])

  // Timeline data (all events merged)
  const timeline = useMemo(() => {
    if (!data) return []
    const events: { date: string; type: string; title: string; detail: string; icon: string }[] = []

    data.appointments.forEach((a) => {
      events.push({
        date: a.date,
        type: "appointment",
        title: `Consultation with Dr. ${a.doctor_name}`,
        detail: a.specialty || "",
        icon: "stethoscope",
      })
    })

    data.prescriptions.forEach((rx) => {
      events.push({
        date: (rx.created_at || "").slice(0, 10),
        type: "prescription",
        title: `Prescription: ${rx.diagnosis || "—"}`,
        detail: `${(rx.items || []).length} medicine(s) by Dr. ${rx.doctor_name || "—"}`,
        icon: "pill",
      })
    })

    data.labOrders.forEach((lab) => {
      events.push({
        date: (lab.created_at || "").slice(0, 10),
        type: "lab",
        title: `Lab: ${lab.test_name || "Test"}`,
        detail: `Status: ${lab.status} | Dr. ${lab.doctor_name || "—"}`,
        icon: "test",
      })
    })

    return events.sort((a, b) => b.date.localeCompare(a.date))
  }, [data])

  // Top diagnoses
  const topDiagnoses = useMemo(() => {
    if (!data?.prescriptions?.length) return []
    const map: Record<string, number> = {}
    data.prescriptions.forEach((rx) => {
      const d = (rx.diagnosis || "").trim()
      if (d) map[d] = (map[d] || 0) + 1
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [data?.prescriptions])

  const handleExport = async () => {
    if (!data) return
    const lines: string[] = []
    lines.push("HEALTH RECORD EXPORT")
    lines.push(`Patient: ${user?.name || "—"}`)
    lines.push(`Phone: ${phone}`)
    lines.push(`Date: ${new Date().toLocaleDateString("en-IN")}`)
    lines.push("")

    if (data.conditions.length > 0) {
      lines.push("=== MEDICAL CONDITIONS ===")
      data.conditions.forEach((c: Condition) => lines.push(`- ${c.condition_name} (${c.severity || "—"})`))
      lines.push("")
    }

    if (data.allergies.length > 0) {
      lines.push("=== ALLERGIES ===")
      data.allergies.forEach((a: Allergy) => lines.push(`- ${a.allergen} (${a.severity || "—"}) — ${a.reaction || ""}`))
      lines.push("")
    }

    lines.push("=== CONSULTATION HISTORY ===")
    data.appointments.forEach((a) => {
      lines.push(`${a.date} | Dr. ${a.doctor_name} (${a.specialty || "—"})`)
    })
    lines.push("")

    lines.push("=== PRESCRIPTIONS ===")
    data.prescriptions.forEach((rx) => {
      lines.push(`${(rx.created_at || "").slice(0, 10)} | ${rx.diagnosis || "—"} | Dr. ${rx.doctor_name || "—"}`)
      ;(rx.items || []).forEach((m: PrescriptionItem) => {
        lines.push(`    - ${m.name || m.medicine_name || "—"} ${m.dosage || ""} ${m.frequency || ""} ${m.duration || ""}`)
      })
    })
    lines.push("")

    if (data.vitals.length > 0) {
      lines.push("=== VITALS HISTORY ===")
      data.vitals.slice(0, 20).forEach((v: Vital) => {
        lines.push(`${new Date(v.created_at).toLocaleDateString("en-IN")} | BP: ${v.bp_systolic || "—"}/${v.bp_diastolic || "—"} | Pulse: ${v.pulse || "—"} | SpO2: ${v.spo2 || "—"}% | Temp: ${v.temperature || "—"}°F | Weight: ${v.weight || "—"} kg`)
      })
    }

    const blob = new Blob([lines.join("\n")], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `health-record-${phone}-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-[300px]" />
          <Skeleton className="h-[300px]" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        variant="glass"
        icon={<Heart className="w-6 h-6" />}
        gradient="gradient-red"
        title="My Health"
        subtitle="Your medical history, vitals trends, and health records"
        action={
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!data}>
            <Download className="w-4 h-4 mr-1" /> Export Records
          </Button>
        }
      />

      {/* Health Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <Stethoscope className="w-5 h-5 mx-auto mb-1 text-blue-500" />
            <p className="text-2xl font-bold">{data?.appointments.length || 0}</p>
            <p className="text-xs text-muted-foreground">Total Visits</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <Pill className="w-5 h-5 mx-auto mb-1 text-green-500" />
            <p className="text-2xl font-bold">{data?.prescriptions.length || 0}</p>
            <p className="text-xs text-muted-foreground">Prescriptions</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <TestTube className="w-5 h-5 mx-auto mb-1 text-purple-500" />
            <p className="text-2xl font-bold">{data?.labOrders.length || 0}</p>
            <p className="text-xs text-muted-foreground">Lab Tests</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <Activity className="w-5 h-5 mx-auto mb-1 text-orange-500" />
            <p className="text-2xl font-bold">{data?.conditions.length || 0}</p>
            <p className="text-xs text-muted-foreground">Conditions</p>
          </CardContent>
        </Card>
      </div>

      {/* Conditions & Allergies */}
      {((data?.conditions?.length || 0) > 0 || (data?.allergies?.length || 0) > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(data?.conditions?.length || 0) > 0 && (
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Medical Conditions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data!.conditions.map((c: Condition, i: number) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm">{c.condition_name}</span>
                    <Badge variant={c.severity === "severe" ? "destructive" : "secondary"} className="text-xs">
                      {c.severity || "—"}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {(data?.allergies?.length || 0) > 0 && (
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Allergies</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data!.allergies.map((a: Allergy, i: number) => (
                  <div key={i} className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">{a.allergen}</span>
                      {a.reaction && <span className="text-xs text-muted-foreground ml-2">({a.reaction})</span>}
                    </div>
                    <Badge variant={a.severity === "severe" ? "destructive" : "secondary"} className="text-xs">
                      {a.severity || "—"}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Tabs defaultValue="vitals" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="vitals">Vitals Trends</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="diagnoses">Diagnoses</TabsTrigger>
        </TabsList>

        {/* Vitals Trends */}
        <TabsContent value="vitals" className="space-y-4">
          {vitalsChart.length > 1 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Blood Pressure */}
              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Droplets className="w-4 h-4 text-red-500" />
                    Blood Pressure
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={vitalsChart}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 9 }} domain={[60, 180]} />
                      <RechartsTooltip contentStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="systolic" stroke="#ef4444" strokeWidth={2} dot={{ r: 2 }} name="Systolic" connectNulls />
                      <Line type="monotone" dataKey="diastolic" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} name="Diastolic" connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Pulse & SpO2 */}
              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Heart className="w-4 h-4 text-pink-500" />
                    Pulse & SpO2
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={vitalsChart}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 9 }} domain={[50, 110]} />
                      <RechartsTooltip contentStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="pulse" stroke="#ec4899" strokeWidth={2} dot={{ r: 2 }} name="Pulse (bpm)" connectNulls />
                      <Line type="monotone" dataKey="spo2" stroke="#06b6d4" strokeWidth={2} dot={{ r: 2 }} name="SpO2 (%)" connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Weight */}
              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Activity className="w-4 h-4 text-green-500" />
                    Weight
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={vitalsChart.filter((v) => v.weight)}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 9 }} />
                      <RechartsTooltip contentStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="weight" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} name="Weight (kg)" connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Temperature */}
              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Thermometer className="w-4 h-4 text-orange-500" />
                    Temperature
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={vitalsChart.filter((v) => v.temp)}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 9 }} domain={[96, 104]} />
                      <RechartsTooltip contentStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="temp" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} name="Temp (°F)" connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="glass-card">
              <CardContent className="py-12 text-center text-muted-foreground">
                <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No vitals recorded yet. Vitals are captured during consultations.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Timeline */}
        <TabsContent value="timeline">
          <Card className="glass-card">
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                {timeline.length > 0 ? (
                  <div className="divide-y">
                    {timeline.map((event, i) => (
                      <div key={i} className="flex gap-3 px-4 py-3">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                          event.type === "appointment" && "bg-blue-100 dark:bg-blue-900/30",
                          event.type === "prescription" && "bg-green-100 dark:bg-green-900/30",
                          event.type === "lab" && "bg-purple-100 dark:bg-purple-900/30",
                        )}>
                          {event.type === "appointment" && <Stethoscope className="w-4 h-4 text-blue-600" />}
                          {event.type === "prescription" && <Pill className="w-4 h-4 text-green-600" />}
                          {event.type === "lab" && <TestTube className="w-4 h-4 text-purple-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{event.title}</p>
                          <p className="text-xs text-muted-foreground">{event.detail}</p>
                          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                            {new Date(event.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center text-muted-foreground">
                    <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No health events recorded yet.</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Diagnoses */}
        <TabsContent value="diagnoses">
          <Card className="glass-card">
            <CardContent className="pt-6">
              {topDiagnoses.length > 0 ? (
                <div className="space-y-3">
                  {topDiagnoses.map(([name, count], i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ["#3b82f6", "#059669", "#d97706", "#dc2626", "#7c3aed", "#06b6d4"][i] || "#94a3b8" }} />
                        <span className="text-sm">{name}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">{count} visit{count > 1 ? "s" : ""}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No diagnoses recorded yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
