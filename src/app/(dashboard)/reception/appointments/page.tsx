"use client"

import { useState, useEffect, useCallback } from "react"
import { useBranch } from "@/components/providers/branch-context"
import { toast } from "sonner"
import { createBrowserClient } from "@/lib/supabase/client"
import { getTodayIST, formatDate, formatTime } from "@/lib/utils/date"
import { humanizeStatus, statusColors, checkInColors, formatPhone } from "@/lib/utils/format"
import { CheckInDialog } from "@/components/reception/check-in-dialog"
import { AdmitDialog } from "@/components/reception/admit-dialog"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { motion } from "framer-motion"
import {
  Calendar,
  MoreVertical,
  XCircle,
  Clock,
  CreditCard,
  UserCheck,
  BedDouble,
  Loader2,
  RefreshCw,
  Download,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react"
import { SectionHeader } from "@/components/shared/section-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { SearchBar } from "@/components/shared/search-bar"
import { StatCard } from "@/components/reception/stat-card"
import type { Doctor, Appointment } from "@/types/database"

export default function AppointmentsPage() {
  const { activeTenantId: tenantId } = useBranch()

  // Filter state
  const [fromDate, setFromDate] = useState(getTodayIST())
  const [toDate, setToDate] = useState(getTodayIST())
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [doctorFilter, setDoctorFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")

  // Data state
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  // Pagination
  const PAGE_SIZE = 50
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)

  // Sort
  const [sortField, setSortField] = useState<string>("date")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  // Dialog state
  const [checkInAppt, setCheckInAppt] = useState<Appointment | null>(null)
  const [admitAppt, setAdmitAppt] = useState<Appointment | null>(null)
  const [cancelBookingId, setCancelBookingId] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)

  // Fetch doctors on mount
  useEffect(() => {
    const supabase = createBrowserClient()
    supabase
      .from("doctors")
      .select("*")
      .eq("tenant_id", tenantId)
      .then(({ data }) => {
        if (data) setDoctors(data as Doctor[])
      })
  }, [tenantId])

  // Reset page when filters change
  useEffect(() => {
    setPage(0)
  }, [fromDate, toDate, statusFilter, doctorFilter, searchQuery, sortField, sortDir])

  // Fetch appointments with server-side pagination
  const fetchData = useCallback(async () => {
    setIsLoading(true)
    const supabase = createBrowserClient()

    let query = supabase
      .from("appointments")
      .select("*", { count: "exact" })
      .eq("tenant_id", tenantId)
      .order(sortField, { ascending: sortDir === "asc" })

    if (sortField !== "time") query = query.order("time", { ascending: true })

    if (fromDate) query = query.gte("date", fromDate)
    if (toDate) query = query.lte("date", toDate)
    if (statusFilter !== "all") query = query.eq("status", statusFilter)
    if (doctorFilter !== "all") query = query.eq("doctor_id", doctorFilter)
    if (searchQuery) {
      const q = searchQuery.trim()
      const normalized = q.replace(/\D/g, "")
      const isPhone = normalized.length >= 7
      const isBookingId = q.toUpperCase().startsWith("BK")
      if (isBookingId) {
        query = query.ilike("booking_id", `%${q}%`)
      } else if (isPhone) {
        query = query.like("patient_phone", `%${normalized}%`)
      } else {
        query = query.ilike("patient_name", `%${q}%`)
      }
    }

    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    query = query.range(from, to)

    const { data, error, count } = await query
    if (error) {
      toast.error("Failed to load appointments")
    } else {
      setAppointments((data || []) as Appointment[])
      setTotalCount(count || 0)
    }
    setIsLoading(false)
  }, [tenantId, fromDate, toDate, statusFilter, doctorFilter, searchQuery, page, sortField, sortDir])

  // Initial fetch + refetch on date change
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-refresh every 15 seconds
  useEffect(() => {
    const interval = setInterval(fetchData, 15000)
    return () => clearInterval(interval)
  }, [fetchData])

  // All filtering is now server-side — appointments IS the filtered list
  const filtered = appointments
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const handleCancel = useCallback(
    async (bookingId: string) => {
      try {
        const res = await fetch("/api/booking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "cancel-appointment",
            booking_id: bookingId,
          }),
        })
        const data = await res.json()
        if (data.success || data.status === "cancelled") {
          toast.success("Appointment cancelled")
          fetchData()
        } else {
          toast.error(data.error || "Cancel failed")
        }
      } catch {
        toast.error("Error cancelling appointment")
      }
    },
    [fetchData]
  )

  // Export to CSV
  const exportCSV = useCallback(() => {
    if (filtered.length === 0) {
      toast.error("No data to export")
      return
    }
    setExporting(true)

    const rows: string[][] = [
      [
        "Booking ID", "Date", "Time", "Patient Name", "Patient Phone",
        "Doctor", "Specialty", "Status", "Payment Status",
        "Check-in Status", "Source",
      ],
    ]

    for (const a of filtered) {
      rows.push([
        a.booking_id || "",
        a.date || "",
        a.time || "",
        a.patient_name || "",
        a.patient_phone || "",
        a.doctor_name || "",
        a.specialty || "",
        a.status || "",
        a.payment_status || "",
        a.check_in_status || "",
        a.source || "",
      ])
    }

    const csv = rows
      .map((row) => row.map((cell) => `"${(cell || "").replace(/"/g, '""')}"`).join(","))
      .join("\n")

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `appointments_${fromDate}_to_${toDate}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success("Downloaded successfully")
    setExporting(false)
  }, [filtered, fromDate, toDate])

  // Stats (based on current page data + total count)
  const stats = {
    total: totalCount,
    confirmed: appointments.filter((a) => a.status === "confirmed").length,
    completed: appointments.filter((a) => a.status === "completed").length,
    cancelled: appointments.filter((a) => a.status === "cancelled").length,
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        variant="glass"
        icon={<Calendar className="w-6 h-6" />}
        gradient="gradient-blue"
        title="Appointments"
        subtitle="View and manage all appointments"
        badge={<Badge variant="secondary" className="text-xs">{stats.total}</Badge>}
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
            {filtered.length > 0 && (
              <Button variant="outline" size="sm" onClick={exportCSV} disabled={exporting}>
                {exporting ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-1" />
                )}
                Export
              </Button>
            )}
          </div>
        }
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger-children">
        <StatCard label="Total" value={stats.total} gradient="gradient-blue" icon={<Calendar className="w-10 h-10" />} index={0} />
        <StatCard label="Confirmed" value={stats.confirmed} gradient="gradient-green" icon={<UserCheck className="w-10 h-10" />} index={1} />
        <StatCard label="Completed" value={stats.completed} gradient="gradient-purple" icon={<Clock className="w-10 h-10" />} index={2} />
        <StatCard label="Cancelled" value={stats.cancelled} gradient="gradient-red" icon={<XCircle className="w-10 h-10" />} index={3} />
      </div>

      {/* Filters */}
      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search by name, phone, or booking ID..."
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-[130px] bg-transparent border-0 shadow-none" />
            <span className="text-xs text-muted-foreground">to</span>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-[130px] bg-transparent border-0 shadow-none" />
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
            <Select value={doctorFilter} onValueChange={setDoctorFilter}>
              <SelectTrigger className="w-[140px] bg-transparent border-0 shadow-none">
                <SelectValue placeholder="Doctor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Doctors</SelectItem>
                {doctors.map((d) => (
                  <SelectItem key={d.doctor_id} value={d.doctor_id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
        actions={
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => { const today = getTodayIST(); setFromDate(today); setToDate(today) }}>Today</Button>
            <Button variant="ghost" size="sm" onClick={() => { const today = getTodayIST(); const d = new Date(today + "T00:00:00+05:30"); d.setDate(d.getDate() - 7); setFromDate(d.toISOString().split("T")[0]); setToDate(today) }}>7 Days</Button>
            <Button variant="ghost" size="sm" onClick={() => { const today = getTodayIST(); const d = new Date(today + "T00:00:00+05:30"); d.setDate(d.getDate() - 30); setFromDate(d.toISOString().split("T")[0]); setToDate(today) }}>30 Days</Button>
            {(statusFilter !== "all" || doctorFilter !== "all" || searchQuery) && (
              <Button variant="ghost" size="sm" onClick={() => { setStatusFilter("all"); setDoctorFilter("all"); setSearchQuery(""); setPage(0) }}>Clear</Button>
            )}
          </div>
        }
      />

      {/* Table */}
      <div className="table-container">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer select-none hover:text-foreground transition-colors"
                  onClick={() => {
                    if (sortField === "patient_name") setSortDir(d => d === "asc" ? "desc" : "asc")
                    else { setSortField("patient_name"); setSortDir("asc") }
                  }}
                >
                  <span className="flex items-center gap-1">
                    Patient
                    {sortField === "patient_name" ? (
                      sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30" />
                    )}
                  </span>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:text-foreground transition-colors"
                  onClick={() => {
                    if (sortField === "doctor_name") setSortDir(d => d === "asc" ? "desc" : "asc")
                    else { setSortField("doctor_name"); setSortDir("asc") }
                  }}
                >
                  <span className="flex items-center gap-1">
                    Doctor
                    {sortField === "doctor_name" ? (
                      sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30" />
                    )}
                  </span>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:text-foreground transition-colors"
                  onClick={() => {
                    if (sortField === "date") setSortDir(d => d === "asc" ? "desc" : "asc")
                    else { setSortField("date"); setSortDir("asc") }
                  }}
                >
                  <span className="flex items-center gap-1">
                    Date & Time
                    {sortField === "date" ? (
                      sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30" />
                    )}
                  </span>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:text-foreground transition-colors"
                  onClick={() => {
                    if (sortField === "status") setSortDir(d => d === "asc" ? "desc" : "asc")
                    else { setSortField("status"); setSortDir("asc") }
                  }}
                >
                  <span className="flex items-center gap-1">
                    Status
                    {sortField === "status" ? (
                      sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30" />
                    )}
                  </span>
                </TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                      <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    </motion.div>
                    <p className="font-medium">No appointments found</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      {fromDate === toDate
                        ? `for ${formatDate(fromDate)}`
                        : `from ${formatDate(fromDate)} to ${formatDate(toDate)}`}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((appt) => (
                  <TableRow key={appt.booking_id} className="hover:bg-muted/50 transition-colors">
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{appt.patient_name}</p>
                        <p className="text-xs text-muted-foreground">{formatPhone(appt.patient_phone)}</p>
                        <p className="text-[10px] text-muted-foreground/60 font-mono">{appt.booking_id}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{appt.doctor_name}</p>
                        <p className="text-xs text-muted-foreground">{appt.specialty}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{formatDate(appt.date)}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {appt.time ? formatTime(appt.time) : "—"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusColors[appt.status] || ""}>
                        {humanizeStatus(appt.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={checkInColors[appt.check_in_status || "pending"] || ""}
                      >
                        {humanizeStatus(appt.check_in_status || "pending")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <CreditCard className="w-3 h-3 text-muted-foreground" />
                        <Badge variant="outline" className="text-xs">
                          {humanizeStatus(appt.payment_status || "pending")}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      {appt.status === "confirmed" && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {(!appt.check_in_status || appt.check_in_status === "pending") && (
                              <DropdownMenuItem onClick={() => setCheckInAppt(appt)}>
                                <UserCheck className="w-4 h-4 mr-2 text-green-500" />
                                Check In
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => setAdmitAppt(appt)}>
                              <BedDouble className="w-4 h-4 mr-2 text-orange-500" />
                              Admit (OP → IP)
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setCancelBookingId(appt.booking_id)}
                              className="text-destructive"
                            >
                              <XCircle className="w-4 h-4 mr-2" />
                              Cancel
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount} appointments
          {fromDate === toDate
            ? ` for ${formatDate(fromDate)}`
            : ` from ${formatDate(fromDate)} to ${formatDate(toDate)}`}
        </p>
        <div className="flex items-center gap-2">
          {filtered.length > 0 && (
            <Button variant="ghost" size="sm" onClick={exportCSV} className="text-xs">
              <FileSpreadsheet className="w-3 h-3 mr-1" />
              CSV
            </Button>
          )}
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs text-muted-foreground px-2">
                {page + 1} / {totalPages}
              </span>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <CheckInDialog
        appointment={checkInAppt}
        open={!!checkInAppt}
        onClose={() => { setCheckInAppt(null); fetchData() }}
        tenantId={tenantId}
      />

      {admitAppt && (
        <AdmitDialog
          patientPhone={admitAppt.patient_phone}
          patientName={admitAppt.patient_name}
          doctorId={admitAppt.doctor_id}
          doctorName={admitAppt.doctor_name}
          bookingId={admitAppt.booking_id}
          tenantId={tenantId}
          open={!!admitAppt}
          onClose={() => { setAdmitAppt(null); fetchData() }}
        />
      )}

      <ConfirmDialog
        open={!!cancelBookingId}
        onOpenChange={(open) => { if (!open) setCancelBookingId(null) }}
        title="Cancel Appointment"
        description="Are you sure you want to cancel this appointment? This action cannot be undone and the patient will be notified."
        confirmLabel="Yes, Cancel"
        variant="destructive"
        loading={cancelling}
        onConfirm={async () => {
          if (!cancelBookingId) return
          setCancelling(true)
          await handleCancel(cancelBookingId)
          setCancelling(false)
          setCancelBookingId(null)
        }}
      />
    </div>
  )
}
