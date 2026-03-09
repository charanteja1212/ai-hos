"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useSession } from "next-auth/react"
import { useBranch } from "@/components/providers/branch-context"
import { createBrowserClient } from "@/lib/supabase/client"
import { formatDate } from "@/lib/utils/date"
import { formatPhone } from "@/lib/utils/format"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { motion } from "framer-motion"
import { FileText, Pill, Clock, RefreshCw, Calendar, Activity, Download, Loader2 } from "lucide-react"
import { SectionHeader } from "@/components/shared/section-header"
import { SearchBar } from "@/components/shared/search-bar"
import { PremiumDialog } from "@/components/shared/premium-dialog"
import { StatCard } from "@/components/reception/stat-card"
import { useTenant } from "@/hooks/use-tenant"
import { PrintButton } from "@/components/print/print-button"
import { PrintLayout } from "@/components/print/print-layout"
import { PrescriptionPrint } from "@/components/print/prescription-print"
import { toast } from "sonner"
import type { SessionUser } from "@/types/auth"
import type { Prescription } from "@/types/database"

interface PrescriptionWithName extends Prescription {
  _patient_name?: string
}

export default function PrescriptionsPage() {
  const { data: session } = useSession()
  const user = session?.user as SessionUser | undefined
  const { activeTenantId: tenantId } = useBranch()
  const doctorId = user?.doctorId || ""

  const PAGE_SIZE = 50
  const [prescriptions, setPrescriptions] = useState<PrescriptionWithName[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [selectedRx, setSelectedRx] = useState<PrescriptionWithName | null>(null)
  const [exporting, setExporting] = useState(false)
  const { tenant } = useTenant(tenantId)

  const fetchPrescriptions = useCallback(async () => {
    if (!doctorId) return
    setRefreshing(true)
    const supabase = createBrowserClient()
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = supabase
      .from("prescriptions")
      .select("*", { count: "exact" })
      .eq("doctor_id", doctorId)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })

    if (fromDate) query = query.gte("created_at", `${fromDate}T00:00:00`)
    if (toDate) query = query.lte("created_at", `${toDate}T23:59:59`)

    const { data, count } = await query.range(from, to)
    const rxList = (data || []) as Prescription[]
    setTotalCount(count || 0)

    const uniquePhones = [...new Set(rxList.map((rx) => rx.patient_phone).filter(Boolean))]
    const nameMap: Record<string, string> = {}

    if (uniquePhones.length > 0) {
      const orFilter = uniquePhones.map((p) => `phone.eq.${p}`).join(",")
      const { data: patients } = await supabase
        .from("patients")
        .select("phone, name")
        .eq("tenant_id", tenantId)
        .or(orFilter)
      if (patients) {
        patients.forEach((p: { phone: string; name: string }) => {
          nameMap[p.phone] = p.name
        })
      }
    }

    const withNames: PrescriptionWithName[] = rxList.map((rx) => ({
      ...rx,
      _patient_name: nameMap[rx.patient_phone] || undefined,
    }))

    setPrescriptions(withNames)
    setLoading(false)
    setRefreshing(false)
  }, [doctorId, tenantId, fromDate, toDate, page])

  useEffect(() => {
    fetchPrescriptions()
  }, [fetchPrescriptions])

  useEffect(() => { setPage(0) }, [fromDate, toDate])

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  // Client-side search filter (within the current page)
  const filtered = prescriptions.filter((rx) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      rx.patient_phone?.toLowerCase().includes(q) ||
      rx._patient_name?.toLowerCase().includes(q) ||
      rx.diagnosis?.toLowerCase().includes(q) ||
      rx.items?.some((item) => item.medicine_name.toLowerCase().includes(q))
    )
  })

  const todayStr = new Date().toISOString().split("T")[0]
  const stats = useMemo(() => {
    const today = prescriptions.filter((rx) => rx.created_at?.startsWith(todayStr)).length
    const withFollowUp = prescriptions.filter((rx) => rx.follow_up_date && rx.follow_up_date >= todayStr).length
    return { total: prescriptions.length, today, withFollowUp }
  }, [prescriptions, todayStr])

  const exportCSV = useCallback(() => {
    if (filtered.length === 0) {
      toast.error("No data to export")
      return
    }
    setExporting(true)
    const rows: string[][] = [
      ["Prescription ID", "Date", "Patient Name", "Patient Phone", "Diagnosis", "Symptoms", "Medicines", "Follow-up Date"],
    ]
    for (const rx of filtered) {
      rows.push([
        rx.prescription_id,
        rx.created_at ? new Date(rx.created_at).toLocaleDateString("en-IN") : "",
        rx._patient_name || "",
        rx.patient_phone || "",
        rx.diagnosis || "",
        rx.symptoms || "",
        (rx.items || []).map(i => `${i.medicine_name} ${i.dosage}`).join("; "),
        rx.follow_up_date || "",
      ])
    }
    const csv = rows.map(row => row.map(cell => `"${(cell || "").replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `prescriptions_${todayStr}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success("Downloaded successfully")
    setExporting(false)
  }, [filtered, todayStr])

  const getCardAccent = (createdAt?: string) => {
    if (!createdAt) return "border-l-muted-foreground/20"
    if (createdAt.startsWith(todayStr)) return "border-l-primary"
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0]
    if (createdAt >= weekAgo) return "border-l-green-500"
    return "border-l-muted-foreground/20"
  }

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <Skeleton className="h-20 rounded-2xl" />
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-12 rounded-xl" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <SectionHeader
        variant="glass"
        icon={<FileText className="w-6 h-6" />}
        gradient="gradient-purple"
        title="Prescriptions"
        subtitle="View all prescriptions you've written"
        badge={<Badge variant="secondary" className="text-xs">{stats.total}</Badge>}
        action={
          <Button onClick={exportCSV} disabled={exporting} variant="outline" size="sm" className="gap-2 rounded-xl">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export CSV
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger-children">
        <StatCard label="Total" value={stats.total} gradient="gradient-purple" icon={<FileText className="w-10 h-10" />} index={0} />
        <StatCard label="Today" value={stats.today} gradient="gradient-blue" icon={<Clock className="w-10 h-10" />} index={1} />
        <StatCard label="Pending Follow-ups" value={stats.withFollowUp} gradient="gradient-orange" icon={<Calendar className="w-10 h-10" />} index={2} />
      </div>

      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search by patient, diagnosis, or medicine..."
        filters={
          <div className="flex items-center gap-2">
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-[140px] bg-transparent border-0 shadow-none" />
            <span className="text-xs text-muted-foreground">to</span>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-[140px] bg-transparent border-0 shadow-none" />
          </div>
        }
        actions={
          <Button variant="outline" size="sm" onClick={fetchPrescriptions} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </Button>
        }
      />

      {filtered.length === 0 ? (
        <Card className="card-hover">
          <CardContent className="p-12 text-center text-muted-foreground">
            <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity }}>
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            </motion.div>
            <p className="font-medium">No prescriptions found</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Your prescriptions will appear here</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((rx, idx) => (
            <motion.div key={rx.prescription_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
              <Card
                className={`cursor-pointer card-hover border-l-4 ${getCardAccent(rx.created_at)}`}
                onClick={() => setSelectedRx(rx)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg gradient-purple flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {(rx._patient_name || rx.patient_phone || "?")[0]?.toUpperCase()}
                        </div>
                        <div>
                          <span className="font-medium text-sm">{rx._patient_name || formatPhone(rx.patient_phone)}</span>
                          {rx._patient_name && (
                            <span className="text-xs text-muted-foreground ml-2">{formatPhone(rx.patient_phone)}</span>
                          )}
                        </div>
                        <Badge variant="outline" className="text-[10px]">{rx.prescription_id}</Badge>
                      </div>
                      {rx.diagnosis && <p className="text-sm text-foreground font-medium">{rx.diagnosis}</p>}
                      {rx.symptoms && <p className="text-xs text-muted-foreground">Symptoms: {rx.symptoms}</p>}
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {rx.items?.map((item, i) => (
                          <Badge key={i} variant="secondary" className="text-xs gap-1">
                            <Pill className="w-3 h-3" />
                            {item.medicine_name} {item.dosage && `\u2014 ${item.dosage}`}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-4 space-y-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {rx.created_at ? formatDate(rx.created_at.split("T")[0]) : "\u2014"}
                      </div>
                      {rx.follow_up_date && (
                        <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                          <Calendar className="w-2.5 h-2.5 mr-0.5" />
                          {formatDate(rx.follow_up_date)}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount} prescriptions
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
      ) : (
        <p className="text-xs text-muted-foreground text-right">
          Showing {filtered.length} of {totalCount} prescriptions
        </p>
      )}

      <PremiumDialog
        open={!!selectedRx}
        onOpenChange={() => setSelectedRx(null)}
        title="Prescription Details"
        subtitle={selectedRx?.prescription_id}
        icon={<FileText className="w-5 h-5" />}
        gradient="gradient-purple"
        maxWidth="sm:max-w-lg"
      >
        {selectedRx && (
          <div className="space-y-4">
            <div className="rounded-xl gradient-blue p-4 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-sm font-bold">
                  {(selectedRx._patient_name || "P")[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-sm">{selectedRx._patient_name || "Patient"}</p>
                  <p className="text-xs text-white/70">{formatPhone(selectedRx.patient_phone)}</p>
                </div>
              </div>
              <p className="text-xs text-white/60 mt-2">
                {selectedRx.created_at ? formatDate(selectedRx.created_at.split("T")[0]) : "\u2014"}
              </p>
            </div>

            {selectedRx.vitals && Object.keys(selectedRx.vitals).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" /> Vitals
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(selectedRx.vitals).map(([key, val]) =>
                    val ? <Badge key={key} variant="secondary" className="text-xs">{key}: {String(val)}</Badge> : null
                  )}
                </div>
              </div>
            )}

            {selectedRx.symptoms && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Symptoms</p>
                <p className="text-sm">{selectedRx.symptoms}</p>
              </div>
            )}

            {selectedRx.diagnosis && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Diagnosis</p>
                <p className="text-sm font-medium">{selectedRx.diagnosis}</p>
              </div>
            )}

            {selectedRx.items && selectedRx.items.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider flex items-center gap-1.5">
                  <Pill className="w-3.5 h-3.5" /> Medicines ({selectedRx.items.length})
                </p>
                <div className="space-y-2">
                  {selectedRx.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 border border-border/50">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-md gradient-green flex items-center justify-center text-white text-xs font-bold">{i + 1}</div>
                        <div>
                          <p className="text-sm font-medium">{item.medicine_name}</p>
                          <p className="text-xs text-muted-foreground">{item.dosage}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{item.frequency}</p>
                        <p className="text-xs text-muted-foreground">{item.duration}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedRx.notes && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 p-3">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Doctor&apos;s Notes</p>
                <p className="text-sm">{selectedRx.notes}</p>
              </div>
            )}

            {selectedRx.follow_up_date && (
              <div className="flex items-center gap-2 text-sm font-medium text-primary bg-primary/5 rounded-lg px-3 py-2">
                <Calendar className="w-4 h-4" />
                Follow-up: {formatDate(selectedRx.follow_up_date)}
              </div>
            )}

            {/* Print */}
            <div className="pt-2 border-t border-border">
              <PrintButton
                documentTitle={`Rx-${selectedRx.prescription_id}`}
                label="Print Prescription"
                variant="outline"
                size="sm"
                className="w-full rounded-xl"
              >
                <PrintLayout tenant={tenant} title="Prescription" subtitle={selectedRx.prescription_id}>
                  <PrescriptionPrint prescription={{ ...selectedRx, patient_name: selectedRx._patient_name || selectedRx.patient_phone }} />
                </PrintLayout>
              </PrintButton>
            </div>
          </div>
        )}
      </PremiumDialog>
    </div>
  )
}
