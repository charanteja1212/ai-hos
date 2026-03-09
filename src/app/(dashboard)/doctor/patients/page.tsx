"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useBranch } from "@/components/providers/branch-context"
import { createBrowserClient } from "@/lib/supabase/client"
import { getTodayIST, formatDate, formatTime } from "@/lib/utils/date"
import { humanizeStatus, statusColors, formatPhone, getInitials } from "@/lib/utils/format"
import { StatCard } from "@/components/reception/stat-card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PremiumDialog } from "@/components/shared/premium-dialog"
import { Card, CardContent } from "@/components/ui/card"
import { motion } from "framer-motion"
import {
  Users,
  CalendarDays,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Download,
  Phone,
  Pill,
  FileText,
  Heart,
  Activity,
} from "lucide-react"
import { SectionHeader } from "@/components/shared/section-header"
import { SearchBar } from "@/components/shared/search-bar"
import type { SessionUser } from "@/types/auth"
import type { Appointment, Patient, Prescription } from "@/types/database"

export default function DoctorPatientsPage() {
  const { data: session } = useSession()
  const user = session?.user as SessionUser | undefined
  const { activeTenantId: tenantId } = useBranch()
  const doctorId = user?.doctorId || ""
  const today = getTodayIST()

  const PAGE_SIZE = 50
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)

  // Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")

  // Detail dialog
  const [selectedPatient, setSelectedPatient] = useState<{
    patient: Patient | null
    appointments: Appointment[]
    prescriptions: Prescription[]
  } | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const fetchAppointments = useCallback(async () => {
    if (!doctorId) return
    setRefreshing(true)
    const supabase = createBrowserClient()
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = supabase
      .from("appointments")
      .select("*", { count: "exact" })
      .eq("tenant_id", tenantId)
      .eq("doctor_id", doctorId)
      .order("date", { ascending: false })
      .order("time", { ascending: false })

    if (fromDate) query = query.gte("date", fromDate)
    if (toDate) query = query.lte("date", toDate)
    if (statusFilter && statusFilter !== "all") query = query.eq("status", statusFilter)

    if (searchQuery.trim()) {
      const q = searchQuery.trim().replace(/[^a-zA-Z0-9\s\-\.]/g, "")
      const isPhone = q.replace(/\D/g, "").length >= 7
      if (isPhone) {
        query = query.like("patient_phone", `%${q.replace(/\D/g, "")}%`)
      } else {
        query = query.ilike("patient_name", `%${q}%`)
      }
    }

    const { data, count, error } = await query.range(from, to)
    if (!error) {
      setAppointments((data || []) as Appointment[])
      setTotalCount(count || 0)
    }
    setLoading(false)
    setRefreshing(false)
  }, [doctorId, tenantId, fromDate, toDate, statusFilter, searchQuery, page])

  useEffect(() => {
    fetchAppointments()
  }, [fetchAppointments])

  // Auto-refresh every 15s
  useEffect(() => {
    const interval = setInterval(fetchAppointments, 15000)
    return () => clearInterval(interval)
  }, [fetchAppointments])

  // Reset page on filter change
  useEffect(() => { setPage(0) }, [searchQuery, statusFilter, fromDate, toDate])

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  // Stats
  const totalPatients = new Set(appointments.map((a) => a.patient_phone)).size
  const confirmed = appointments.filter((a) => a.status === "confirmed").length
  const completedCount = appointments.filter((a) => a.status === "completed").length
  const cancelled = appointments.filter((a) => a.status === "cancelled").length

  // Quick date buttons
  const setToday = () => { setFromDate(today); setToDate(today) }
  const setThisWeek = () => {
    const d = new Date()
    const dayOfWeek = d.getDay()
    const monday = new Date(d)
    monday.setDate(d.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
    setFromDate(monday.toISOString().split("T")[0])
    setToDate(today)
  }
  const setThisMonth = () => {
    const d = new Date()
    setFromDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`)
    setToDate(today)
  }
  const setAllTime = () => { setFromDate(""); setToDate("") }

  // Open patient detail dialog
  const openPatientDetail = async (patientPhone: string, patientName?: string) => {
    setDetailLoading(true)
    setSelectedPatient({ patient: null, appointments: [], prescriptions: [] })

    const supabase = createBrowserClient()

    // Look up the patient record by phone
    const { data: patientRow } = await supabase
      .from("patients")
      .select("*")
      .eq("tenant_id", tenantId)
      .or(`phone.eq.${patientPhone.replace(/[^a-zA-Z0-9\s\-\.]/g, "")},phone.eq.+${patientPhone.replace(/[^a-zA-Z0-9\s\-\.]/g, "")}`)
      .limit(1)
      .maybeSingle()

    // If the patient record name doesn't match the clicked name,
    // this is a dependent — override display with appointment data
    let patientData = patientRow as Patient | null
    if (patientData && patientName && patientData.name.toLowerCase() !== patientName.toLowerCase()) {
      patientData = {
        ...patientData,
        name: patientName,
        // Clear fields that belong to the primary patient, not the dependent
        age: undefined,
        gender: undefined,
        blood_group: undefined,
        allergies: undefined,
        chronic_diseases: undefined,
      }
    }

    // Filter appointments & prescriptions to only this specific patient name
    const [aptsRes, rxRes] = await Promise.all([
      supabase
        .from("appointments")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("doctor_id", doctorId)
        .eq("patient_phone", patientPhone)
        .order("date", { ascending: false })
        .limit(50),
      supabase
        .from("prescriptions")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("doctor_id", doctorId)
        .eq("patient_phone", patientPhone)
        .order("created_at", { ascending: false })
        .limit(20),
    ])

    // If this is a dependent, only show their appointments (not the primary patient's)
    const allApts = (aptsRes.data || []) as Appointment[]
    const filteredApts = patientName
      ? allApts.filter((a) => a.patient_name?.toLowerCase() === patientName.toLowerCase())
      : allApts

    // Show all prescriptions for this phone (can't filter by name since prescriptions don't always have patient_name)
    setSelectedPatient({
      patient: patientData || null,
      appointments: filteredApts.length > 0 ? filteredApts : allApts,
      prescriptions: (rxRes.data || []) as Prescription[],
    })
    setDetailLoading(false)
  }

  // CSV export
  const exportCSV = () => {
    const headers = ["Patient Name", "Phone", "Date", "Time", "Status", "Booking ID", "Payment"]
    const rows = appointments.map((a) => [
      a.patient_name || "",
      a.patient_phone || "",
      a.date || "",
      a.time || "",
      a.status || "",
      a.booking_id || "",
      a.payment_status || "",
    ])
    const csv = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `my-patients-${today}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        variant="glass"
        icon={<Users className="w-6 h-6" />}
        gradient="gradient-blue"
        title="My Patients"
        subtitle="All patients who have booked appointments with you"
        badge={<Badge variant="secondary" className="text-xs">{totalPatients} patients</Badge>}
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 stagger-children">
        <StatCard label="Unique Patients" value={totalPatients} gradient="gradient-blue" icon={<Users className="w-10 h-10" />} index={0} />
        <StatCard label="Confirmed" value={confirmed} gradient="gradient-green" icon={<CalendarDays className="w-10 h-10" />} index={1} />
        <StatCard label="Completed" value={completedCount} gradient="gradient-purple" icon={<CheckCircle2 className="w-10 h-10" />} index={2} />
        <StatCard label="Cancelled" value={cancelled} gradient="gradient-orange" icon={<XCircle className="w-10 h-10" />} index={3} />
      </div>

      {/* Filters */}
      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search by name, phone, or booking ID..."
        filters={
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px] bg-transparent border-0 shadow-none">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="pending_payment">Pending Payment</SelectItem>
                <SelectItem value="no_show">No Show</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-[130px] bg-transparent border-0 shadow-none" />
            <span className="text-xs text-muted-foreground">to</span>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-[130px] bg-transparent border-0 shadow-none" />
          </div>
        }
        actions={
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={setToday}>Today</Button>
            <Button variant="ghost" size="sm" onClick={setThisWeek}>Week</Button>
            <Button variant="ghost" size="sm" onClick={setThisMonth}>Month</Button>
            <Button variant="ghost" size="sm" onClick={setAllTime}>All</Button>
            <Button variant="outline" size="sm" onClick={fetchAppointments} disabled={refreshing}>
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={appointments.length === 0}>
              <Download className="w-4 h-4" />
            </Button>
          </div>
        }
      />

      {/* Table */}
      {appointments.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity }}>
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            </motion.div>
            <p className="font-medium">No patients found</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Try adjusting your filters or date range</p>
          </CardContent>
        </Card>
      ) : (
        <div className="table-container">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Patient</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Booking ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {appointments.map((apt) => (
                <TableRow
                  key={apt.booking_id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => openPatientDetail(apt.patient_phone, apt.patient_name)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                        {getInitials(apt.patient_name)}
                      </div>
                      <span className="font-medium text-sm">{apt.patient_name || "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{formatPhone(apt.patient_phone)}</TableCell>
                  <TableCell className="text-sm">{formatDate(apt.date)}</TableCell>
                  <TableCell className="text-sm">{formatTime(apt.time)}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[apt.status] || "bg-muted text-foreground"}`}>
                      {humanizeStatus(apt.status)}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">{apt.booking_id}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount} appointments
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
      {totalPages <= 1 && (
        <p className="text-xs text-muted-foreground text-right">
          {totalCount} appointments &middot; {totalPatients} unique patients
        </p>
      )}

      {/* Patient Detail Dialog */}
      <PremiumDialog
        open={!!selectedPatient}
        onOpenChange={() => setSelectedPatient(null)}
        title="Patient Details"
        subtitle="Medical history and appointment records"
        icon={<Users className="w-5 h-5" />}
        gradient="bg-gradient-to-r from-blue-600 to-indigo-600"
        maxWidth="sm:max-w-2xl"
      >
          {detailLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl" />
            </div>
          ) : selectedPatient && (
            <div className="space-y-4">
              {/* Patient info header */}
              <div className="rounded-xl gradient-blue p-4 text-white">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-lg font-bold">
                    {getInitials(selectedPatient.patient?.name)}
                  </div>
                  <div>
                    <p className="font-bold text-lg">{selectedPatient.patient?.name || "Unknown"}</p>
                    <div className="flex items-center gap-3 text-sm text-white/70">
                      <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{formatPhone(selectedPatient.patient?.phone)}</span>
                      {selectedPatient.patient?.age && <span>Age: {selectedPatient.patient.age}</span>}
                      {selectedPatient.patient?.gender && <span>{selectedPatient.patient.gender}</span>}
                      {selectedPatient.patient?.blood_group && <span>Blood: {selectedPatient.patient.blood_group}</span>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Medical info */}
              {(selectedPatient.patient?.allergies || selectedPatient.patient?.chronic_diseases) && (
                <div className="grid grid-cols-2 gap-3">
                  {selectedPatient.patient?.allergies && (
                    <div className="rounded-lg bg-destructive/10 p-3">
                      <p className="text-xs font-medium text-destructive mb-1 flex items-center gap-1"><Heart className="w-3 h-3" />Allergies</p>
                      <p className="text-sm">{selectedPatient.patient.allergies}</p>
                    </div>
                  )}
                  {selectedPatient.patient?.chronic_diseases && (
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1"><Activity className="w-3 h-3" />Chronic</p>
                      <p className="text-sm">{selectedPatient.patient.chronic_diseases}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Appointments with this doctor */}
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4" /> Appointments ({selectedPatient.appointments.length})
                </h3>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {selectedPatient.appointments.map((apt) => (
                    <div key={apt.booking_id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 text-sm">
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{formatDate(apt.date)}</span>
                        <span className="text-muted-foreground">{formatTime(apt.time)}</span>
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[apt.status] || "bg-muted text-foreground"}`}>
                        {humanizeStatus(apt.status)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Prescriptions */}
              {selectedPatient.prescriptions.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Prescription History ({selectedPatient.prescriptions.length})
                  </h3>
                  <div className="space-y-2 max-h-[250px] overflow-y-auto">
                    {selectedPatient.prescriptions.map((rx) => (
                      <div key={rx.prescription_id} className="rounded-lg border border-border p-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {rx.created_at ? formatDate(rx.created_at.split("T")[0]) : "—"}
                          </span>
                          <Badge variant="outline" className="text-[10px]">{rx.prescription_id}</Badge>
                        </div>
                        {rx.diagnosis && <p className="text-sm font-medium">{rx.diagnosis}</p>}
                        {rx.items && rx.items.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {rx.items.map((item, i) => (
                              <Badge key={i} variant="secondary" className="text-[10px] gap-1">
                                <Pill className="w-2.5 h-2.5" />
                                {item.medicine_name} — {item.dosage}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
      </PremiumDialog>
    </div>
  )
}
