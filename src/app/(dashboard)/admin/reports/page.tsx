"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useSession } from "next-auth/react"
import { useBranch } from "@/components/providers/branch-context"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { createBrowserClient } from "@/lib/supabase/client"
import { getTodayIST } from "@/lib/utils/date"
import { formatCurrency } from "@/lib/utils/format"
import { SectionHeader } from "@/components/shared/section-header"
import { DownloadPdfButton } from "@/components/print/download-pdf-button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import {
  FileText, Download, Calendar, IndianRupee, Users, Stethoscope,
  BarChart3, RefreshCw, FileSpreadsheet,
} from "lucide-react"

type ReportType = "daily-collection" | "appointments" | "patients" | "revenue"
interface ReportCard { id: ReportType; title: string; description: string; icon: React.ReactNode; gradient: string }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReportRow = Record<string, any>

function downloadCSV(rows: ReportRow[], columns: string[], filename: string) {
  if (rows.length === 0) { toast.error("No data to export"); return }
  const header = columns.join(",")
  const body = rows.map(r =>
    columns.map(c => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(",")
  ).join("\n")
  const csv = "\uFEFF" + header + "\n" + body
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  toast.success("CSV downloaded")
}

const REPORTS: ReportCard[] = [
  { id: "daily-collection", title: "Daily Collection", description: "Today's billing summary by payment status", icon: <IndianRupee className="w-5 h-5" />, gradient: "gradient-green" },
  { id: "appointments", title: "Appointment Report", description: "Appointments grouped by doctor & status", icon: <Stethoscope className="w-5 h-5" />, gradient: "gradient-blue" },
  { id: "patients", title: "Patient Report", description: "Registered patients and visit counts", icon: <Users className="w-5 h-5" />, gradient: "gradient-purple" },
  { id: "revenue", title: "Revenue Report", description: "Monthly revenue breakdown", icon: <BarChart3 className="w-5 h-5" />, gradient: "gradient-orange" },
]

export default function ReportsPage() {
  const { data: session } = useSession()
  const { activeTenantId: tenantId } = useBranch()

  const today = getTodayIST()
  const [fromDate, setFromDate] = useState(today)
  const [toDate, setToDate] = useState(today)
  const [activeReport, setActiveReport] = useState<ReportType | null>(null)
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<ReportRow[]>([])
  const [columns, setColumns] = useState<string[]>([])

  useEffect(() => { setRows([]); setColumns([]) }, [activeReport])

  const fetchDailyCollection = useCallback(async () => {
    const supabase = createBrowserClient()
    const { data, error } = await supabase
      .from("invoices")
      .select("invoice_id, patient_name, type, total, payment_status, created_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", fromDate + "T00:00:00")
      .lte("created_at", toDate + "T23:59:59")
      .order("created_at", { ascending: false })
    if (error) { toast.error("Failed to fetch collection data"); return }
    const paid = (data || []).filter(i => i.payment_status === "paid")
    const unpaid = (data || []).filter(i => i.payment_status === "unpaid")
    const partial = (data || []).filter(i => i.payment_status === "partial")
    const summary: ReportRow[] = [
      { Status: "Paid", Count: paid.length, Amount: formatCurrency(paid.reduce((s, i) => s + (i.total || 0), 0)) },
      { Status: "Unpaid", Count: unpaid.length, Amount: formatCurrency(unpaid.reduce((s, i) => s + (i.total || 0), 0)) },
      { Status: "Partial", Count: partial.length, Amount: formatCurrency(partial.reduce((s, i) => s + (i.total || 0), 0)) },
      { Status: "Total", Count: (data || []).length, Amount: formatCurrency((data || []).reduce((s, i) => s + (i.total || 0), 0)) },
    ]
    setColumns(["Status", "Count", "Amount"])
    setRows(summary)
  }, [tenantId, fromDate, toDate])

  const fetchAppointments = useCallback(async () => {
    const supabase = createBrowserClient()
    const { data, error } = await supabase
      .from("appointments")
      .select("appointment_id, patient_name, doctor_name, specialty, status, date, time")
      .eq("tenant_id", tenantId)
      .gte("date", fromDate)
      .lte("date", toDate)
      .order("date", { ascending: false })
    if (error) { toast.error("Failed to fetch appointments"); return }
    // Group by doctor + status
    const grouped: Record<string, { Doctor: string; Specialty: string; Confirmed: number; Completed: number; Cancelled: number; "No Show": number; Total: number }> = {}
    for (const a of data || []) {
      const key = a.doctor_name || "Unknown"
      if (!grouped[key]) grouped[key] = { Doctor: key, Specialty: a.specialty || "", Confirmed: 0, Completed: 0, Cancelled: 0, "No Show": 0, Total: 0 }
      grouped[key].Total++
      if (a.status === "confirmed") grouped[key].Confirmed++
      else if (a.status === "completed") grouped[key].Completed++
      else if (a.status === "cancelled") grouped[key].Cancelled++
      else if (a.status === "no_show") grouped[key]["No Show"]++
    }
    setColumns(["Doctor", "Specialty", "Confirmed", "Completed", "Cancelled", "No Show", "Total"])
    setRows(Object.values(grouped))
  }, [tenantId, fromDate, toDate])

  const fetchPatients = useCallback(async () => {
    const supabase = createBrowserClient()
    const { data, error } = await supabase
      .from("patients")
      .select("phone, name, gender, age, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
    if (error) { toast.error("Failed to fetch patients"); return }
    const all = data || []
    const inRange = all.filter(p => {
      const d = (p.created_at || "").split("T")[0]
      return d >= fromDate && d <= toDate
    })
    const summary: ReportRow[] = [
      { Metric: "Total Registered Patients", Value: all.length },
      { Metric: `New Patients (${fromDate} to ${toDate})`, Value: inRange.length },
      { Metric: "Male", Value: all.filter(p => p.gender === "Male").length },
      { Metric: "Female", Value: all.filter(p => p.gender === "Female").length },
      { Metric: "Other / Unknown", Value: all.filter(p => !p.gender || (p.gender !== "Male" && p.gender !== "Female")).length },
    ]
    setColumns(["Metric", "Value"])
    setRows(summary)
  }, [tenantId, fromDate, toDate])

  const fetchRevenue = useCallback(async () => {
    const supabase = createBrowserClient()
    const { data, error } = await supabase
      .from("invoices")
      .select("total, payment_status, type, created_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", fromDate + "T00:00:00")
      .lte("created_at", toDate + "T23:59:59")
    if (error) { toast.error("Failed to fetch revenue data"); return }
    // Group by month
    const monthly: Record<string, { Month: string; Consultation: number; Pharmacy: number; Lab: number; Other: number; Total: number }> = {}
    for (const inv of data || []) {
      if (inv.payment_status !== "paid") continue
      const d = new Date(inv.created_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      const label = d.toLocaleDateString("en-IN", { month: "long", year: "numeric" })
      if (!monthly[key]) monthly[key] = { Month: label, Consultation: 0, Pharmacy: 0, Lab: 0, Other: 0, Total: 0 }
      const amt = inv.total || 0
      if (inv.type === "consultation") monthly[key].Consultation += amt
      else if (inv.type === "pharmacy") monthly[key].Pharmacy += amt
      else if (inv.type === "lab") monthly[key].Lab += amt
      else monthly[key].Other += amt
      monthly[key].Total += amt
    }
    const sorted = Object.entries(monthly).sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => ({
      ...v,
      Consultation: formatCurrency(v.Consultation),
      Pharmacy: formatCurrency(v.Pharmacy),
      Lab: formatCurrency(v.Lab),
      Other: formatCurrency(v.Other),
      Total: formatCurrency(v.Total),
    }))
    setColumns(["Month", "Consultation", "Pharmacy", "Lab", "Other", "Total"])
    setRows(sorted)
  }, [tenantId, fromDate, toDate])

  const generate = useCallback(async () => {
    if (!activeReport) return
    setLoading(true)
    try {
      if (activeReport === "daily-collection") await fetchDailyCollection()
      else if (activeReport === "appointments") await fetchAppointments()
      else if (activeReport === "patients") await fetchPatients()
      else if (activeReport === "revenue") await fetchRevenue()
    } finally {
      setLoading(false)
    }
  }, [activeReport, fetchDailyCollection, fetchAppointments, fetchPatients, fetchRevenue])

  const csvFilename = useMemo(() => `${activeReport || "report"}_${fromDate}_to_${toDate}.csv`, [activeReport, fromDate, toDate])
  const reportTitle = REPORTS.find(r => r.id === activeReport)?.title || "Report"

  const printContent = useMemo(() => (
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ marginBottom: 4 }}>{reportTitle}</h2>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 16 }}>{fromDate} to {toDate}</p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>{columns.map(c => <th key={c} style={{ borderBottom: "2px solid #ddd", padding: "6px 8px", textAlign: "left" }}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{columns.map(c => <td key={c} style={{ borderBottom: "1px solid #eee", padding: "6px 8px" }}>{String(r[c] ?? "")}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  ), [rows, columns, reportTitle, fromDate, toDate])

  return (
    <div className="space-y-6">
      {/* Header */}
      <SectionHeader
        title="Reports & Export"
        subtitle="Generate, preview, and download hospital reports"
        icon={<FileText className="w-6 h-6" />}
        gradient="gradient-green"
        variant="glass"
        action={
          activeReport && rows.length > 0 ? (
            <div className="flex items-center gap-2">
              <DownloadPdfButton documentTitle={`${reportTitle}-${fromDate}-to-${toDate}`} label="Save PDF" size="sm" className="rounded-xl">
                {printContent}
              </DownloadPdfButton>
              <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={() => downloadCSV(rows, columns, csvFilename)}>
                <FileSpreadsheet className="w-4 h-4" /> CSV
              </Button>
            </div>
          ) : undefined
        }
      />

      {/* Date Range Picker */}
      <Card className="rounded-2xl">
        <CardContent className="pt-5">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">From</Label>
              <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-[160px] rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">To</Label>
              <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-[160px] rounded-xl" />
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 rounded-xl h-9" onClick={() => { setFromDate(today); setToDate(today) }}>
              <Calendar className="w-3.5 h-3.5" /> Today
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 rounded-xl h-9" onClick={() => {
              const d = new Date(today); d.setDate(d.getDate() - 29)
              setFromDate(d.toISOString().split("T")[0]); setToDate(today)
            }}>
              Last 30 Days
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 rounded-xl h-9" onClick={() => {
              const d = new Date(today); d.setMonth(d.getMonth(), 1)
              setFromDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`); setToDate(today)
            }}>
              This Month
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Reports Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {REPORTS.map((report, idx) => (
          <motion.div
            key={report.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.07 }}
          >
            <Card
              className={cn(
                "card-hover rounded-2xl cursor-pointer transition-all border-2",
                activeReport === report.id ? "border-primary ring-1 ring-primary/20" : "border-transparent",
              )}
              onClick={() => setActiveReport(report.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0", report.gradient)}>
                    {report.icon}
                  </div>
                  <CardTitle className="text-sm font-semibold">{report.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{report.description}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Generate Button */}
      {activeReport && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3">
          <Button onClick={generate} disabled={loading} className="gap-2 rounded-xl">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
            Generate {REPORTS.find(r => r.id === activeReport)?.title}
          </Button>
          <Badge variant="secondary" className="text-xs">
            {fromDate} &mdash; {toDate}
          </Badge>
        </motion.div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-10 rounded-xl" />
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 rounded-lg" />)}
        </div>
      )}

      {/* Report Preview Table */}
      {!loading && rows.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="rounded-2xl overflow-hidden">
            <CardHeader className="pb-2 flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                {reportTitle} Preview
              </CardTitle>
              <div className="flex items-center gap-2">
                <DownloadPdfButton documentTitle={`${reportTitle}-${fromDate}-to-${toDate}`} label="PDF" size="sm" variant="ghost" className="h-7 text-xs rounded-lg">
                  {printContent}
                </DownloadPdfButton>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 rounded-lg" onClick={() => downloadCSV(rows, columns, csvFilename)}>
                  <Download className="w-3 h-3" /> CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map(col => (
                      <TableHead key={col}>{col}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => (
                    <motion.tr
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-border/50 hover:bg-accent/30 transition-colors"
                    >
                      {columns.map(col => (
                        <TableCell key={col} className="text-sm">
                          {String(row[col] ?? "")}
                        </TableCell>
                      ))}
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Empty state */}
      {!loading && activeReport && rows.length === 0 && (
        <Card className="rounded-2xl">
          <CardContent className="py-16 text-center">
            <FileText className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              Select a report above and click <strong>Generate</strong> to preview data
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
