"use client"

import { useSession } from "next-auth/react"
import useSWR from "swr"
import { createBrowserClient } from "@/lib/supabase/client"
import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import {
  CalendarDays,
  CalendarPlus,
  FileText,
  Receipt,
  Clock,
  Stethoscope,
  Building2,
  ArrowRight,
  RefreshCw,
  AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import type { SessionUser } from "@/types/auth"

const statusColors: Record<string, string> = {
  confirmed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  completed: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  pending_payment: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
}

export default function PatientDashboard() {
  const { data: session } = useSession()
  const user = session?.user as SessionUser | undefined
  const phone = user?.patientPhone

  const supabase = createBrowserClient()

  const { data: stats, isLoading, error: fetchError, mutate } = useSWR(
    phone ? `patient-dashboard-${phone}` : null,
    async () => {
      const today = new Date().toISOString().split("T")[0]

      const [appts, upcoming, rxRecent, invoicesUnpaid, hospitals] = await Promise.all([
        supabase
          .from("appointments")
          .select("*", { count: "exact", head: true })
          .eq("patient_phone", phone!),
        supabase
          .from("appointments")
          .select("booking_id, doctor_name, specialty, date, time, status, tenant_id")
          .eq("patient_phone", phone!)
          .gte("date", today)
          .in("status", ["confirmed"])
          .order("date", { ascending: true })
          .limit(3),
        supabase
          .from("prescriptions")
          .select("prescription_id, doctor_name, diagnosis, items, created_at, tenant_id")
          .eq("patient_phone", phone!)
          .order("created_at", { ascending: false })
          .limit(3),
        supabase
          .from("invoices")
          .select("*", { count: "exact", head: true })
          .eq("patient_phone", phone!)
          .eq("payment_status", "unpaid"),
        supabase
          .from("appointments")
          .select("tenant_id")
          .eq("patient_phone", phone!),
      ])

      // Get unique hospital names
      const uniqueTenantIds = [...new Set((hospitals.data || []).map((a) => a.tenant_id).filter(Boolean))]
      let hospitalNames: Record<string, string> = {}
      if (uniqueTenantIds.length > 0) {
        const { data: tenants } = await supabase
          .from("tenants")
          .select("tenant_id, hospital_name")
          .in("tenant_id", uniqueTenantIds)
        hospitalNames = Object.fromEntries(
          (tenants || []).map((t) => [t.tenant_id, t.hospital_name])
        )
      }

      return {
        totalVisits: appts.count || 0,
        upcomingAppointments: upcoming.data || [],
        recentPrescriptions: rxRecent.data || [],
        unpaidBills: invoicesUnpaid.count || 0,
        upcomingCount: (upcoming.data || []).length,
        hospitalNames,
        hospitals: uniqueTenantIds,
      }
    },
    { revalidateOnFocus: false }
  )

  if (fetchError) {
    return (
      <div className="max-w-4xl mx-auto flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="w-12 h-12 text-destructive/40 mb-4" />
        <h2 className="text-lg font-semibold mb-1">Unable to load dashboard</h2>
        <p className="text-sm text-muted-foreground mb-4">Please check your connection and try again.</p>
        <Button variant="outline" onClick={() => mutate()} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Retry
        </Button>
      </div>
    )
  }

  if (isLoading || !stats) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 rounded-2xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </div>
    )
  }

  const statCards = [
    { label: "Total Visits", value: stats.totalVisits, icon: CalendarDays, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Upcoming", value: stats.upcomingCount, icon: Clock, color: "text-green-500", bg: "bg-green-500/10" },
    { label: "Prescriptions", value: stats.recentPrescriptions.length, icon: FileText, color: "text-purple-500", bg: "bg-purple-500/10" },
    { label: "Pending Bills", value: stats.unpaidBills, icon: Receipt, color: "text-amber-500", bg: "bg-amber-500/10" },
  ]

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return "Good morning"
    if (hour < 17) return "Good afternoon"
    return "Good evening"
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Welcome Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-gradient-to-r from-teal-500 via-cyan-600 to-blue-700 p-5 sm:p-6 text-white"
      >
        <p className="text-sm text-white/70">{getGreeting()}</p>
        <h1 className="text-xl sm:text-2xl font-bold mt-0.5">{user?.name}</h1>
        <div className="flex items-center flex-wrap gap-2 mt-3">
          {stats.hospitals.length > 0 && stats.hospitals.map((tid) => (
            <Badge key={tid} className="bg-white/20 text-white text-[10px] border-0">
              <Building2 className="w-3 h-3 mr-1" />
              {stats.hospitalNames[tid] || tid}
            </Badge>
          ))}
          <Button asChild size="sm" className="ml-auto bg-white/20 hover:bg-white/30 text-white border-0 rounded-xl text-xs gap-1">
            <Link href="/patient/book">
              <CalendarPlus className="w-3.5 h-3.5" />
              Book Appointment
            </Link>
          </Button>
        </div>
      </motion.div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-2", stat.bg)}>
                  <stat.icon className={cn("w-4 h-4", stat.color)} />
                </div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Upcoming Appointments */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Upcoming Appointments</h2>
          <Link href="/patient/appointments" className="text-xs text-primary flex items-center gap-1 hover:underline">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {stats.upcomingAppointments.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-6 text-center">
              <CalendarDays className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No upcoming appointments</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {stats.upcomingAppointments.map((apt) => (
              <Card key={apt.booking_id} className="border-0 shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
                    <Stethoscope className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{apt.doctor_name}</p>
                    <p className="text-xs text-muted-foreground">{apt.specialty}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">{apt.date} at {apt.time}</span>
                      {apt.tenant_id && stats.hospitalNames[apt.tenant_id] && (
                        <Badge variant="secondary" className="text-[10px]">
                          {stats.hospitalNames[apt.tenant_id]}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Badge className={cn("text-[10px] shrink-0", statusColors[apt.status] || "")}>
                    {apt.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Recent Prescriptions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Recent Prescriptions</h2>
          <Link href="/patient/prescriptions" className="text-xs text-primary flex items-center gap-1 hover:underline">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {stats.recentPrescriptions.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-6 text-center">
              <FileText className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No prescriptions yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {stats.recentPrescriptions.map((rx) => (
              <Card key={rx.prescription_id} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{rx.doctor_name}</p>
                      {rx.diagnosis && (
                        <p className="text-xs text-muted-foreground mt-0.5">{rx.diagnosis}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {rx.created_at ? new Date(rx.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""}
                    </span>
                  </div>
                  {rx.items && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(rx.items as { medicine_name: string }[]).slice(0, 3).map((item, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px]">
                          {item.medicine_name}
                        </Badge>
                      ))}
                      {(rx.items as { medicine_name: string }[]).length > 3 && (
                        <Badge variant="secondary" className="text-[10px]">
                          +{(rx.items as { medicine_name: string }[]).length - 3} more
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
