"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useBranch } from "@/components/providers/branch-context"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { createBrowserClient } from "@/lib/supabase/client"
import { getTodayIST } from "@/lib/utils/date"
import { humanizeStatus, formatPhone, formatCurrency } from "@/lib/utils/format"
import { StatCard } from "@/components/reception/stat-card"
import { SectionHeader } from "@/components/shared/section-header"
import { SearchBar } from "@/components/shared/search-bar"
import { PremiumDialog } from "@/components/shared/premium-dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  LazyLineChart as LineChart,
  LazyPieChart as PieChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Pie,
  Cell,
} from "@/components/ui/lazy-recharts"
import dynamic from "next/dynamic"
const Legend = dynamic(() => import("recharts").then((mod) => mod.Legend), { ssr: false })
import {
  Receipt,
  IndianRupee,
  Stethoscope,
  Pill,
  TestTube,
  Download,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  FileText,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { useTenant } from "@/hooks/use-tenant"
import { PrintButton } from "@/components/print/print-button"
import { PrintLayout } from "@/components/print/print-layout"
import { InvoicePrint } from "@/components/print/invoice-print"
import { AnalyticsReportPrint } from "@/components/print/analytics-report-print"
import type { Invoice } from "@/types/database"

// Badge color maps
const TYPE_BADGE: Record<string, string> = {
  consultation: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  pharmacy: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  lab: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  admission: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  procedure: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
}

const TYPE_LABEL: Record<string, string> = {
  consultation: "Consultation",
  pharmacy: "Pharmacy",
  lab: "Lab",
  admission: "Admission",
  procedure: "Procedure",
}

const PAYMENT_BADGE: Record<string, string> = {
  paid: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  unpaid: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  partial: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
}

const PAYMENT_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  paid: CheckCircle2,
  unpaid: AlertCircle,
  partial: Clock,
}

const PIE_COLORS = ["#3b82f6", "#14b8a6", "#f97316", "#a855f7", "#ec4899"]

// Date range presets
function getDateRange(preset: string): { from: string; to: string } {
  const today = getTodayIST()
  const d = new Date(today + "T00:00:00")
  switch (preset) {
    case "today":
      return { from: today, to: today }
    case "7d": {
      const from = new Date(d)
      from.setDate(from.getDate() - 6)
      return { from: from.toISOString().split("T")[0], to: today }
    }
    case "30d": {
      const from = new Date(d)
      from.setDate(from.getDate() - 29)
      return { from: from.toISOString().split("T")[0], to: today }
    }
    default:
      return { from: today, to: today }
  }
}

