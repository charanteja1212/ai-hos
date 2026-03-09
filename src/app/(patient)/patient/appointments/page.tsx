"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  CalendarDays,
  Stethoscope,
  Search,
  Building2,
  Clock,
  XCircle,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { usePatientAppointments } from "@/hooks/use-patient-appointments"
import Link from "next/link"
import type { SessionUser } from "@/types/auth"

const statusColors: Record<string, string> = {
  confirmed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  completed: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  pending_payment: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  no_show: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
}

type Tab = "upcoming" | "past" | "all"

export default function PatientAppointmentsPage() {
  const { data: session } = useSession()
  const user = session?.user as SessionUser | undefined
  const phone = user?.patientPhone

  const { appointments, hospitalNames, isLoading, mutate } = usePatientAppointments(phone)
  const [tab, setTab] = useState<Tab>("all")
  const [search, setSearch] = useState("")
  const [cancelTarget, setCancelTarget] = useState<{ booking_id: string; doctor_name: string; date: string; time: string; tenant_id: string } | null>(null)
  const [cancelling, setCancelling] = useState(false)

  const today = new Date().toISOString().split("T")[0]

  const filtered = appointments.filter((apt) => {
    if (tab === "upcoming" && (apt.date < today || apt.status === "cancelled" || apt.status === "completed")) return false
    if (tab === "past" && apt.date >= today && apt.status !== "completed" && apt.status !== "cancelled") return false

    if (search) {
      const q = search.toLowerCase()
      return (
        apt.doctor_name?.toLowerCase().includes(q) ||
        apt.specialty?.toLowerCase().includes(q) ||
        apt.booking_id?.toLowerCase().includes(q)
      )
    }
    return true
  })

  const canCancel = (apt: { status: string; date: string }) => {
    return apt.status === "confirmed" && apt.date >= today
  }

  const handleCancel = async () => {
    if (!cancelTarget) return
    setCancelling(true)
    try {
      const res = await fetch("/api/patient-appointment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel",
          booking_id: cancelTarget.booking_id,
          tenant_id: cancelTarget.tenant_id,
        }),
      })
      const data = await res.json()
      if (res.ok && !data.error) {
        toast.success("Appointment cancelled", {
          description: `${cancelTarget.doctor_name} on ${cancelTarget.date} at ${cancelTarget.time}`,
        })
        mutate()
      } else {
        toast.error("Failed to cancel", { description: data.error || data.message || "Please try again" })
      }
    } catch {
      toast.error("Failed to cancel", { description: "Network error. Please try again." })
    } finally {
      setCancelling(false)
      setCancelTarget(null)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="h-10 rounded-xl" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    )
  }

  const upcomingCount = appointments.filter((a) => a.date >= today && a.status !== "cancelled" && a.status !== "completed").length
  const pastCount = appointments.length - upcomingCount

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "all", label: "All", count: appointments.length },
    { key: "upcoming", label: "Upcoming", count: upcomingCount },
    { key: "past", label: "Past", count: pastCount },
  ]

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div>
        <h1 className="text-lg font-bold">Appointments</h1>
        <p className="text-sm text-muted-foreground">{appointments.length} total appointments</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
              tab === t.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            {t.label}
            {t.count > 0 && (
              <span className={cn(
                "ml-1.5 text-[10px] rounded-full px-1.5 py-0.5 font-semibold",
                tab === t.key ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by doctor, specialty, or booking ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 rounded-xl"
        />
      </div>

      {/* Appointment List */}
      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            {search ? (
              <>
                <Search className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No results for &ldquo;{search}&rdquo;</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Try a different doctor name, specialty, or booking ID</p>
                <Button variant="ghost" size="sm" className="mt-3 text-xs" onClick={() => setSearch("")}>
                  Clear search
                </Button>
              </>
            ) : (
              <>
                <CalendarDays className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {tab === "upcoming" ? "No upcoming appointments" : tab === "past" ? "No past appointments" : "No appointments yet"}
                </p>
                {tab !== "past" && (
                  <Button asChild variant="outline" size="sm" className="mt-3 text-xs rounded-xl gap-1">
                    <Link href="/patient/book">
                      <CalendarDays className="w-3 h-3" />
                      Book Appointment
                    </Link>
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((apt, i) => (
            <motion.div
              key={apt.booking_id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Stethoscope className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{apt.doctor_name}</p>
                        <Badge className={cn("text-[10px] shrink-0", statusColors[apt.status] || "")}>
                          {apt.status?.replace("_", " ")}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{apt.specialty}</p>
                      <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          {apt.date}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {apt.time}
                        </span>
                        {apt.tenant_id && hospitalNames[apt.tenant_id] && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {hospitalNames[apt.tenant_id]}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-[10px] text-muted-foreground/60 font-mono">{apt.booking_id}</p>
                        {canCancel(apt) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 rounded-lg"
                            onClick={() => setCancelTarget({
                              booking_id: apt.booking_id,
                              doctor_name: apt.doctor_name,
                              date: apt.date,
                              time: apt.time,
                              tenant_id: apt.tenant_id || "",
                            })}
                          >
                            <XCircle className="w-3 h-3" />
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Appointment?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget && (
                <>
                  Are you sure you want to cancel your appointment with{" "}
                  <span className="font-medium text-foreground">{cancelTarget.doctor_name}</span> on{" "}
                  <span className="font-medium text-foreground">{cancelTarget.date}</span> at{" "}
                  <span className="font-medium text-foreground">{cancelTarget.time}</span>?
                  This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep Appointment</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={cancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelling ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  Cancelling...
                </>
              ) : (
                "Yes, Cancel"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
