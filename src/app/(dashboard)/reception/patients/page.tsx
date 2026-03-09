"use client"

import { useState, useCallback, useRef } from "react"
import { useBranch } from "@/components/providers/branch-context"
import { createBrowserClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { motion } from "framer-motion"
import {
  Phone,
  User,
  Calendar,
  Loader2,
  Download,
  FileSpreadsheet,
  Clock,
  CreditCard,
  Stethoscope,
} from "lucide-react"
import { formatDate, formatTime, getTodayIST } from "@/lib/utils/date"
import { humanizeStatus, statusColors, formatPhone, getInitials } from "@/lib/utils/format"
import { SectionHeader } from "@/components/shared/section-header"
import { SearchBar } from "@/components/shared/search-bar"
import { PremiumDialog } from "@/components/shared/premium-dialog"
import type { Patient, Appointment } from "@/types/database"

interface PatientWithAppointments extends Patient {
  recentAppointments: Appointment[]
  totalAppointments: number
}

export default function PatientsPage() {
  const { activeTenantId: tenantId } = useBranch()

  const [query, setQuery] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [results, setResults] = useState<PatientWithAppointments[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Detail dialog
  const [selectedPatient, setSelectedPatient] = useState<PatientWithAppointments | null>(null)
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Keep ref for export
  const lastResults = useRef<PatientWithAppointments[]>([])

  const searchPatients = useCallback(async () => {
    if (!query.trim() && !fromDate && !toDate) {
      toast.error("Enter a search term or date range")
      return
    }
    setLoading(true)
    setSearched(true)

    const supabase = createBrowserClient()

    // Strategy: If date range is set, find patients from appointments in that range
    // Otherwise search patients by phone/name/booking_id
    let patientPhones: string[] = []
    let dateFilteredAppts: Appointment[] = []

    if (fromDate || toDate) {
      // Search appointments in date range first
      let apptQuery = supabase
        .from("appointments")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("date", { ascending: false })

      if (fromDate) apptQuery = apptQuery.gte("date", fromDate)
      if (toDate) apptQuery = apptQuery.lte("date", toDate)

      // If query is also provided, filter by it
      if (query.trim()) {
        const q = query.trim().replace(/[^a-zA-Z0-9\s\-\.]/g, "")
        const normalized = q.replace(/\D/g, "")
        const isPhone = normalized.length >= 7
        const isBookingId = q.toUpperCase().startsWith("BK")

        if (isBookingId) {
          apptQuery = apptQuery.ilike("booking_id", `%${q}%`)
        } else if (isPhone) {
          apptQuery = apptQuery.like("patient_phone", `%${normalized}%`)
        } else {
          apptQuery = apptQuery.ilike("patient_name", `%${q}%`)
        }
      }

      const { data: appts } = await apptQuery.limit(200)
      dateFilteredAppts = (appts || []) as Appointment[]
      patientPhones = [...new Set(dateFilteredAppts.map((a) => a.patient_phone))]

      if (patientPhones.length === 0) {
        setResults([])
        lastResults.current = []
        setLoading(false)
        return
      }

      // Fetch patient records for these phones
      const { data: patients } = await supabase
        .from("patients")
        .select("*")
        .eq("tenant_id", tenantId)
        .in("phone", patientPhones)

      const enriched: PatientWithAppointments[] = (patients || []).map((p: Patient) => {
        const appts = dateFilteredAppts.filter((a) => a.patient_phone === p.phone)
        return {
          ...p,
          recentAppointments: appts.slice(0, 5),
          totalAppointments: appts.length,
        }
      })

      setResults(enriched)
      lastResults.current = enriched
    } else {
      // No date range — search by query
      const q = query.trim().replace(/[^a-zA-Z0-9\s\-\.]/g, "")
      const normalized = q.replace(/\D/g, "")
      const isPhone = normalized.length >= 7
      const isBookingId = q.toUpperCase().startsWith("BK")

      if (isBookingId) {
        // Search appointments by booking ID
        const { data: appts } = await supabase
          .from("appointments")
          .select("*")
          .eq("tenant_id", tenantId)
          .ilike("booking_id", `%${q}%`)
          .limit(20)

        const phones = [...new Set((appts || []).map((a: Appointment) => a.patient_phone))]
        if (phones.length === 0) {
          setResults([])
          lastResults.current = []
          setLoading(false)
          return
        }

        const { data: patients } = await supabase
          .from("patients")
          .select("*")
          .eq("tenant_id", tenantId)
          .in("phone", phones)

        const enriched: PatientWithAppointments[] = (patients || []).map((p: Patient) => {
          const pAppts = (appts || []).filter((a: Appointment) => a.patient_phone === p.phone) as Appointment[]
          return {
            ...p,
            recentAppointments: pAppts.slice(0, 5),
            totalAppointments: pAppts.length,
          }
        })

        setResults(enriched)
        lastResults.current = enriched
      } else {
        // Search patients by phone or name
        let patientQuery = supabase
          .from("patients")
          .select("*")
          .eq("tenant_id", tenantId)
          .limit(50)

        if (isPhone) {
          patientQuery = patientQuery.or(`phone.like.%${normalized}%`)
        } else {
          patientQuery = patientQuery.ilike("name", `%${q}%`)
          // q is already sanitized above
        }

        const { data: patients } = await patientQuery

        if (!patients || patients.length === 0) {
          setResults([])
          lastResults.current = []
          setLoading(false)
          return
        }

        // Batch-fetch appointments for all patients in one query (fixes N+1)
        const phones = (patients as Patient[]).map((p) => p.phone)
        const orFilter = phones.map((p) => `patient_phone.eq.${p}`).join(",")
        const { data: allAppts } = await supabase
          .from("appointments")
          .select("*")
          .eq("tenant_id", tenantId)
          .or(orFilter)
          .order("date", { ascending: false })
          .limit(500)

        const apptsByPhone: Record<string, Appointment[]> = {}
        for (const a of (allAppts || []) as Appointment[]) {
          if (!apptsByPhone[a.patient_phone]) apptsByPhone[a.patient_phone] = []
          apptsByPhone[a.patient_phone].push(a)
        }

        const enriched: PatientWithAppointments[] = (patients as Patient[]).map((p) => {
          const pAppts = apptsByPhone[p.phone] || []
          return {
            ...p,
            recentAppointments: pAppts.slice(0, 5),
            totalAppointments: pAppts.length,
          }
        })

        setResults(enriched)
        lastResults.current = enriched
      }
    }

    setLoading(false)
  }, [query, fromDate, toDate, tenantId])

  // Load full appointment history for a patient
  const openPatientDetail = useCallback(async (patient: PatientWithAppointments) => {
    setSelectedPatient(patient)
    setLoadingDetail(true)
    const supabase = createBrowserClient()
    const { data } = await supabase
      .from("appointments")
      .select("*")
      .eq("patient_phone", patient.phone)
      .eq("tenant_id", tenantId)
      .order("date", { ascending: false })
      .limit(100)

    setAllAppointments((data || []) as Appointment[])
    setLoadingDetail(false)
  }, [tenantId])

  // Load all patients (today's) for quick view
  const loadToday = useCallback(async () => {
    setFromDate(getTodayIST())
    setToDate(getTodayIST())
    setQuery("")
    // Trigger search after state update
    setLoading(true)
    setSearched(true)

    const supabase = createBrowserClient()
    const today = getTodayIST()

    const { data: appts } = await supabase
      .from("appointments")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("date", today)
      .order("time")

    const phones = [...new Set((appts || []).map((a: Appointment) => a.patient_phone))]

    if (phones.length === 0) {
      setResults([])
      lastResults.current = []
      setLoading(false)
      return
    }

    const { data: patients } = await supabase
      .from("patients")
      .select("*")
      .eq("tenant_id", tenantId)
      .in("phone", phones)

    const enriched: PatientWithAppointments[] = (patients || []).map((p: Patient) => {
      const pAppts = (appts || []).filter((a: Appointment) => a.patient_phone === p.phone) as Appointment[]
      return {
        ...p,
        recentAppointments: pAppts,
        totalAppointments: pAppts.length,
      }
    })

    setResults(enriched)
    lastResults.current = enriched
    setLoading(false)
  }, [tenantId])

  // Export to Excel (CSV)
  const exportToExcel = useCallback(async () => {
    const data = lastResults.current
    if (data.length === 0) {
      toast.error("No data to export")
      return
    }

    setExporting(true)

    // Flatten patient + appointments into rows
    const rows: string[][] = []
    rows.push([
      "Patient Name",
      "Phone",
      "Age",
      "Gender",
      "Blood Group",
      "Allergies",
      "Chronic Diseases",
      "Emergency Contact",
      "Booking ID",
      "Date",
      "Time",
      "Doctor",
      "Specialty",
      "Status",
      "Payment Status",
      "Check-in Status",
      "Source",
    ])

    for (const p of data) {
      if (p.recentAppointments.length === 0) {
        // Patient with no appointments in range
        rows.push([
          p.name || "",
          p.phone || "",
          String(p.age || ""),
          p.gender || "",
          p.blood_group || "",
          p.allergies || "",
          p.chronic_diseases || "",
          p.emergency_contact || "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
        ])
      } else {
        for (const a of p.recentAppointments) {
          rows.push([
            p.name || "",
            p.phone || "",
            String(p.age || ""),
            p.gender || "",
            p.blood_group || "",
            p.allergies || "",
            p.chronic_diseases || "",
            p.emergency_contact || "",
            a.booking_id || "",
            a.date || "",
            a.time || "",
            a.doctor_name || "",
            a.specialty || "",
            a.status || "",
            a.payment_status || "",
            a.check_in_status || "",
            a.source || "",
          ])
        }
      }
    }

    // CSV encode
    const csv = rows
      .map((row) =>
        row.map((cell) => `"${(cell || "").replace(/"/g, '""')}"`).join(",")
      )
      .join("\n")

    // Add BOM for Excel UTF-8 compatibility
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    const dateStr = fromDate && toDate ? `${fromDate}_to_${toDate}` : getTodayIST()
    a.download = `patients_${dateStr}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success("Downloaded successfully")
    setExporting(false)
  }, [fromDate, toDate])


  return (
    <div className="space-y-6">
      <SectionHeader
        variant="glass"
        icon={<User className="w-6 h-6" />}
        gradient="gradient-purple"
        title="Patient Details"
        subtitle="Search patients by phone, name, or booking ID"
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadToday}>
              <Calendar className="w-4 h-4 mr-1" />
              Today
            </Button>
            {results.length > 0 && (
              <Button variant="outline" size="sm" onClick={exportToExcel} disabled={exporting}>
                {exporting ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-1" />
                )}
                Export CSV
              </Button>
            )}
          </div>
        }
      />

      {/* Search & Filters */}
      <SearchBar
        value={query}
        onChange={setQuery}
        onSubmit={searchPatients}
        placeholder="Search by phone, name, or booking ID (e.g. BK...)..."
        filters={
          <div className="flex items-center gap-2">
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-[130px] bg-transparent border-0 shadow-none" />
            <span className="text-xs text-muted-foreground">to</span>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-[130px] bg-transparent border-0 shadow-none" />
            {(fromDate || toDate) && (
              <Button variant="ghost" size="sm" onClick={() => { setFromDate(""); setToDate("") }}>Clear</Button>
            )}
          </div>
        }
        actions={
          <Button onClick={searchPatients} disabled={loading} size="sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
          </Button>
        }
      />

      {/* Results */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="rounded-xl bg-card border border-dashed border-border p-12 text-center">
          <motion.div
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <User className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          </motion.div>
          <p className="font-medium text-muted-foreground">No patients found</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Try a different search term or date range
          </p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <>
          <div className="table-container">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Age/Gender</TableHead>
                  <TableHead>Visits</TableHead>
                  <TableHead>Last Appointment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((patient) => {
                  const lastAppt = patient.recentAppointments[0]
                  return (
                    <TableRow
                      key={patient.phone}
                      className="hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => openPatientDetail(patient)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                            {getInitials(patient.name || "?")}
                          </div>
                          <span className="font-medium text-sm">{patient.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm flex items-center gap-1">
                          <Phone className="w-3 h-3 text-muted-foreground" />
                          {formatPhone(patient.phone)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {patient.age ? `${patient.age} yrs` : "—"}
                          {patient.gender ? ` / ${patient.gender}` : ""}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{patient.totalAppointments}</Badge>
                      </TableCell>
                      <TableCell>
                        {lastAppt ? (
                          <div className="text-sm">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-muted-foreground" />
                              {formatDate(lastAppt.date)}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {lastAppt.doctor_name} — {lastAppt.specialty}
                            </p>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {lastAppt ? (
                          <Badge
                            variant="secondary"
                            className={statusColors[lastAppt.status] || ""}
                          >
                            {humanizeStatus(lastAppt.status)}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="text-xs">
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {results.length} patients
              {fromDate && toDate && ` (${formatDate(fromDate)} — ${formatDate(toDate)})`}
            </p>
            <Button variant="outline" size="sm" onClick={exportToExcel} disabled={exporting}>
              {exporting ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4 mr-1" />
              )}
              Download as CSV
            </Button>
          </div>
        </>
      )}

      {/* Patient Detail Dialog */}
      <PremiumDialog
        open={!!selectedPatient}
        onOpenChange={() => setSelectedPatient(null)}
        title={selectedPatient?.name || "Patient"}
        subtitle={selectedPatient ? formatPhone(selectedPatient.phone) : undefined}
        icon={<User className="w-5 h-5" />}
        gradient="gradient-blue"
        maxWidth="sm:max-w-2xl"
      >
          {selectedPatient && (
            <div className="space-y-5">
              {/* Patient Info Card */}
              <div className="rounded-xl gradient-blue p-4 text-white">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-lg font-bold">
                    {getInitials(selectedPatient.name || "?")}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-lg">{selectedPatient.name}</p>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-white/70">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {formatPhone(selectedPatient.phone)}
                      </span>
                      {selectedPatient.age && <span>{selectedPatient.age} yrs</span>}
                      {selectedPatient.gender && <span>{selectedPatient.gender}</span>}
                      {selectedPatient.blood_group && (
                        <Badge variant="outline" className="text-white/90 border-white/30 text-[10px]">{selectedPatient.blood_group}</Badge>
                      )}
                    </div>
                  </div>
                </div>
                {/* Extra patient info */}
                <div className="grid grid-cols-2 gap-2 mt-3 text-sm text-white/80">
                  {selectedPatient.email && (
                    <div>
                      <span className="text-xs text-white/50">Email:</span>{" "}
                      {selectedPatient.email}
                    </div>
                  )}
                  {selectedPatient.address && (
                    <div>
                      <span className="text-xs text-white/50">Address:</span>{" "}
                      {selectedPatient.address}
                    </div>
                  )}
                  {selectedPatient.allergies && (
                    <div className="bg-white/10 rounded-lg px-2 py-1">
                      <span className="text-xs text-amber-300">Allergies:</span>{" "}
                      {selectedPatient.allergies}
                    </div>
                  )}
                  {selectedPatient.chronic_diseases && (
                    <div>
                      <span className="text-xs text-white/50">Chronic:</span>{" "}
                      {selectedPatient.chronic_diseases}
                    </div>
                  )}
                  {selectedPatient.emergency_contact && (
                    <div>
                      <span className="text-xs text-white/50">Emergency:</span>{" "}
                      {selectedPatient.emergency_contact}
                    </div>
                  )}
                </div>
              </div>

              {/* Appointment History */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-3">
                  Appointment History ({allAppointments.length})
                </p>
                {loadingDetail ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 rounded-lg" />
                    ))}
                  </div>
                ) : allAppointments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No appointments found
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                    {allAppointments.map((appt) => (
                      <div
                        key={appt.booking_id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              {formatDate(appt.date)}
                            </span>
                            {appt.time && (
                              <span className="text-sm text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatTime(appt.time)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Stethoscope className="w-3 h-3" />
                            {appt.doctor_name}
                            {appt.specialty && (
                              <span className="text-muted-foreground/60">
                                ({appt.specialty})
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">
                              {appt.booking_id}
                            </Badge>
                            {appt.source && (
                              <span className="text-[10px] text-muted-foreground">
                                via {appt.source}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          <Badge
                            variant="secondary"
                            className={statusColors[appt.status] || ""}
                          >
                            {humanizeStatus(appt.status)}
                          </Badge>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground justify-end">
                            <CreditCard className="w-3 h-3" />
                            {humanizeStatus(appt.payment_status || "pending")}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
      </PremiumDialog>
    </div>
  )
}