export default function BillingPage() {
  const { activeTenantId: tenantId } = useBranch()

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [datePreset, setDatePreset] = useState("30d")
  const [typeFilter, setTypeFilter] = useState("all")
  const [paymentFilter, setPaymentFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [updatingPayment, setUpdatingPayment] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkConfirm, setBulkConfirm] = useState(false)
  const [bulkAction, setBulkAction] = useState<string>("")

  const { tenant } = useTenant(tenantId)
  const { from: fromDate, to: toDate } = useMemo(() => getDateRange(datePreset), [datePreset])

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    const supabase = createBrowserClient()
    const { data } = await supabase
      .from("invoices")
      .select("*")
      .eq("tenant_id", tenantId)
      .gte("created_at", fromDate + "T00:00:00")
      .lte("created_at", toDate + "T23:59:59")
      .order("created_at", { ascending: false })
    setInvoices((data || []) as Invoice[])
    setLoading(false)
  }, [tenantId, fromDate, toDate])

  useEffect(() => { fetchInvoices() }, [fetchInvoices])

  // Filtered invoices
  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      if (typeFilter !== "all" && inv.type !== typeFilter) return false
      if (paymentFilter !== "all" && inv.payment_status !== paymentFilter) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        return (
          inv.invoice_id.toLowerCase().includes(q) ||
          (inv.patient_name || "").toLowerCase().includes(q) ||
          (inv.patient_phone || "").toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [invoices, typeFilter, paymentFilter, searchQuery])

  // Stats
  const stats = useMemo(() => {
    const paid = invoices.filter(i => i.payment_status === "paid")
    const totalRevenue = paid.reduce((s, i) => s + (i.total || 0), 0)
    const consultationRev = paid.filter(i => i.type === "consultation").reduce((s, i) => s + (i.total || 0), 0)
    const pharmacyRev = paid.filter(i => i.type === "pharmacy").reduce((s, i) => s + (i.total || 0), 0)
    const labRev = paid.filter(i => i.type === "lab").reduce((s, i) => s + (i.total || 0), 0)
    return { totalRevenue, consultationRev, pharmacyRev, labRev, totalInvoices: invoices.length }
  }, [invoices])

  // Chart data: daily revenue trend (last 7 days from range)
  const trendData = useMemo(() => {
    const days: string[] = []
    const d = new Date(toDate + "T00:00:00")
    for (let i = 6; i >= 0; i--) {
      const day = new Date(d)
      day.setDate(day.getDate() - i)
      days.push(day.toISOString().split("T")[0])
    }
    return days.map(date => {
      const dayLabel = new Date(date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short" })
      const dayInvoices = invoices.filter(inv => inv.created_at?.startsWith(date) && inv.payment_status === "paid")
      const consultation = dayInvoices.filter(i => i.type === "consultation").reduce((s, i) => s + (i.total || 0), 0)
      const pharmacy = dayInvoices.filter(i => i.type === "pharmacy").reduce((s, i) => s + (i.total || 0), 0)
      const lab = dayInvoices.filter(i => i.type === "lab").reduce((s, i) => s + (i.total || 0), 0)
      return { day: dayLabel, consultation, pharmacy, lab, total: consultation + pharmacy + lab }
    })
  }, [invoices, toDate])

  // Pie chart: revenue by type
  const pieData = useMemo(() => {
    const data = [
      { name: "Consultation", value: stats.consultationRev, color: PIE_COLORS[0] },
      { name: "Pharmacy", value: stats.pharmacyRev, color: PIE_COLORS[1] },
      { name: "Lab", value: stats.labRev, color: PIE_COLORS[2] },
    ].filter(d => d.value > 0)
    return data
  }, [stats])

  // Sparklines for stat cards
  const sparklines = useMemo(() => {
    const days: string[] = []
    const d = new Date(toDate + "T00:00:00")
    for (let i = 6; i >= 0; i--) {
      const day = new Date(d)
      day.setDate(day.getDate() - i)
      days.push(day.toISOString().split("T")[0])
    }
    const total = days.map(date => invoices.filter(i => i.created_at?.startsWith(date) && i.payment_status === "paid").reduce((s, i) => s + (i.total || 0), 0))
    const consultation = days.map(date => invoices.filter(i => i.created_at?.startsWith(date) && i.type === "consultation" && i.payment_status === "paid").reduce((s, i) => s + (i.total || 0), 0))
    const pharmacy = days.map(date => invoices.filter(i => i.created_at?.startsWith(date) && i.type === "pharmacy" && i.payment_status === "paid").reduce((s, i) => s + (i.total || 0), 0))
    const lab = days.map(date => invoices.filter(i => i.created_at?.startsWith(date) && i.type === "lab" && i.payment_status === "paid").reduce((s, i) => s + (i.total || 0), 0))
    return { total, consultation, pharmacy, lab }
  }, [invoices, toDate])

  // Update payment status
  const updatePaymentStatus = useCallback(async (invoiceId: string, newStatus: string) => {
    setUpdatingPayment(true)
    const supabase = createBrowserClient()
    const { error } = await supabase
      .from("invoices")
      .update({ payment_status: newStatus })
      .eq("invoice_id", invoiceId)
      .eq("tenant_id", tenantId)

    if (error) {
      toast.error("Failed to update payment status")
    } else {
      toast.success(`Invoice marked as ${newStatus}`)
      // Update local state
      setInvoices(prev => prev.map(inv =>
        inv.invoice_id === invoiceId ? { ...inv, payment_status: newStatus as Invoice["payment_status"] } : inv
      ))
      if (selectedInvoice?.invoice_id === invoiceId) {
        setSelectedInvoice(prev => prev ? { ...prev, payment_status: newStatus as Invoice["payment_status"] } : null)
      }
    }
    setUpdatingPayment(false)
  }, [selectedInvoice, tenantId])

  // Export CSV
  const exportCSV = useCallback(() => {
    if (filtered.length === 0) {
      toast.error("No data to export")
      return
    }
    setExporting(true)

    const rows: string[][] = [
      ["Invoice ID", "Date", "Patient Name", "Patient Phone", "Type", "Items", "Subtotal", "Tax", "Discount", "Total", "Payment Status"],
    ]

    for (const inv of filtered) {
      rows.push([
        inv.invoice_id,
        inv.created_at ? new Date(inv.created_at).toLocaleDateString("en-IN") : "",
        inv.patient_name || "",
        inv.patient_phone || "",
        TYPE_LABEL[inv.type] || inv.type,
        String(inv.items?.length || 0),
        String(inv.subtotal || 0),
        String(inv.tax || 0),
        String(inv.discount || 0),
        String(inv.total || 0),
        inv.payment_status,
      ])
    }

    const csv = rows
      .map((row) => row.map((cell) => `"${(cell || "").replace(/"/g, '""')}"`).join(","))
      .join("\n")

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `invoices_${fromDate}_to_${toDate}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success("Downloaded successfully")
    setExporting(false)
  }, [filtered, fromDate, toDate])

  // Bulk operations
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map(i => i.invoice_id)))
    }
  }

  const executeBulkAction = useCallback(async () => {
    if (selectedIds.size === 0 || !bulkAction) return
    setUpdatingPayment(true)
    const supabase = createBrowserClient()
    const ids = Array.from(selectedIds)

    const { error } = await supabase
      .from("invoices")
      .update({ payment_status: bulkAction })
      .in("invoice_id", ids)
      .eq("tenant_id", tenantId)

    if (error) {
      toast.error("Failed to update invoices")
    } else {
      toast.success(`${ids.length} invoices marked as ${bulkAction}`)
      setInvoices(prev => prev.map(inv =>
        ids.includes(inv.invoice_id) ? { ...inv, payment_status: bulkAction as Invoice["payment_status"] } : inv
      ))
      setSelectedIds(new Set())
    }
    setUpdatingPayment(false)
    setBulkConfirm(false)
    setBulkAction("")
  }, [selectedIds, bulkAction, tenantId])

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 rounded-2xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <SectionHeader
        title="Billing & Invoices"
        subtitle="Track revenue, manage invoices, and update payment status"
        icon={<Receipt className="w-6 h-6" />}
        gradient="gradient-green"
        variant="glass"
        badge={
          <Badge variant="secondary" className="text-xs">
            {stats.totalInvoices} invoices
          </Badge>
        }
        action={
          <div className="flex items-center gap-2">
            <PrintButton
              documentTitle={`Revenue-Report-${fromDate}-to-${toDate}`}
              label="Print Report"
              variant="outline"
              size="sm"
              className="rounded-xl"
            >
              <PrintLayout tenant={tenant} title="Revenue Report" subtitle={`${fromDate} to ${toDate}`}>
                <AnalyticsReportPrint invoices={filtered} fromDate={fromDate} toDate={toDate} />
              </PrintLayout>
            </PrintButton>
            <Button onClick={exportCSV} disabled={exporting} className="gap-2 rounded-xl">
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Export CSV
            </Button>
          </div>
        }
      />

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Total Revenue"
          value={formatCurrency(stats.totalRevenue)}
          icon={<IndianRupee className="w-10 h-10" />}
          gradient="gradient-green"
          index={0}
          sparklineData={sparklines.total}
        />
        <StatCard
          label="Consultation"
          value={formatCurrency(stats.consultationRev)}
          icon={<Stethoscope className="w-10 h-10" />}
          gradient="gradient-blue"
          index={1}
          sparklineData={sparklines.consultation}
        />
        <StatCard
          label="Pharmacy"
          value={formatCurrency(stats.pharmacyRev)}
          icon={<Pill className="w-10 h-10" />}
          gradient="gradient-teal"
          index={2}
          sparklineData={sparklines.pharmacy}
        />
        <StatCard
          label="Lab"
          value={formatCurrency(stats.labRev)}
          icon={<TestTube className="w-10 h-10" />}
          gradient="gradient-orange"
          index={3}
          sparklineData={sparklines.lab}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue Trend */}
        <Card className="glass rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Revenue Trend (7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <RechartsTooltip
                  contentStyle={{ borderRadius: 12, fontSize: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                  formatter={(value) => [formatCurrency(Number(value || 0))]}
                />
                <Line type="monotone" dataKey="consultation" stroke="#3b82f6" strokeWidth={2} dot={false} name="Consultation" />
                <Line type="monotone" dataKey="pharmacy" stroke="#14b8a6" strokeWidth={2} dot={false} name="Pharmacy" />
                <Line type="monotone" dataKey="lab" stroke="#f97316" strokeWidth={2} dot={false} name="Lab" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Revenue by Type */}
        <Card className="glass rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Revenue by Type</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="flex items-center justify-center h-[220px] text-muted-foreground text-sm">
                No paid invoices in this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  >
                    {pieData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(value) => [formatCurrency(Number(value || 0))]}
                    contentStyle={{ borderRadius: 12, fontSize: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={datePreset} onValueChange={setDatePreset}>
          <SelectTrigger className="w-[140px] rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px] rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="consultation">Consultation</SelectItem>
            <SelectItem value="pharmacy">Pharmacy</SelectItem>
            <SelectItem value="lab">Lab</SelectItem>
            <SelectItem value="admission">Admission</SelectItem>
          </SelectContent>
        </Select>

        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="w-[140px] rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex-1 min-w-[200px]">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by invoice ID, patient name, or phone..."
          />
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-3 flex items-center gap-3">
          <Badge variant="secondary" className="text-xs">{selectedIds.size} selected</Badge>
          <Button size="sm" className="h-7 text-xs rounded-lg gap-1" onClick={() => { setBulkAction("paid"); setBulkConfirm(true) }}>
            <CheckCircle2 className="w-3 h-3" /> Mark Paid
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs rounded-lg gap-1" onClick={() => { setBulkAction("unpaid"); setBulkConfirm(true) }}>
            <AlertCircle className="w-3 h-3" /> Mark Unpaid
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs rounded-lg ml-auto" onClick={() => setSelectedIds(new Set())}>
            Clear
          </Button>
        </motion.div>
      )}

      {/* Invoice Table */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl overflow-hidden"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={filtered.length > 0 && selectedIds.size === filtered.length}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Invoice ID</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="hidden sm:table-cell">Items</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                  {searchQuery || typeFilter !== "all" || paymentFilter !== "all"
                    ? "No invoices matching your filters"
                    : "No invoices found in this period"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((inv, idx) => {
                const PayIcon = PAYMENT_ICON[inv.payment_status] || AlertCircle
                return (
                  <motion.tr
                    key={inv.invoice_id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    className={cn("group border-b border-border/50 hover:bg-accent/30 transition-colors cursor-pointer", selectedIds.has(inv.invoice_id) && "bg-primary/5")}
                    onClick={() => setSelectedInvoice(inv)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(inv.invoice_id)}
                        onCheckedChange={() => toggleSelect(inv.invoice_id)}
                      />
                    </TableCell>
                    <TableCell>
                      <code className="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                        {inv.invoice_id}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{inv.patient_name || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{formatPhone(inv.patient_phone)}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={cn("text-xs", TYPE_BADGE[inv.type] || "")}>
                        {TYPE_LABEL[inv.type] || inv.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="text-sm text-muted-foreground">{inv.items?.length || 0} items</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-semibold text-sm">{formatCurrency(inv.total)}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={cn("text-xs gap-1", PAYMENT_BADGE[inv.payment_status] || "")}>
                        <PayIcon className="w-3 h-3" />
                        {humanizeStatus(inv.payment_status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-xs text-muted-foreground">
                        {inv.created_at ? new Date(inv.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {inv.payment_status !== "paid" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation()
                            updatePaymentStatus(inv.invoice_id, "paid")
                          }}
                        >
                          Mark Paid
                        </Button>
                      )}
                    </TableCell>
                  </motion.tr>
                )
              })
            )}
          </TableBody>
        </Table>
      </motion.div>

      {/* Invoice Detail Dialog */}
      <PremiumDialog
        open={!!selectedInvoice}
        onOpenChange={(open) => { if (!open) setSelectedInvoice(null) }}
        title="Invoice Details"
        subtitle={selectedInvoice ? `${selectedInvoice.invoice_id}` : ""}
        icon={<FileText className="w-5 h-5" />}
        gradient="gradient-green"
      >
        {selectedInvoice && (
          <div className="space-y-5">
            {/* Patient Info */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{selectedInvoice.patient_name || "Unknown Patient"}</p>
                <p className="text-sm text-muted-foreground">{formatPhone(selectedInvoice.patient_phone)}</p>
              </div>
              <div className="text-right">
                <Badge variant="secondary" className={cn("text-xs", TYPE_BADGE[selectedInvoice.type] || "")}>
                  {TYPE_LABEL[selectedInvoice.type] || selectedInvoice.type}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedInvoice.created_at ? new Date(selectedInvoice.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : ""}
                </p>
              </div>
            </div>

            {/* Line Items */}
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(selectedInvoice.items || []).map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-sm">{item.description}</TableCell>
                      <TableCell className="text-center text-sm">{item.quantity}</TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(item.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Totals */}
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(selectedInvoice.subtotal)}</span>
              </div>
              {(selectedInvoice.tax || 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{formatCurrency(selectedInvoice.tax)}</span>
                </div>
              )}
              {(selectedInvoice.discount || 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="text-green-600">-{formatCurrency(selectedInvoice.discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base pt-2 border-t border-border">
                <span>Total</span>
                <span>{formatCurrency(selectedInvoice.total)}</span>
              </div>
            </div>

            {/* Payment Actions */}
            <div className="flex items-center gap-2 pt-2">
              <span className="text-sm text-muted-foreground mr-auto">Payment Status:</span>
              {(["unpaid", "partial", "paid"] as const).map((status) => {
                const isActive = selectedInvoice.payment_status === status
                const StatusIcon = PAYMENT_ICON[status] || AlertCircle
                return (
                  <Button
                    key={status}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    className={cn("gap-1.5 rounded-lg text-xs", isActive && PAYMENT_BADGE[status])}
                    disabled={updatingPayment || isActive}
                    onClick={() => updatePaymentStatus(selectedInvoice.invoice_id, status)}
                  >
                    {updatingPayment ? <Loader2 className="w-3 h-3 animate-spin" /> : <StatusIcon className="w-3 h-3" />}
                    {humanizeStatus(status)}
                  </Button>
                )
              })}
            </div>

            {/* Print */}
            <div className="pt-2 border-t border-border">
              <PrintButton
                documentTitle={`Invoice-${selectedInvoice.invoice_id}`}
                label="Print Invoice"
                variant="outline"
                size="sm"
                className="w-full rounded-xl"
              >
                <PrintLayout tenant={tenant} title="Invoice" subtitle={selectedInvoice.invoice_id}>
                  <InvoicePrint invoice={selectedInvoice} />
                </PrintLayout>
              </PrintButton>
            </div>

            {/* Booking reference */}
            {selectedInvoice.booking_id && (
              <p className="text-xs text-muted-foreground">
                Linked to booking: <code className="bg-muted/50 px-1 py-0.5 rounded">{selectedInvoice.booking_id}</code>
              </p>
            )}
          </div>
        )}
      </PremiumDialog>

      <ConfirmDialog
        open={bulkConfirm}
        onOpenChange={setBulkConfirm}
        title={`Bulk Update — Mark as ${bulkAction}`}
        description={`This will update ${selectedIds.size} invoice(s) to "${bulkAction}" status. Continue?`}
        confirmLabel={`Mark ${selectedIds.size} as ${bulkAction}`}
        onConfirm={executeBulkAction}
        loading={updatingPayment}
      />
    </div>
  )
}
